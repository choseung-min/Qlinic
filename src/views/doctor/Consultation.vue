<template>
  <div class="doctor-shell">
    <DoctorHeader :doctor-name="doctor.name || user?.displayName || 'Doctor'" @logout="handleLogout" />

    <main class="consultation-page">
      <button class="back-button" type="button" @click="goToPatient">
        ← Back to Patient Information
      </button>

      <p v-if="isLoading" class="message">Loading consultation...</p>
      <p v-else-if="errorMessage" class="message error-message" role="alert">
        {{ errorMessage }}
      </p>

      <template v-else>
        <header class="consultation-header">
          <div class="patient-banner">
            <div class="queue-number">
              {{ formatQueueNumber(visit.queueNumber) }}
            </div>
            <div>
              <h1>{{ patient.displayName || "Patient" }}</h1>
              <p>
                {{ formatVisitType(visit.visitType) }}
                <span aria-hidden="true"> • </span>
                {{ visit.visitStatus }}
              </p>
            </div>
          </div>
          <span class="status-badge" :class="String(consultation.status || '').toLowerCase().replaceAll(' ', '-')">
            {{ consultation.status }}
          </span>
        </header>

        <section class="form-card">
          <label for="diagnosis">
            Diagnosis <span aria-hidden="true">*</span>
          </label>
          <textarea id="diagnosis" v-model="form.diagnosis" placeholder="Enter diagnosis" rows="4"
            :disabled="isSaving || isCompleting || !isOngoing" />

          <label for="notes">Consultation Notes</label>
          <textarea id="notes" v-model="form.notes" placeholder="Enter consultation notes, observations, etc." rows="5"
            :disabled="isSaving || isCompleting || !isOngoing" />

          <label for="medication">Medication / Prescription</label>
          <textarea id="medication" v-model="form.medication"
            placeholder="Enter prescribed medication (leave empty if no medication)" rows="4"
            :disabled="isSaving || isCompleting || !isOngoing || form.noMedicationRequired" />
          <label class="checkbox-label">
            <input v-model="form.noMedicationRequired" type="checkbox"
              :disabled="isSaving || isCompleting || !isOngoing" @change="handleMedicationChoice" />
            No medication required
          </label>
          <p class="helper-text">
            If medication is prescribed, the patient will be routed to medicine collection after consultation
            completion.
          </p>

          <p v-if="saveMessage" class="success-message" role="status">
            {{ saveMessage }}
          </p>
          <p v-if="saveError" class="message error-message" role="alert">
            {{ saveError }}
          </p>
          <p v-if="completionError" class="message error-message" role="alert">
            {{ completionError }}
          </p>

          <div class="action-row">
            <button class="save-button" type="button" :disabled="isSaving || isCompleting || !isOngoing"
              @click="handleSave">
              {{ isSaving ? "Saving..." : "Save" }}
            </button>
            <button class="complete-button" type="button" :disabled="isSaving || isCompleting || !isOngoing"
              @click="handleComplete">
              {{ isCompleting ? "Completing..." : "Complete Consultation" }}
            </button>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup>
import DoctorHeader from "@/components/common/DoctorHeader.vue";
import {
  computed,
  defineComponent,
  h,
  onMounted,
  onUnmounted,
  ref,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { auth } from "@/services/firebase";
import { signOutUser } from "@/services/auth";
import { resolveDoctorForUser } from "@/services/doctorService";
import {
  completeConsultation,
  getConsultationDetails,
  updateConsultationDetails,
} from "@/services/consultationService";

const DetailItem = defineComponent({
  props: {
    label: { type: String, required: true },
    value: { type: [String, Number], default: "" },
  },
  setup(props) {
    return () => h("div", { class: "detail-item" }, [
      h("dt", null, props.label),
      h("dd", null, props.value == null || props.value === "" ? "—" : String(props.value)),
    ]);
  },
});

const route = useRoute();
const router = useRouter();
const user = ref(null);
const doctor = ref({});
const patient = ref({});
const visit = ref({});
const consultation = ref({});
const isLoading = ref(true);
const errorMessage = ref("");
const isSaving = ref(false);
const isCompleting = ref(false);
const saveMessage = ref("");
const saveError = ref("");
const completionError = ref("");
const form = ref({
  diagnosis: "",
  notes: "",
  medication: "",
  noMedicationRequired: false,
});
let unsubscribeAuth;

const isOngoing = computed(
  () =>
    consultation.value.status === "Ongoing"
    && visit.value.visitStatus === "In Consultation",
);

onMounted(() => {
  unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
    user.value = firebaseUser;
    if (!firebaseUser) {
      await router.push({ name: "Login" });
      return;
    }

    try {
      const doctorRecord = await resolveDoctorForUser(firebaseUser);
      if (!doctorRecord) {
        throw new Error("Your doctor profile could not be found.");
      }
      doctor.value = doctorRecord;
      const details = await getConsultationDetails({
        consultationId: route.params.consultationId,
        doctorId: doctorRecord.id,
      });
      consultation.value = details.consultation;
      patient.value = details.patient;
      visit.value = details.visit;
      form.value = {
        diagnosis: details.consultation.diagnosis || "",
        notes: details.consultation.notes || "",
        medication: details.consultation.medication || "",
        noMedicationRequired: details.consultation.noMedicationRequired === true,
      };
    } catch (error) {
      console.error("Unable to load consultation.", error);
      errorMessage.value = error.code === "permission-denied"
        ? "You do not have permission to view this consultation."
        : error.message || "Unable to load consultation.";
    } finally {
      isLoading.value = false;
    }
  });
});

onUnmounted(() => unsubscribeAuth?.());

async function handleSave() {
  saveMessage.value = "";
  saveError.value = "";

  if (!form.value.diagnosis.trim()) {
    saveError.value = "Enter a diagnosis before saving.";
    return;
  }

  if (form.value.noMedicationRequired && form.value.medication.trim()) {
    saveError.value =
      "Clear the medication details before selecting no medication required.";
    return;
  }

  isSaving.value = true;
  try {
    await updateConsultationDetails({
      consultationId: consultation.value.id,
      doctorId: doctor.value.id,
      ...form.value,
    });
    saveMessage.value = "Consultation details saved.";
  } catch (error) {
    console.error("Unable to save consultation details.", error);
    saveError.value = error.code === "permission-denied"
      ? "You do not have permission to save this consultation."
      : error.message
      || "Unable to save consultation details. Your changes are still in the form.";
  } finally {
    isSaving.value = false;
  }
}

async function handleComplete() {
  saveMessage.value = "";
  saveError.value = "";
  completionError.value = "";

  if (!form.value.diagnosis.trim()) {
    completionError.value =
      "Enter a diagnosis before completing the consultation.";
    return;
  }

  if (!form.value.noMedicationRequired && !form.value.medication.trim()) {
    completionError.value =
      "Enter medication details or select no medication required.";
    return;
  }

  if (form.value.noMedicationRequired && form.value.medication.trim()) {
    completionError.value =
      "Clear the medication details before selecting no medication required.";
    return;
  }

  isCompleting.value = true;
  try {
    await completeConsultation({
      consultationId: consultation.value.id,
      doctorId: doctor.value.id,
      ...form.value,
    });
    await router.push({ name: "DoctorMain" });
  } catch (error) {
    console.error("Unable to complete consultation.", error);
    completionError.value = error.code === "permission-denied"
      ? "You do not have permission to complete this consultation."
      : error.message
      || "Unable to complete consultation. Your changes are still in the form.";
  } finally {
    isCompleting.value = false;
  }
}

function handleMedicationChoice() {
  if (form.value.noMedicationRequired) {
    form.value.medication = "";
  }
}

function goToPatient() {
  router.push({
    name: "DoctorPatientInformation",
    params: { visitId: consultation.value.visitId },
  });
}

async function handleLogout() {
  try {
    await signOutUser();
    await router.push({ name: "Login" });
  } catch (error) {
    console.error("Unable to log out.", error);
    errorMessage.value = "Unable to log out. Please try again.";
  }
}

function formatQueueNumber(value) {
  return value == null ? "—" : `Q${String(value).padStart(2, "0")}`;
}

function formatVisitType(value) {
  return String(value || "").toLowerCase() === "appointment" ? "Appointment" : "Walk-in";
}

function formatDate(value) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date pending"
    : new Intl.DateTimeFormat("en-SG", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
}
</script>

<style scoped>
.doctor-shell {
  min-height: 100vh;
}

.consultation-page {
  margin: 0 auto;
  max-width: 920px;
  padding: 28px 24px 64px;
}

.back-button {
  background: transparent;
  color: var(--color-primary-dark);
  font-size: 13px;
  font-weight: 600;
  padding: 4px 0;
}

.back-button:hover:not(:disabled) {
  background: transparent;
  color: var(--color-primary-deep, #0b5d5a);
  text-decoration: underline;
}

.consultation-header {
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-primary-dark);
  border-radius: var(--radius-card, 8px);
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: space-between;
  margin: 24px 0 16px;
  padding: 20px 24px;
}

.patient-banner {
  align-items: center;
  display: flex;
  gap: 16px;
  min-width: 0;
}

.queue-number {
  align-items: center;
  background: var(--color-primary-soft);
  border-radius: var(--radius-control, 6px);
  color: var(--color-primary-dark);
  display: flex;
  flex-shrink: 0;
  font-size: 16px;
  font-weight: 700;
  height: 52px;
  justify-content: center;
  width: 52px;
}

.consultation-header h1 {
  color: var(--color-text);
  font-size: 23px;
  line-height: 1.3;
  margin: 0 0 5px;
  overflow-wrap: anywhere;
}

.patient-banner p {
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}

.status-badge {
  background: var(--color-info-soft, #eff6ff);
  border-radius: var(--radius-badge, 4px);
  color: var(--color-info, #1d4ed8);
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 9px;
}

.status-badge.completed {
  background: var(--color-success-soft, #ecfdf5);
  color: var(--color-success, #166534);
}

.form-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card, 8px);
  padding: 28px 30px;
}

.form-card>label:not(.checkbox-label) {
  color: var(--color-text);
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 8px;
}

.form-card>label span {
  color: var(--color-danger, #b42318);
}

textarea {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control, 6px);
  color: var(--color-text);
  display: block;
  font: inherit;
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 22px;
  padding: 12px 14px;
  resize: vertical;
  width: 100%;
}

textarea::placeholder {
  color: #6b7b89;
}

textarea:focus-visible {
  border-color: var(--color-primary-dark);
}

textarea:disabled {
  background: var(--color-background);
  cursor: not-allowed;
}

.checkbox-label {
  align-items: center;
  color: var(--color-text);
  display: flex;
  font-size: 14px;
  gap: 9px;
  margin: -6px 0 12px;
}

.checkbox-label input {
  accent-color: var(--color-primary-dark);
  height: 16px;
  width: 16px;
}

.helper-text {
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 24px;
}

.action-row {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 4px;
}

.save-button,
.complete-button {
  border-radius: var(--radius-control, 6px);
  font-size: 14px;
  min-height: 44px;
  padding: 11px 18px;
}

.save-button {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  min-width: 116px;
}

.save-button:hover:not(:disabled) {
  background: var(--color-background);
  color: var(--color-primary-dark);
}

.complete-button {
  background: var(--color-primary-dark);
  color: white;
  min-width: 200px;
}

.complete-button:hover:not(:disabled) {
  background: var(--color-primary-deep, #0b5d5a);
}

.save-button:disabled,
.complete-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.success-message {
  color: var(--color-success, #166534);
  font-size: 14px;
  margin: 0 0 16px;
}

.message {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.5;
}

.error-message {
  color: var(--color-danger, #b42318);
}

@media (max-width: 700px) {
  .consultation-page {
    padding: 24px 16px 48px;
  }

  .consultation-header {
    align-items: flex-start;
    padding: 18px;
  }

  .form-card {
    padding: 20px 18px;
  }

  .action-row {
    align-items: stretch;
    flex-direction: column;
  }

  .save-button,
  .complete-button {
    width: 100%;
  }
}
</style>
