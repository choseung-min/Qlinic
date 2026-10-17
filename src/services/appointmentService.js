import { db } from "@/services/firebase";

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
