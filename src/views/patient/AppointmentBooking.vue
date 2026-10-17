<template>
  <main class="page booking-page">
    <header class="page-header booking-header">
      <p class="eyebrow">Patient appointments</p>
      <h1>Book an Appointment</h1>
      <p>Choose a doctor, date and available time slot.</p>
    </header>

    <section class="card booking-card">
      <form novalidate @submit.prevent="handleSubmit">
        <div class="field-group">
          <label for="doctor">Doctor</label>
          <select id="doctor" v-model="selectedDoctor">
            <option disabled value="">Select a doctor</option>
            <option
              v-for="doctor in doctors"
              :key="doctor.id"
              :value="doctor.id"
            >
              {{ doctor.name }}
            </option>
          </select>
          <p v-if="errors.doctor" class="field-error" role="alert">
            {{ errors.doctor }}
          </p>
        </div>

        <div class="field-group">
          <label for="appointment-date">Date</label>
          <input
            id="appointment-date"
            v-model="selectedDate"
            :min="minimumDate"
            type="date"
            @change="clearTimeSlot"
          />
          <p v-if="errors.date" class="field-error" role="alert">
            {{ errors.date }}
          </p>
        </div>

        <fieldset class="field-group time-fieldset">
          <legend>Time Slot</legend>
          <div class="time-grid">
            <button
              v-for="slot in timeSlots"
              :key="slot"
              :class="{ selected: selectedTimeSlot === slot }"
              type="button"
              @click="selectTimeSlot(slot)"
            >
              {{ slot }}
            </button>
          </div>
          <p v-if="errors.time" class="field-error" role="alert">
            {{ errors.time }}
          </p>
        </fieldset>

        <div class="field-group">
          <label for="reason">Reason for visit</label>
          <textarea
            id="reason"
            v-model.trim="reasonForVisit"
            rows="3"
            placeholder="Briefly describe your symptoms or reason"
          ></textarea>
          <p v-if="errors.reason" class="field-error" role="alert">
            {{ errors.reason }}
          </p>
        </div>

        <p v-if="successMessage" class="success-message" role="status">
          {{ successMessage }}
        </p>
        <p v-if="submissionError" class="field-error" role="alert">
          {{ submissionError }}
        </p>

        <button class="confirm-button" :disabled="!isFormValid" type="submit">
          Confirm Booking
        </button>
      </form>
    </section>
  </main>
</template>

<script setup>
import { computed, reactive, ref } from "vue";

const doctors = [
  { id: "sample-sarah-lim", name: "Dr. Sarah Lim" },
  { id: "sample-daniel-tan", name: "Dr. Daniel Tan" },
  { id: "sample-emily-wong", name: "Dr. Emily Wong" },
];

const timeSlots = [
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
];

const selectedDoctor = ref("");
const selectedDate = ref("");
const selectedTimeSlot = ref("");
const reasonForVisit = ref("");
const successMessage = ref("");
const submissionError = ref("");
const errors = reactive({ doctor: "", date: "", time: "", reason: "" });

const minimumDate = computed(() => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return formatDate(tomorrow);
});

const isFormValid = computed(
  () =>
    Boolean(selectedDoctor.value) &&
    isFutureDate(selectedDate.value) &&
    Boolean(selectedTimeSlot.value) &&
    Boolean(reasonForVisit.value),
);

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isFutureDate(dateValue) {
  return Boolean(dateValue) && dateValue >= minimumDate.value;
}

function clearTimeSlot() {
  selectedTimeSlot.value = "";
  errors.time = "";
}

function selectTimeSlot(slot) {
  selectedTimeSlot.value = slot;
  errors.time = "";
}

function validateForm() {
  errors.doctor = selectedDoctor.value ? "" : "Please select a doctor.";
  errors.date = isFutureDate(selectedDate.value)
    ? ""
    : "Please choose a date after today.";
  errors.time = selectedTimeSlot.value
    ? ""
    : "Please select an available time slot.";
  errors.reason = reasonForVisit.value
    ? ""
    : "Please enter a reason for your visit.";
  return !Object.values(errors).some(Boolean);
}

function handleSubmit() {
  successMessage.value = "";
  submissionError.value = "";

  if (!validateForm()) {
    return;
  }

  successMessage.value = "Your booking details are ready to confirm.";
}
</script>

<style scoped>
.booking-page {
  max-width: 720px;
}

.booking-header {
  margin: 12px 0 20px;
}

.eyebrow {
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin: 0 0 8px;
  text-transform: uppercase;
}

.booking-card {
  max-width: 520px;
}

form,
.field-group {
  display: grid;
  gap: 8px;
}

form {
  gap: 20px;
}

label,
legend {
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
}

select,
input[type="date"],
textarea {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 7px;
  color: var(--color-text);
  padding: 11px 12px;
  width: 100%;
}

select:focus,
input:focus,
textarea:focus {
  border-color: var(--color-primary);
  outline: 2px solid var(--color-primary-soft);
}

textarea {
  min-height: 88px;
  resize: vertical;
}

.time-fieldset {
  border: 0;
  margin: 0;
  padding: 0;
}

.time-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.time-grid button {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
  padding: 10px 8px;
}

.time-grid button:hover,
.time-grid button.selected {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
}

.confirm-button {
  width: 100%;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.field-error {
  color: #b42318;
  font-size: 13px;
  margin: 0;
}

.success-message {
  background: var(--color-primary-soft);
  border-radius: 7px;
  color: var(--color-primary-dark);
  font-size: 13px;
  margin: 0;
  padding: 10px 12px;
}

@media (max-width: 480px) {
  .time-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
