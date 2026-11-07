import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { db } from "@/services/firebase";
import { getActiveDoctors } from "@/services/doctorService";

// Late/Absent patients are still in today's queue until staff resolve them
const ACTIVE_VISIT_STATUSES = new Set(["Waiting", "Called", "Late", "Absent"]);
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
  return db
    .collection("visits")
    .where("patientId", "==", patientId)
    .where("visitDate", "==", getClinicDate())
    .onSnapshot(
    (snapshot) => {
      const activeVisit = snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .find((visit) => ACTIVE_VISIT_STATUSES.has(visit.visitStatus));

      if (!activeVisit) {
        onChange(null);
        return;
      }

      onChange(activeVisit);
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

  // assign a doctor up front; if every doctor is on break, staff allocate one later
  const doctor = pickShortestQueueDoctor(
    await getAvailableDoctorsWithLoad(visitDate),
  );

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
        doctorId: doctor?.id || "",
        doctorName: doctor?.name || "",
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
  reasonForVisit,
  doctorId = "",
}) {
  const trimmedName = patientName?.trim();
  const trimmedPatientId = patientId?.trim();
  const visitDate = getClinicDate();

  if (!trimmedName || !reasonForVisit?.trim()) {
    throw createQueueError("invalid-walk-in");
  }

  const appointmentTime = getNextQueueTimeSlot();

  if (!appointmentTime) {
    throw createQueueError("no-remaining-time-slots");
  }

  // staff can pick a doctor; otherwise assign the available doctor with the shortest queue
  const availableDoctors = await getAvailableDoctorsWithLoad(visitDate);
  const doctor = doctorId
    ? availableDoctors.find((candidate) => candidate.id === doctorId)
    : pickShortestQueueDoctor(availableDoctors);

  if (!doctor) {
    throw createQueueError(doctorId ? "doctor-unavailable" : "no-available-doctor");
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

function getNextQueueTimeSlot() {
  const now = new Date();
  const currentTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);

  return queueTimeSlots.find((slot) => slot > currentTime);
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

// statuses that count towards a doctor's current queue
const QUEUE_LOAD_STATUSES = new Set([
  "Waiting",
  "Called",
  "Late",
  "In Consultation",
]);

export function isDoctorAvailable(doctor) {
  return (
    (doctor.availabilityStatus || "Available") === "Available" &&
    doctor.available !== false
  );
}

// available doctors, each with queueLength = patients currently assigned today
export async function getAvailableDoctorsWithLoad(visitDate = getClinicDate()) {
  const doctors = (await getActiveDoctors()).filter(isDoctorAvailable);

  if (doctors.length === 0) {
    return [];
  }

  const visitsSnapshot = await db
    .collection("visits")
    .where("visitDate", "==", visitDate)
    .get();

  const queueLoad = new Map(doctors.map((doctor) => [doctor.id, 0]));
  visitsSnapshot.forEach((document) => {
    const visit = document.data();
    if (
      queueLoad.has(visit.doctorId) &&
      QUEUE_LOAD_STATUSES.has(visit.visitStatus)
    ) {
      queueLoad.set(visit.doctorId, queueLoad.get(visit.doctorId) + 1);
    }
  });

  return doctors.map((doctor) => ({
    ...doctor,
    queueLength: queueLoad.get(doctor.id),
  }));
}

// shortest queue wins; ties go to the first doctor alphabetically
export function pickShortestQueueDoctor(doctorsWithLoad) {
  if (!doctorsWithLoad?.length) {
    return null;
  }

  return doctorsWithLoad.reduce((best, doctor) =>
    doctor.queueLength < best.queueLength ? doctor : best,
  );
}
