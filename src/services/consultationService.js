import firebase from "firebase/compat/app";
import { auth, db } from "@/services/firebase";

const CONSULTATION_STATUS = "Ongoing";
const IN_CONSULTATION_STATUS = "In Consultation";

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
