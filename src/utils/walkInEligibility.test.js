import assert from "node:assert/strict";
import test from "node:test";
import {
  WALK_IN_MESSAGES,
  findRelevantVisit,
  getPatientQueueErrorMessage,
} from "./walkInEligibility.js";

test("completed appointment visits remain visible on the patient dashboard", () => {
  const completed = { id: "appointment-1", visitType: "appointment", visitStatus: "Completed" };
  assert.equal(findRelevantVisit([completed]), completed);
  const collecting = { visitStatus: "Awaiting Medicine" };
  assert.equal(findRelevantVisit([completed, collecting]), collecting);
});

test("known appointment and completed visit guards explain the actual reason", () => {
  assert.equal(getPatientQueueErrorMessage({ code: "appointment-today" }), WALK_IN_MESSAGES["appointment-today"]);
  assert.equal(getPatientQueueErrorMessage({ code: "visit-completed-today" }), WALK_IN_MESSAGES["visit-completed-today"]);
});

test("permission errors give actionable guidance without assuming a completed visit", () => {
  for (const action of ["join", "read", "leave"]) {
    const message = getPatientQueueErrorMessage({ code: "permission-denied", queueOperation: "queue-transaction" }, action);
    assert.match(message, /contact clinic staff/);
    assert.doesNotMatch(message, /permission|queue-transaction|already seen a doctor/);
  }
});
