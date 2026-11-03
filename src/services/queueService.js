import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { db } from "@/services/firebase";
import { getActiveDoctors } from "@/services/doctorService";

const ACTIVE_VISIT_STATUSES = new Set(["Waiting", "Called"]);
export const queueTimeSlots = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
];

export function watchActiveWalkInVisit(patientId, onChange, onError) {
  const visitRef = db
    .collection("visits")
    .doc(`walkin_${patientId}_${getClinicDate()}`);

  return visitRef.onSnapshot(
    (snapshot) => {
      if (!snapshot.exists) {
        onChange(null);
        return;
      }

      const visit = { id: snapshot.id, ...snapshot.data() };
      onChange(ACTIVE_VISIT_STATUSES.has(visit.visitStatus) ? visit : null);
    },
    (error) => onError(addQueueOperation(error, "active-visit-read")),
  );
}

export function watchWaitingWalkIns(visitDate, onChange, onError) {
  return db
    .collection("visits")
    .where("visitDate", "==", visitDate)
    .where("visitStatus", "==", "Waiting")
    .onSnapshot(
      (snapshot) => {
        onChange(
          snapshot.docs.map((document) => ({
            id: document.id,
            ...document.data(),
          })),
        );
      },
      (error) => onError(addQueueOperation(error, "waiting-queue-list")),
    );
}

export async function joinWalkInQueue(patientId) {
  if (!patientId) {
    throw createQueueError("unauthenticated");
  }

  const visitDate = getClinicDate();
  const visitRef = db
    .collection("visits")
    .doc(`walkin_${patientId}_${visitDate}`);
  const counterRef = db.collection("queueCounters").doc(visitDate);

  try {
    return await db.runTransaction(async (transaction) => {
      let existingVisit;
      try {
        existingVisit = await transaction.get(visitRef);
      } catch (error) {
        throw addQueueOperation(error, "active-visit-transaction-read");
      }

      let counterSnapshot;
      try {
        counterSnapshot = await transaction.get(counterRef);
      } catch (error) {
        throw addQueueOperation(error, "queue-counter-transaction-read");
      }

      if (existingVisit.exists) {
        const existingData = existingVisit.data();

        if (ACTIVE_VISIT_STATUSES.has(existingData?.visitStatus)) {
          return {
            id: existingVisit.id,
            ...existingData,
            alreadyJoined: true,
          };
        }
      }

      const queueNumber = counterSnapshot.exists
        ? counterSnapshot.data()?.nextQueueNumber || 1
        : 1;

      transaction.set(counterRef, {
        visitDate,
        nextQueueNumber: queueNumber + 1,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      const visitData = {
        patientId,
        visitType: "walk-in",
        visitStatus: "Waiting",
        queueNumber,
        queueOrder: queueNumber,
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        visitDate,
      };

      transaction.set(visitRef, visitData);

      return {
        id: visitRef.id,
        ...visitData,
        alreadyJoined: false,
      };
    });
  } catch (error) {
    throw addQueueOperation(error, error.queueOperation || "queue-transaction");
  }
}

export async function registerWalkInPatient({
  patientName,
  patientId = "",
  visitDate,
  appointmentTime,
  reasonForVisit,
}) {
  const trimmedName = patientName?.trim();
  const trimmedPatientId = patientId?.trim();

  if (!trimmedName || !visitDate || !appointmentTime || !reasonForVisit?.trim()) {
    throw createQueueError("invalid-walk-in");
  }

  if (!queueTimeSlots.includes(appointmentTime)) {
    throw createQueueError("invalid-time-slot");
  }

  const doctors = await getActiveDoctors();
  const doctor = doctors[0];

  if (!doctor) {
    throw createQueueError("no-available-doctor");
  }

  const visitRef = db.collection("visits").doc();
  const counterRef = db.collection("queueCounters").doc(visitDate);

  return db.runTransaction(async (transaction) => {
    const counterSnapshot = await transaction.get(counterRef);
    const queueNumber = counterSnapshot.exists
      ? counterSnapshot.data()?.nextQueueNumber || 1
      : 1;

    transaction.set(counterRef, {
      visitDate,
      nextQueueNumber: queueNumber + 1,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    transaction.set(visitRef, {
      ...(trimmedPatientId ? { patientId: trimmedPatientId } : {}),
      patientName: trimmedName,
      doctorId: doctor.id,
      doctorName: doctor.name || "",
      visitType: "walk-in",
      visitDate,
      appointmentDate: visitDate,
      appointmentTime,
      reasonForVisit: reasonForVisit.trim(),
      queueNumber,
      queueOrder: queueNumber,
      visitStatus: "Waiting",
      status: "waiting",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    return { id: visitRef.id, queueNumber, doctor };
  });
}

export async function leaveWalkInQueue(patientId) {
  if (!patientId) {
    throw createQueueError("unauthenticated");
  }

  const visitRef = db
    .collection("visits")
    .doc(`walkin_${patientId}_${getClinicDate()}`);

  try {
    return await db.runTransaction(async (transaction) => {
      const visitSnapshot = await transaction.get(visitRef);

      if (!visitSnapshot.exists) {
        return false;
      }

      const visit = visitSnapshot.data();

      if (visit?.patientId !== patientId) {
        throw createQueueError("not-owner");
      }

      if (!ACTIVE_VISIT_STATUSES.has(visit.visitStatus)) {
        return false;
      }

      transaction.delete(visitRef);
      return true;
    });
  } catch (error) {
    throw addQueueOperation(error, error.queueOperation || "leave-queue");
  }
}

function getClinicDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createQueueError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function addQueueOperation(error, operation) {
  error.queueOperation = operation;
  return error;
}
