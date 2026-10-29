import { db } from "@/services/firebase";

export async function getDoctorPatientDetails({ visitId, doctorId }) {
  if (!visitId || !doctorId) {
    throw new Error("A visit and doctor are required.");
  }

  const visitSnapshot = await db.collection("visits").doc(visitId).get();
  if (!visitSnapshot.exists) {
    throw new Error("The selected visit could not be found.");
  }

  const visit = { id: visitSnapshot.id, ...visitSnapshot.data() };
  if (visit.doctorId !== doctorId) {
    throw new Error("You are not authorized to view this patient.");
  }

  const patientSnapshot = await db
    .collection("users")
    .doc(visit.patientId)
    .get();
  if (!patientSnapshot.exists || patientSnapshot.data()?.role !== "patient") {
    throw new Error("The patient profile could not be found.");
  }

  const patientProfile = {
    id: patientSnapshot.id,
    ...patientSnapshot.data(),
  };

  let appointment = null;
  if (visit.appointmentId) {
    const appointmentSnapshot = await db
      .collection("appointments")
      .doc(visit.appointmentId)
      .get();
    if (appointmentSnapshot.exists) {
      appointment = {
        id: appointmentSnapshot.id,
        ...appointmentSnapshot.data(),
      };
    }
  }

  const patientDetails = await getPatientDetails(visit.patientId);
  const consultationResult = await getPastConsultations({
    patientId: visit.patientId,
    doctorId,
  });

  return {
    visit,
    appointment,
    patient: {
      ...patientProfile,
      ...patientDetails,
    },
    consultations: consultationResult.records,
    consultationError: consultationResult.error,
  };
}

async function getPatientDetails(patientId) {
  try {
    const snapshot = await db.collection("patients").doc(patientId).get();
    return snapshot.exists ? snapshot.data() : {};
  } catch (error) {
    if (error.code === "permission-denied") {
      console.info(
        "[DoctorPatient] Patient collection is not readable; using user profile fields.",
      );
      return {};
    }
    throw error;
  }
}

async function getPastConsultations({ patientId, doctorId }) {
  try {
    const snapshot = await db
      .collection("consultations")
      .where("patientId", "==", patientId)
      .where("doctorId", "==", doctorId)
      .get();

    return {
      records: snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .sort(compareConsultationDates),
      error: null,
    };
  } catch (error) {
    if (error.code === "permission-denied" || error.code === "not-found") {
      console.info(
        "[DoctorPatient] Consultation history is unavailable; showing empty history.",
      );
      return {
        records: [],
        error:
          error.code === "permission-denied"
            ? "Consultation history is not available under the current Firestore permissions."
            : null,
      };
    }
    throw error;
  }
}

function compareConsultationDates(first, second) {
  return getDateValue(second) - getDateValue(first);
}

function getDateValue(consultation) {
  const value =
    consultation.consultationDate ||
    consultation.date ||
    consultation.completedAt ||
    consultation.createdAt;

  if (value?.toDate) {
    return value.toDate().getTime();
  }

  const timestamp = Date.parse(value || "");
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
