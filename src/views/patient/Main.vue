<template>
  <main class="page dashboard-page">
    <header class="page-header">
      <p class="eyebrow">Patient dashboard</p>
      <h1>Welcome, {{ patientName }}</h1>
      <p>Here's what's happening with your visits today.</p>
    </header>

    <p v-if="isInitializingQueue" class="status-message" role="status">
      Checking your queue status...
    </p>

    <section
      v-else-if="currentVisit"
      class="card queue-card joined-queue-card"
      aria-labelledby="queue-title"
    >
      <div>
        <div class="queue-heading">
          <div class="queue-title-group">
            <h2 id="queue-title">You're in the queue</h2>
            <span class="status-badge">{{ currentVisit.visitStatus }}</span>
          </div>
          <button
            class="leave-button"
            :disabled="isLeaving"
            type="button"
            @click="handleLeaveQueue"
          >
            {{ isLeaving ? "Leaving..." : "Leave Queue" }}
          </button>
        </div>
        <div class="queue-stats">
          <div class="queue-number">
            <strong>Q{{ formatQueueNumber(currentVisit.queueNumber) }}</strong>
            <span>Queue No.</span>
          </div>
          <div>
            <span>Queue Position</span>
            <strong>{{ queuePosition ? `#${queuePosition}` : "--" }}</strong>
          </div>
          <div>
            <span>Patients Ahead</span>
            <strong>{{ patientsAhead }}</strong>
          </div>
          <div>
            <span>Est. Wait</span>
            <strong>{{ estimatedWait }} min</strong>
          </div>
        </div>
        <p v-if="patientsAhead === 0" class="next-message">
          You're next! Please head to the clinic now.
        </p>
        <p v-else class="queue-note">
          You are in the queue. Please monitor your queue position.
        </p>
        <p v-if="queueError" class="error-message" role="alert">
          {{ queueError }}
        </p>
      </div>
    </section>

    <section v-else class="card queue-card" aria-labelledby="queue-title">
      <div>
        <h2 id="queue-title">Not currently in the queue</h2>
        <p>Join the walk-in queue remotely, no need to wait at the clinic.</p>
        <p v-if="queueError" class="error-message" role="alert">
          {{ queueError }}
        </p>
      </div>

      <button :disabled="isJoining" type="button" @click="handleJoinQueue">
        {{ isJoining ? "Joining..." : "Join Queue" }}
      </button>
    </section>

    <section class="quick-actions" aria-label="Quick actions">
      <router-link class="quick-action card" to="/appointment-booking">
        <span class="action-icon" aria-hidden="true">▣</span>
        <span>
          <strong>Book Appointment</strong>
          <small>Pick a doctor, date and time slot.</small>
        </span>
      </router-link>
      <router-link class="quick-action card" to="/history">
        <span class="action-icon" aria-hidden="true">↶</span>
        <span>
          <strong>View History</strong>
          <small>See your past visits and outcomes.</small>
        </span>
      </router-link>
      <router-link class="quick-action card" to="/personal-details">
        <span class="action-icon" aria-hidden="true">♙</span>
        <span>
          <strong>My Profile</strong>
          <small>Update your personal details.</small>
        </span>
      </router-link>
    </section>

    <section class="appointments-section" aria-labelledby="upcoming-title">
      <div class="section-heading">
        <h2 id="upcoming-title">Upcoming Appointments</h2>
        <router-link class="book-new-button" to="/appointment-booking">
          <span aria-hidden="true">＋</span> Book New
        </router-link>
      </div>

      <p v-if="isLoadingAppointments" class="status-message" role="status">
        Loading appointments...
      </p>
      <p v-else-if="appointmentsError" class="error-message" role="alert">
        {{ appointmentsError }}
      </p>
      <p v-else-if="!upcomingAppointments.length" class="empty-message">
        You have no upcoming appointments.
      </p>
      <div v-else class="appointments-grid">
        <article
          v-for="appointment in upcomingAppointments"
          :key="appointment.id"
          class="appointment-card card"
          role="link"
          tabindex="0"
          @click="openAppointment(appointment.id)"
          @keydown.enter="openAppointment(appointment.id)"
          @keydown.space.prevent="openAppointment(appointment.id)"
        >
          <div class="appointment-topline">
            <span class="appointment-status">{{ appointment.status }}</span>
            <span>{{ formatAppointmentDate(appointment.date) }}</span>
          </div>
          <h3>{{ appointment.doctorName }}</h3>
          <p>{{ appointment.reason }}</p>
          <strong>{{ formatAppointmentTime(appointment.time) }}</strong>
        </article>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { auth, db } from "@/services/firebase";
import {
  joinWalkInQueue,
  leaveWalkInQueue,
  watchActiveWalkInVisit,
  watchWaitingWalkIns,
} from "@/services/queueService";

const isJoining = ref(false);
const router = useRouter();
const patientName = ref("there");
const isLeaving = ref(false);
const isLoadingAppointments = ref(true);
const isInitializingQueue = ref(true);
const upcomingAppointments = ref([]);
const currentVisit = ref(null);
const waitingVisits = ref([]);
const appointmentsError = ref("");
const queueError = ref("");
let stopActiveVisitListener;
let stopWaitingQueueListener;
let stopAuthListener;

const patientsAhead = computed(() => {
  if (!currentVisit.value || currentVisit.value.visitStatus !== "Waiting") {
    return 0;
  }

  return waitingVisits.value.filter(
    (visit) => visit.queueOrder < currentVisit.value.queueOrder,
  ).length;
});

const queuePosition = computed(() =>
  currentVisit.value?.visitStatus === "Waiting" ? patientsAhead.value + 1 : 0,
);

const estimatedWait = computed(() => patientsAhead.value * 15);

async function loadPatientProfile(user) {
  patientName.value = user.displayName?.trim() || "there";

  try {
    const userSnapshot = await db.collection("users").doc(user.uid).get();
    const displayName = userSnapshot.data()?.displayName?.trim();

    if (displayName && auth.currentUser?.uid === user.uid) {
      patientName.value = displayName;
    }
  } catch (error) {
    console.error("Unable to load patient profile.", error);
  }
}

async function loadUpcomingAppointments(patientId) {
  isLoadingAppointments.value = true;
  appointmentsError.value = "";

  try {
    const snapshot = await db
      .collection("appointments")
      .where("patientId", "==", patientId)
      .get();
    const today = getLocalDate();

    const appointments = await Promise.all(
      snapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .filter(
          (appointment) =>
            appointment.appointmentDate >= today &&
            appointment.status === "booked",
        )
        .map(async (appointment) => {
          const doctorSnapshot = appointment.doctorId
            ? await db.collection("doctors").doc(appointment.doctorId).get()
            : null;

          return {
            id: appointment.id,
            doctorName: doctorSnapshot?.exists
              ? doctorSnapshot.data()?.name || "Doctor unavailable"
              : "Doctor unavailable",
            reason: appointment.reasonForVisit || "No reason provided",
            date: appointment.appointmentDate,
            time: appointment.appointmentTime,
            status: appointment.status,
          };
        }),
    );

    appointments.sort((firstAppointment, secondAppointment) =>
      `${firstAppointment.date}${firstAppointment.time}`.localeCompare(
        `${secondAppointment.date}${secondAppointment.time}`,
      ),
    );
    upcomingAppointments.value = appointments;
  } catch (error) {
    console.error("Unable to load upcoming appointments.", error);
    appointmentsError.value = "Unable to load upcoming appointments.";
    upcomingAppointments.value = [];
  } finally {
    isLoadingAppointments.value = false;
  }
}

function getLocalDate() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatAppointmentDate(dateValue) {
  if (!dateValue) {
    return "Date unavailable";
  }

  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("en-SG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatAppointmentTime(timeValue) {
  if (!timeValue) {
    return "Time unavailable";
  }

  const [hours, minutes] = timeValue.split(":").map(Number);
  const time = new Date();
  time.setHours(hours, minutes, 0, 0);
  return time.toLocaleTimeString("en-SG", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatQueueNumber(queueNumber) {
  return String(queueNumber).padStart(2, "0");
}

function openAppointment(appointmentId) {
  router.push({ name: "History", query: { appointmentId } });
}

function handleQueueListenerError(error) {
  console.error(
    "Unable to load queue information:",
    error.queueOperation,
    error.code,
    error.message,
    error,
  );
  queueError.value =
    error.code === "permission-denied"
      ? `Queue information is not available (${error.queueOperation || "unknown operation"}: ${error.code}).`
      : `Unable to load queue information (${error.queueOperation || "unknown operation"}: ${error.code || "unknown error"}).`;
  isInitializingQueue.value = false;
}

function startWaitingQueueListener(visitDate) {
  stopWaitingQueueListener?.();
  stopWaitingQueueListener = watchWaitingWalkIns(
    visitDate,
    (visits) => {
      waitingVisits.value = visits;
    },
    handleQueueListenerError,
  );
}

function startActiveVisitListener(patientId) {
  stopActiveVisitListener = watchActiveWalkInVisit(
    patientId,
    (visit) => {
      currentVisit.value = visit;
      isInitializingQueue.value = false;

      if (visit) {
        startWaitingQueueListener(visit.visitDate);
      } else {
        stopWaitingQueueListener?.();
        waitingVisits.value = [];
      }
    },
    handleQueueListenerError,
  );
}

async function handleJoinQueue() {
  queueError.value = "";

  if (!auth.currentUser?.uid) {
    queueError.value = "Please sign in before joining the queue.";
    return;
  }

  isJoining.value = true;

  try {
    const visit = await joinWalkInQueue(auth.currentUser.uid);
    currentVisit.value = visit;
    isInitializingQueue.value = false;
    startWaitingQueueListener(visit.visitDate);
  } catch (error) {
    console.error(
      "Unable to join the walk-in queue:",
      error.queueOperation,
      error.code,
      error.message,
      error,
    );
    queueError.value =
      error.code === "duplicate-booking"
        ? "You are already in today's walk-in queue."
        : error.code === "permission-denied"
          ? `You do not have permission to join the queue (${error.queueOperation || "unknown operation"}).`
          : `Unable to join the queue (${error.queueOperation || "unknown operation"}: ${error.code || "unknown error"}).`;
  } finally {
    isJoining.value = false;
  }
}

async function handleLeaveQueue() {
  if (!auth.currentUser?.uid || !window.confirm("Leave today's queue?")) {
    return;
  }

  queueError.value = "";
  isLeaving.value = true;

  try {
    await leaveWalkInQueue(auth.currentUser.uid);
    currentVisit.value = null;
    waitingVisits.value = [];
  } catch (error) {
    console.error(
      "Unable to leave the walk-in queue:",
      error.queueOperation,
      error.code,
      error.message,
      error,
    );
    queueError.value =
      error.code === "permission-denied"
        ? "You do not have permission to leave the queue."
        : "Unable to leave the queue. Please try again.";
  } finally {
    isLeaving.value = false;
  }
}

onMounted(() => {
  stopAuthListener = auth.onAuthStateChanged((user) => {
    stopActiveVisitListener?.();
    stopWaitingQueueListener?.();

    if (!user) {
      patientName.value = "there";
      upcomingAppointments.value = [];
      isLoadingAppointments.value = false;
      isInitializingQueue.value = false;
      queueError.value = "Please sign in before viewing your queue.";
      return;
    }

    console.log("Queue auth user:", user.uid);
    loadPatientProfile(user);
    loadUpcomingAppointments(user.uid);
    startActiveVisitListener(user.uid);
  });
});

onUnmounted(() => {
  stopAuthListener?.();
  stopActiveVisitListener?.();
  stopWaitingQueueListener?.();
});
</script>

<style scoped>
.dashboard-page {
  max-width: 950px;
}

.eyebrow {
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin: 0 0 8px;
  text-transform: uppercase;
}

.appointments-section {
  margin: 28px 0 32px;
}

.section-heading {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 14px;
}

.section-heading h2 {
  font-size: 16px;
  margin: 0;
}

.book-new-button {
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: 7px;
  color: var(--color-primary-dark);
  display: inline-flex;
  font-size: 12px;
  font-weight: 600;
  gap: 5px;
  padding: 7px 10px;
  text-decoration: none;
}

.book-new-button:hover {
  background: var(--color-primary-soft);
}

.appointments-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.appointment-card {
  cursor: pointer;
  display: grid;
  gap: 8px;
  min-height: 150px;
  padding: 16px;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease;
}

.appointment-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.appointment-card:focus-visible {
  outline: 3px solid var(--color-primary);
  outline-offset: 3px;
}

.appointment-card h3,
.appointment-card p {
  margin: 0;
}

.appointment-card h3 {
  font-size: 14px;
}

.appointment-card p {
  color: var(--color-text-muted);
  font-size: 13px;
}

.appointment-card strong {
  font-size: 13px;
}

.appointment-topline {
  align-items: center;
  color: var(--color-text-muted);
  display: flex;
  font-size: 12px;
  justify-content: space-between;
}

.appointment-status {
  background: var(--color-primary-soft);
  border-radius: 4px;
  color: var(--color-primary-dark);
  font-weight: 700;
  padding: 4px 8px;
  text-transform: capitalize;
}

.empty-message {
  color: var(--color-text-muted);
  font-size: 13px;
}

.queue-card {
  align-items: center;
  display: flex;
  gap: 24px;
  justify-content: space-between;
  margin-top: 22px;
}

.joined-queue-card {
  background: #f2fffb;
  border-color: #b7eee3;
  display: block;
}

.queue-heading {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-content: space-between;
  width: 100%;
}

.queue-title-group {
  align-items: center;
  display: flex;
  gap: 12px;
}

.status-badge {
  background: #c7f4e9;
  border-radius: 999px;
  color: var(--color-primary-dark);
  font-size: 12px;
  font-weight: 700;
  padding: 5px 10px;
}

.queue-stats {
  align-items: stretch;
  display: grid;
  gap: 18px;
  grid-template-columns: 1.2fr repeat(3, 1fr);
  margin-top: 20px;
}

.queue-stats > div {
  display: grid;
  gap: 5px;
}

.queue-stats span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.queue-stats strong {
  color: var(--color-text);
  font-size: 18px;
}

.queue-number {
  aspect-ratio: 1;
  background: var(--color-primary);
  border-radius: 8px;
  color: var(--color-surface);
  justify-items: center;
  padding: 12px;
  width: 114px;
}

.queue-number strong,
.queue-number span {
  color: inherit;
}

.queue-number strong {
  font-size: 24px;
}

.next-message,
.queue-note {
  background: #cdf7ed;
  border-radius: 7px;
  color: var(--color-primary-dark) !important;
  margin-top: 20px !important;
  padding: 11px 12px;
}

.status-message {
  color: var(--color-text-muted);
  font-size: 13px;
  margin-top: 24px;
}

.queue-card h2 {
  font-size: 14px;
  margin: 0 0 6px;
}

.queue-card p {
  color: var(--color-text-muted);
  font-size: 13px;
  margin: 0;
}

.queue-card button {
  flex: 0 0 auto;
}

.quick-actions {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 22px;
}

.quick-action {
  align-items: flex-start;
  color: inherit;
  display: flex;
  gap: 12px;
  min-height: 84px;
  padding: 16px;
  text-decoration: none;
  transition:
    border-color 0.2s ease,
    transform 0.2s ease;
}

.quick-action:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.quick-action strong,
.quick-action small {
  display: block;
}

.quick-action strong {
  font-size: 13px;
  margin-bottom: 5px;
}

.quick-action small {
  color: var(--color-text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.action-icon {
  align-items: center;
  color: var(--color-primary);
  display: inline-flex;
  font-size: 18px;
  height: 22px;
  justify-content: center;
  width: 22px;
}

.leave-button {
  background: transparent;
  border: 1px solid #b7eee3;
  color: var(--color-primary-dark);
  padding: 8px 12px;
}

.leave-button:hover {
  background: #dffaf4;
}

.error-message {
  color: #b42318 !important;
  margin-top: 10px !important;
}

.success-message {
  background: var(--color-primary-soft);
  border-radius: 7px;
  color: var(--color-primary-dark) !important;
  margin-top: 12px !important;
  padding: 9px 11px;
}

button:disabled {
  cursor: wait;
  opacity: 0.65;
}

@media (max-width: 560px) {
  .appointments-grid,
  .quick-actions {
    grid-template-columns: 1fr;
  }

  .queue-card {
    align-items: flex-start;
    flex-direction: column;
  }

  .queue-card button {
    width: 100%;
  }

  .queue-stats {
    gap: 12px;
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
