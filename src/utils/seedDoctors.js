import { db } from "@/services/firebase";

export async function seedDevelopmentDoctors() {
  const sampleDoctors = [
    {
      id: "sample-sarah-lim",
      name: "Dr. Sarah Lim",
      active: true,
      email: "sarah.lim@example.test",
    },
    {
      id: "sample-daniel-tan",
      name: "Dr. Daniel Tan",
      active: true,
      email: "daniel.tan@example.test",
    },
    {
      id: "sample-emily-wong",
      name: "Dr. Emily Wong",
      active: true,
      email: "emily.wong@example.test",
    },
  ];

  const batch = db.batch();

  sampleDoctors.forEach(({ id, ...doctor }) => {
    batch.set(db.collection("doctors").doc(id), doctor, { merge: true });
  });

  await batch.commit();
}
