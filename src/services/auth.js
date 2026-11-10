import { auth, db } from "./firebase";

function logFirestoreFailure(operation, error, details) {
  console.error(`[DoctorLogin] ${operation} failed.`, {
    ...details,
    errorCode: error?.code || "unknown",
    errorMessage: error?.message || "Unknown Firestore error",
  });
}

async function findDoctorRecord(doctorId, uid) {
  for (const collectionName of ["doctors", "doctor"]) {
    const path = `${collectionName}/${doctorId}`;
    console.info("[DoctorLogin] Reading doctor document.", {
      operation: "get",
      path,
    });

    try {
      const doctorDocument = await db
        .collection(collectionName)
        .doc(doctorId)
        .get();

      console.info("[DoctorLogin] Doctor document read completed.", {
        operation: "get",
        path,
        exists: doctorDocument.exists,
      });

      if (
        doctorDocument.exists &&
        doctorDocument.data()?.uid === uid &&
        (!doctorDocument.data()?.doctorId ||
          doctorDocument.data()?.doctorId === doctorId)
      ) {
        return doctorDocument;
      }
    } catch (error) {
      logFirestoreFailure("Read doctor document", error, {
        operation: "get",
        path,
      });
      throw error;
    }
  }

  for (const collectionName of ["doctors", "doctor"]) {
    console.info("[DoctorLogin] Querying doctor document by authenticated UID.", {
      operation: "list",
      collection: collectionName,
      filters: ["uid == authenticated-user-uid", "doctorId == entered-doctor-id"],
    });

    try {
      const doctorQuery = await db
        .collection(collectionName)
        .where("doctorId", "==", doctorId)
        .where("uid", "==", uid)
        .limit(1)
        .get();

      console.info("[DoctorLogin] Doctor UID query completed.", {
        operation: "list",
        collection: collectionName,
        resultCount: doctorQuery.size,
      });

      if (!doctorQuery.empty) {
        return doctorQuery.docs[0];
      }
    } catch (error) {
      logFirestoreFailure("Query doctor document by authenticated UID", error, {
        operation: "list",
        collection: collectionName,
        filters: [
          "uid == authenticated-user-uid",
          "doctorId == entered-doctor-id",
        ],
      });
      throw error;
    }
  }

  return null;
}

async function readUserProfile(uid) {
  console.info("[DoctorLogin] Reading user profile.", {
    operation: "get",
    path: `users/${uid}`,
  });

  try {
    const userSnapshot = await db.collection("users").doc(uid).get();
    console.info("[DoctorLogin] User profile read completed.", {
      operation: "get",
      path: `users/${uid}`,
      exists: userSnapshot.exists,
    });
    return userSnapshot;
  } catch (error) {
    logFirestoreFailure("Read user profile", error, {
      operation: "get",
      path: `users/${uid}`,
    });
    throw error;
  }
}

export async function registerPatient({
  displayName,
  email,
  password,
  mobileNumber,
  dateOfBirth,
  sex,
  patientIdentifier,
  address,
  preferredLanguage,
  allergies,
  medicalConditions,
  currentMedications,
}) {
  const credential = await auth.createUserWithEmailAndPassword(email, password);
  const { uid } = credential.user;

  try {
    const profileData = {
      displayName,
      email,
      mobileNumber,
      dateOfBirth,
      sex,
      patientIdentifier,
      address,
      preferredLanguage,
      allergies,
      medicalConditions,
      currentMedications,
    };

    await db.collection("users").doc(uid).set({
      ...profileData,
      role: "patient",
    });

    await db.collection("patients").doc(uid).set(profileData);
  } catch (error) {
    await credential.user.delete().catch(() => {
      // Keep the original Firestore error for the user if cleanup is denied.
    });
    throw error;
  }

  return credential.user;
}

export async function signInUser({ email, password, staffId }) {
  console.info("[DoctorLogin] Authentication started.");
  let credential;
  try {
    credential = await auth.signInWithEmailAndPassword(email, password);
    console.info("[DoctorLogin] Authentication succeeded.", {
      authenticatedUid: credential.user.uid,
    });
  } catch (error) {
    console.error("[DoctorLogin] Authentication failed.", {
      errorCode: error?.code || "unknown",
      errorMessage: error?.message || "Unknown authentication error",
    });
    throw error;
  }

  const userSnapshot = await readUserProfile(credential.user.uid);

  if (!userSnapshot.exists) {
    await auth.signOut();
    throw new Error("Your account profile has not been set up.");
  }

  const userData = userSnapshot.data();
  console.info("[DoctorLogin] Checking account role.", {
    role: userData.role || null,
    hasDoctorId: typeof userData.doctorId === "string",
    hasLegacyDoctorId: typeof userData.doctorID === "string",
  });

  if (userData.role === "doctor") {
    const enteredDoctorId = staffId?.trim();
    const mappedDoctorId = userData.doctorId || userData.doctorID;

    if (!enteredDoctorId) {
      await auth.signOut();
      throw new Error("Please enter your doctor ID.");
    }

    if (
      typeof mappedDoctorId !== "string" ||
      enteredDoctorId !== mappedDoctorId
    ) {
      await auth.signOut();
      throw new Error("The doctor ID could not be verified.");
    }

    console.info("[DoctorLogin] Resolving doctor ID.", {
      enteredDoctorId,
      authenticatedUid: credential.user.uid,
    });
    const doctorDocument = await findDoctorRecord(
      enteredDoctorId,
      credential.user.uid,
    );

    if (!doctorDocument) {
      await auth.signOut();
      throw new Error("The doctor ID could not be verified.");
    }

    console.info("[DoctorLogin] Doctor profile loaded.", {
      documentId: doctorDocument.id,
    });
    return { user: credential.user, role: "doctor" };
  }

  if (userData.role === "staff") {
    if (!staffId) {
      await auth.signOut();
      throw new Error("Please enter your staff ID.");
    }

    const staffQuery = await db
      .collection("staff")
      .where("staffId", "==", staffId)
      .where("uid", "==", credential.user.uid)
      .limit(1)
      .get();

    if (staffQuery.empty) {
      await auth.signOut();
      throw new Error("The staff ID could not be verified.");
    }

    return { user: credential.user, role: "staff" };
  }

  if (userData.role === "patient") {
    return { user: credential.user, role: "patient" };
  }

  if (userData.role !== "staff" && userData.role !== "doctor") {
    await auth.signOut();
    throw new Error("Your account has an invalid role.");
  }
}

export function signOutUser() {
  return auth.signOut();
}
