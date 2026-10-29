<template>
  <div class="doctor-shell">
    <header class="doctor-nav">
      <router-link class="doctor-brand" to="/doctor" aria-label="Qlinic doctor dashboard">
        <span class="brand-mark" aria-hidden="true">♧</span>
        <span>
          <strong>Qlinic</strong>
          <small>DOCTOR</small>
        </span>
      </router-link>

      <router-link class="dashboard-link" to="/doctor">
        <span aria-hidden="true">▦</span>
        Dashboard
      </router-link>

      <div class="doctor-account">
        <span>{{ doctor.name || user?.displayName || "Doctor" }}</span>
        <button class="logout-button" type="button" @click="handleLogout">
          <span aria-hidden="true">↪</span>
          Log out
        </button>
      </div>
    </header>

    <main class="patient-page">
      <button class="back-button" type="button" @click="router.push({ name: 'DoctorMain' })">
        ← Back to Dashboard
      </button>

      <p v-if="isLoading" class="message">Loading patient information...</p>
      <p v-else-if="errorMessage" class="message error-message" role="alert">
        {{ errorMessage }}
      </p>

      <template v-else>
        <header class="patient-header">
          <div>
            <p class="eyebrow">PATIENT INFORMATION</p>
            <h1>{{ patient.displayName || "Patient" }}</h1>
          </div>
          <span class="status-badge">{{ visit.visitStatus }}</span>
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

        <section class="info-card" aria-labelledby="medical-profile-title">
          <h2 id="medical-profile-title">Medical Profile</h2>
          <div class="detail-grid">
            <DetailItem label="Allergies" :value="patient.allergies" fallback="Not recorded" />
            <DetailItem label="Existing medical conditions" :value="patient.medicalConditions || patient.conditions" fallback="Not recorded" />
            <DetailItem label="Current medications" :value="patient.currentMedications || patient.medications" fallback="Not recorded" />
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
              <h3>{{ formatDate(consultation.consultationDate || consultation.date || consultation.completedAt || consultation.createdAt) }}</h3>
              <span class="status-badge">{{ consultation.status || "Completed" }}</span>
            </div>
            <div class="detail-grid">
              <DetailItem label="Queue number" :value="consultation.queueNumber" />
              <DetailItem label="Diagnosis" :value="consultation.diagnosis" />
              <DetailItem label="Notes" :value="consultation.notes" />
              <DetailItem label="Medication" :value="consultation.medication" />
            </div>
          </article>
        </section>

        <button
          class="start-button"
          type="button"
          :disabled="isStartingConsultation"
          @click="handleStartConsultation"
        >
          {{ isStartingConsultation ? "Starting..." : "Start Consultation" }}
        </button>
      </template>
    </main>
  </div>
</template>

<script setup>
import { defineComponent, h, onMounted, onUnmounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { auth } from "@/services/firebase";
import { signOutUser } from "@/services/auth";
import { resolveDoctorForUser } from "@/services/doctorService";
import { getDoctorPatientDetails } from "@/services/doctorPatientService";
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
    } catch (error) {
      console.error("Unable to load patient information.", error);
      errorMessage.value = error.code === "permission-denied"
        ? "You do not have permission to view this patient."
        : error.message || "Unable to load patient information.";
    } finally {
      isLoading.value = false;
    }
  });
});

onUnmounted(() => unsubscribeAuth?.());

async function handleStartConsultation() {
  if (isStartingConsultation.value || !doctor.value.id || !visit.value.id) {
    return;
  }

  isStartingConsultation.value = true;
  errorMessage.value = "";
  try {
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
    errorMessage.value = error.code === "permission-denied"
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
.doctor-shell { min-height: 100vh; }
.doctor-nav {
  align-items: center;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  min-height: 88px;
  padding: 8px max(24px, calc((100vw - 1280px) / 2));
}
.doctor-brand, .dashboard-link, .logout-button {
  align-items: center;
  display: inline-flex;
  text-decoration: none;
}
.doctor-brand { color: #141d35; gap: 12px; }
.doctor-brand strong, .doctor-brand small { display: block; }
.doctor-brand strong { font-size: 24px; }
.doctor-brand small { color: var(--color-primary-dark); font-size: 13px; letter-spacing: .06em; }
.brand-mark {
  align-items: center;
  background: var(--color-primary-dark);
  border-radius: 12px;
  color: white;
  display: inline-flex;
  font-size: 27px;
  height: 52px;
  justify-content: center;
  width: 52px;
}
.dashboard-link {
  background: var(--color-primary-soft);
  border-radius: 14px;
  color: var(--color-primary-dark);
  font-size: 18px;
  font-weight: 600;
  gap: 10px;
  padding: 14px 20px;
}
.doctor-account { align-items: center; display: flex; gap: 30px; }
.logout-button { background: transparent; color: #53647d; gap: 10px; padding: 8px 0; }
.logout-button:hover { background: transparent; color: var(--color-primary-dark); }
.patient-page { margin: 0 auto; max-width: 1120px; padding: 38px 24px 70px; }
.back-button { background: transparent; color: var(--color-primary-dark); padding: 0; }
.back-button:hover { background: transparent; text-decoration: underline; }
.patient-header { align-items: center; display: flex; justify-content: space-between; margin: 34px 0 24px; }
.eyebrow { color: var(--color-primary-dark); font-size: 13px; font-weight: 700; letter-spacing: .08em; margin: 0 0 8px; }
.patient-header h1 { color: #141d35; font-size: 36px; margin: 0; }
.status-badge { background: #c6f7ef; border-radius: 8px; color: var(--color-primary-dark); display: inline-block; font-size: 14px; font-weight: 700; padding: 8px 14px; }
.info-card, .consultation-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  margin-top: 18px;
  padding: 28px;
}
.info-card h2, .section-heading h2 { color: #141d35; font-size: 24px; margin: 0 0 22px; }
.detail-grid { display: grid; gap: 22px 40px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.detail-item { margin: 0; min-width: 0; }
.detail-item :deep(dt) { color: #8a9ab2; font-size: 12px; font-weight: 700; letter-spacing: .06em; margin-bottom: 7px; text-transform: uppercase; }
.detail-item :deep(dd) { color: #27344b; font-size: 17px; margin: 0; overflow-wrap: anywhere; }
.consultations-section { margin-top: 38px; }
.section-heading { align-items: center; display: flex; justify-content: space-between; }
.consultation-heading { align-items: center; display: flex; justify-content: space-between; margin-bottom: 20px; }
.consultation-heading h3 { color: #27344b; font-size: 19px; margin: 0; }
.empty-state, .message { color: var(--color-text-muted); font-size: 16px; }
.error-message { color: #b42318; }
.start-button { display: block; margin: 30px 0 0 auto; }
button:disabled { cursor: not-allowed; opacity: .65; }
@media (max-width: 700px) {
  .doctor-nav, .patient-header { align-items: flex-start; flex-direction: column; gap: 18px; }
  .dashboard-link { display: none; }
  .doctor-account { font-size: 14px; gap: 12px; }
  .detail-grid { grid-template-columns: 1fr; }
}
</style>
