<template>
  <main class="page">
    <header class="page-header">
      <h1>Register walk-in patient</h1>
      <p>Add a patient to the queue immediately. They will wait at the clinic until called.</p>
    </header>

    <section class="card registration-card">
      <form @submit.prevent="handleSubmit">
        <label for="patient-name">Patient name</label>
        <input id="patient-name" v-model.trim="patientName" required type="text" />

        <label for="patient-id">
          Patient ID <span class="optional-label">(optional)</span>
        </label>
        <input id="patient-id" v-model.trim="patientId" type="text"
          placeholder="Leave blank for a patient without an account" />
        <p class="field-help">
          A patient ID links this visit to the patient's account. A name is enough
          for patients without an account.
        </p>

        <label for="allergies">
          Allergies <span class="optional-label">(optional)</span>
        </label>
        <textarea
          id="allergies"
          v-model.trim="allergies"
          rows="2"
          placeholder="List any known allergies"
        ></textarea>

        <label for="medical-conditions">
          Existing medical conditions
          <span class="optional-label">(optional)</span>
        </label>
        <textarea
          id="medical-conditions"
          v-model.trim="medicalConditions"
          rows="2"
          placeholder="List any existing medical conditions"
        ></textarea>

        <label for="current-medications">
          Current medications <span class="optional-label">(optional)</span>
        </label>
        <textarea
          id="current-medications"
          v-model.trim="currentMedications"
          rows="2"
          placeholder="List any current medications"
        ></textarea>

        <label for="reason">Reason for visit</label>
        <textarea id="reason" v-model.trim="reasonForVisit" required rows="3"
          placeholder="Briefly describe the reason for the visit"></textarea>

        <label for="doctor">Assign doctor</label>
        <select id="doctor" v-model="selectedDoctorId" :disabled="doctorsLoading">
          <option value="">
            Auto-assign (shortest queue{{ suggestedDoctor ? `: ${suggestedDoctor.name}` : "" }})
          </option>
          <option v-for="doctor in doctors" :key="doctor.id" :value="doctor.id">
            {{ doctor.name }} · {{ doctor.queueLength }} in queue
          </option>
        </select>
        <p class="field-help">
          <template v-if="doctorsLoading">Loading available doctors...</template>
          <template v-else-if="doctors.length === 0">
            No doctors are available right now. Registration needs at least one available doctor.
          </template>
          <template v-else>
            Only doctors who are available (not on break) are listed.
          </template>
        </p>

        <p v-if="successMessage" class="success-message" role="status">
          {{ successMessage }}
        </p>
        <p v-if="errorMessage" class="error-message" role="alert">
          {{ errorMessage }}
        </p>

        <button :disabled="isSubmitting || doctorsLoading || doctors.length === 0" type="submit">
          {{ isSubmitting ? "Registering..." : "Register patient" }}
        </button>
      </form>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  getAvailableDoctorsWithLoad,
  pickShortestQueueDoctor,
  registerWalkInPatient,
} from "@/services/queueService";

const router = useRouter();
const patientName = ref("");
const patientId = ref("");
const reasonForVisit = ref("");
const allergies = ref("");
const medicalConditions = ref("");
const currentMedications = ref("");
const isSubmitting = ref(false);
const successMessage = ref("");
const errorMessage = ref("");
const doctors = ref([]);
const doctorsLoading = ref(true);
const selectedDoctorId = ref("");

const suggestedDoctor = computed(() => pickShortestQueueDoctor(doctors.value));

onMounted(loadDoctors);

async function loadDoctors() {
  doctorsLoading.value = true;
  try {
    doctors.value = await getAvailableDoctorsWithLoad();
    // drop a selection that is no longer available
    if (!doctors.value.some((doctor) => doctor.id === selectedDoctorId.value)) {
      selectedDoctorId.value = "";
    }
  } catch (error) {
    console.error("Unable to load available doctors.", error);
    errorMessage.value = "Unable to load available doctors. Please refresh the page.";
  } finally {
    doctorsLoading.value = false;
  }
}

async function handleSubmit() {
  successMessage.value = "";
  errorMessage.value = "";
  isSubmitting.value = true;

  try {
    const result = await registerWalkInPatient({
      patientName: patientName.value,
      patientId: patientId.value,
      reasonForVisit: reasonForVisit.value,
      doctorId: selectedDoctorId.value,
      allergies: allergies.value,
      medicalConditions: medicalConditions.value,
      currentMedications: currentMedications.value,
    });

    successMessage.value = `Patient registered. Queue number: Q${result.queueNumber}, assigned to ${result.doctor.name}.`;
    await router.push({ name: "StaffMain" });
  } catch (error) {
    errorMessage.value =
      error.code === "no-available-doctor"
        ? "No active doctor is available right now."
        : error.code === "doctor-unavailable"
          ? "That doctor just became unavailable. Please choose another doctor."
          : error.code === "no-remaining-time-slots"
            ? "Walk-in registration is closed because there are no remaining clinic slots today."
            : error.code === "already-in-queue"
              ? "This patient is already in today's queue."
              : error.code === "permission-denied"
                ? "You do not have permission to register a walk-in patient."
                : "Unable to register the walk-in patient. Please try again.";
    // queue lengths or availability may have changed since the page loaded
    if (error.code === "doctor-unavailable") {
      await loadDoctors();
    }
  } finally {
    isSubmitting.value = false;
  }
}

</script>

<style scoped>
.registration-card {
  max-width: var(--width-form, 640px);
}

form {
  display: grid;
  gap: 10px;
}

label {
  color: var(--color-text);
  font-size: 14px;
  font-weight: 600;
  margin-top: 8px;
}

.optional-label {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 400;
}

input,
select,
textarea {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control, 6px);
  color: var(--color-text);
  font: inherit;
  font-size: 14px;
  min-height: 44px;
  padding: 11px 12px;
  width: 100%;
}

textarea {
  line-height: 1.5;
  resize: vertical;
}

input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  border-color: var(--color-primary-dark);
}

input:disabled,
select:disabled,
textarea:disabled {
  background: var(--color-background);
  color: var(--color-text-muted);
}

.field-help {
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.5;
  margin: -4px 0 2px;
}

.error-message,
.success-message {
  font-size: 13px;
  line-height: 1.5;
  margin: 6px 0 0;
}

.error-message {
  color: var(--color-danger);
}

.success-message {
  color: var(--color-success);
}

form>button[type="submit"] {
  justify-self: start;
  margin-top: 14px;
  min-height: 44px;
  padding: 11px 18px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 600px) {
  .registration-card {
    padding: 20px 16px;
  }

  form>button[type="submit"] {
    width: 100%;
  }
}
</style>
