import { auth, db } from "./firebase";

async function findDoctorRecord(doctorId, uid) {
  for (const collectionName of ["doctors", "doctor"]) {
    const doctorQuery = await db
      .collection(collectionName)
      .where("doctorId", "==", doctorId)
      .where("uid", "==", uid)
      .limit(1)
      .get();

    if (!doctorQuery.empty) {
      return doctorQuery.docs[0];
    }

    const doctorDocument = await db.collection(collectionName).doc(doctorId).get();

    if (
      doctorDocument.exists &&
      doctorDocument.data()?.uid === uid &&
      (!doctorDocument.data()?.doctorId ||
        doctorDocument.data()?.doctorId === doctorId)
    ) {
      return doctorDocument;
    }
  }

  return null;
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
  const credential = await auth.signInWithEmailAndPassword(email, password);
  const userSnapshot = await db.collection("users").doc(credential.user.uid).get();

  if (!userSnapshot.exists) {
    await auth.signOut();
    throw new Error("Your account profile has not been set up.");
  }

  const userData = userSnapshot.data();

  if (userData.role === "doctor") {
    if (!staffId || !/^D/.test(staffId)) {
      await auth.signOut();
      throw new Error("Please enter a doctor ID starting with D.");
    }

    const doctorDocument = await findDoctorRecord(
      staffId,
      credential.user.uid,
    );

    if (
      !doctorDocument
    ) {
      await auth.signOut();
      throw new Error("The doctor ID could not be verified.");
    }

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
