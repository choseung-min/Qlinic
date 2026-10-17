import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { db } from "@/services/firebase";

const clinicTimeSlots = [
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
  const appointmentRef = appointmentCollection.doc();

  await db.runTransaction(async (transaction) => {
    const doctorSnapshot = await transaction.get(doctorRef);
    const slotSnapshot = await transaction.get(slotQuery);
    const duplicateSnapshot = await transaction.get(duplicateQuery);

    if (!doctorSnapshot.exists || doctorSnapshot.data()?.active !== true) {
      throw createAppointmentError("invalid-doctor");
    }

    if (!slotSnapshot.empty) {
      throw createAppointmentError("slot-taken");
    }

    if (!duplicateSnapshot.empty) {
      throw createAppointmentError("duplicate-booking");
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
