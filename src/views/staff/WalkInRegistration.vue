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

        <p v-if="successMessage" class="success-message" role="status">
          {{ successMessage }}
        </p>
        <p v-if="errorMessage" class="error-message" role="alert">
          {{ errorMessage }}
        </p>

        <button :disabled="isSubmitting" type="submit">
          {{ isSubmitting ? "Registering..." : "Register patient" }}
        </button>
      </form>
    </section>
  </main>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { registerWalkInPatient } from "@/services/queueService";

const router = useRouter();
const patientName = ref("");
const patientId = ref("");
const reasonForVisit = ref("");
const isSubmitting = ref(false);
const successMessage = ref("");
const errorMessage = ref("");

async function handleSubmit() {
  successMessage.value = "";
  errorMessage.value = "";
  isSubmitting.value = true;

  try {
    const result = await registerWalkInPatient({
      patientName: patientName.value,
      patientId: patientId.value,
      reasonForVisit: reasonForVisit.value,
    });

    successMessage.value = `Patient registered. Queue number: Q${result.queueNumber}.`;
    await router.push({ name: "StaffMain" });
  } catch (error) {
    errorMessage.value =
      error.code === "no-available-doctor"
        ? "No active doctor is available right now."
        : error.code === "no-remaining-time-slots"
          ? "Walk-in registration is closed because there are no remaining clinic slots today."
        : error.code === "permission-denied"
          ? "You do not have permission to register a walk-in patient."
          : "Unable to register the walk-in patient. Please try again.";
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
