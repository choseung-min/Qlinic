<template>
  <main class="page dashboard-page">
    <header class="page-header">
      <p class="eyebrow">Patient dashboard</p>
      <h1>Welcome, {{ patientName }}</h1>
      <p>Here's what's happening with your visits today.</p>
    </header>

    <PatientReminders />

    <p v-if="CLINIC_TEST_TIME" class="status-message" role="status">
      Testing clinic hours at {{ CLINIC_TEST_TIME }} Singapore time. Today's visits and appointments still apply.
    </p>

    <p v-if="isInitializingQueue" class="status-message" role="status">
      Checking your queue status...
    </p>

    <section
      v-else-if="currentVisit && !isQueuedVisit"
      class="card queue-card joined-queue-card"
      aria-labelledby="queue-title"
    >
      <div>
        <div class="queue-heading">
          <div class="queue-title-group">
            <h2 id="queue-title">Today's visit</h2>
            <span class="status-badge" :class="visitStatusClass">{{ visitStatusLabel }}</span>
          </div>
        </div>
        <p class="queue-note" role="status">{{ visitStatusMessage }}</p>
        <p v-if="queueError" class="error-message" role="alert">{{ queueError }}</p>
      </div>
    </section>

    <section
      v-else-if="currentVisit"
      class="card queue-card joined-queue-card"
      aria-labelledby="queue-title"
    >
      <div>
        <div class="queue-heading">
          <div class="queue-title-group">
            <h2 id="queue-title">You're in the queue</h2>
            <span class="status-badge" :class="String(currentVisit.visitStatus || '').toLowerCase().replaceAll(' ', '-')">{{ currentVisit.visitStatus }}</span>
          </div>
          <button
            v-if="canLeaveQueue"
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
            <strong>{{ formatQueueLabel(currentVisit.queueNumber) }}</strong>
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
        <p v-if="currentVisit.visitStatus === 'Called'" class="next-message">
          You're being called. Please go to the consultation room now.
        </p>
        <p v-if="breakNotice" class="queue-note">
          {{ breakNotice }}
        </p>
        <p v-else-if="currentVisit.visitStatus === 'Late'" class="queue-note">
          You were marked late and moved to the back of the queue. Please
          check in with reception when you arrive.
        </p>
        <p v-else-if="currentVisit.visitStatus === 'Absent'" class="queue-note">
          You were marked absent. Please speak to reception to rejoin the queue.
        </p>
        <p v-else-if="patientsAhead === 0" class="next-message">
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
        <p v-if="hasAppointmentToday" class="queue-note" role="alert">
          {{ WALK_IN_MESSAGES['appointment-today'] }}
        </p>
        <p v-else-if="isLoadingWalkInAppointments" class="queue-note" role="status">
          Checking today's appointments...
        </p>
        <p v-if="!clinicOpen" class="queue-note" role="status">
          {{ CLINIC_CLOSED_MESSAGE }}
        </p>
        <p v-if="queueError" class="error-message" role="alert">
          {{ queueError }}
        </p>
      </div>

      <button :disabled="isJoining || !clinicOpen || hasAppointmentToday || isLoadingWalkInAppointments || queueReadFailed" type="button" @click="handleJoinQueue">
        {{ isJoining ? "Joining..." : clinicOpen ? "Join Queue" : "Clinic Closed" }}
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
        <span class="action-icon" aria-hidden="true">◎</span>
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
            <span class="appointment-status" :class="'appointment-status--' + String(appointment.status || '').toLowerCase()">{{ appointment.status }}</span>
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
import { auth , db } from "@/services/firebase";
import PatientReminders from "@/components/patient/PatientReminders.vue";
import { CLINIC_CLOSED_MESSAGE, CLINIC_TEST_TIME, getClinicDate, isClinicOpen } from "@/utils/clinicHours";
import {
  QUEUED_VISIT_STATUSES,
  WALK_IN_MESSAGES,
  canPatientLeaveVisit,
  getVisitBlockCode,
  getPatientQueueErrorMessage,
  hasBookedAppointmentToday,
} from "@/utils/walkInEligibility";
import {
  joinWalkInQueue,
  leaveWalkInQueue,
  watchActiveWalkInVisit,
  watchPatientAppointments,
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
const walkInAppointments = ref([]);
const isLoadingWalkInAppointments = ref(true);
const queueReadFailed = ref(false);
const waitingVisits = ref([]);
const appointmentsError = ref("");
const queueError = ref("");
const doctorAvailability = ref(null);
const clockTick = ref(Date.now());
const clinicOpen = computed(() => isClinicOpen(new Date(clockTick.value)));
const hasAppointmentToday = computed(() => hasBookedAppointmentToday(
  walkInAppointments.value, getClinicDate(new Date(clockTick.value)),
));
const isQueuedVisit = computed(() => QUEUED_VISIT_STATUSES.has(currentVisit.value?.visitStatus));
const canLeaveQueue = computed(() => canPatientLeaveVisit(currentVisit.value, auth.currentUser?.uid));
const visitStatusLabel = computed(() => {
  if (currentVisit.value?.visitStatus === "Awaiting Medicine" &&
      currentVisit.value?.medicineStatus === "Ready for Collection") {
    return "Ready for Collection";
  }
  return currentVisit.value?.visitStatus || "Registered";
});
const visitStatusClass = computed(() => visitStatusLabel.value.toLowerCase().replaceAll(" ", "-"));
const visitStatusMessage = computed(() => {
  switch (visitStatusLabel.value) {
    case "Completed":
      return WALK_IN_MESSAGES["visit-completed-today"];
    case "In Consultation":
      return "You're seeing the doctor now.";
    case "Awaiting Medicine":
      return "Please wait for your medicine to be ready.";
    case "Awaiting Medicine Collection":
    case "Ready for Collection":
      return "Please collect your medicine at reception.";
    default:
      return WALK_IN_MESSAGES["walk-in-already-used"];
  }
});
let clinicHoursTimer;
let stopWalkInAppointmentsListener;
let stopActiveVisitListener;
let stopWaitingQueueListener;
let stopDoctorAvailabilityListener;
let stopAuthListener;
let breakRefreshTimer;

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

const estimatedWait = computed(() => {
  const baseWait = patientsAhead.value * 15;
  if (
    currentVisit.value?.visitStatus !== "Waiting" ||
    doctorAvailability.value?.availabilityStatus !== "On Break"
  ) {
    return baseWait;
  }

  const remainingBreak = getRemainingBreakMinutes(
    doctorAvailability.value,
    clockTick.value,
  );
  return remainingBreak == null ? baseWait : baseWait + remainingBreak;
});

const breakNotice = computed(() => {
  if (doctorAvailability.value?.availabilityStatus !== "On Break") {
    return "";
  }

  const remainingBreak = getRemainingBreakMinutes(
    doctorAvailability.value,
    clockTick.value,
  );
  if (remainingBreak == null) {
    return "Your doctor is currently on break. The return time is not available; this estimate is approximate.";
  }
  if (remainingBreak === 0) {
    return "Your doctor remains on break. The displayed wait is approximate and may be stale until the doctor returns.";
  }

  return `Your doctor is on break. The displayed wait includes approximately ${remainingBreak} minute${remainingBreak === 1 ? "" : "s"} of remaining break time.`;
});

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

function formatQueueLabel(queueNumber) {
  const value = String(queueNumber);
  return value.startsWith("A")
    ? `A${formatQueueNumber(value.slice(1))}`
    : `Q${formatQueueNumber(value)}`;
}

function openAppointment(appointmentId) {
  router.push({ name: "History", query: { appointmentId } });
}

function handleQueueListenerError(error) {
  queueReadFailed.value = true;
  console.error(
    "Unable to load queue information:",
    error.queueOperation,
    error.code,
    error.message,
    error,
  );
  queueError.value = getPatientQueueErrorMessage(error, "read");
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
      startDoctorAvailabilityListener(visit?.doctorId);

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

function startDoctorAvailabilityListener(doctorId) {
  stopDoctorAvailabilityListener?.();
  stopDoctorAvailabilityListener = undefined;
  doctorAvailability.value = null;
  clearInterval(breakRefreshTimer);
  breakRefreshTimer = undefined;

  if (!doctorId) {
    return;
  }

  stopDoctorAvailabilityListener = db
    .collection("doctors")
    .doc(doctorId)
    .onSnapshot(
      (snapshot) => {
        doctorAvailability.value = snapshot.exists
          ? { id: snapshot.id, ...snapshot.data() }
          : null;
        clearInterval(breakRefreshTimer);
        if (doctorAvailability.value?.availabilityStatus === "On Break") {
          breakRefreshTimer = window.setInterval(() => {
            clockTick.value = Date.now();
          }, 60_000);
        } else {
          clockTick.value = Date.now();
        }
      },
      (error) => {
        console.error("Unable to load doctor availability for queue estimate.", error);
        doctorAvailability.value = null;
      },
    );
}

function getRemainingBreakMinutes(doctor, now) {
  const startedAt = toDate(doctor?.breakStartedAt);
  const duration = Number(doctor?.breakDurationMinutes);
  if (!startedAt || !Number.isInteger(duration) || duration < 1) {
    return null;
  }

  return Math.max(
    0,
    Math.ceil((startedAt.getTime() + duration * 60_000 - now) / 60_000),
  );
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function handleJoinQueue() {
  if (isJoining.value || isInitializingQueue.value || isLoadingWalkInAppointments.value || queueReadFailed.value) return;
  queueError.value = "";
  clockTick.value = Date.now();

  if (!clinicOpen.value) {
    queueError.value = CLINIC_CLOSED_MESSAGE;
    return;
  }

  if (!auth.currentUser?.uid) {
    queueError.value = "Please sign in before joining the queue.";
    return;
  }

  if (currentVisit.value || hasAppointmentToday.value) {
    queueError.value = currentVisit.value
      ? WALK_IN_MESSAGES[getVisitBlockCode(currentVisit.value)] : WALK_IN_MESSAGES["appointment-today"];
    return;
  }

  isJoining.value = true;

  try {
    // Let the live listener display the latest status, including staff updates.
    await joinWalkInQueue(auth.currentUser.uid);
  } catch (error) {
    console.error(
      "Unable to join the walk-in queue:",
      error.queueOperation,
      error.code,
      error.message,
      error,
    );
    queueError.value = error.code === "clinic-closed"
      ? CLINIC_CLOSED_MESSAGE : getPatientQueueErrorMessage(error);
  } finally {
    isJoining.value = false;
  }
}

async function handleLeaveQueue() {
  if (isLeaving.value || !canLeaveQueue.value || !window.confirm("Leave today's queue?")) {
    return;
  }

  queueError.value = "";
  isLeaving.value = true;

  try {
    // The live listener owns the current visit; it may have advanced meanwhile.
    await leaveWalkInQueue(auth.currentUser.uid);
  } catch (error) {
    console.error(
      "Unable to leave the walk-in queue:",
      error.queueOperation,
      error.code,
      error.message,
      error,
    );
    queueError.value = getPatientQueueErrorMessage(error, "leave");
  } finally {
    isLeaving.value = false;
  }
}

onMounted(() => {
  clockTick.value = Date.now();
  clinicHoursTimer = window.setInterval(() => {
    clockTick.value = Date.now();
  }, 1_000);
  stopAuthListener = auth.onAuthStateChanged((user) => {
    stopWalkInAppointmentsListener?.();
    stopActiveVisitListener?.();
    stopWaitingQueueListener?.();
    stopDoctorAvailabilityListener?.();
    clearInterval(breakRefreshTimer);
    currentVisit.value = null;
    waitingVisits.value = [];
    walkInAppointments.value = [];
    queueReadFailed.value = !user;
    isInitializingQueue.value = Boolean(user);
    isLoadingWalkInAppointments.value = Boolean(user);
    queueError.value = "";

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
    stopWalkInAppointmentsListener = watchPatientAppointments(user.uid, (appointments) => {
      walkInAppointments.value = appointments;
      isLoadingWalkInAppointments.value = false;
    }, handleQueueListenerError);
    startActiveVisitListener(user.uid);
  });
});

onUnmounted(() => {
  stopWalkInAppointmentsListener?.();
  clearInterval(clinicHoursTimer);
  stopAuthListener?.();
  stopActiveVisitListener?.();
  stopWaitingQueueListener?.();
  stopDoctorAvailabilityListener?.();
  clearInterval(breakRefreshTimer);
});
</script>

<style scoped>
.dashboard-page {
  max-width: 1000px;
}

.eyebrow {
  color: var(--color-primary-dark);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  margin: 0 0 6px;
  text-transform: uppercase;
}

.dashboard-page .page-header {
  margin-bottom: 20px;
}

.appointments-section {
  margin: 32px 0;
}

.section-heading {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 14px;
}

.section-heading h2 {
  font-size: 19px;
  margin: 0;
}

.book-new-button {
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-primary-dark);
  display: inline-flex;
  font-size: 13px;
  font-weight: 600;
  gap: 5px;
  padding: 9px 12px;
  text-decoration: none;
}

.book-new-button:hover {
  background: var(--color-primary-soft);
}

.appointments-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.appointment-card {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 150px;
  padding: 18px;
  transition: border-color 0.2s ease;
}

.appointment-card:hover {
  border-color: var(--color-primary);
}

.appointment-card:focus-visible {
  outline: 2px solid var(--color-primary-dark);
  outline-offset: 3px;
}

.appointment-card h3,
.appointment-card p {
  margin: 0;
}

.appointment-card h3 {
  font-size: 15px;
}

.appointment-card p {
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.appointment-card > strong {
  font-size: 14px;
  margin-top: auto;
}

.appointment-topline {
  align-items: center;
  color: var(--color-text-muted);
  display: flex;
  flex-wrap: wrap;
  font-size: 12px;
  gap: 8px;
  justify-content: space-between;
}

.appointment-status {
  background: var(--color-primary-soft);
  border-radius: var(--radius-badge);
  color: var(--color-primary-dark);
  font-size: 11px;
  font-weight: 600;
  padding: 5px 9px;
  text-transform: capitalize;
}

.appointment-status--completed {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.appointment-status--cancelled {
  background: #eef2f4;
  color: var(--color-text-muted);
}

.empty-message,
.status-message {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.5;
}

.queue-card {
  align-items: center;
  display: flex;
  gap: 24px;
  justify-content: space-between;
  margin-top: 16px;
}

.joined-queue-card {
  background: var(--color-surface);
  border-left: 3px solid var(--color-primary-dark);
  display: block;
}

.queue-heading {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: space-between;
  width: 100%;
}

.queue-title-group {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.queue-card h2 {
  font-size: 18px;
  margin: 0 0 6px;
}

.status-badge {
  background: #eef2f4;
  border-radius: var(--radius-badge);
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 600;
  padding: 5px 9px;
}

.status-badge.called,
.status-badge.in-consultation {
  background: var(--color-info-soft);
  color: var(--color-info);
}

.status-badge.late,
.status-badge.awaiting-medicine,
.status-badge.awaiting-medicine-collection {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.status-badge.completed,
.status-badge.ready-for-collection {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.queue-stats {
  align-items: center;
  display: grid;
  gap: 18px;
  grid-template-columns: 112px repeat(3, minmax(0, 1fr));
  margin-top: 20px;
}

.queue-stats > div {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.queue-stats span {
  color: var(--color-text-muted);
  font-size: 12px;
}

.queue-stats strong {
  color: var(--color-text);
  font-size: 19px;
  font-variant-numeric: tabular-nums;
}

.queue-number {
  align-content: center;
  background: var(--color-primary-soft);
  border-radius: var(--radius-control);
  justify-items: center;
  min-height: 102px;
  padding: 12px;
}

.queue-number strong,
.queue-number span {
  color: var(--color-primary-dark);
}

.queue-number strong {
  font-size: 27px;
}

.queue-card p {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
}

.queue-card .next-message,
.queue-card .queue-note {
  background: var(--color-primary-soft);
  border-radius: var(--radius-control);
  color: var(--color-primary-dark);
  margin-top: 20px;
  padding: 11px 12px;
}

.queue-card .next-message {
  border-left: 3px solid var(--color-primary-dark);
  font-weight: 600;
}

.queue-card .error-message {
  color: var(--color-danger);
  margin-top: 10px;
}

.quick-actions {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin-top: 16px;
}

.quick-action {
  align-items: flex-start;
  color: inherit;
  display: flex;
  gap: 12px;
  min-height: 98px;
  padding: 18px;
  text-decoration: none;
  transition: border-color 0.2s ease;
}

.quick-action:hover {
  border-color: var(--color-primary);
}

.quick-action strong,
.quick-action small {
  display: block;
}

.quick-action strong {
  font-size: 14px;
  margin-bottom: 6px;
}

.quick-action small {
  color: var(--color-text-muted);
  font-size: 12px;
  line-height: 1.5;
}

.action-icon {
  align-items: center;
  background: var(--color-primary-soft);
  border-radius: var(--radius-control);
  color: var(--color-primary-dark);
  display: inline-flex;
  flex: 0 0 34px;
  font-size: 17px;
  height: 34px;
  justify-content: center;
}

.leave-button {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-primary-dark);
  padding: 9px 12px;
}

.leave-button:hover:not(:disabled) {
  background: var(--color-primary-soft);
}

.error-message {
  color: var(--color-danger);
  font-size: 13px;
  margin-top: 10px;
}

.success-message {
  background: var(--color-primary-soft);
  border-radius: var(--radius-control);
  color: var(--color-primary-dark);
  margin-top: 12px;
  padding: 10px 12px;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

@media (max-width: 850px) {
  .appointments-grid,
  .quick-actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .appointments-grid,
  .quick-actions {
    grid-template-columns: 1fr;
  }

  .queue-card {
    align-items: stretch;
    flex-direction: column;
  }

  .queue-card > button {
    width: 100%;
  }

  .queue-stats {
    gap: 12px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .queue-heading {
    align-items: flex-start;
  }
}
</style>
