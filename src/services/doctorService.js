import { db } from "@/services/firebase";

export async function resolveDoctorForUser(user) {
  if (!user?.uid) {
    console.error(
      "[DoctorDashboard] Doctor resolution failed: no authenticated user.",
    );
    return null;
  }

  console.info("[DoctorDashboard] Reading authenticated user profile.", {
    operation: "get",
    path: `users/${user.uid}`,
  });
  let userSnapshot;
  try {
    userSnapshot = await db.collection("users").doc(user.uid).get();
    console.info("[DoctorDashboard] User profile read succeeded.", {
      exists: userSnapshot.exists,
    });
  } catch (error) {
    logFirestoreFailure("Read authenticated user profile", error, {
      operation: "get",
      path: `users/${user.uid}`,
    });
    throw error;
  }

  const userData = userSnapshot.data() || {};
  console.info("[DoctorDashboard] Doctor identity fields resolved.", {
    role: userData.role || null,
    doctorId: userData.doctorId || null,
    doctorID: userData.doctorID || null,
    authenticatedUid: user.uid,
  });
  if (userData.role !== "doctor") {
    console.error("[DoctorDashboard] User profile role is not doctor.", {
      role: userData.role || null,
    });
    return null;
  }
  const configuredDoctorId = userData.doctorId || userData.doctorID;

  if (configuredDoctorId) {
    console.info("[DoctorDashboard] Reading configured doctor profile.", {
      operation: "get",
      path: `doctors/${configuredDoctorId}`,
      configuredDoctorId,
      configuredDoctorIdType: typeof configuredDoctorId,
    });
    const doctor = await getDoctor(configuredDoctorId);
    console.info("[DoctorDashboard] Configured doctor profile resolved.", {
      exists: Boolean(doctor),
      resolvedDoctorDocumentId: doctor?.id || null,
      doctorUidMatchesAuthenticatedUser: doctor
        ? !doctor.uid || doctor.uid === user.uid
        : false,
      active: doctor?.active ?? null,
    });
    if (doctor && (!doctor.uid || doctor.uid === user.uid)) {
      return doctor;
    }
  }

  console.info("[DoctorDashboard] Querying doctor profile by auth UID.", {
    operation: "list",
    collection: "doctors",
    filters: ["uid == authenticated-user-uid", "limit(1)"],
  });
  let doctorQuery;
  try {
    doctorQuery = await db
      .collection("doctors")
      .where("uid", "==", user.uid)
      .limit(1)
      .get();
  } catch (error) {
    logFirestoreFailure("Query doctor profile by auth UID", error, {
      operation: "list",
      collection: "doctors",
      filters: ["uid == authenticated-user-uid", "limit(1)"],
    });
    throw error;
  }

  if (!doctorQuery.empty) {
    const document = doctorQuery.docs[0];
    const doctor = {
      id: document.id,
      ...document.data(),
    };

    console.info("[DoctorDashboard] Doctor resolved by UID fallback.", {
      resolvedDoctorDocumentId: doctor.id,
      resolvedDoctorIdType: typeof doctor.id,
      doctorUidMatchesAuthenticatedUser: doctor.uid === user.uid,
      active: doctor.active ?? null,
    });
    return doctor.active === true ? doctor : null;
  }

  return null;
}

export async function getActiveDoctors() {
  console.log("Firebase project:", db.app.options.projectId);
  console.log("Fetching doctors...");

  const snapshot = await db
    .collection("doctors")
    .where("active", "==", true)
    .get();

  console.log("Doctors snapshot size:", snapshot.size);
  console.log(
    "Doctors returned:",
    snapshot.docs.map((document) => ({
      id: document.id,
      ...document.data(),
    })),
  );

  return snapshot.docs
    .map((document) => ({
      id: document.id,
      ...document.data(),
    }))
    .sort((firstDoctor, secondDoctor) =>
      firstDoctor.name.localeCompare(secondDoctor.name),
    );
}

export async function getDoctor(doctorId) {
  let documentSnapshot;
  try {
    documentSnapshot = await db.collection("doctors").doc(doctorId).get();
  } catch (error) {
    logFirestoreFailure("Read configured doctor profile", error, {
      operation: "get",
      path: `doctors/${doctorId}`,
    });
    throw error;
  }

  if (!documentSnapshot.exists || documentSnapshot.data()?.active !== true) {
    return null;
  }

  return {
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  };
}

export function watchDoctorQueue({ doctorId, visitDate, onChange, onError }) {
  if (!doctorId || !visitDate) {
    throw new Error("A doctor ID and visit date are required.");
  }

  const queueQuery = db
    .collection("visits")
    .where("doctorId", "==", doctorId)
    .where("visitDate", "==", visitDate);

  console.info("[DoctorDashboard] Starting assigned visits listener.", {
    operation: "list",
    collection: "visits",
    resolvedDoctorId: doctorId,
    resolvedDoctorIdType: typeof doctorId,
    filters: [`doctorId == ${doctorId}`, `visitDate == ${visitDate}`],
  });

  return queueQuery.onSnapshot(
    async (snapshot) => {
      try {
        console.info("[DoctorDashboard] Assigned visits snapshot received.", {
          count: snapshot.size,
        });
        const visits = snapshot.docs
          .map((document) => ({
            id: document.id,
            ...document.data(),
          }))
          .filter((visit) => visit.visitStatus !== "Completed")
          .sort(compareQueueOrder);

        const patientIds = [
          ...new Set(visits.map((visit) => visit.patientId).filter(Boolean)),
        ];
        const patientSnapshots = await Promise.all(
          patientIds.map(async (patientId) => {
            try {
              return await db.collection("users").doc(patientId).get();
            } catch (error) {
              logFirestoreFailure("Read assigned patient profile", error, {
                operation: "get",
                path: "users/{patientId}",
              });
              throw error;
            }
          }),
        );
        const patientNames = new Map(
          patientSnapshots.map((document) => [
            document.id,
            document.data()?.displayName || "Patient",
          ]),
        );

        const appointmentIds = [
          ...new Set(
            visits.map((visit) => visit.appointmentId).filter(Boolean),
          ),
        ];
        const appointmentSnapshots = await Promise.all(
          appointmentIds.map(async (appointmentId) => {
            try {
              return await db
                .collection("appointments")
                .doc(appointmentId)
                .get();
            } catch (error) {
              logFirestoreFailure("Read assigned appointment", error, {
                operation: "get",
                path: "appointments/{appointmentId}",
              });
              throw error;
            }
          }),
        );
        const appointments = new Map(
          appointmentSnapshots.map((document) => [
            document.id,
            document.exists ? { id: document.id, ...document.data() } : null,
          ]),
        );

        onChange(
          visits.map((visit, index) => {
            const appointment = appointments.get(visit.appointmentId);
            return {
              ...visit,
              patientName: patientNames.get(visit.patientId) || "Patient",
              appointmentTime:
                visit.appointmentTime || appointment?.appointmentTime || "",
              reasonForVisit:
                visit.reasonForVisit || appointment?.reasonForVisit || "",
              visitType: normalizeVisitType(
                visit.visitType || (appointment ? "appointment" : "walk-in"),
              ),
              queuePosition: index + 1,
            };
          }),
        );
      } catch (error) {
        logFirestoreFailure("Process assigned visits snapshot", error, {
          operation: "get",
          collection: "users or appointments",
        });
        onError(error);
      }
    },
    (error) => {
      logFirestoreFailure("Assigned visits listener", error, {
        operation: "list",
        collection: "visits",
        resolvedDoctorId: doctorId,
        resolvedDoctorIdType: typeof doctorId,
        filters: [`doctorId == ${doctorId}`, `visitDate == ${visitDate}`],
      });
      onError(error);
    },
  );
}

function logFirestoreFailure(operation, error, details) {
  console.error(`[DoctorDashboard] ${operation} failed.`, {
    ...details,
    code: error?.code || "unknown",
    message: error?.message || "Unknown Firestore error",
  });
}

function compareQueueOrder(firstVisit, secondVisit) {
  const firstOrder = numericValue(
    firstVisit.queueOrder,
    firstVisit.queueNumber,
  );
  const secondOrder = numericValue(
    secondVisit.queueOrder,
    secondVisit.queueNumber,
  );

  return firstOrder - secondOrder;
}

function numericValue(primaryValue, fallbackValue) {
  const value = Number(primaryValue ?? fallbackValue);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function normalizeVisitType(visitType) {
  return String(visitType).toLowerCase() === "appointment"
    ? "Appointment"
    : "Walk-in";
}
