import { db } from "@/services/firebase";

export async function getActiveDoctors() {
  const snapshot = await db
    .collection("doctors")
    .where("active", "==", true)
    .orderBy("name")
    .get();

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

export async function getDoctor(doctorId) {
  const document = await db.collection("doctors").doc(doctorId).get();

  if (!document.exists || document.data()?.active !== true) {
    return null;
  }

  return { id: document.id, ...document.data() };
}
