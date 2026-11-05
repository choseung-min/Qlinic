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
        <input
          id="patient-id"
          v-model.trim="patientId"
          type="text"
          placeholder="Leave blank for a patient without an account"
        />
        <p class="field-help">
          A patient ID links this visit to the patient's account. A name is enough
          for patients without one.
        </p>

        <label for="reason">Reason for visit</label>
        <textarea
          id="reason"
          v-model.trim="reasonForVisit"
          required
          rows="3"
          placeholder="Briefly describe the reason for the visit"
        ></textarea>

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
  max-width: 560px;
}

form {
  display: grid;
  gap: 10px;
}

label {
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
  margin-top: 6px;
}

input,
select,
textarea {
  border: 1px solid var(--color-border);
  border-radius: 7px;
  color: var(--color-text);
  font: inherit;
  padding: 11px 12px;
}

textarea {
  resize: vertical;
}

input:focus,
select:focus,
textarea:focus {
  border-color: var(--color-primary);
  outline: 2px solid var(--color-primary-soft);
}

.optional-label,
.field-help {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 400;
}

.field-help {
  margin: -4px 0 2px;
}

.error-message {
  color: #b42318;
  font-size: 13px;
}

.success-message {
  color: #067647;
  font-size: 13px;
}

button:disabled {
  cursor: wait;
  opacity: 0.65;
}
</style>
