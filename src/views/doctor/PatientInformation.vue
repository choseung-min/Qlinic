<template>
  <div class="doctor-shell">
    <DoctorHeader :doctor-name="doctor.name || user?.displayName || 'Doctor'" @logout="handleLogout" />

    <main class="patient-page">
      <button class="back-button" type="button" @click="router.push({ name: 'DoctorMain' })">
        ← Back to Dashboard
      </button>

      <p v-if="isLoading" class="message">
        Loading patient information...
      </p>
      <p v-else-if="errorMessage" class="message error-message" role="alert">
        {{ errorMessage }}
      </p>

      <template v-else>
        <header class="patient-header">
          <div>
            <p class="eyebrow">PATIENT INFORMATION</p>
            <h1>{{ patient.displayName || "Patient" }}</h1>
          </div>
          <span class="status-badge" :class="String(visit.visitStatus || '').toLowerCase().replaceAll(' ', '-')">
            {{ visit.visitStatus }}
          </span>
        </header>

        <section class="info-card" aria-labelledby="patient-details-title">
          <h2 id="patient-details-title">Patient Details</h2>
          <div class="detail-grid">
            <DetailItem label="Full name" :value="patient.displayName" />
            <DetailItem label="Date of birth" :value="patient.dateOfBirth" />
            <DetailItem label="Sex" :value="patient.sex" />
            <DetailItem label="Phone" :value="patient.mobileNumber" />
            <DetailItem label="NRIC/FIN or patient identifier" :value="patient.patientIdentifier" />
            <DetailItem label="Email address" :value="patient.email" />
          </div>
        </section>

        <section class="info-card" aria-labelledby="current-visit-title">
          <h2 id="current-visit-title">Current Visit</h2>
          <div class="detail-grid">
            <DetailItem label="Visit type" :value="formatVisitType(visit.visitType)" />
            <DetailItem label="Appointment time" :value="visit.appointmentTime || appointment?.appointmentTime" />
            <DetailItem label="Queue number" :value="formatQueueNumber(visit.queueNumber)" />
            <DetailItem label="Queue position" :value="visit.queuePosition" />
            <DetailItem label="Reason for visit" :value="visit.reasonForVisit || appointment?.reasonForVisit" />
            <DetailItem label="Status" :value="visit.visitStatus" />
          </div>
        </section>

        <section class="info-card medical-profile-card" aria-labelledby="medical-profile-title">
          <h2 id="medical-profile-title">Medical Profile</h2>
          <div class="detail-grid">
            <DetailItem label="Allergies" :value="patient.allergies" fallback="Not recorded" />
            <DetailItem label="Existing medical conditions" :value="patient.medicalConditions || patient.conditions"
              fallback="Not recorded" />
            <DetailItem label="Current medications" :value="patient.currentMedications || patient.medications"
              fallback="Not recorded" />
          </div>
        </section>

        <section class="consultations-section" aria-labelledby="consultations-title">
          <div class="section-heading">
            <h2 id="consultations-title">Past Consultations</h2>
          </div>

          <p v-if="!consultations.length" class="empty-state">
            No previous consultations recorded.
          </p>
          <p v-if="consultationError" class="message error-message" role="alert">
            {{ consultationError }}
          </p>

          <article v-for="consultation in consultations" :key="consultation.id" class="consultation-card">
            <div class="consultation-heading">
              <h3>
                {{
                  formatDate(
                    consultation.consultationDate ||
                    consultation.date ||
                    consultation.completedAt ||
                    consultation.createdAt
                  )
                }}
              </h3>
              <span class="status-badge"
                :class="String(consultation.status || 'Completed').toLowerCase().replaceAll(' ', '-')">
                {{ consultation.status || "Completed" }}
              </span>
            </div>

            <div class="detail-grid">
              <DetailItem label="Queue number" :value="consultation.queueNumber" />
              <DetailItem label="Diagnosis" :value="consultation.diagnosis" />
              <DetailItem label="Notes" :value="consultation.notes" />
              <DetailItem label="Medication" :value="consultation.medication" />
            </div>
          </article>
        </section>

        <button class="start-button" type="button" :disabled="isStartingConsultation" @click="handleStartConsultation">
          {{ isStartingConsultation ? "Starting..." : "Start Consultation" }}
        </button>
      </template>
    </main>
  </div>
</template>

<script setup>
import DoctorHeader from "@/components/common/DoctorHeader.vue";
import { defineComponent, h, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { auth } from "@/services/firebase";
import { signOutUser } from "@/services/auth";
import { resolveDoctorForUser } from "@/services/doctorService";
import {
  getDoctorPatientDetails,
  watchDoctorPatientVisit,
} from "@/services/doctorPatientService";
import { startConsultation } from "@/services/consultationService";

const DetailItem = defineComponent({
  props: {
    label: { type: String, required: true },
    value: { type: [String, Number], default: "" },
    fallback: { type: String, default: "—" },
  },
  setup(props) {
    return () =>
      h("div", { class: "detail-item" }, [
        h("dt", null, props.label),
        h(
          "dd",
          null,
          props.value === "" || props.value == null
            ? props.fallback
            : String(props.value),
        ),
      ]);
  },
});

const route = useRoute();
const router = useRouter();
const user = ref(null);
const doctor = ref({});
const patient = ref({});
const visit = ref({});
const appointment = ref(null);
const consultations = ref([]);
const consultationError = ref("");
const isLoading = ref(true);
const errorMessage = ref("");
const isStartingConsultation = ref(false);
let unsubscribeAuth;
let unsubscribeVisit;

onMounted(() => {
  unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
    user.value = firebaseUser;
    if (!firebaseUser) {
      await router.push({ name: "Login" });
      return;
    }

    try {
      doctor.value = await resolveDoctorForUser(firebaseUser);
      if (!doctor.value) {
        throw new Error("Your doctor profile could not be found.");
      }

      const details = await getDoctorPatientDetails({
        visitId: route.params.visitId,
        doctorId: doctor.value.id,
      });
      visit.value = details.visit;
      patient.value = details.patient;
      appointment.value = details.appointment;
      consultations.value = details.consultations;
      consultationError.value = details.consultationError || "";
      unsubscribeVisit = watchDoctorPatientVisit(
        route.params.visitId,
        (updatedVisit) => {
          if (
            updatedVisit.doctorId !== doctor.value.id
            || updatedVisit.visitStatus !== "Called"
          ) {
            patient.value = {};
            visit.value = {};
            appointment.value = null;
            consultations.value = [];
            errorMessage.value =
              "This patient must be called by staff before you can view their information or start consultation.";
            return;
          }

          visit.value = updatedVisit;
          errorMessage.value = "";
        },
        (error) => {
          console.error("Unable to monitor patient visit access.", error);
          patient.value = {};
          visit.value = {};
          appointment.value = null;
          consultations.value = [];
          errorMessage.value = "Unable to verify access to this patient.";
        },
      );
    } catch (error) {
      console.error("Unable to load patient information.", error);
      errorMessage.value = error.code === "visit-not-called"
        ? error.message
        : error.code === "permission-denied"
        ? "You do not have permission to view this patient."
        : error.message || "Unable to load patient information.";
    } finally {
      isLoading.value = false;
    }
  });
});

onUnmounted(() => unsubscribeAuth?.());
onUnmounted(() => unsubscribeVisit?.());

async function handleStartConsultation() {
  if (isStartingConsultation.value || !doctor.value.id || !visit.value.id) {
    return;
  }

  isStartingConsultation.value = true;
  errorMessage.value = "";
  try {
    if (visit.value.visitStatus !== "Called") {
      errorMessage.value =
        "This patient must be called by staff before you can view their information or start consultation.";
      return;
    }

    const result = await startConsultation({
      visitId: visit.value.id,
      doctorId: doctor.value.id,
    });
    await router.push({
      name: "DoctorConsultation",
      params: { consultationId: result.id },
    });
  } catch (error) {
    console.error("Unable to start consultation.", error);
    errorMessage.value = error.message?.includes("current status")
      ? "This patient must be called by staff before you can start consultation."
      : error.code === "permission-denied"
      ? "You do not have permission to start this consultation."
      : error.message || "Unable to start consultation.";
  } finally {
    isStartingConsultation.value = false;
  }
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
  return value == null ? "" : `Q${String(value).padStart(2, "0")}`;
}

function formatVisitType(value) {
  return String(value || "").toLowerCase() === "appointment"
    ? "Appointment"
    : value
      ? "Walk-in"
      : "";
}

function formatDate(value) {
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date not recorded"
    : new Intl.DateTimeFormat("en-SG", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(date);
}
</script>

<style scoped>
.doctor-shell {
  min-height: 100vh;
}

.patient-page {
  margin: 0 auto;
  max-width: var(--width-content, 1150px);
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

.patient-header {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  margin: 24px 0 20px;
}

.eyebrow {
  color: var(--color-primary-dark);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.07em;
  margin: 0 0 6px;
}

.patient-header h1 {
  color: var(--color-text);
  font-size: 28px;
  line-height: 1.25;
  margin: 0;
  overflow-wrap: anywhere;
}

.status-badge {
  background: #f0f3f5;
  border-radius: var(--radius-badge, 4px);
  color: var(--color-text-muted);
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  padding: 5px 9px;
}

.status-badge.in-consultation,
.status-badge.called,
.status-badge.ongoing {
  background: var(--color-info-soft, #eff6ff);
  color: var(--color-info, #1d4ed8);
}

.status-badge.awaiting-medicine,
.status-badge.late {
  background: var(--color-warning-soft, #fffbeb);
  color: var(--color-warning, #92400e);
}

.status-badge.completed {
  background: var(--color-success-soft, #ecfdf5);
  color: var(--color-success, #166534);
}

.info-card,
.consultation-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card, 8px);
  margin-top: 12px;
  padding: 24px;
}

.medical-profile-card {
  border-left: 3px solid var(--color-primary);
}

.info-card h2,
.section-heading h2 {
  color: var(--color-text);
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 20px;
}

.detail-grid {
  display: grid;
  gap: 20px 28px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.detail-item {
  min-width: 0;
}

.detail-item :deep(dt) {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 5px;
}

.detail-item :deep(dd) {
  color: var(--color-text);
  font-size: 15px;
  line-height: 1.5;
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.consultations-section {
  margin-top: 32px;
}

.section-heading h2 {
  margin-bottom: 16px;
}

.consultation-card {
  margin-top: 10px;
}

.consultation-heading {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: space-between;
  margin-bottom: 18px;
}

.consultation-heading h3 {
  color: var(--color-text);
  font-size: 16px;
  margin: 0;
}

.empty-state,
.message {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.5;
}

.empty-state {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card, 8px);
  margin: 0;
  padding: 20px;
}

.error-message {
  color: var(--color-danger, #b42318);
}

.start-button {
  display: block;
  margin: 24px 0 0 auto;
  min-height: 42px;
  padding: 10px 18px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

@media (max-width: 700px) {
  .patient-page {
    padding: 24px 16px 48px;
  }

  .patient-header {
    align-items: flex-start;
  }

  .detail-grid {
    grid-template-columns: 1fr;
  }

  .info-card,
  .consultation-card {
    padding: 18px;
  }
}
</style>
