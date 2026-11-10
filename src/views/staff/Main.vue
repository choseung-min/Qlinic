<template>
  <main class="page staff-dashboard">
    <header class="staff-page-header">
      <h1>Staff Dashboard</h1>
      <p>Today's appointments and patient queues</p>
    </header>
    <p
      v-if="appointmentsError || visitsError"
      class="error-message"
      role="alert"
    >
      {{ appointmentsError || visitsError }}
    </p>

    <section class="queue-summary" aria-labelledby="queue-summary-title">
      <div class="section-heading">
        <div>
          <h2 id="queue-summary-title">Current queues</h2>
          <p class="section-subtitle">Each doctor calls their next patient when ready. Appointments go first.</p>
        </div>
        <router-link
          class="register-patient-button"
          :to="{ name: 'StaffWalkInRegistration' }"
        >
          Register patient
        </router-link>
      </div>
      <div class="queue-summary-grid">
        <!-- 2A: one queue and Call next per doctor -->
        <article
          v-for="queue in doctorQueues"
          :key="queue.doctor.id"
          class="queue-summary-card"
          :class="{ 'queue-summary-card--break': queue.onBreak }"
        >
          <div>
            <span class="queue-summary-label">
              {{ queue.doctor.name }}
              <span v-if="queue.onBreak" class="break-pill">On break</span>
            </span>
            <strong class="queue-summary-number">{{ queue.calledLabel }}</strong>
            <small>{{ queue.statusLabel }}</small>
          </div>
          <button
            type="button"
            :disabled="
              callingDoctorId === queue.doctor.id ||
              !queue.next ||
              Boolean(queue.called) ||
              queue.onBreak
            "
            @click="callNextPatient(queue)"
          >
            {{ callingDoctorId === queue.doctor.id ? "Calling..." : "Call next" }}
          </button>
        </article>
        <p v-if="!doctorQueues.length" class="empty-message">
          No doctors are on the roster today.
        </p>
      </div>
    </section>

    <section
      v-if="patientsNeedingDoctor.length || flaggedVisits.length"
      class="reassign-banner"
      role="status"
    >
      <div>
        <strong v-if="patientsNeedingDoctor.length">
          {{ patientsNeedingDoctor.length }}
          {{ patientsNeedingDoctor.length === 1 ? "patient needs" : "patients need" }}
          a doctor
        </strong>
        <p>
          <template v-if="doctorsOnBreak.length">
            On break: {{ doctorsOnBreak.map((doctor) => doctor.name).join(", ") }}.
          </template>
          <template v-if="!availableDoctorCount">
            No doctors are available right now. Flag these patients so everyone
            can see they are waiting on a doctor.
          </template>
          <template v-else>
            Walk-ins move to the available doctor with the shortest queue.
            Appointment patients are flagged for you to handle.
          </template>
        </p>
        <p v-if="reassignMessage" class="reassign-result">{{ reassignMessage }}</p>
        <p v-if="flaggedVisits.length">
          {{ flaggedVisits.length }} flagged
          {{ flaggedVisits.length === 1 ? "patient is" : "patients are" }}
          waiting for their doctor. Open a card to assign another doctor.
        </p>
      </div>
      <button
        type="button"
        v-if="patientsNeedingDoctor.length"
        :disabled="reassigning"
        @click="reassignPatients"
      >
        {{
          reassigning
            ? "Updating..."
            : availableDoctorCount
              ? "Reassign / flag patients"
              : "Flag patients"
        }}
      </button>
    </section>

    <section class="dashboard-section" aria-labelledby="appointments-title">
      <div class="section-heading">
        <div>
          <h2 id="appointments-title">Today’s appointments</h2>
          <p class="section-subtitle">{{ formatDate(today) }}</p>
        </div>
        <span class="live-indicator">Live updates</span>
      </div>

      <p v-if="appointmentsLoading" class="empty-message">
        Loading appointments...
      </p>
      <p v-else-if="!appointments.length" class="empty-message">
        No appointments scheduled for today.
      </p>
      <div v-else class="appointment-list">
        <article
          v-for="appointment in appointments"
          :key="appointment.id"
          class="appointment-row"
        >
          <time>{{ appointment.appointmentTime || "—" }}</time>
          <div class="appointment-person">
            <strong>{{ appointment.patientName }}</strong>
            <span>{{ appointment.doctorName }}</span>
          </div>
          <span class="visit-type">{{
            appointment.status === "cancelled" ? "Cancelled" : "Appointment"
          }}</span>
          <button
            v-if="appointment.status === 'booked'"
            class="check-in-button"
            :disabled="
              checkedInAppointmentIds.has(appointment.id) ||
              checkingInAppointmentId === appointment.id
            "
            type="button"
            @click="checkInAppointmentForQueue(appointment)"
          >
            {{
              checkingInAppointmentId === appointment.id
                ? "Checking in..."
                : checkedInAppointmentIds.has(appointment.id)
                  ? "Checked in"
                  : "Check in"
            }}
          </button>
          <span
            v-else
            class="status-badge"
            :class="appointmentStatusClass(appointment.status)"
          >
            {{ formatStatus(appointment.status) }}
          </span>
        </article>
      </div>
    </section>

    <section class="dashboard-section" aria-labelledby="flow-title">
      <div class="section-heading">
        <div>
          <h2 id="flow-title">Patient flow</h2>
          <p class="section-subtitle">
            Visits update automatically as their status changes.
          </p>
        </div>
        <span class="live-indicator">Live updates</span>
      </div>

      <div class="pipeline">
        <section
          class="pipeline-column registration-column"
          aria-labelledby="registration-title"
        >
          <h3 id="registration-title">
            Registration / Queue <span>{{ pipeline.registration.length }}</span>
          </h3>
          <article
            v-for="visit in pipeline.registration"
            :key="visit.id"
            class="visit-card"
            :class="{ 'appointment-visit-card': isPriorityVisit(visit) }"
            tabindex="0"
            role="button"
            @click="openVisitActions(visit)"
            @keydown.enter="openVisitActions(visit)"
          >
            <div class="visit-card-heading">
              <strong>{{ visit.patientName }}</strong>
              <span v-if="visit.queueNumber" class="queue-label">{{
                formatQueueLabel(visit)
              }}</span>
            </div>
            <span>{{ visit.visitType }} · {{ visit.doctorName }}</span>
            <span
              class="status-badge"
              :class="visitStatusClass(visit.visitStatus)"
            >
              {{ visit.visitStatus }}
            </span>
            <small v-if="doctorTag(visit)" class="attention-tag">
              {{ doctorTag(visit) }}
            </small>
            <small v-if="duplicatePatientIds.has(visit.patientId)" class="attention-tag">
              In queue twice
            </small>
            <small v-if="visit.appointmentTime">{{
              visit.appointmentTime
            }}</small>
          </article>
          <p v-if="!pipeline.registration.length" class="column-empty">
            No patients waiting.
          </p>
        </section>

        <section class="pipeline-column" aria-labelledby="consultation-title">
          <h3 id="consultation-title">
            In Consultation <span>{{ pipeline.consultation.length }}</span>
          </h3>
          <article
            v-for="visit in pipeline.consultation"
            :key="visit.id"
            class="visit-card"
            :class="{ 'appointment-visit-card': isPriorityVisit(visit) }"
            tabindex="0"
            role="button"
            @click="openVisitActions(visit)"
            @keydown.enter="openVisitActions(visit)"
          >
            <div class="visit-card-heading">
              <strong>{{ visit.patientName }}</strong>
              <span v-if="visit.queueNumber" class="queue-label">{{
                formatQueueLabel(visit)
              }}</span>
            </div>
            <span>{{ visit.visitType }} · {{ visit.doctorName }}</span>
            <span
              class="status-badge"
              :class="visitStatusClass(visit.visitStatus)"
            >
              {{ visit.visitStatus }}
            </span>
            <small v-if="visit.appointmentTime">{{
              visit.appointmentTime
            }}</small>
          </article>
          <p v-if="!pipeline.consultation.length" class="column-empty">
            No active consultations.
          </p>
        </section>

        <section class="pipeline-column" aria-labelledby="medicine-title">
          <h3 id="medicine-title">
            Awaiting Medicine <span>{{ pipeline.medicine.length }}</span>
          </h3>
          <article
            v-for="visit in pipeline.medicine"
            :key="visit.id"
            class="visit-card"
            :class="{ 'appointment-visit-card': isPriorityVisit(visit) }"
            tabindex="0"
            role="button"
            @click="openVisitActions(visit)"
            @keydown.enter="openVisitActions(visit)"
          >
            <div class="visit-card-heading">
              <strong>{{ visit.patientName }}</strong>
              <span v-if="visit.queueNumber" class="queue-label">{{
                formatQueueLabel(visit)
              }}</span>
            </div>
            <span>{{ visit.visitType }} · {{ visit.doctorName }}</span>
            <span
              class="status-badge"
              :class="visitStatusClass(visit.visitStatus)"
            >
              {{ visit.visitStatus }}
            </span>
            <small v-if="visit.appointmentTime">{{
              visit.appointmentTime
            }}</small>
          </article>
          <p v-if="!pipeline.medicine.length" class="column-empty">
            No patients awaiting medicine.
          </p>
        </section>

        <section class="pipeline-column" aria-labelledby="completed-title">
          <h3 id="completed-title">
            Completed <span>{{ pipeline.completed.length }}</span>
          </h3>
          <article
            v-for="visit in pipeline.completed"
            :key="visit.id"
            class="visit-card"
            :class="{ 'appointment-visit-card': isPriorityVisit(visit) }"
            tabindex="0"
            role="button"
            @click="openVisitActions(visit)"
            @keydown.enter="openVisitActions(visit)"
          >
            <div class="visit-card-heading">
              <strong>{{ visit.patientName }}</strong>
              <span v-if="visit.queueNumber" class="queue-label">{{
                formatQueueLabel(visit)
              }}</span>
            </div>
            <span>{{ visit.visitType }} · {{ visit.doctorName }}</span>
            <span
              class="status-badge"
              :class="visitStatusClass(visit.visitStatus)"
            >
              {{ visit.visitStatus }}
            </span>
            <small v-if="visit.appointmentTime">{{
              visit.appointmentTime
            }}</small>
          </article>
          <p v-if="!pipeline.completed.length" class="column-empty">
            No completed visits.
          </p>
        </section>

        <div
          v-if="selectedVisit"
          class="dialog-backdrop"
          @click.self="closeVisitActions"
        >
          <section
            class="action-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="visit-action-title"
          >
            <button
              class="dialog-close"
              type="button"
              aria-label="Close"
              @click="closeVisitActions"
            >
              X
            </button>
            <h2 id="visit-action-title">{{ selectedVisit.patientName }}</h2>
            <p>
              {{ selectedVisit.visitType }} · {{ selectedVisit.visitStatus }}
            </p>
            <p v-if="actionError" class="error-message" role="alert">
              {{ actionError }}
            </p>
            <div
              v-if="['Waiting', 'Called', 'Late'].includes(selectedVisit.visitStatus)"
              class="assign-doctor"
            >
              <label for="assign-doctor-select">
                {{ selectedVisit.doctorId ? "Change doctor" : "Assign doctor" }}
              </label>
              <p v-if="!selectedVisit.doctorId" class="unassigned-warning">
                This patient has no doctor yet.
              </p>
              <div class="assign-doctor-row">
                <select
                  id="assign-doctor-select"
                  v-model="assignDoctorId"
                  :disabled="assignDoctorsLoading || assigningDoctor"
                >
                  <option value="" disabled>
                    {{ assignDoctorsLoading ? "Loading doctors..." : "Choose a doctor" }}
                  </option>
                  <option
                    v-for="doctor in assignableDoctors"
                    :key="doctor.id"
                    :value="doctor.id"
                  >
                    {{ doctor.name }} · {{ doctor.queueLength }} in queue
                  </option>
                </select>
                <button
                  type="button"
                  :disabled="
                    !assignDoctorId ||
                    assignDoctorId === selectedVisit.doctorId ||
                    assigningDoctor
                  "
                  @click="assignDoctor"
                >
                  {{ assigningDoctor ? "Saving..." : "Save" }}
                </button>
              </div>
            </div>
            <div class="action-list">
              <button
                v-if="
                  selectedVisit.visitStatus === 'Waiting' ||
                  selectedVisit.visitStatus === 'Called'
                "
                type="button"
                @click="runQueueAction('late')"
              >
                Mark as late
              </button>
              <button
                v-if="
                  ['Waiting', 'Called', 'Late'].includes(
                    selectedVisit.visitStatus,
                  )
                "
                type="button"
                @click="runQueueAction('absent', true)"
              >
                Mark as absent
              </button>
              <button
                v-if="['Late', 'Absent'].includes(selectedVisit.visitStatus)"
                type="button"
                @click="runQueueAction('arrived')"
              >
                Mark as arrived
              </button>
              <button
                v-if="
                  ['Waiting', 'Called', 'Late'].includes(
                    selectedVisit.visitStatus,
                  )
                "
                class="danger-button"
                type="button"
                @click="deleteVisit"
              >
                Delete patient from queue
              </button>
            </div>
          </section>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { auth, db } from "@/services/firebase";
import {
  assignVisitDoctor,
  callVisit,
  clearDoctorAttention,
  reassignVisit,
  changeQueueStatus,
  checkInAppointment,
  deleteStaffVisit,
} from "@/services/staffVisitService";
import {
  getAvailableDoctorsWithLoad,
  pickShortestQueueDoctor,
} from "@/services/queueService";

const today = ref(getLocalDate());
const appointments = ref([]);
const visits = ref([]);
const appointmentsLoading = ref(true);
const appointmentsError = ref("");
const visitsError = ref("");
const selectedVisit = ref(null);
const actionError = ref("");
const checkedInAppointmentIds = ref(new Set());
const checkingInAppointmentId = ref("");
const callingDoctorId = ref("");
const assignableDoctors = ref([]);
const assignDoctorsLoading = ref(false);
const assignDoctorId = ref("");
const assigningDoctor = ref(false);
const doctors = ref([]);
const reassigning = ref(false);
const reassignMessage = ref("");
let stopDoctors;
let stopAppointments;
let stopVisits;
let stopAuth;
let loadVersion = 0;

const pipeline = computed(() => ({
  registration: visits.value.filter((visit) =>
    ["Waiting", "Called", "Late", "Absent"].includes(visit.visitStatus),
  ),
  consultation: visits.value.filter(
    (visit) => visit.visitStatus === "In Consultation",
  ),
  medicine: visits.value.filter((visit) =>
    [
      "Awaiting Medicine",
      "Awaiting Medicine Collection",
      "Preparing Medicine",
      "Ready for Collection",
    ].includes(visit.visitStatus),
  ),
  completed: visits.value.filter((visit) => visit.visitStatus === "Completed"),
}));

// 2A/2B: each doctor's own queue. Appointment visits have negative
// queueOrder, so they sort ahead of walk-ins within a doctor's queue.
const doctorQueues = computed(() =>
  [...doctors.value]
    .sort((first, second) =>
      String(first.name || "").localeCompare(String(second.name || "")),
    )
    .map((doctor) => {
      const queueVisits = visits.value
        .filter(
          (visit) =>
            visit.doctorId === doctor.id &&
            ["Waiting", "Called", "Late"].includes(visit.visitStatus),
        )
        .sort(compareQueueOrder);
      const called = queueVisits.find((visit) => visit.visitStatus === "Called");
      const waiting = queueVisits.filter((visit) => visit.visitStatus === "Waiting");
      const next = waiting[0];
      const onBreak = doctor.availabilityStatus === "On Break";

      let statusLabel = "No patients waiting";
      if (onBreak) {
        statusLabel = `${waiting.length} waiting · reassign from the banner`;
      } else if (called) {
        statusLabel = "Finish the current patient first";
      } else if (next) {
        statusLabel = `Next: ${formatQueueLabel(next)} · ${waiting.length} waiting`;
      }

      return {
        doctor,
        called,
        next,
        onBreak,
        calledLabel: called ? formatQueueLabel(called) : "—",
        statusLabel,
      };
    }),
);

// Only genuinely unassigned patients are candidates for the shared-queue
// allocation action. Patients already assigned to a doctor remain there
// while that doctor is on break.
const onBreakDoctorIds = computed(
  () =>
    new Set(
      doctors.value
        .filter((doctor) => doctor.availabilityStatus === "On Break")
        .map((doctor) => doctor.id),
    ),
);

const doctorsOnBreak = computed(() =>
  doctors.value.filter((doctor) => onBreakDoctorIds.value.has(doctor.id)),
);

const availableDoctorCount = computed(
  () =>
    doctors.value.filter(
      (doctor) =>
        doctor.active === true &&
        (doctor.availabilityStatus || "Available") === "Available" &&
        doctor.available !== false,
    ).length,
);

const ACTIVE_QUEUE_STATUSES = ["Waiting", "Called", "Late"];

function needsDoctor(visit) {
  return (
    ACTIVE_QUEUE_STATUSES.includes(visit.visitStatus) &&
    !visit.doctorId
  );
}

// patients the banner button still has to act on. Flagged appointment
// patients are already handled (6B); flagged walk-ins come back once a
// doctor is available again (6C).
const patientsNeedingDoctor = computed(() =>
  visits.value
    .filter(
      (visit) =>
        needsDoctor(visit) &&
        !(
          visit.needsAttention &&
          (isPriorityVisit(visit) || !availableDoctorCount.value)
        ),
    )
    .sort(compareQueueOrder),
);

const flaggedVisits = computed(() =>
  visits.value.filter(
    (visit) =>
      visit.needsAttention && ACTIVE_QUEUE_STATUSES.includes(visit.visitStatus),
  ),
);

function doctorTag(visit) {
  if (visit.needsAttention && needsDoctor(visit)) return "Flagged: doctor unavailable";
  if (!needsDoctor(visit)) return "";
  return "No doctor";
}

// 6D: the same patient in progress twice today (e.g. appointment + walk-in)
const duplicatePatientIds = computed(() => {
  const seen = new Set();
  const duplicates = new Set();
  visits.value
    .filter((visit) =>
      [...ACTIVE_QUEUE_STATUSES, "Absent", "In Consultation"].includes(
        visit.visitStatus,
      ),
    )
    .forEach((visit) => {
      if (!visit.patientId) return;
      if (seen.has(visit.patientId)) duplicates.add(visit.patientId);
      seen.add(visit.patientId);
    });
  return duplicates;
});

// 6C: when a flagged patient's own doctor is back on duty, clear the flag
const clearingFlags = new Set();
const staleFlags = computed(() =>
  flaggedVisits.value.filter(
    (visit) =>
      visit.doctorId &&
      doctors.value.some(
        (doctor) =>
          doctor.id === visit.doctorId &&
          (doctor.availabilityStatus || "Available") === "Available",
      ),
  ),
);

watch(staleFlags, (stale) => {
  stale.forEach(async (visit) => {
    if (clearingFlags.has(visit.id)) return;
    clearingFlags.add(visit.id);
    try {
      await clearDoctorAttention(visit.id, visit.doctorId);
    } catch (error) {
      console.error("Unable to clear the doctor flag.", error);
    } finally {
      clearingFlags.delete(visit.id);
    }
  });
});

onMounted(() => {
  stopAuth = auth.onAuthStateChanged((user) => {
    stopListeners();

    if (user) {
      stopAppointments = watchAppointments();
      stopVisits = watchVisits();
      stopDoctors = watchDoctors();
    } else {
      appointments.value = [];
      visits.value = [];
      appointmentsLoading.value = false;
    }
  });
});

onUnmounted(() => {
  stopListeners();
  stopAuth?.();
});

function stopListeners() {
  stopAppointments?.();
  stopVisits?.();
  stopDoctors?.();
  stopAppointments = undefined;
  stopVisits = undefined;
  stopDoctors = undefined;
  loadVersion++;
}

function openVisitActions(visit) {
  selectedVisit.value = visit;
  actionError.value = "";
  assignDoctorId.value = visit.doctorId || "";

  if (["Waiting", "Called", "Late"].includes(visit.visitStatus)) {
    loadAssignableDoctors(visit);
  }
}

async function loadAssignableDoctors(visit) {
  assignDoctorsLoading.value = true;
  try {
    assignableDoctors.value = await getAvailableDoctorsWithLoad(today.value);
    // pre-select the shortest queue for patients with no doctor yet
    if (!visit.doctorId) {
      assignDoctorId.value =
        pickShortestQueueDoctor(assignableDoctors.value)?.id || "";
    }
    if (assignableDoctors.value.length === 0) {
      actionError.value = "No doctors are available right now.";
    }
  } catch (error) {
    console.error("Unable to load available doctors.", error);
    actionError.value = "Unable to load available doctors.";
  } finally {
    assignDoctorsLoading.value = false;
  }
}

async function assignDoctor() {
  const visit = selectedVisit.value;
  const doctor = assignableDoctors.value.find(
    (candidate) => candidate.id === assignDoctorId.value,
  );
  if (!visit || !doctor) return;

  assigningDoctor.value = true;
  actionError.value = "";
  try {
    await assignVisitDoctor(visit.id, doctor);
    closeVisitActions();
  } catch (error) {
    console.error("Unable to assign doctor.", error);
    actionError.value =
      error.code === "permission-denied"
        ? "You do not have permission to assign doctors."
        : error.code === "doctor-unavailable"
          ? "That doctor is no longer available. Choose another doctor."
        : error.message || "Unable to assign a doctor.";
  } finally {
    assigningDoctor.value = false;
  }
}

function closeVisitActions() {
  selectedVisit.value = null;
  actionError.value = "";
}

// Story 4: late / absent / arrived
async function runQueueAction(action, requiresConfirmation = false) {
  const visit = selectedVisit.value;
  if (!visit) return;

  if (
    requiresConfirmation &&
    !window.confirm(`Mark ${visit.patientName} as ${action}?`)
  ) {
    return;
  }

  try {
    await changeQueueStatus(visit.id, action, getBackOfQueueOrder(visit));
    closeVisitActions();
  } catch (error) {
    console.error("Unable to update queue status.", error);
    actionError.value =
      error.code === "permission-denied"
        ? "You do not have permission to update this patient."
        : error.message || "Unable to update this patient.";
  }
}

// one place behind the last patient in the same queue (appointment or walk-in)
function getBackOfQueueOrder(visit) {
  const sameQueue = visits.value.filter(
    (other) =>
      other.id !== visit.id &&
      isPriorityVisit(other) === isPriorityVisit(visit) &&
      ["Waiting", "Called", "Late"].includes(other.visitStatus),
  );
  const orders = [visit, ...sameQueue]
    .map(getQueueSortValue)
    .filter((order) => order < Number.MAX_SAFE_INTEGER);
  return orders.length ? Math.max(...orders) + 1 : undefined;
}

async function deleteVisit() {
  const visit = selectedVisit.value;
  if (
    !visit ||
    !window.confirm(`Delete ${visit.patientName} from the queue?`)
  ) {
    return;
  }

  try {
    await deleteStaffVisit(visit.id);
    closeVisitActions();
  } catch (error) {
    console.error("Unable to delete visit.", error);
    actionError.value =
      error.code === "permission-denied"
        ? "You do not have permission to delete this patient."
        : error.message || "Unable to delete this patient.";
  }
}

async function checkInAppointmentForQueue(appointment) {
  checkingInAppointmentId.value = appointment.id;
  appointmentsError.value = "";

  try {
    await checkInAppointment(appointment.id);
    checkedInAppointmentIds.value = new Set([
      ...checkedInAppointmentIds.value,
      appointment.id,
    ]);
  } catch (error) {
    console.error("Unable to check in appointment.", error);
    appointmentsError.value =
      error.code === "permission-denied"
        ? "You do not have permission to check in this appointment."
        : error.message || "Unable to check in this appointment.";
  } finally {
    checkingInAppointmentId.value = "";
  }
}

async function callNextPatient(queue) {
  if (queue.called) {
    visitsError.value =
      `${queue.doctor.name}'s called patient must begin consultation with the doctor, or be marked late or absent, before another patient can be called.`;
    return;
  }

  if (!queue.next || queue.onBreak) {
    return;
  }

  callingDoctorId.value = queue.doctor.id;
  visitsError.value = "";

  try {
    await callVisit(queue.next.id);
  } catch (error) {
    console.error("Unable to call the next patient.", error);
    visitsError.value =
      error.code === "permission-denied"
        ? "You do not have permission to call the next patient."
        : error.message || "Unable to call the next patient.";
  } finally {
    callingDoctorId.value = "";
  }
}

function watchDoctors() {
  return db
    .collection("doctors")
    .where("active", "==", true)
    .onSnapshot(
      (snapshot) => {
        doctors.value = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));
        if (
          selectedVisit.value &&
          ["Waiting", "Called", "Late"].includes(selectedVisit.value.visitStatus)
        ) {
          loadAssignableDoctors(selectedVisit.value);
        }
      },
      (error) => console.error("Unable to watch doctors.", error),
    );
}

// spread affected patients across available doctors, shortest queue first
async function reassignPatients() {
  reassigning.value = true;
  reassignMessage.value = "";
  visitsError.value = "";

  try {
    const available = await getAvailableDoctorsWithLoad(today.value);
    const counts = { reassigned: 0, flagged: 0, skipped: 0 };

    for (const visit of patientsNeedingDoctor.value) {
      // 6B: appointment patients keep their booked doctor and get flagged
      const doctor =
        isPriorityVisit(visit) && visit.doctorId
          ? null
          : pickShortestQueueDoctor(available);
      const result = await reassignVisit(visit.id, visit.doctorId || "", doctor);
      counts[result]++;

      // keep the local counts in step so patients are spread out
      if (result === "reassigned" && doctor) {
        doctor.queueLength++;
      }
    }

    reassignMessage.value =
      `Moved ${counts.reassigned} walk-in(s)` +
      (counts.flagged ? `, flagged ${counts.flagged}` : "") +
      (counts.skipped ? `, ${counts.skipped} left unchanged` : "") +
      ".";
  } catch (error) {
    console.error("Unable to reassign patients.", error);
    visitsError.value =
      error.code === "permission-denied"
        ? "You do not have permission to reassign patients."
        : error.message || "Unable to reassign patients.";
  } finally {
    reassigning.value = false;
  }
}

function watchAppointments() {
  return db
    .collection("appointments")
    .where("appointmentDate", "==", today.value)
    .onSnapshot(
      async (snapshot) => {
        const version = ++loadVersion;
        appointmentsLoading.value = true;
        try {
          const rows = await Promise.all(
            snapshot.docs.map(async (document) => {
              const appointment = document.data();
              return {
                id: document.id,
                ...appointment,
                patientName: await getPatientName(appointment.patientId),
                doctorName: await getDoctorName(appointment.doctorId),
              };
            }),
          );
          rows.sort((first, second) =>
            String(first.appointmentTime || "").localeCompare(
              String(second.appointmentTime || ""),
            ),
          );
          if (version === loadVersion) {
            appointments.value = rows;
            appointmentsError.value = "";
            appointmentsLoading.value = false;
          }
        } catch (error) {
          console.error("Unable to load staff appointments.", error);
          appointmentsError.value = "Unable to load today’s appointments.";
          appointmentsLoading.value = false;
        }
      },
      (error) => {
        console.error("Unable to watch staff appointments.", error);
        appointmentsError.value = "Unable to load today’s appointments.";
        appointmentsLoading.value = false;
      },
    );
}

function watchVisits() {
  return db
    .collection("visits")
    .where("visitDate", "==", today.value)
    .onSnapshot(
      async (snapshot) => {
        try {
          const rows = await Promise.all(
            snapshot.docs.map(async (document) => {
              const visit = document.data();
              return {
                id: document.id,
                ...visit,
                patientName:
                  visit.patientName || (await getPatientName(visit.patientId)),
                doctorName:
                  visit.doctorName || (await getDoctorName(visit.doctorId)),
                visitType: formatVisitType(visit.visitType),
                visitStatus: normalizeVisitStatus(
                  visit.visitStatus || visit.status,
                ),
              };
            }),
          );
          rows.sort(compareQueueOrder);
          checkedInAppointmentIds.value = new Set(
            rows
              .filter((visit) => visit.appointmentId)
              .map((visit) => visit.appointmentId),
          );
          visits.value = rows;
          visitsError.value = "";
        } catch (error) {
          console.error("Unable to load staff visits.", error);
          visitsError.value = "Unable to load today’s patient flow.";
        }
      },
      (error) => {
        console.error("Unable to watch staff visits.", error);
        visitsError.value = "Unable to load today’s patient flow.";
      },
    );
}

async function getPatientName(patientId) {
  if (!patientId) return "Walk-in patient";
  const snapshot = await db.collection("patients").doc(patientId).get();
  const patient = snapshot.data() || {};
  return patient.displayName || patient.fullName || patient.name || patientId;
}

async function getDoctorName(doctorId) {
  if (!doctorId) return "Unassigned";
  const snapshot = await db.collection("doctors").doc(doctorId).get();
  return snapshot.data()?.name || doctorId;
}

function formatVisitType(type) {
  return String(type || "")
    .toLowerCase()
    .includes("walk")
    ? "Walk-in"
    : "Appointment";
}

function normalizeVisitStatus(status) {
  const normalized = String(status || "")
    .trim()
    .toLowerCase();
  const statusLabels = {
    waiting: "Waiting",
    called: "Called",
    late: "Late",
    absent: "Absent",
    "in consultation": "In Consultation",
    "awaiting medicine": "Awaiting Medicine",
    "awaiting medicine collection": "Awaiting Medicine Collection",
    "preparing medicine": "Preparing Medicine",
    "ready for collection": "Ready for Collection",
    completed: "Completed",
  };

  return statusLabels[normalized] || status || "Unknown";
}

function formatStatus(status) {
  return status === "cancelled" ? "Cancelled" : "Booked";
}

function appointmentStatusClass(status) {
  return status === "cancelled" ? "status-cancelled" : "status-booked";
}

function visitStatusClass(status) {
  if (status === "Late") return "status-late";
  if (status === "Absent") return "status-absent";
  return "status-visit";
}

function formatQueueLabel(visit) {
  return String(visit.queueNumber).startsWith("A")
    ? visit.queueNumber
    : `Q${visit.queueNumber}`;
}

function isPriorityVisit(visit) {
  return String(visit.queueNumber || "").startsWith("A");
}

function compareQueueOrder(firstVisit, secondVisit) {
  return getQueueSortValue(firstVisit) - getQueueSortValue(secondVisit);
}

function getQueueSortValue(visit) {
  const queueOrder = Number(visit.queueOrder);
  if (Number.isFinite(queueOrder)) {
    return queueOrder;
  }

  const queueNumber = Number.parseInt(
    String(visit.queueNumber || "").slice(1),
    10,
  );
  return Number.isFinite(queueNumber) ? queueNumber : Number.MAX_SAFE_INTEGER;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-SG", { dateStyle: "long" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function getLocalDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}
</script>

<style scoped>
.staff-dashboard {
  display: grid;
  gap: 28px;
}

.staff-page-header h1 {
  font-size: var(--font-size-page-title, 28px);
  margin-bottom: 6px;
}

.staff-page-header p,
.section-subtitle {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.5;
  margin: 4px 0 0;
}

.dashboard-section,
.queue-summary {
  min-width: 0;
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
  color: var(--color-text);
  font-size: 19px;
  margin: 0;
}

.queue-summary-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(255px, 1fr));
}

.queue-summary-card {
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  display: flex;
  gap: 16px;
  justify-content: space-between;
  min-width: 0;
  padding: 18px;
}

/* modifier follows the base card so its background isn't overwritten */
.queue-summary-card--break {
  background: #f4f6f7;
  border-color: #d5dde1;
}

.queue-summary-label,
.queue-summary-card small {
  color: var(--color-text-muted);
  display: block;
  font-size: 12px;
  line-height: 1.5;
}

.queue-summary-label {
  color: var(--color-text);
  font-weight: 600;
}

.queue-summary-number {
  color: var(--color-text);
  display: block;
  font-size: 27px;
  line-height: 1.2;
  margin: 7px 0 4px;
}

.queue-summary-card button {
  flex-shrink: 0;
  white-space: nowrap;
}

.queue-summary-card button:disabled,
.check-in-button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.break-pill {
  background: var(--color-warning-soft);
  border-radius: var(--radius-badge);
  color: var(--color-warning);
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  margin-left: 6px;
  padding: 3px 6px;
}

.register-patient-button {
  background: var(--color-primary-dark);
  border-radius: var(--radius-control);
  color: white;
  font-size: 13px;
  font-weight: 600;
  padding: 10px 14px;
  text-decoration: none;
  white-space: nowrap;
}

.register-patient-button:hover {
  background: var(--color-primary-deep);
}

.live-indicator {
  align-items: center;
  color: var(--color-success);
  display: inline-flex;
  font-size: 12px;
  font-weight: 600;
  gap: 6px;
  white-space: nowrap;
}

.live-indicator::before {
  background: var(--color-success);
  border-radius: 50%;
  content: '';
  height: 6px;
  width: 6px;
}

.appointment-list,
.pipeline-column {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  min-width: 0;
}

.appointment-row {
  align-items: center;
  border-bottom: 1px solid var(--color-border);
  display: grid;
  gap: 16px;
  /* time, patient/doctor, type, action */
  grid-template-columns: 66px minmax(0, 1fr) 100px minmax(100px, auto);
  padding: 14px 16px;
}

.appointment-row:last-child {
  border-bottom: 0;
}

.appointment-row time {
  color: var(--color-text);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.appointment-person {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.appointment-person strong {
  color: var(--color-text);
  font-size: 14px;
  overflow-wrap: anywhere;
}

.appointment-person span,
.visit-card > span:not(.status-badge),
.visit-card > small:not(.attention-tag) {
  color: var(--color-text-muted);
  display: block;
  font-size: 12px;
  line-height: 1.45;
  margin-top: 3px;
  overflow-wrap: anywhere;
}

.visit-type {
  color: var(--color-text-muted);
  font-size: 12px;
}

.status-badge {
  border-radius: var(--radius-badge);
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  padding: 5px 9px;
  text-align: center;
  width: fit-content;
}

.status-booked {
  background: var(--color-primary-soft);
  color: var(--color-primary-dark);
}

.status-cancelled {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.status-absent {
  background: #edf1f4;
  color: var(--color-text-muted);
}

.status-late {
  background: var(--color-warning-soft);
  color: var(--color-warning);
}

.status-visit {
  background: var(--color-info-soft);
  color: var(--color-info);
  margin-top: 6px;
}

.reassign-banner {
  align-items: center;
  background: var(--color-warning-soft);
  border: 1px solid #ead5a6;
  border-radius: var(--radius-card);
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 16px 18px;
}

.reassign-banner p {
  color: #72531b;
  font-size: 13px;
  line-height: 1.5;
  margin: 4px 0 0;
}

.reassign-banner .reassign-result {
  color: var(--color-success);
}

.reassign-banner button {
  flex-shrink: 0;
}

.attention-tag,
.visit-card > small.attention-tag {
  color: var(--color-warning);
  display: block;
  font-size: 12px;
  font-weight: 600;
  margin-top: 5px;
}

.queue-label {
  color: var(--color-primary-dark);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.check-in-button {
  background: var(--color-primary-soft);
  border: 1px solid #bfded9;
  color: var(--color-primary-dark);
  font-size: 12px;
  justify-self: start;
  padding: 8px 12px;
  white-space: nowrap;
}

.check-in-button:hover:not(:disabled) {
  background: #d1eee9;
}

.pipeline {
  align-items: start;
  display: grid;
  gap: 12px;
  grid-template-columns: 1.4fr repeat(3, minmax(0, 1fr));
}

.pipeline-column {
  min-height: 180px;
  padding: 14px;
}

.pipeline-column h3 {
  align-items: center;
  color: var(--color-text);
  display: flex;
  flex-wrap: wrap;
  font-size: 14px;
  gap: 6px;
  margin: 0 0 14px;
}

.pipeline-column h3 span {
  background: #eef3f5;
  border-radius: var(--radius-badge);
  color: var(--color-text-muted);
  font-size: 11px;
  padding: 3px 7px;
}

.visit-card {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  cursor: pointer;
  margin-bottom: 8px;
  padding: 12px;
}

.appointment-visit-card {
  background: #f1f7f6;
  border-color: #c6ded9;
}

.visit-card:hover {
  border-color: var(--color-primary);
}

.visit-card:focus-visible {
  border-color: var(--color-primary-dark);
  outline: 2px solid var(--color-primary-dark);
  outline-offset: 2px;
}

.visit-card-heading {
  align-items: baseline;
  display: flex;
  gap: 8px;
  justify-content: space-between;
}

.visit-card-heading strong {
  color: var(--color-text);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.visit-card-heading span {
  color: var(--color-primary-dark);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.column-empty,
.empty-message {
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.5;
}

.assign-doctor {
  border-bottom: 1px solid var(--color-border);
  display: grid;
  gap: 6px;
  margin-bottom: 12px;
  padding-bottom: 12px;
}

.assign-doctor label {
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
}

.assign-doctor-row {
  display: flex;
  gap: 8px;
}

.assign-doctor-row select {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  flex: 1;
  font: inherit;
  font-size: 13px;
  min-width: 0;
  padding: 9px 10px;
}

.unassigned-warning {
  color: var(--color-warning);
  font-size: 12px;
  margin: 0;
}

.error-message {
  color: var(--color-danger);
  font-size: 13px;
  margin: 0;
}

.dialog-backdrop {
  align-items: flex-start;
  background: rgb(31 41 55 / 35%);
  display: flex;
  inset: 0;
  justify-content: center;
  overflow-y: auto;
  padding: clamp(24px, 8vh, 80px) 16px 24px;
  position: fixed;
  z-index: 10;
}

.action-dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-dialog);
  box-shadow: var(--shadow-overlay);
  max-height: calc(100dvh - 48px);
  max-width: 420px;
  overflow-y: auto;
  padding: 24px;
  position: relative;
  width: 100%;
}

.action-dialog h2 {
  color: var(--color-text);
  font-size: 19px;
  margin: 0 24px 6px 0;
  overflow-wrap: anywhere;
}

.action-dialog p {
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.5;
  margin: 4px 0 12px;
}

.action-dialog p.error-message {
  color: var(--color-danger);
}

.action-dialog p.unassigned-warning {
  color: var(--color-warning);
}

.dialog-close {
  background: transparent;
  color: var(--color-text-muted);
  padding: 4px 8px;
  position: absolute;
  right: 12px;
  top: 12px;
}

.dialog-close:hover {
  background: var(--color-background);
  color: var(--color-text);
}

.action-list {
  display: grid;
  gap: 8px;
  margin-top: 20px;
}

.action-list button {
  text-align: left;
  width: 100%;
}

.action-list .danger-button {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.action-list .danger-button:hover {
  background: #ffe0dc;
}

@media (max-width: 900px) {
  .pipeline {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .staff-dashboard {
    gap: 24px;
  }

  .queue-summary-grid,
  .pipeline {
    grid-template-columns: 1fr;
  }

  .queue-summary-card {
    align-items: flex-start;
    flex-direction: column;
  }

  .reassign-banner {
    align-items: stretch;
    flex-direction: column;
  }

  .appointment-row {
    gap: 10px;
    grid-template-columns: 72px minmax(0, 1fr);
  }

  .appointment-row .visit-type,
  .appointment-row .status-badge,
  .appointment-row .check-in-button {
    grid-column: 2;
    justify-self: start;
  }

  .action-dialog {
    padding: 20px;
  }
}
</style>
