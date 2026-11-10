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

  if (!["Called", "In Consultation"].includes(visit.visitStatus)) {
    const error = new Error(
      "This patient must be called by staff before you can view their information or start consultation.",
    );
    error.code = "visit-not-called";
    throw error;
  }

// accountless walk-ins do not have a users/{patientId} document
// their information comes from the assigned visit instead
if (visit.patientId == null) {
  if (
    String(visit.visitType || "").toLowerCase() !== "walk-in" ||
    typeof visit.patientName !== "string" ||
    !visit.patientName.trim()
  ) {
    throw new Error("The patient profile could not be found.");
  }

  return {
    visit,
    appointment: null,
    patient: { displayName: visit.patientName },
    consultations: [],
    consultationError: null,
  };
}

// a supplied but invalid patient ID must not be treated as accountless
if (typeof visit.patientId !== "string" || !visit.patientId.trim()) {
  throw new Error("The patient profile could not be found.");
}

if (visit.visitStatus === "In Consultation") {
  const consultationSnapshot = await db
    .collection("consultations")
    .doc(visitId)
    .get();
  const consultation = consultationSnapshot.data() || {};

  if (
    !consultationSnapshot.exists
    || consultation.status !== "Ongoing"
    || consultation.visitId !== visitId
    || consultation.doctorId !== doctorId
    || consultation.patientId !== visit.patientId
  ) {
    throw new Error("The ongoing consultation could not be found.");
  }
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
      allergies: patientProfile.allergies || visit.allergies || patientDetails.allergies,
      medicalConditions:
        patientProfile.medicalConditions
        || visit.medicalConditions
        || patientDetails.medicalConditions,
      currentMedications:
        patientProfile.currentMedications
        || visit.currentMedications
        || patientDetails.currentMedications,
    },
    consultations: consultationResult.records,
    consultationError: consultationResult.error,
  };
}

export function watchDoctorPatientVisit(visitId, onChange, onError) {
  if (!visitId) {
    throw new Error("A visit is required.");
  }

  return db.collection("visits").doc(visitId).onSnapshot(
    (snapshot) => {
      if (!snapshot.exists) {
        onError(new Error("The selected visit could not be found."));
        return;
      }

      onChange({ id: snapshot.id, ...snapshot.data() });
    },
    onError,
  );
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
