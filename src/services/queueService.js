import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { db } from "@/services/firebase";

const ACTIVE_VISIT_STATUSES = new Set(["Waiting", "Called"]);

export async function joinWalkInQueue(patientId) {
  if (!patientId) {
    throw createQueueError("unauthenticated");
  }

  const visitDate = getClinicDate();
  const visitRef = db
    .collection("visits")
    .doc(`walkin_${patientId}_${visitDate}`);
  const counterRef = db.collection("queueCounters").doc(visitDate);

  return db.runTransaction(async (transaction) => {
    const existingVisit = await transaction.get(visitRef);
    const counterSnapshot = await transaction.get(counterRef);

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
