import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { db } from "@/services/firebase";

export const clinicTimeSlots = [
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

export async function getBookedTimeSlots({ doctorId, appointmentDate }) {
  const snapshot = await db
    .collection("appointments")
    .where("doctorId", "==", doctorId)
    .where("appointmentDate", "==", appointmentDate)
    .where("status", "==", "booked")
    .get();

  return new Set(
    snapshot.docs
      .map((document) => document.data()?.appointmentTime)
      .filter(Boolean),
  );
}

export async function createAppointment({
  patientId,
  doctorId,
  appointmentDate,
  appointmentTime,
  reasonForVisit,
}) {
  if (!patientId) {
    throw createAppointmentError("unauthenticated");
  }

  if (!isFutureDate(appointmentDate)) {
    throw createAppointmentError("invalid-date");
  }

  if (!clinicTimeSlots.includes(appointmentTime)) {
    throw createAppointmentError("invalid-time-slot");
  }

  if (!reasonForVisit?.trim()) {
    throw createAppointmentError("invalid-reason");
  }

  const doctorRef = db.collection("doctors").doc(doctorId);
  const appointmentCollection = db.collection("appointments");
  const slotQuery = appointmentCollection
    .where("doctorId", "==", doctorId)
    .where("appointmentDate", "==", appointmentDate)
    .where("appointmentTime", "==", appointmentTime)
    .where("status", "==", "booked");
  const duplicateQuery = appointmentCollection
    .where("patientId", "==", patientId)
    .where("doctorId", "==", doctorId)
    .where("appointmentDate", "==", appointmentDate)
    .where("appointmentTime", "==", appointmentTime)
    .where("status", "==", "booked");
  const slotId = `${doctorId}_${appointmentDate}_${appointmentTime.replace(":", "-")}`;
  const appointmentRef = appointmentCollection.doc(slotId);

  const [doctorSnapshot, slotSnapshot, duplicateSnapshot] = await Promise.all([
    doctorRef.get(),
    slotQuery.get(),
    duplicateQuery.get(),
  ]);

  if (!doctorSnapshot.exists || doctorSnapshot.data()?.active !== true) {
    throw createAppointmentError("invalid-doctor");
  }

  if (!slotSnapshot.empty) {
    throw createAppointmentError("slot-taken");
  }

  if (!duplicateSnapshot.empty) {
    throw createAppointmentError("duplicate-booking");
  }

  await db.runTransaction(async (transaction) => {
    const existingSlot = await transaction.get(appointmentRef);

    if (existingSlot.exists) {
      throw createAppointmentError("slot-taken");
    }

    transaction.set(appointmentRef, {
      patientId,
      doctorId,
      appointmentDate,
      appointmentTime,
      reasonForVisit: reasonForVisit.trim(),
      status: "booked",
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  });

  return appointmentRef.id;
}

function isFutureDate(dateValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue || "")) {
    return false;
  }

  const tomorrow = new Date();
  tomorrow.setHours(0, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return dateValue >= formatDate(tomorrow);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createAppointmentError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}


export async function rescheduleAppointment({
  appointmentId,
  patientId,
  appointmentDate,
  appointmentTime
}) {
  if (!patientId) {
    throw createAppointmentError('unauthenticated');
  }

  if (!appointmentId) {
    throw createAppointmentError('appointment-not-found');
  }

  if (!isFutureDate(appointmentDate)) {
    throw createAppointmentError('invalid-date');
  }

  if (!clinicTimeSlots.includes(appointmentTime)) {
    throw createAppointmentError('invalid-time-slot');
  }

  const appointments = db.collection('appointments');
  const oldRef = appointments.doc(appointmentId);

  return db.runTransaction(async (transaction) => {
    const oldSnapshot = await transaction.get(oldRef);

    if (!oldSnapshot.exists) {
      throw createAppointmentError('appointment-not-found');
    }

    const current = oldSnapshot.data();

    if (current.patientId !== patientId) {
      throw createAppointmentError('unauthenticated');
    }

    if (current.status !== 'booked' ||
      !isFutureDate(current.appointmentDate)) {
      throw createAppointmentError('cannot-reschedule');
    }

    if (current.appointmentDate === appointmentDate &&
      current.appointmentTime === appointmentTime) {
      throw createAppointmentError('no-changes');
    }

    if (!current.doctorId) {
      throw createAppointmentError('invalid-doctor');
    }

    // generate a new appointment ID following the booking service
    const newId = `${current.doctorId}_${appointmentDate}_${appointmentTime.replace(':', '-')}`;

    const newRef = appointments.doc(newId);
    const doctorRef = db.collection('doctors').doc(current.doctorId);

    const newSnapshot = await transaction.get(newRef);
    const doctorSnapshot = await transaction.get(doctorRef);

    if (!doctorSnapshot.exists ||
      doctorSnapshot.data().active !== true) {
      throw createAppointmentError('invalid-doctor');
    }

    if (newSnapshot.exists) {
      throw createAppointmentError('slot-taken');
    }

    // save the appointment under the new slot ID
    transaction.set(newRef, {
      ...current,
      appointmentDate,
      appointmentTime,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // release the old appointment slot
    transaction.delete(oldRef);

    return newId;
  });
}


// 5C cancel an appointment while keeping its history
export async function cancelAppointment({ appointmentId, patientId }) {
  if (!patientId) {
    throw createAppointmentError('unauthenticated');
  }

  if (!appointmentId) {
    throw createAppointmentError('appointment-not-found');
  }

  const appointments = db.collection('appointments');
  const oldRef = appointments.doc(appointmentId);

  return db.runTransaction(async (transaction) => {
    const oldSnapshot = await transaction.get(oldRef);

    if (!oldSnapshot.exists) {
      throw createAppointmentError('appointment-not-found');
    }

    const current = oldSnapshot.data();

    if (current.patientId !== patientId) {
      throw createAppointmentError('unauthenticated');
    }

    if (current.status !== 'booked' ||
      !isFutureDate(current.appointmentDate)) {
      throw createAppointmentError('cannot-cancel');
    }

    // archived records use a different ID so the original slot becomes available
    const archiveId = `cancelled_${appointmentId}_${appointments.doc().id}`;
    const archiveRef = appointments.doc(archiveId);

    transaction.set(archiveRef, {
      ...current,
      status: 'cancelled',
      originalAppointmentId: appointmentId,
      cancelledAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    transaction.delete(oldRef);

    return archiveRef.id;
  });
}
