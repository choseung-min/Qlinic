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
          <div>
            <p class="eyebrow">CONSULTATION</p>
            <h1>{{ patient.displayName || "Patient" }}</h1>
          </div>
          <span class="status-badge">{{ consultation.status }}</span>
        </header>
        <section class="info-card">
          <h2>Consultation Details</h2>
          <div class="detail-grid">
            <DetailItem label="Patient" :value="patient.displayName" />
            <DetailItem label="Queue number" :value="formatQueueNumber(visit.queueNumber)" />
            <DetailItem label="Visit type" :value="formatVisitType(visit.visitType)" />
            <DetailItem label="Doctor" :value="doctor.name" />
            <DetailItem label="Started" :value="formatDate(consultation.startedAt)" />
            <DetailItem label="Status" :value="consultation.status" />
          </div>
        </section>
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
import { getConsultationDetails } from "@/services/consultationService";

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
let unsubscribeAuth;

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
.consultation-header { align-items: center; display: flex; justify-content: space-between; margin: 34px 0 24px; }
.eyebrow { color: var(--color-primary-dark); font-size: 13px; font-weight: 700; letter-spacing: .08em; margin: 0 0 8px; }
.consultation-header h1 { color: #141d35; font-size: 36px; margin: 0; }
.status-badge { background: #c6f7ef; border-radius: 8px; color: var(--color-primary-dark); display: inline-block; font-size: 14px; font-weight: 700; padding: 8px 14px; }
.info-card { background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 18px; margin-top: 18px; padding: 28px; }
.info-card h2 { color: #141d35; font-size: 24px; margin: 0 0 22px; }
.detail-grid { display: grid; gap: 22px 40px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.detail-item :deep(dt) { color: #8a9ab2; font-size: 12px; font-weight: 700; letter-spacing: .06em; margin-bottom: 7px; text-transform: uppercase; }
.detail-item :deep(dd) { color: #27344b; font-size: 17px; margin: 0; overflow-wrap: anywhere; }
.message { color: var(--color-text-muted); font-size: 16px; }
.error-message { color: #b42318; }
@media (max-width: 700px) { .doctor-nav, .consultation-header { align-items: flex-start; flex-direction: column; gap: 18px; } .dashboard-link { display: none; } .doctor-account { font-size: 14px; gap: 12px; } .detail-grid { grid-template-columns: 1fr; } }
</style>
