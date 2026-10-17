import { db } from "@/services/firebase";

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
  const documentSnapshot = await db.collection("doctors").doc(doctorId).get();

  if (!documentSnapshot.exists() || documentSnapshot.data()?.active !== true) {
    return null;
  }

  return {
    id: documentSnapshot.id,
    ...documentSnapshot.data(),
  };
}
