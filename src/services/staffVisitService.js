import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { db } from "@/services/firebase";

const TRANSITIONS = {
  call: {
    from: ["Waiting"],
    to: "Called",
    fields: { visitStatus: "Called" },
  },
  "to-consultation": {
    from: ["Waiting", "Called", "Late"],
    to: "In Consultation",
    fields: { visitStatus: "In Consultation" },
  },
  "to-medicine": {
    from: ["In Consultation"],
    to: "Awaiting Medicine",
    fields: {
      visitStatus: "Awaiting Medicine",
      medicineStatus: "Preparing",
    },
  },
  "to-completed": {
    from: [
      "Awaiting Medicine",
      "Awaiting Medicine Collection",
      "Ready for Collection",
    ],
    to: "Completed",
    fields: {
      visitStatus: "Completed",
      medicineStatus: "Collected",
    },
  },
  late: {
    from: ["Waiting", "Called"],
    to: "Late",
    fields: { visitStatus: "Late" },
  },
};

export async function updateStaffVisitStatus(visitId, currentStatus, action) {
  const transition = TRANSITIONS[action];

  if (!visitId || !transition?.from.includes(currentStatus)) {
    throw new Error("This patient cannot be moved from their current status.");
  }

  await db
    .collection("visits")
    .doc(visitId)
    .update({
      ...transition.fields,
    });
}

export async function deleteStaffVisit(visitId) {
  if (!visitId) {
    throw new Error("A visit ID is required.");
  }

  await db.collection("visits").doc(visitId).delete();
}

export async function checkInAppointment(appointmentId) {
  if (!appointmentId) {
    throw new Error("An appointment ID is required.");
  }

  const appointmentRef = db.collection("appointments").doc(appointmentId);
  const visitRef = db.collection("visits").doc(`appointment_${appointmentId}`);
  const appointmentQueueRef = db
    .collection("appointmentQueueCounters")
    .doc(getClinicDate());

  return db.runTransaction(async (transaction) => {
    const [appointmentSnapshot, visitSnapshot, counterSnapshot] =
      await Promise.all([
        transaction.get(appointmentRef),
        transaction.get(visitRef),
        transaction.get(appointmentQueueRef),
      ]);

    if (!appointmentSnapshot.exists) {
      throw new Error("The appointment could not be found.");
    }

    const appointment = appointmentSnapshot.data();

    if (appointment.status !== "booked") {
      throw new Error("Only booked appointments can be checked in.");
    }

    if (visitSnapshot.exists) {
      return { alreadyCheckedIn: true };
    }

    const appointmentNumber = counterSnapshot.exists
      ? counterSnapshot.data()?.nextAppointmentNumber || 1
      : 1;

    transaction.set(appointmentQueueRef, {
      visitDate: getClinicDate(),
      nextAppointmentNumber: appointmentNumber + 1,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    transaction.set(visitRef, {
      appointmentId,
      patientId: appointment.patientId,
      doctorId: appointment.doctorId,
      visitType: "appointment",
      visitStatus: "Waiting",
      patientName: appointment.patientName || "",
      appointmentDate: appointment.appointmentDate,
      appointmentTime: appointment.appointmentTime,
      reasonForVisit: appointment.reasonForVisit || "",
      queueNumber: `A${appointmentNumber}`,
      queueOrder: -100000 + appointmentNumber,
      appointmentQueueNumber: appointmentNumber,
      visitDate: getClinicDate(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    return {
      alreadyCheckedIn: false,
      queueNumber: `A${appointmentNumber}`,
    };
  });
}

function getClinicDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}
