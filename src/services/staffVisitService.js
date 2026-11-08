import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import { db } from "@/services/firebase";
import { findVisitInProgress } from "@/services/queueService";

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
};

// Story 6: move a patient off a doctor who went on break (or who has no
// doctor) to `doctor`. With no doctor available, flag the visit instead.
// Returns "reassigned", "flagged" or "skipped" (someone already handled it).
export async function reassignVisit(visitId, fromDoctorId, doctor) {
  const visitRef = db.collection("visits").doc(visitId);

  return db.runTransaction(async (transaction) => {
    const visitSnapshot = await transaction.get(visitRef);
    if (!visitSnapshot.exists) return "skipped";

    const visit = visitSnapshot.data();
    const stillOnSameDoctor = (visit.doctorId || "") === (fromDoctorId || "");

    if (!stillOnSameDoctor || !ASSIGNABLE_STATUSES.includes(visit.visitStatus)) {
      return "skipped";
    }

    if (doctor) {
      const doctorSnapshot = await transaction.get(
        db.collection("doctors").doc(doctor.id),
      );
      if (
        !doctorSnapshot.exists ||
        doctorSnapshot.data()?.active !== true ||
        (doctorSnapshot.data()?.availabilityStatus || "Available") !==
          "Available" ||
        doctorSnapshot.data()?.available === false
      ) {
        return "skipped";
      }

      transaction.update(visitRef, {
        doctorId: doctor.id,
        doctorName: doctor.name || "",
        reassignedFromDoctorId: fromDoctorId || "",
        reassignedAt: firebase.firestore.FieldValue.serverTimestamp(),
        needsAttention: false,
        attentionReason: "",
        // a called patient goes back to waiting for their new doctor
        ...(visit.visitStatus === "Called" ? { visitStatus: "Waiting" } : {}),
      });
      return "reassigned";
    }

    // nobody to move them to: flag for staff (rules need a real doctorId here)
    if (!fromDoctorId || visit.needsAttention) {
      return "skipped";
    }

    transaction.update(visitRef, {
      needsAttention: true,
      attentionReason: "Doctor on break and no other doctor is available.",
    });
    return "flagged";
  });
}

// 6C: the patient's own doctor is back on duty, so the flag is no longer needed
export async function clearDoctorAttention(visitId, doctorId) {
  const visitRef = db.collection("visits").doc(visitId);

  return db.runTransaction(async (transaction) => {
    const visitSnapshot = await transaction.get(visitRef);
    if (!visitSnapshot.exists) return false;

    const visit = visitSnapshot.data();
    if (!visit.needsAttention || visit.doctorId !== doctorId) return false;

    transaction.update(visitRef, {
      needsAttention: false,
      attentionReason: "",
    });
    return true;
  });
}

// Story 2: call a patient safely. Re-checks the saved status (so two
// receptionists can't call the same patient) and keeps one called
// patient per doctor per day in doctorQueueState.
export async function callVisit(visitId) {
  if (!visitId) {
    throw new Error("There is no patient to call.");
  }

  const visitRef = db.collection("visits").doc(visitId);

  await db.runTransaction(async (transaction) => {
    const visitSnapshot = await transaction.get(visitRef);

    if (!visitSnapshot.exists) {
      throw new Error("This patient is no longer in the queue.");
    }

    const visit = visitSnapshot.data();

    if (visit.visitStatus !== "Waiting") {
      throw new Error(
        "This patient was already called or moved by someone else.",
      );
    }

    if (!visit.doctorId) {
      throw new Error("Assign a doctor to this patient before calling them.");
    }

    const stateRef = db
      .collection("doctorQueueState")
      .doc(`${visit.visitDate}_${visit.doctorId}`);
    const stateSnapshot = await transaction.get(stateRef);
    const calledVisitId = stateSnapshot.exists
      ? stateSnapshot.data().calledVisitId
      : null;

    // the doctor's last called patient only blocks if they are still "Called"
    if (calledVisitId && calledVisitId !== visitId) {
      const calledSnapshot = await transaction.get(
        db.collection("visits").doc(calledVisitId),
      );

      if (
        calledSnapshot.exists &&
        calledSnapshot.data().visitStatus === "Called"
      ) {
        throw new Error(
          `${visit.doctorName || "This doctor"} already has a called patient. ` +
            "Move them to consultation or mark them late first.",
        );
      }
    }

    transaction.set(stateRef, {
      doctorId: visit.doctorId,
      visitDate: visit.visitDate,
      calledVisitId: visitId,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    transaction.update(visitRef, { visitStatus: "Called" });
  });
}

// Story 4: late / absent / arrived. moveToBack puts the patient behind
// everyone currently in their queue (backOfQueueOrder comes from the page).
const QUEUE_STATUS_ACTIONS = {
  late: {
    from: ["Waiting", "Called"],
    to: "Late",
    moveToBack: () => true,
  },
  absent: {
    from: ["Waiting", "Called", "Late"],
    to: "Absent",
    moveToBack: () => false,
  },
  arrived: {
    from: ["Late", "Absent"],
    to: "Waiting",
    // late patients were already moved back; absent patients rejoin at the back
    moveToBack: (status) => status === "Absent",
  },
};

export async function changeQueueStatus(visitId, action, backOfQueueOrder) {
  const queueAction = QUEUE_STATUS_ACTIONS[action];

  if (!visitId || !queueAction) {
    throw new Error("This patient cannot be moved from their current status.");
  }

  const visitRef = db.collection("visits").doc(visitId);

  await db.runTransaction(async (transaction) => {
    const visitSnapshot = await transaction.get(visitRef);

    if (!visitSnapshot.exists) {
      throw new Error("This patient is no longer in the queue.");
    }

    const visit = visitSnapshot.data();

    // check the saved status, not what the page last showed
    if (!queueAction.from.includes(visit.visitStatus)) {
      throw new Error(
        "This patient's status has changed. Please refresh and try again.",
      );
    }

    const currentOrder = Number(visit.queueOrder ?? visit.queueNumber ?? 0);
    const queueOrder =
      queueAction.moveToBack(visit.visitStatus) &&
      Number.isFinite(backOfQueueOrder)
        ? Math.max(backOfQueueOrder, currentOrder)
        : currentOrder;

    transaction.update(visitRef, {
      visitStatus: queueAction.to,
      queueOrder,
      statusUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
  });
}

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

// staff (re)allocate a patient to a doctor while they are still waiting
const ASSIGNABLE_STATUSES = ["Waiting", "Called", "Late"];

export async function assignVisitDoctor(visitId, doctor) {
  if (!visitId || !doctor?.id) {
    throw new Error("Choose a doctor to assign.");
  }

  const visitRef = db.collection("visits").doc(visitId);

  await db.runTransaction(async (transaction) => {
    const visitSnapshot = await transaction.get(visitRef);
    const doctorRef = db.collection("doctors").doc(doctor.id);
    const doctorSnapshot = await transaction.get(doctorRef);

    if (!visitSnapshot.exists) {
      throw new Error("This patient is no longer in the queue.");
    }

    if (
      !doctorSnapshot.exists ||
      doctorSnapshot.data()?.active !== true ||
      (doctorSnapshot.data()?.availabilityStatus || "Available") !== "Available" ||
      doctorSnapshot.data()?.available === false
    ) {
      const error = new Error("That doctor is no longer available.");
      error.code = "doctor-unavailable";
      throw error;
    }

    if (!ASSIGNABLE_STATUSES.includes(visitSnapshot.data().visitStatus)) {
      throw new Error("Doctors can only be changed before consultation starts.");
    }

    transaction.update(visitRef, {
      doctorId: doctor.id,
      doctorName: doctor.name || "",
      reassignedFromDoctorId: visitSnapshot.data().doctorId || "",
      reassignedAt: firebase.firestore.FieldValue.serverTimestamp(),
      needsAttention: false,
      attentionReason: "",
    });
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

  // 6D: the patient may already be in the walk-in queue
  const appointmentSnapshot = await appointmentRef.get();
  const existingVisit = await findVisitInProgress(
    appointmentSnapshot.data()?.patientId,
    getClinicDate(),
  );
  if (existingVisit && existingVisit.id !== visitRef.id) {
    throw new Error(
      "This patient is already in the walk-in queue. Remove them from it before checking in their appointment.",
    );
  }

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
