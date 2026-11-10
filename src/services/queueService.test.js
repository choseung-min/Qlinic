import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { SourceTextModule, SyntheticModule } from "node:vm";
import * as eligibility from "../utils/walkInEligibility.js";

const today = "2026-11-10";
const patientId = "patient-1";
const walkInId = `walkin_${patientId}_${today}`;

async function setup({ visits = [], appointments = [], beforeTransaction, isOpen = () => true } = {}) {
  const documents = new Map();
  for (const visit of visits) documents.set(`visits/${visit.id}`, { patientId, visitDate: today, visitType: "walk-in", ...visit });
  for (const appointment of appointments) documents.set(`appointments/${appointment.id}`, { patientId, appointmentDate: today, ...appointment });
  const writes = [];
  const snapshot = (path) => ({
    id: path.split("/")[1],
    exists: documents.has(path),
    data: () => documents.get(path),
  });
  function collection(name, filters = []) {
    return {
      where(field, operator, value) {
        assert.equal(operator, "==");
        return collection(name, [...filters, [field, value]]);
      },
      doc(id) { return { path: `${name}/${id}`, id }; },
      async get() {
        return { docs: [...documents].filter(([path, data]) =>
          path.startsWith(`${name}/`) && filters.every(([field, value]) => data[field] === value),
        ).map(([path]) => snapshot(path)) };
      },
    };
  }
  const db = {
    collection,
    async runTransaction(callback) {
      beforeTransaction?.(documents);
      return callback({
        get: async (ref) => snapshot(ref.path),
        set(ref, data) { writes.push([ref.path, data]); documents.set(ref.path, data); },
        delete(ref) { writes.push([ref.path, null]); documents.delete(ref.path); },
      });
    },
  };
  const dependencies = {
    "firebase/compat/app": { default: { firestore: { FieldValue: { serverTimestamp: () => "timestamp" } } } },
    "firebase/compat/firestore": {},
    "@/services/firebase": { db },
    "@/services/doctorService": { getActiveDoctors: async () => [] },
    "@/utils/clinicHours": { getClinicDate: () => today, isClinicOpen: isOpen },
    "@/utils/walkInEligibility": eligibility,
  };
  const module = new SourceTextModule(await readFile(new URL("./queueService.js", import.meta.url), "utf8"));
  await module.link((specifier) => {
    const exports = dependencies[specifier];
    assert.ok(exports, `Unexpected dependency: ${specifier}`);
    return new SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    });
  });
  await module.evaluate();
  return { service: module.namespace, documents, writes };
}

test("repeated joins return the existing queue entry without writes", async () => {
  const { service, writes } = await setup({ visits: [{ id: walkInId, visitStatus: "Waiting", queueNumber: 1 }] });
  const result = await service.joinWalkInQueue(patientId);
  assert.equal(result.alreadyJoined, true);
  assert.equal(result.queueNumber, 1);
  assert.equal(writes.length, 0);
});

test("consultation, medicine and completed visits cannot be overwritten", async () => {
  for (const visitStatus of ["In Consultation", "Awaiting Medicine", "Awaiting Medicine Collection", "Ready for Collection", "Completed"]) {
    const { service, writes, documents } = await setup({ visits: [{ id: walkInId, visitStatus }] });
    await assert.rejects(service.joinWalkInQueue(patientId), {
      code: visitStatus === "Completed" ? "visit-completed-today" : "already-in-queue",
    });
    assert.equal(writes.length, 0);
    assert.equal(documents.get(`visits/${walkInId}`).visitStatus, visitStatus);
  }
});

test("another active visit or a completed staff-registered walk-in blocks entry", async () => {
  for (const [visitType, visitStatus, code] of [
    ["appointment", "Waiting", "already-in-queue"],
    ["appointment", "In Consultation", "already-in-queue"],
    ["appointment", "Awaiting Medicine", "already-in-queue"],
    ["walk-in", "Completed", "visit-completed-today"],
    ["appointment", "Completed", "visit-completed-today"],
  ]) {
    const { service, writes } = await setup({ visits: [{ id: "other-visit", visitType, visitStatus }] });
    await assert.rejects(service.joinWalkInQueue(patientId), { code });
    assert.equal(writes.length, 0);
  }
});

test("only today's booked appointments block walk-in entry", async () => {
  for (const appointment of [
    { id: "a", status: "booked" },
    { id: "a", status: "cancelled" },
    { id: "a", status: "completed" },
    { id: "a", status: "booked", appointmentDate: "2026-11-11" },
    { id: "a", status: "booked", appointmentDate: "2026-11-09" },
  ]) {
    const { service, writes } = await setup({ appointments: [appointment] });
    if (appointment.status === "booked" && !appointment.appointmentDate) {
      await assert.rejects(service.joinWalkInQueue(patientId), { code: "appointment-today" });
      assert.equal(writes.length, 0);
    } else {
      const result = await service.joinWalkInQueue(patientId);
      assert.equal(result.alreadyJoined, false);
      assert.equal(writes.length, 2);
    }
  }
});

test("a visit advancing into consultation during join is protected by the transaction", async () => {
  const { service, writes } = await setup({
    visits: [{ id: walkInId, visitStatus: "Waiting" }],
    beforeTransaction(documents) {
      documents.get(`visits/${walkInId}`).visitStatus = "In Consultation";
    },
  });
  await assert.rejects(service.joinWalkInQueue(patientId), { code: "already-in-queue" });
  assert.equal(writes.length, 0);
});

test("patients can leave only their own waiting or late walk-in", async () => {
  for (const visitStatus of ["Waiting", "Late", "Called", "Absent", "In Consultation", "Awaiting Medicine", "Completed"]) {
    const { service, writes } = await setup({ visits: [{ id: walkInId, visitStatus }] });
    if (["Waiting", "Late"].includes(visitStatus)) {
      assert.equal(await service.leaveWalkInQueue(patientId), true);
      assert.equal(writes.length, 1);
    } else {
      await assert.rejects(service.leaveWalkInQueue(patientId), { code: "cannot-leave-queue" });
      assert.equal(writes.length, 0);
    }
  }
});

test("a staff call made during a leave request prevents deletion", async () => {
  const { service, writes } = await setup({
    visits: [{ id: walkInId, visitStatus: "Waiting" }],
    beforeTransaction(documents) { documents.get(`visits/${walkInId}`).visitStatus = "Called"; },
  });
  await assert.rejects(service.leaveWalkInQueue(patientId), { code: "cannot-leave-queue" });
  assert.equal(writes.length, 0);
});

test("missing patient and closing-time boundary are rejected without writes", async () => {
  let checks = 0;
  const { service, writes } = await setup({ isOpen: () => ++checks === 1 });
  await assert.rejects(service.joinWalkInQueue(""), { code: "unauthenticated" });
  await assert.rejects(service.joinWalkInQueue(patientId), { code: "clinic-closed" });
  assert.equal(writes.length, 0);
});
