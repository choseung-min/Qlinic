import firebase from "firebase/compat/app";
import { auth, db } from "@/services/firebase";

const CONSULTATION_STATUS = "Ongoing";
const IN_CONSULTATION_STATUS = "In Consultation";

export async function completeConsultation({
  consultationId,
  doctorId,
  diagnosis,
  notes,
  medication,
  noMedicationRequired,
}) {
  if (!consultationId || !doctorId) {
    throw new Error("A consultation and doctor are required.");
  }

  const normalizedDiagnosis = String(diagnosis || "").trim();
  const normalizedNotes = String(notes || "").trim();
  const normalizedMedication = String(medication || "").trim();
  const hasNoMedication = Boolean(noMedicationRequired);

  if (!normalizedDiagnosis) {
    throw new Error("Enter a diagnosis before completing the consultation.");
  }

  if (!hasNoMedication && !normalizedMedication) {
    throw new Error(
      "Enter medication details or select no medication required.",
    );
  }

  if (hasNoMedication && normalizedMedication) {
    throw new Error(
      "Clear the medication details before selecting no medication required.",
    );
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be signed in to complete this consultation.");
  }

  const userSnapshot = await db.collection("users").doc(currentUser.uid).get();
  const userData = userSnapshot.data() || {};
  if (
    userData.role !== "doctor"
    || (userData.doctorId || userData.doctorID) !== doctorId
  ) {
    throw new Error("You are not authorized to complete this consultation.");
  }

  const consultationRef = db.collection("consultations").doc(consultationId);
  const visitRef = db.collection("visits").doc(consultationId);

  try {
    await db.runTransaction(async (transaction) => {
      const [consultationSnapshot, visitSnapshot] = await Promise.all([
        transaction.get(consultationRef),
        transaction.get(visitRef),
      ]);

      if (!consultationSnapshot.exists) {
        throw new Error("The consultation could not be found.");
      }

      if (!visitSnapshot.exists) {
        throw new Error("The consultation's visit could not be found.");
      }

      const consultation = consultationSnapshot.data() || {};
      const visit = visitSnapshot.data() || {};
      if (
        consultation.doctorId !== doctorId
        || consultation.visitId !== consultationId
        || consultation.patientId !== visit.patientId
        || visit.doctorId !== doctorId
      ) {
        throw new Error("You are not authorized to complete this consultation.");
      }

      if (consultation.status === "Completed") {
        throw new Error("This consultation has already been completed.");
      }

      if (
        consultation.status !== CONSULTATION_STATUS
        || visit.visitStatus !== IN_CONSULTATION_STATUS
      ) {
        throw new Error("Only an ongoing consultation can be completed.");
      }

      const finalVisitStatus = hasNoMedication
        ? "Completed"
        : "Awaiting Medicine";
      const consultationUpdate = {
        diagnosis: normalizedDiagnosis,
        notes: normalizedNotes,
        medication: hasNoMedication ? "" : normalizedMedication,
        noMedicationRequired: hasNoMedication,
        status: "Completed",
        completedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      const visitUpdate = {
        visitStatus: finalVisitStatus,
      };

      if (hasNoMedication) {
        visitUpdate.medicineStatus = firebase.firestore.FieldValue.delete();
        visitUpdate.prescription = firebase.firestore.FieldValue.delete();
      } else {
        visitUpdate.medicineStatus = "Preparing";
        visitUpdate.prescription = normalizedMedication;
      }

      transaction.update(consultationRef, consultationUpdate);
      transaction.update(visitRef, visitUpdate);
    });
  } catch (error) {
    console.error("[Consultation] Completion transaction failed.", {
      operation: "complete",
      consultationPath: `consultations/${consultationId}`,
      visitPath: `visits/${consultationId}`,
      doctorId,
      authenticatedUid: currentUser.uid,
      errorCode: error?.code || "unknown",
      errorMessage: error?.message || "Unknown Firestore error",
    });
    throw error;
  }
}

export async function updateConsultationDetails({
  consultationId,
  doctorId,
  diagnosis,
  notes,
  medication,
  noMedicationRequired,
}) {
  if (!consultationId || !doctorId) {
    throw new Error("A consultation and doctor are required.");
  }

  const normalizedDiagnosis = String(diagnosis || "").trim();
  const normalizedNotes = String(notes || "").trim();
  const normalizedMedication = String(medication || "").trim();

  if (!normalizedDiagnosis) {
    throw new Error("Enter a diagnosis before saving.");
  }

  if (noMedicationRequired && normalizedMedication) {
    throw new Error(
      "Clear the medication details before selecting no medication required.",
    );
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be signed in to save consultation details.");
  }

  const userSnapshot = await db.collection("users").doc(currentUser.uid).get();
  const userData = userSnapshot.data() || {};
  if (
    userData.role !== "doctor"
    || (userData.doctorId || userData.doctorID) !== doctorId
  ) {
    throw new Error("You are not authorized to edit this consultation.");
  }

  const consultationRef = db.collection("consultations").doc(consultationId);
  const visitRef = db.collection("visits").doc(consultationId);

  console.info("[Consultation] Saving consultation details.", {
    operation: "transaction",
    consultationPath: `consultations/${consultationId}`,
    visitPath: `visits/${consultationId}`,
    doctorId,
    authenticatedUid: currentUser.uid,
    updateFields: [
      "diagnosis",
      "notes",
      "medication",
      "noMedicationRequired",
      "updatedAt",
    ],
    usesServerTimestamp: true,
  });

  try {
    await db.runTransaction(async (transaction) => {
      const [consultationSnapshot, visitSnapshot] = await Promise.all([
        transaction.get(consultationRef),
        transaction.get(visitRef),
      ]);

      console.info("[Consultation] Save transaction reads completed.", {
        consultationExists: consultationSnapshot.exists,
        visitExists: visitSnapshot.exists,
      });

      if (!consultationSnapshot.exists) {
        throw new Error("The consultation could not be found.");
      }

      if (!visitSnapshot.exists) {
        throw new Error("The consultation's visit could not be found.");
      }

      const consultation = consultationSnapshot.data() || {};
      const visit = visitSnapshot.data() || {};
      console.info("[Consultation] Save authorization fields checked.", {
        consultationDoctorId: consultation.doctorId || null,
        requestedDoctorId: doctorId,
        consultationVisitId: consultation.visitId || null,
        selectedVisitId: consultationId,
        consultationStatus: consultation.status || null,
        visitDoctorId: visit.doctorId || null,
        visitStatus: visit.visitStatus || null,
        patientIdsMatch: consultation.patientId === visit.patientId,
      });
      if (
        consultation.doctorId !== doctorId
        || consultation.visitId !== consultationId
        || consultation.patientId !== visit.patientId
        || visit.doctorId !== doctorId
      ) {
        throw new Error("You are not authorized to edit this consultation.");
      }

      if (
        consultation.status !== CONSULTATION_STATUS
        || visit.visitStatus !== IN_CONSULTATION_STATUS
      ) {
        throw new Error("Only an ongoing consultation can be edited.");
      }

      transaction.update(consultationRef, {
        diagnosis: normalizedDiagnosis,
        notes: normalizedNotes,
        medication: noMedicationRequired ? "" : normalizedMedication,
        noMedicationRequired: Boolean(noMedicationRequired),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });
  } catch (error) {
    console.error("[Consultation] Save transaction failed.", {
      operation: "update",
      consultationPath: `consultations/${consultationId}`,
      visitPath: `visits/${consultationId}`,
      doctorId,
      authenticatedUid: currentUser.uid,
      errorCode: error?.code || "unknown",
      errorMessage: error?.message || "Unknown Firestore error",
    });
    throw error;
  }
}

export async function startConsultation({ visitId, doctorId }) {
  if (!visitId || !doctorId) {
    throw new Error("A visit and doctor are required to start a consultation.");
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("You must be signed in to start a consultation.");
  }

  const userSnapshot = await db.collection("users").doc(currentUser.uid).get();
  const userData = userSnapshot.data() || {};
  const configuredDoctorId = userData.doctorId || userData.doctorID;
  if (userData.role !== "doctor" || configuredDoctorId !== doctorId) {
    throw new Error("You are not authorized to start this consultation.");
  }

  const consultationRef = db.collection("consultations").doc(visitId);
  const visitRef = db.collection("visits").doc(visitId);
  const doctorRef = db.collection("doctors").doc(doctorId);

  return db.runTransaction(async (transaction) => {
    const [visitSnapshot, consultationSnapshot, doctorSnapshot] =
      await Promise.all([
      transaction.get(visitRef),
      transaction.get(consultationRef),
      transaction.get(doctorRef),
    ]);

    if (!visitSnapshot.exists || !doctorSnapshot.exists) {
      throw new Error("The selected visit could not be found.");
    }

    const visit = visitSnapshot.data() || {};
    const doctor = doctorSnapshot.data() || {};
    if (visit.doctorId !== doctorId || (doctor.uid && doctor.uid !== currentUser.uid)) {
      throw new Error("You are not authorized to start this consultation.");
    }

    if (consultationSnapshot.exists) {
      const consultation = consultationSnapshot.data() || {};
      if (
        consultation.visitId !== visitId ||
        consultation.patientId !== visit.patientId ||
        consultation.doctorId !== doctorId
      ) {
        throw new Error(
          "The existing consultation does not match the selected visit.",
        );
      }

      if (consultation.status === CONSULTATION_STATUS) {
        if (visit.visitStatus !== IN_CONSULTATION_STATUS) {
          throw new Error(
            "The consultation is ongoing but the visit status is inconsistent.",
          );
        }

        return { id: consultationSnapshot.id, existing: true };
      }

      throw new Error("This visit already has a completed consultation.");
    }

    if (visit.visitStatus !== "Waiting") {
      throw new Error(
        `This visit cannot start a consultation from its current status (${visit.visitStatus || "unknown"}).`,
      );
    }

    transaction.set(consultationRef, {
      patientId: visit.patientId,
      visitId,
      doctorId,
      startedAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: CONSULTATION_STATUS,
    });
    transaction.update(visitRef, {
      visitStatus: IN_CONSULTATION_STATUS,
    });

    return { id: consultationRef.id, existing: false };
  });
}

export async function getConsultationDetails({ consultationId, doctorId }) {
  if (!consultationId || !doctorId) {
    throw new Error("A consultation and doctor are required.");
  }

  const consultationSnapshot = await db
    .collection("consultations")
    .doc(consultationId)
    .get();
  if (!consultationSnapshot.exists) {
    throw new Error("The consultation could not be found.");
  }

  const consultation = {
    id: consultationSnapshot.id,
    ...consultationSnapshot.data(),
  };
  if (consultation.doctorId !== doctorId) {
    throw new Error("You are not authorized to view this consultation.");
  }

  const [visitSnapshot, patientSnapshot, doctorSnapshot] = await Promise.all([
    db.collection("visits").doc(consultation.visitId).get(),
    db.collection("users").doc(consultation.patientId).get(),
    db.collection("doctors").doc(doctorId).get(),
  ]);

  if (!visitSnapshot.exists || !patientSnapshot.exists || !doctorSnapshot.exists) {
    throw new Error("The consultation references missing application data.");
  }

  const visit = { id: visitSnapshot.id, ...visitSnapshot.data() };
  if (visit.doctorId !== doctorId || visit.patientId !== consultation.patientId) {
    throw new Error("The consultation references an unauthorized visit.");
  }

  return {
    consultation,
    visit,
    patient: { id: patientSnapshot.id, ...patientSnapshot.data() },
    doctor: { id: doctorSnapshot.id, ...doctorSnapshot.data() },
  };
}
