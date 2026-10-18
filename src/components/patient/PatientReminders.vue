<template>
  <section v-if="reminders.length" class="patient-reminders" aria-label="Appointment reminders">
    <ReminderBanner v-for="item in reminders" :key="item.id" :message="item.message" />
  </section>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { auth, db } from "@/services/firebase";
import { getActiveDoctors } from "@/services/doctorService";
import ReminderBanner from "@/components/patient/ReminderBanner.vue";
import { shouldShowReminder, buildReminderText } from "@/utils/reminderLogic";

const reminders = ref([]);
let unsubscribeAuth;

// Load this patient's booked appointments and keep the ones 7, 3 or 1 days away.
async function loadReminders(uid) {
  const snapshot = await db
    .collection("appointments")
    .where("patientId", "==", uid)
    .where("status", "==", "booked")
    .get();

  const dueAppointments = snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter(shouldShowReminder);

  if (!dueAppointments.length) {
    reminders.value = [];
    return;
  }

  // appointments only store doctorId, so look the doctor's name up
  const doctors = await getActiveDoctors();
  const doctorNames = Object.fromEntries(doctors.map((doctor) => [doctor.id, doctor.name]));

  reminders.value = dueAppointments.map((appt) => ({
    id: appt.id,
    message: buildReminderText(appt, doctorNames[appt.doctorId]),
  }));
}

onMounted(() => {
  unsubscribeAuth = auth.onAuthStateChanged((user) => {
    if (user) {
      loadReminders(user.uid).catch((error) => {
        console.error("Unable to load reminders.", error);
      });
    } else {
      reminders.value = [];
    }
  });
});

onUnmounted(() => {
  unsubscribeAuth?.();
});
</script>