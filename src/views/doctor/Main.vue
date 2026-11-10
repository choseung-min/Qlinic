<template>
  <div class="doctor-shell">
    <DoctorHeader :doctor-name="doctor.name || user?.displayName || 'Doctor'" @logout="handleLogout" />

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
            <span class="availability-badge" :class="{ 'availability-badge--break': availabilityLabel === 'On Break' }">
              {{ availabilityLabel }}
            </span>
            <button class="break-button" type="button" :disabled="isUpdatingAvailability" @click="toggleAvailability">
              {{ isUpdatingAvailability ? "Saving..." : availabilityActionLabel }}
            </button>
          </div>
        </header>

        <p v-if="availabilityError" class="message error-message" role="alert">
          {{ availabilityError }}
        </p>

        <section class="next-patient-panel" aria-labelledby="next-patient-title">
          <h2 id="next-patient-title">NEXT PATIENT</h2>
          <div v-if="nextPatient" class="next-patient-content">
            <div class="queue-number queue-number-primary">
              Q{{ formatQueueNumber(nextPatient.queueNumber) }}
            </div>
            <div class="patient-summary">
              <h3>{{ nextPatient.patientName }}</h3>
              <p>{{ visitDescription(nextPatient) }}</p>
              <span class="status-badge" :class="statusClass(nextPatient.visitStatus)">
                {{ nextPatient.visitStatus }}
              </span>
            </div>
            <button
              class="details-button"
              type="button"
              :disabled="!canOpenPatient(nextPatient)"
              @click="openPatient(nextPatient)"
            >
              View Details
            </button>
          </div>
          <p v-else class="empty-state">
            No waiting patients assigned to you at the moment.
          </p>
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
                <h3>
                  {{ visit.patientName }}
                  <span>#{{ visit.queuePosition }}</span>
                </h3>
                <p>{{ visitDescription(visit) }}</p>
              </div>
              <span class="status-badge" :class="statusClass(visit.visitStatus)">
                {{ visit.visitStatus }}
              </span>
              <button
                class="view-button"
                type="button"
                :disabled="!canOpenPatient(visit)"
                :title="patientAccessMessage(visit)"
                @click="openPatient(visit)"
              >
                View
              </button>
            </article>
          </div>
        </section>
      </template>
    </main>

    <div v-if="isBreakModalOpen" class="modal-backdrop" role="presentation">
      <section class="break-modal" role="dialog" aria-modal="true" aria-labelledby="break-modal-title">
        <h2 id="break-modal-title">Estimated break duration</h2>
        <p>
          Choose how long you expect to be away. You can return early at any time.
        </p>
        <label for="break-duration">Duration in minutes</label>
        <select id="break-duration" v-model.number="breakDurationMinutes">
          <option v-for="duration in breakDurationOptions" :key="duration" :value="duration">
            {{ duration }} minutes
          </option>
        </select>
        <p v-if="breakModalError" class="message error-message" role="alert">
          {{ breakModalError }}
        </p>
        <div class="break-modal-actions">
          <button type="button" class="secondary-button" :disabled="isUpdatingAvailability" @click="closeBreakModal">
            Cancel
          </button>
          <button type="button" :disabled="isUpdatingAvailability" @click="confirmBreak">
            {{ isUpdatingAvailability ? "Saving..." : "Confirm Break" }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import DoctorHeader from "@/components/common/DoctorHeader.vue";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { auth } from "@/services/firebase";
import { signOutUser } from "@/services/auth";
import {
  getClinicDate,
  resolveDoctorForUser,
  updateDoctorAvailability,
  watchDoctorAvailability,
  watchDoctorQueue,
} from "@/services/doctorService";

const router = useRouter();
const user = ref(null);
const doctor = ref({});
const visits = ref([]);
const isLoading = ref(true);
const errorMessage = ref("");
const availabilityError = ref("");
const isUpdatingAvailability = ref(false);
const isBreakModalOpen = ref(false);
const breakModalError = ref("");
const breakDurationMinutes = ref(30);
const breakDurationOptions = [15, 30, 45, 60];
let unsubscribeAuth;
let unsubscribeQueue;
let unsubscribeDoctor;

const nextPatient = computed(
  () => visits.value.find((visit) => visit.visitStatus === "Waiting") || null,
);
const availabilityLabel = computed(() => {
  if (doctor.value.availabilityStatus) {
    return normalizeAvailability(doctor.value.availabilityStatus);
  }

  if (doctor.value.availability) {
    return normalizeAvailability(doctor.value.availability);
  }

  if (doctor.value.available === false) {
    return "On Break";
  }

  return "Available";
});
const availabilityActionLabel = computed(() =>
  availabilityLabel.value === "On Break"
    ? "Return to Available"
    : "Go On Break",
);

onMounted(() => {
  unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
    user.value = firebaseUser;
    unsubscribeQueue?.();
    unsubscribeDoctor?.();
    unsubscribeQueue = null;
    unsubscribeDoctor = null;
    isLoading.value = true;
    errorMessage.value = "";
    availabilityError.value = "";

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
      unsubscribeDoctor = watchDoctorAvailability(
        doctorRecord.id,
        (updatedDoctor) => {
          doctor.value = updatedDoctor;
          availabilityError.value = "";
        },
        (error) => {
          console.error("Unable to synchronize doctor availability.", error);
          availabilityError.value =
            error.code === "permission-denied"
              ? "You do not have permission to read doctor availability."
              : "Unable to synchronize doctor availability.";
        },
      );
      unsubscribeQueue = watchDoctorQueue({
        doctorId: doctorRecord.id,
        visitDate: getClinicDate(),
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
  unsubscribeDoctor?.();
  unsubscribeAuth?.();
});

async function toggleAvailability() {
  if (!doctor.value.id || isUpdatingAvailability.value) {
    return;
  }

  if (availabilityLabel.value !== "On Break") {
    breakModalError.value = "";
    breakDurationMinutes.value = 30;
    isBreakModalOpen.value = true;
    return;
  }

  isUpdatingAvailability.value = true;
  availabilityError.value = "";

  try {
    await updateDoctorAvailability(doctor.value.id, "Available");
  } catch (error) {
    console.error("Unable to update doctor availability.", {
      code: error.code,
      message: error.message,
    });
    availabilityError.value =
      error.code === "permission-denied"
        ? "You do not have permission to change your availability."
        : "Unable to update your availability. Please try again.";
  } finally {
    isUpdatingAvailability.value = false;
  }
}

function closeBreakModal() {
  if (!isUpdatingAvailability.value) {
    isBreakModalOpen.value = false;
    breakModalError.value = "";
  }
}

async function confirmBreak() {
  if (
    !Number.isInteger(breakDurationMinutes.value) ||
    breakDurationMinutes.value < 5 ||
    breakDurationMinutes.value > 240
  ) {
    breakModalError.value = "Enter a whole number from 5 to 240 minutes.";
    return;
  }

  isUpdatingAvailability.value = true;
  breakModalError.value = "";
  availabilityError.value = "";

  try {
    await updateDoctorAvailability(
      doctor.value.id,
      "On Break",
      breakDurationMinutes.value,
    );
    isBreakModalOpen.value = false;
  } catch (error) {
    console.error("Unable to start doctor break.", {
      code: error.code,
      message: error.message,
    });
    breakModalError.value =
      error.code === "permission-denied"
        ? "You do not have permission to change your availability."
        : "Unable to start your break. Please try again.";
  } finally {
    isUpdatingAvailability.value = false;
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

function canOpenPatient(visit) {
  return (
    ["Called", "In Consultation"].includes(visit?.visitStatus)
    && visit?.doctorId === doctor.value.id
  );
}

function patientAccessMessage(visit) {
  return canOpenPatient(visit)
    ? "View patient information"
    : "Patient information is available after staff calls the patient.";
}

function openPatient(visit) {
  if (!canOpenPatient(visit)) {
    return;
  }

  router.push({
    name: "DoctorPatientInformation",
    params: { visitId: visit.id },
  });
}

function normalizeAvailability(status) {
  return String(status).toLowerCase().replaceAll("_", " ") === "on break"
    ? "On Break"
    : "Available";
}
</script>

<style scoped>
.doctor-shell {
  min-height: 100vh;
}

.doctor-page {
  margin: 0 auto;
  max-width: var(--width-content, 1150px);
  padding: 32px 24px 64px;
}

.doctor-header {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  justify-content: space-between;
  margin-bottom: 24px;
}

.doctor-header h1 {
  color: var(--color-text);
  font-size: 28px;
  font-weight: 700;
  line-height: 1.25;
  margin: 0 0 6px;
}

.doctor-header p {
  color: var(--color-text-muted);
  font-size: 14px;
  margin: 0;
}

.availability-controls {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.availability-badge,
.status-badge {
  border-radius: var(--radius-badge, 4px);
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.4;
  padding: 5px 9px;
  white-space: nowrap;
}

.availability-badge {
  background: var(--color-success-soft, #ecfdf5);
  color: var(--color-success, #166534);
}

.availability-badge--break {
  background: var(--color-warning-soft, #fffbeb);
  color: var(--color-warning, #92400e);
}

.break-button,
.view-button {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
}

.break-button {
  padding: 9px 14px;
}

.break-button:hover:not(:disabled),
.view-button:hover:not(:disabled) {
  background: var(--color-background);
  color: var(--color-primary-dark);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.next-patient-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-left: 3px solid var(--color-primary-dark);
  border-radius: var(--radius-card, 8px);
  padding: 24px;
}

.next-patient-panel h2 {
  color: var(--color-primary-dark);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.07em;
  margin: 0 0 16px;
}

.next-patient-content {
  align-items: center;
  display: grid;
  gap: 18px;
  grid-template-columns: 62px minmax(0, 1fr) auto;
}

.queue-number {
  align-items: center;
  border-radius: var(--radius-control, 6px);
  display: flex;
  font-size: 16px;
  font-weight: 700;
  height: 54px;
  justify-content: center;
  width: 54px;
}

.queue-number-primary {
  background: var(--color-primary-dark);
  color: white;
  height: 62px;
  width: 62px;
}

.queue-number-muted {
  background: #eef3f5;
  color: var(--color-text);
}

.patient-summary {
  min-width: 0;
}

.patient-summary h3 {
  color: var(--color-text);
  font-size: 19px;
  font-weight: 650;
  line-height: 1.3;
  margin: 0 0 5px;
  overflow-wrap: anywhere;
}

.patient-summary h3 span {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 500;
  margin-left: 6px;
}

.patient-summary p {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
  overflow-wrap: anywhere;
}

.patient-summary .status-badge {
  margin-top: 9px;
}

.status-badge {
  background: #f0f3f5;
  color: #526170;
}

.status-badge.called,
.status-badge.in-consultation,
.status-badge.ready {
  background: var(--color-info-soft, #eff6ff);
  color: var(--color-info, #1d4ed8);
}

.status-badge.awaiting-medicine,
.status-badge.late {
  background: var(--color-warning-soft, #fffbeb);
  color: var(--color-warning, #92400e);
}

.status-badge.completed,
.status-badge.collected {
  background: var(--color-success-soft, #ecfdf5);
  color: var(--color-success, #166534);
}

.status-badge.absent,
.status-badge.cancelled {
  background: #f0f3f5;
  color: #526170;
}

.details-button {
  background: var(--color-primary-dark);
  border: 1px solid var(--color-primary-dark);
  border-radius: var(--radius-control, 6px);
  color: white;
  font-size: 13px;
  min-width: 124px;
  padding: 10px 16px;
}

.details-button:hover:not(:disabled) {
  background: var(--color-primary-deep, #0b5d5a);
}

.queue-section {
  margin-top: 32px;
}

.queue-section>h2 {
  color: var(--color-text);
  font-size: 19px;
  margin: 0 0 16px;
}

.queue-list {
  display: grid;
  gap: 10px;
}

.patient-card {
  align-items: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card, 8px);
  display: grid;
  gap: 16px;
  grid-template-columns: 54px minmax(0, 1fr) auto auto;
  padding: 16px 18px;
}

.patient-card .patient-summary h3 {
  font-size: 16px;
}

.patient-card .patient-summary p {
  font-size: 13px;
}

.view-button {
  border-radius: var(--radius-control, 6px);
  padding: 9px 16px;
}

.empty-state,
.message {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
}

.queue-empty {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card, 8px);
  padding: 24px;
}

.error-message {
  color: var(--color-danger, #b42318);
}

.modal-backdrop {
  align-items: center;
  background: rgb(20 29 53 / 35%);
  display: flex;
  inset: 0;
  justify-content: center;
  overflow-y: auto;
  padding: 24px;
  position: fixed;
  z-index: 10;
}

.break-modal {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-dialog, 12px);
  box-shadow: var(--shadow-overlay, 0 16px 40px rgb(31 41 55 / 14%));
  max-height: calc(100dvh - 48px);
  max-width: 430px;
  overflow-y: auto;
  padding: 24px;
  width: 100%;
}

.break-modal h2 {
  color: var(--color-text);
  font-size: 20px;
  margin: 0 0 10px;
}

.break-modal p {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.5;
  margin: 0 0 18px;
}

/* keep error messages visible instead of inheriting modal paragraph colour */
.break-modal .error-message {
  color: var(--color-danger, #b42318);
  margin-top: 12px;
}

.break-modal label,
.break-modal select {
  display: block;
  width: 100%;
}

.break-modal label {
  color: var(--color-text);
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.break-modal select {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control, 6px);
  color: var(--color-text);
  font: inherit;
  font-size: 14px;
  padding: 11px 12px;
}

.break-modal-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.secondary-button {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.secondary-button:hover:not(:disabled) {
  background: var(--color-background);
  color: var(--color-primary-dark);
}

@media (max-width: 760px) {
  .doctor-page {
    padding: 24px 16px 48px;
  }

  .doctor-header {
    align-items: flex-start;
  }

  .next-patient-content {
    grid-template-columns: 62px minmax(0, 1fr);
  }

  .details-button {
    grid-column: 2;
    justify-self: start;
  }

  .patient-card {
    grid-template-columns: 54px minmax(0, 1fr) auto;
  }

  .patient-card .status-badge {
    grid-column: 2;
    grid-row: 2;
    justify-self: start;
  }

  .patient-card .view-button {
    grid-column: 3;
    grid-row: 1 / span 2;
  }
}

@media (max-width: 520px) {
  .availability-controls {
    width: 100%;
  }

  .next-patient-panel {
    padding: 18px;
  }

  .next-patient-content,
  .patient-card {
    column-gap: 12px;
  }

  .patient-card {
    grid-template-columns: 54px minmax(0, 1fr);
    padding: 14px;
  }

  .patient-card .view-button {
    grid-column: 2;
    grid-row: 3;
    justify-self: start;
  }
}
</style>
