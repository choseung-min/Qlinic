<template>
  <div class="doctor-shell">
    <header class="doctor-nav">
      <router-link class="doctor-brand" to="/doctor" aria-label="Qlinic doctor dashboard">
        <span class="brand-mark" aria-hidden="true">♧</span>
        <span><strong>Qlinic</strong><small>DOCTOR</small></span>
      </router-link>
      <router-link class="dashboard-link" to="/doctor">▦ Dashboard</router-link>
      <div class="doctor-account">
        <span>{{ doctor.name || user?.displayName || "Doctor" }}</span>
        <button class="logout-button" type="button" @click="handleLogout">↪ Log out</button>
      </div>
    </header>

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
            <div class="queue-number">{{ formatQueueNumber(visit.queueNumber) }}</div>
            <div>
              <h1>{{ patient.displayName || "Patient" }}</h1>
              <p>
                {{ formatVisitType(visit.visitType) }}
                <span aria-hidden="true"> • </span>
                {{ visit.visitStatus }}
              </p>
            </div>
          </div>
          <span class="status-badge">{{ consultation.status }}</span>
        </header>
        <section class="form-card">
          <label for="diagnosis">Diagnosis <span aria-hidden="true">*</span></label>
          <textarea
            id="diagnosis"
            v-model="form.diagnosis"
            placeholder="Enter diagnosis"
            rows="4"
            :disabled="isSaving || isCompleting || !isOngoing"
          />

          <label for="notes">Consultation Notes</label>
          <textarea
            id="notes"
            v-model="form.notes"
            placeholder="Enter consultation notes, observations, etc."
            rows="5"
            :disabled="isSaving || isCompleting || !isOngoing"
          />

          <label for="medication">Medication / Prescription</label>
          <textarea
            id="medication"
            v-model="form.medication"
            placeholder="Enter prescribed medication (leave empty if no medication)"
            rows="4"
            :disabled="isSaving || isCompleting || !isOngoing || form.noMedicationRequired"
          />
          <label class="checkbox-label">
            <input
              v-model="form.noMedicationRequired"
              type="checkbox"
              :disabled="isSaving || isCompleting || !isOngoing"
              @change="handleMedicationChoice"
            />
            No medication required
          </label>
          <p class="helper-text">
            If medication is prescribed, the patient will be routed to medicine collection after consultation completion.
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
            <button
              class="save-button"
              type="button"
              :disabled="isSaving || isCompleting || !isOngoing"
              @click="handleSave"
            >
              {{ isSaving ? "Saving..." : "Save" }}
            </button>
            <button
              class="complete-button"
              type="button"
              :disabled="isSaving || isCompleting || !isOngoing"
              @click="handleComplete"
            >
              {{ isCompleting ? "Completing..." : "Complete Consultation" }}
            </button>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup>
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
.doctor-shell { min-height: 100vh; }
.doctor-nav { align-items: center; background: var(--color-surface); border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; min-height: 88px; padding: 8px max(24px, calc((100vw - 1280px) / 2)); }
.doctor-brand, .dashboard-link, .logout-button { align-items: center; display: inline-flex; text-decoration: none; }
.doctor-brand { color: #141d35; gap: 12px; }
.doctor-brand strong, .doctor-brand small { display: block; }
.doctor-brand strong { font-size: 24px; }
.doctor-brand small { color: var(--color-primary-dark); font-size: 13px; letter-spacing: .06em; }
.brand-mark { align-items: center; background: var(--color-primary-dark); border-radius: 12px; color: white; display: inline-flex; font-size: 27px; height: 52px; justify-content: center; width: 52px; }
.dashboard-link { background: var(--color-primary-soft); border-radius: 14px; color: var(--color-primary-dark); font-size: 18px; font-weight: 600; gap: 10px; padding: 14px 20px; }
.doctor-account { align-items: center; display: flex; gap: 30px; }
.logout-button { background: transparent; color: #53647d; gap: 10px; padding: 8px 0; }
.consultation-page { margin: 0 auto; max-width: 1120px; padding: 38px 24px 70px; }
.back-button { background: transparent; color: var(--color-primary-dark); padding: 0; }
.back-button:hover { background: transparent; text-decoration: underline; }
.consultation-header { align-items: center; background: #effcf9; border: 2px solid #b8f1e7; border-radius: 18px; display: flex; justify-content: space-between; margin: 34px 0 24px; padding: 20px; }
.patient-banner { align-items: center; display: flex; gap: 16px; }
.queue-number { align-items: center; background: #347e76; border-radius: 10px; color: white; display: flex; font-size: 18px; font-weight: 700; height: 62px; justify-content: center; width: 62px; }
.consultation-header h1 { color: #141d35; font-size: 25px; margin: 0 0 5px; }
.patient-banner p { color: #53647d; margin: 0; }
.status-badge { background: #c6f7ef; border-radius: 8px; color: var(--color-primary-dark); display: inline-block; font-size: 14px; font-weight: 700; padding: 8px 14px; }
.form-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 18px; margin-top: 18px; padding: 30px 34px; }
.form-card > label:not(.checkbox-label) { color: #27344b; display: block; font-size: 17px; font-weight: 700; margin: 8px 0 10px; }
.form-card > label span { color: #b42318; }
textarea { border: 1px solid #d5dfe8; border-radius: 8px; box-sizing: border-box; color: #27344b; display: block; font: inherit; margin-bottom: 22px; padding: 14px; resize: vertical; width: 100%; }
textarea:focus { border-color: var(--color-primary-dark); outline: 2px solid #c6f7ef; }
.checkbox-label { align-items: center; color: #53647d; display: flex; gap: 9px; margin: -8px 0 12px; }
.checkbox-label input { accent-color: var(--color-primary-dark); height: 16px; width: 16px; }
.helper-text { color: #8a9ab2; font-size: 14px; margin: 0 0 26px; }
.action-row { display: grid; gap: 16px; grid-template-columns: 1fr 1fr; }
.save-button, .complete-button { border-radius: 8px; min-height: 48px; }
.save-button { background: white; border: 1px solid #d5dfe8; color: #27344b; }
.save-button:hover:not(:disabled) { background: #f5faf9; }
.complete-button { background: var(--color-primary-dark); color: white; }
.success-message { color: #18794e; font-size: 15px; margin: 0 0 16px; }
.message { color: var(--color-text-muted); font-size: 16px; }
.error-message { color: #b42318; }
@media (max-width: 700px) { .doctor-nav, .consultation-header { align-items: flex-start; flex-direction: column; gap: 18px; } .dashboard-link { display: none; } .doctor-account { font-size: 14px; gap: 12px; } .form-card { padding: 24px 18px; } .action-row { grid-template-columns: 1fr; } }
</style>
