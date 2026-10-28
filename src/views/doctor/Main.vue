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

    <main class="doctor-page">
      <p v-if="errorMessage" class="message error-message" role="alert">
        {{ errorMessage }}
      </p>
      <p v-else-if="isLoading" class="message">Loading your patient queue...</p>

      <template v-else>
        <header class="doctor-header">
          <div>
            <h1>{{ doctor.name || "Doctor" }}</h1>
            <p>{{ doctor.specialisation || "General Practice" }}</p>
          </div>
          <div class="availability-controls">
            <span class="availability-badge">{{ availabilityLabel }}</span>
            <button class="break-button" type="button" disabled title="Availability management is not available yet">
              <span aria-hidden="true">☕</span>
              Go On Break
            </button>
          </div>
        </header>

        <section class="next-patient-panel" aria-labelledby="next-patient-title">
          <h2 id="next-patient-title">NEXT PATIENT</h2>
          <div v-if="nextPatient" class="next-patient-content">
            <div class="queue-number queue-number-primary">
              Q{{ formatQueueNumber(nextPatient.queueNumber) }}
            </div>
            <div class="patient-summary">
              <h3>{{ nextPatient.patientName }}</h3>
              <p>{{ visitDescription(nextPatient) }}</p>
              <span class="status-badge">{{ nextPatient.visitStatus }}</span>
            </div>
            <button class="details-button" type="button" disabled title="Patient details are not available yet">
              <span aria-hidden="true">◉</span>
              View Details
            </button>
          </div>
          <p v-else class="empty-state">No waiting patients assigned to you at the moment.</p>
        </section>

        <section class="queue-section" aria-labelledby="queue-title">
          <h2 id="queue-title">Your Patient Queue ({{ visits.length }})</h2>
          <p v-if="visits.length === 0" class="empty-state queue-empty">
            No patient visits assigned to you today.
          </p>
          <div v-else class="queue-list">
            <article v-for="visit in visits" :key="visit.id" class="patient-card">
              <div class="queue-number queue-number-muted">
                Q{{ formatQueueNumber(visit.queueNumber) }}
              </div>
              <div class="patient-summary">
                <h3>{{ visit.patientName }} <span>#{{ visit.queuePosition }}</span></h3>
                <p>{{ visitDescription(visit) }}</p>
              </div>
              <span class="status-badge" :class="statusClass(visit.visitStatus)">
                {{ visit.visitStatus }}
              </span>
              <button class="view-button" type="button" disabled title="Patient details are not available yet">
                <span aria-hidden="true">◉</span>
                View
              </button>
            </article>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { auth } from "@/services/firebase";
import { signOutUser } from "@/services/auth";
import { resolveDoctorForUser, watchDoctorQueue } from "@/services/doctorService";

const router = useRouter();
const user = ref(null);
const doctor = ref({});
const visits = ref([]);
const isLoading = ref(true);
const errorMessage = ref("");
let unsubscribeAuth;
let unsubscribeQueue;

const nextPatient = computed(
  () => visits.value.find((visit) => visit.visitStatus === "Waiting") || null,
);
const availabilityLabel = computed(() => {
  if (doctor.value.availability) {
    return doctor.value.availability;
  }

  if (doctor.value.available === false) {
    return "On Break";
  }

  return "Available";
});

onMounted(() => {
  unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
    user.value = firebaseUser;
    unsubscribeQueue?.();
    unsubscribeQueue = null;
    isLoading.value = true;
    errorMessage.value = "";

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
      unsubscribeQueue = watchDoctorQueue({
        doctorId: doctorRecord.id,
        visitDate: getLocalDate(),
        onChange: (queue) => {
          visits.value = queue;
          isLoading.value = false;
        },
        onError: (error) => {
          console.error("Unable to load the doctor's queue.", error);
          errorMessage.value = "Unable to load your patient queue.";
          isLoading.value = false;
        },
      });
    } catch (error) {
      console.error("Unable to load the doctor dashboard.", error);
      errorMessage.value = error.message || "Unable to load the doctor dashboard.";
      isLoading.value = false;
    }
  });
});

onUnmounted(() => {
  unsubscribeQueue?.();
  unsubscribeAuth?.();
});

async function handleLogout() {
  try {
    await signOutUser();
    await router.push({ name: "Login" });
  } catch (error) {
    console.error("Unable to log out.", error);
    errorMessage.value = "Unable to log out. Please try again.";
  }
}

function getLocalDate() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatQueueNumber(queueNumber) {
  return queueNumber == null ? "—" : String(queueNumber).padStart(2, "0");
}

function visitDescription(visit) {
  return [visit.visitType, visit.appointmentTime, visit.reasonForVisit]
    .filter(Boolean)
    .join("  •  ");
}

function statusClass(status) {
  return String(status).toLowerCase().replaceAll(" ", "-");
}
</script>

<style scoped>
.doctor-shell {
  min-height: 100vh;
}

.doctor-nav {
  align-items: center;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  min-height: 88px;
  padding: 8px max(24px, calc((100vw - 1280px) / 2));
}

.doctor-brand,
.dashboard-link,
.logout-button {
  align-items: center;
  color: #53647d;
  display: inline-flex;
  text-decoration: none;
}

.doctor-brand {
  color: #141d35;
  gap: 12px;
}

.doctor-brand strong,
.doctor-brand small {
  display: block;
}

.doctor-brand strong {
  font-size: 24px;
}

.doctor-brand small {
  color: var(--color-primary-dark);
  font-size: 13px;
  letter-spacing: 0.06em;
  margin-top: 2px;
}

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
  font-size: 23px;
  font-weight: 600;
  gap: 10px;
  padding: 15px 22px;
}

.dashboard-link span {
  font-size: 29px;
  line-height: 0.7;
}

.doctor-account {
  align-items: center;
  display: flex;
  font-size: 21px;
  gap: 30px;
}

.logout-button {
  background: transparent;
  color: #53647d;
  font-size: 17px;
  gap: 12px;
  padding: 8px 0;
}

.logout-button:hover {
  background: transparent;
  color: var(--color-primary-dark);
}

.doctor-page {
  margin: 0 auto;
  max-width: 1330px;
  padding: 58px 24px 70px;
}

.doctor-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 42px;
}

.doctor-header h1 {
  color: #141d35;
  font-size: 38px;
  margin: 0 0 10px;
}

.doctor-header p,
.patient-summary p {
  color: #60728d;
  font-size: 24px;
  margin: 0;
}

.availability-controls {
  align-items: center;
  display: flex;
  gap: 20px;
}

.availability-badge,
.status-badge {
  background: #c6f7ef;
  border-radius: 8px;
  color: var(--color-primary-dark);
  display: inline-block;
  font-size: 18px;
  font-weight: 700;
  padding: 8px 16px;
}

.break-button,
.view-button {
  background: var(--color-surface);
  border: 1px solid #d6e0e5;
  box-shadow: var(--shadow-card);
  color: #111827;
}

.break-button {
  font-size: 20px;
  padding: 15px 25px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 1;
}

.next-patient-panel {
  background: linear-gradient(110deg, #edfffb, #fff);
  border: 1px solid #75e4d8;
  border-radius: 22px;
  padding: 38px;
}

.next-patient-panel h2 {
  color: var(--color-primary-dark);
  font-size: 20px;
  letter-spacing: 0.04em;
  margin: 0 0 22px;
}

.next-patient-content,
.patient-card {
  align-items: center;
  display: flex;
  gap: 26px;
}

.queue-number {
  align-items: center;
  border-radius: 16px;
  display: flex;
  flex: 0 0 76px;
  font-size: 22px;
  font-weight: 700;
  height: 76px;
  justify-content: center;
}

.queue-number-primary {
  background: var(--color-primary-dark);
  color: white;
}

.queue-number-muted {
  background: #f0f4f8;
  color: #34445b;
}

.patient-summary {
  min-width: 0;
}

.patient-summary h3 {
  color: #141d35;
  font-size: 28px;
  margin: 0 0 8px;
}

.patient-summary h3 span {
  color: #91a1bb;
  font-size: 20px;
  margin-left: 8px;
}

.patient-summary .status-badge {
  margin-top: 12px;
}

.details-button {
  margin-left: auto;
  min-width: 190px;
}

.details-button,
.view-button {
  border-radius: 10px;
  font-size: 18px;
  padding: 14px 22px;
}

.details-button {
  background: var(--color-primary-dark);
}

.queue-section {
  margin-top: 42px;
}

.queue-section > h2 {
  color: #141d35;
  font-size: 29px;
  margin: 0 0 22px;
}

.queue-list {
  display: grid;
  gap: 20px;
}

.patient-card {
  background: var(--color-surface);
  border: 1px solid #e8eef2;
  border-radius: 18px;
  min-height: 128px;
  padding: 26px;
}

.patient-card .patient-summary {
  flex: 1;
}

.patient-card .patient-summary h3 {
  font-size: 24px;
}

.patient-card .patient-summary p {
  font-size: 20px;
}

.patient-card .status-badge {
  margin-left: auto;
}

.view-button {
  min-width: 132px;
}

.empty-state,
.message {
  color: var(--color-text-muted);
  font-size: 16px;
  margin: 0;
}

.queue-empty {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 18px;
  padding: 28px;
}

.error-message {
  color: #b42318;
}

@media (max-width: 760px) {
  .doctor-nav,
  .doctor-header,
  .next-patient-content,
  .patient-card {
    align-items: flex-start;
    flex-direction: column;
  }

  .dashboard-link {
    display: none;
  }

  .doctor-account {
    font-size: 14px;
    gap: 8px;
  }

  .doctor-page {
    padding: 32px 16px;
  }

  .availability-controls {
    width: 100%;
  }

  .details-button,
  .patient-card .status-badge,
  .view-button {
    margin-left: 0;
  }
}
</style>
