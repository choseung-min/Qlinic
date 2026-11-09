<template>
  <main class="page history-page">

    <!-- appointment details view -->
    <div v-if="selectedAppointment" class="appointment-detail-view">
      <button type="button" class="back-button" @click="backToHistory">
        &larr; Back
      </button>

      <div class="detail-card">
        <p v-if="selectedAppointment.status === 'booked'" class="status-badge status-booked">
          Booked
        </p>

        <p v-else-if="selectedAppointment.status === 'completed'" class="status-badge status-completed">
          Completed
        </p>

        <p v-else-if="selectedAppointment.status === 'cancelled'" class="status-badge status-cancelled">
          Cancelled
        </p>

        <p v-else class="status-badge">
          {{ selectedAppointment.status || 'Unknown' }}
        </p>

        <h2 class="detail-doctor">
          {{ selectedAppointment.doctorName || 'Doctor unavailable' }}
        </h2>

        <p class="detail-reason">
          {{ selectedAppointment.reason || 'No reason for visit provided' }}
        </p>

        <p v-if="rescheduleSuccess" class="edit-success" role="status">
          {{ rescheduleSuccess }}
        </p>

        <p v-if="cancelSuccess" class="edit-success" role="status">
          {{ cancelSuccess }}
        </p>

        <!-- 5A rescheduling interface -->
        <div v-if="isEditing" class="edit-form">

          <div class="form-row">
            <div class="form-field">
              <label for="edit-date">Date</label>
              <input id="edit-date" type="date" v-model="editDate" :min="minimumDate()"
                @change="loadAvailableTimes(true)" :disabled="isSaving">
            </div>

            <div class="form-field">
              <label for="edit-time">Time</label>
              <select id="edit-time" v-model="editTime"
                :disabled="isLoadingAvailability || isSaving || !!availabilityError">
                <option disabled value="">Select a time slot</option>
                <option v-for="slot in timeSlots" :key="slot" :value="slot"
                  :disabled="bookedTimeSlots.includes(slot) && !isCurrentSlot(slot)">
                  {{ slot }}
                </option>
              </select>
            </div>
          </div>

          <p v-if="isLoadingAvailability" class="edit-message">
            Checking availability...
          </p>

          <p v-if="availabilityError" class="edit-error" role="alert">
            {{ availabilityError }}
          </p>

          <p v-if="rescheduleError" class="edit-error" role="alert">
            {{ rescheduleError }}
          </p>

          <div class="action-buttons">
            <button type="button" class="button-primary" @click="saveChanges"
              :disabled="isSaving || isLoadingAvailability || !!availabilityError || !editTime">
              {{ isSaving ? 'Saving...' : 'Save Changes' }}
            </button>

            <button type="button" class="button-secondary" @click="cancelEditing" :disabled="isSaving">
              Cancel Edit
            </button>
          </div>

        </div>

        <!-- regular appointment details -->
        <div v-else>
          <div class="detail-schedule">
            <p>Date: {{ formatDate(selectedAppointment.date) }}</p>
            <p>Time: {{ selectedAppointment.time || 'Time unavailable' }}</p>
          </div>

          <!-- 5A separate reschedule and cancel actions -->
          <div v-if="selectedAppointment.status === 'booked'">

            <div v-if="canModifyAppointment()" class="action-buttons">
              <button type="button" class="button-secondary" @click="startEditing">
                Edit / Reschedule
              </button>

              <button type="button" class="button-danger" @click="openCancelConfirm" :disabled="isCancelling">
                Cancel Appointment
              </button>
            </div>

            <p v-else class="action-note">
              This appointment can no longer be rescheduled or cancelled
            </p>
          </div>

          <!-- 7C completed appointment consultation details -->
          <div v-if="selectedAppointment.status === 'completed'" class="consultation-details">
            <h3>Consultation Details</h3>

            <p>
              <strong>Outcome:</strong>
              {{ selectedAppointment.outcome || 'Not available' }}
            </p>

            <p>
              <strong>Diagnosis:</strong>
              {{ selectedAppointment.diagnosis || 'Not available' }}
            </p>

            <p>
              <strong>Medication:</strong>
              {{ selectedAppointment.medication || 'Not available' }}
            </p>
          </div>

          <div v-else-if="selectedAppointment.status === 'cancelled'" class="consultation-details">
            <h3>Appointment Details</h3>
            <p>This appointment was cancelled</p>
            <p>No consultation details are available</p>
          </div>
        </div>

      </div>
    </div>

    <!-- appointment history grid -->
    <div v-else>
      <div class="page-header">
        <p class="eyebrow">Patient appointments</p>
        <h1>My Appointments</h1>
        <p>View and manage your upcoming, past and cancelled appointments.</p>
      </div>

      <div v-if="loading" class="history-message">
        <p>Loading appointments...</p>
      </div>

      <div v-else-if="errorMessage" class="history-message">
        <p>{{ errorMessage }}</p>
      </div>

      <template v-else>
        <nav class="appointment-tabs" aria-label="Appointment status">
          <button
            v-for="tab in appointmentTabs"
            :key="tab.id"
            class="appointment-tab"
            :class="{ active: activeTab === tab.id }"
            type="button"
            @click="activeTab = tab.id"
          >
            {{ tab.label }} ({{ tab.count }})
          </button>
        </nav>

        <div v-if="filteredAppointments.length > 0" class="history-grid">
        <AppointmentHistoryCard v-for="appointment in filteredAppointments" :key="appointment.id" :appointment="appointment"
          @select="selectAppointment" />
        </div>

        <div v-else class="card history-message">
          <h2>No {{ activeTab }} appointments</h2>
          <p>Your {{ activeTab }} appointments will appear here.</p>
        </div>
      </template>
    </div>

    <!-- 5C cancellation confirmation -->
    <div v-if="showCancelConfirm" class="cancel-overlay" @click.self="closeCancelConfirm">
      <div class="cancel-dialog" role="alertdialog" aria-modal="true" aria-labelledby="cancel-dialog-title"
        aria-describedby="cancel-dialog-description">
        <h2 id="cancel-dialog-title">Confirm cancel?</h2>
        <p id="cancel-dialog-description">
          This will cancel your appointment and free up the slot for other patients.
        </p>

        <p v-if="cancelError" class="edit-error" role="alert">
          {{ cancelError }}
        </p>

        <div class="cancel-dialog-actions">
          <button type="button" class="button-secondary" @click="closeCancelConfirm" :disabled="isCancelling">
            Keep Appointment
          </button>
          <button type="button" class="button-danger" @click="confirmCancellation" :disabled="isCancelling">
            {{ isCancelling ? 'Cancelling...' : 'Yes, Cancel' }}
          </button>
        </div>
      </div>
    </div>
  </main>
</template>

<script>
import AppointmentHistoryCard from '@/components/patient/AppointmentHistoryCard.vue';
import { auth, db } from '@/services/firebase.js';
import {
  clinicTimeSlots,
  getBookedTimeSlots,
  rescheduleAppointment,
  cancelAppointment
} from '@/services/appointmentService.js';

export default {
  name: 'History',

  components: {
    AppointmentHistoryCard
  },

  data() {
    return {
      appointments: [],
      activeTab: 'upcoming',
      selectedAppointment: null,
      loading: true,
      errorMessage: '',
      unsubscribeAuth: null,

      // 5A
      isEditing: false,
      editDate: '',
      editTime: '',

      // 5B
      timeSlots: clinicTimeSlots,
      bookedTimeSlots: [],
      isLoadingAvailability: false,
      availabilityError: '',
      rescheduleError: '',
      rescheduleSuccess: '',
      isSaving: false,

      // 5C
      showCancelConfirm: false,
      isCancelling: false,
      cancelError: '',
      cancelSuccess: ''
    };
  },

  computed: {
    appointmentTabs() {
      return [
        { id: 'upcoming', label: 'Upcoming', count: this.upcomingAppointments.length },
        { id: 'past', label: 'Past', count: this.pastAppointments.length },
        { id: 'cancelled', label: 'Cancelled', count: this.cancelledAppointments.length }
      ];
    },

    upcomingAppointments() {
      const today = this.localDate();
      return this.appointments.filter((appointment) =>
        appointment.status === 'booked' && appointment.date >= today
      );
    },

    pastAppointments() {
      const today = this.localDate();
      return this.appointments.filter((appointment) =>
        appointment.status !== 'cancelled' &&
        (appointment.status === 'completed' || appointment.date < today)
      );
    },

    cancelledAppointments() {
      return this.appointments.filter((appointment) => appointment.status === 'cancelled');
    },

    filteredAppointments() {
      return {
        upcoming: this.upcomingAppointments,
        past: this.pastAppointments,
        cancelled: this.cancelledAppointments
      }[this.activeTab];
    }
  },

  mounted() {
    this.unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        this.getAppointments(user.uid);
      } else {
        this.appointments = [];
        this.selectedAppointment = null;
        this.isEditing = false;
        this.errorMessage = 'Please log in to view your appointments';
        this.loading = false;
      }
    });
  },

  beforeUnmount() {
    if (this.unsubscribeAuth) {
      this.unsubscribeAuth();
    }
  },

  methods: {
    localDate() {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },

    async getAppointments(patientId) {
      this.loading = true;
      this.errorMessage = '';
      this.appointments = [];
      this.selectedAppointment = null;
      this.isEditing = false;

      try {
        // 7A retrieve appointments for the logged-in patient
        const snapshot = await db.collection('appointments')
          .where('patientId', '==', patientId)
          .get();

        const patientAppointments = [];

        for (const doc of snapshot.docs) {
          const appointment = doc.data();

          // retrieve doctor's name from doctors collection
          let doctorName = 'doctor unavailable';

          if (appointment.doctorId) {
            const doctorDoc = await db.collection('doctors')
              .doc(appointment.doctorId)
              .get();

            if (doctorDoc.exists) {
              doctorName = doctorDoc.data().name || 'doctor unavailable';
            }
          }

          patientAppointments.push({
            id: doc.id,
            doctorId: appointment.doctorId,
            doctorName: doctorName,
            reason: appointment.reasonForVisit,
            date: appointment.appointmentDate,
            time: appointment.appointmentTime,
            status: appointment.status,
            outcome: appointment.outcome,
            diagnosis: appointment.diagnosis,
            medication: appointment.medication
          });
        }

        // display most recent appointment dates first
        patientAppointments.sort((a, b) => {
          return (b.date + b.time).localeCompare(a.date + a.time);
        });

        if (auth.currentUser && auth.currentUser.uid === patientId) {
          this.appointments = patientAppointments;
          const appointmentId = this.$route.query.appointmentId;
          const selectedAppointment = patientAppointments.find(
            (appointment) => appointment.id === appointmentId
          );

          if (selectedAppointment) {
            this.selectAppointment(selectedAppointment);
          }
        }

      } catch (error) {
        console.error('error retrieving appointments:', error);

        if (auth.currentUser && auth.currentUser.uid === patientId) {
          this.errorMessage = 'unable to load appointments';
        }
      } finally {
        if (auth.currentUser && auth.currentUser.uid === patientId) {
          this.loading = false;
        }
      }
    },

    selectAppointment(appointment) {
      this.selectedAppointment = appointment;
      this.isEditing = false;
      this.rescheduleSuccess = '';
      this.rescheduleError = '';
      this.cancelSuccess = '';
      this.cancelError = '';
      this.showCancelConfirm = false;
      if (this.$route.query.appointmentId) {
        this.$router.replace({ name: 'History' });
      }
    },

    backToHistory() {
      if (this.isSaving || this.isCancelling) return;

      this.selectedAppointment = null;
      this.isEditing = false;
      this.rescheduleSuccess = '';
      this.cancelSuccess = '';
      this.cancelError = '';
      this.showCancelConfirm = false;
    },

    // 5A allow changes only before the appointment day
    canModifyAppointment() {
      if (!this.selectedAppointment ||
        this.selectedAppointment.status !== 'booked' ||
        !this.selectedAppointment.date) {
        return false;
      }

      const appointmentDate = new Date(
        this.selectedAppointment.date + 'T00:00:00'
      );

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return appointmentDate > today;
    },

    // 5A open the pre-filled edit form
    startEditing() {
      if (!this.canModifyAppointment()) {
        return;
      }

      this.editDate = this.selectedAppointment.date;
      this.editTime = this.selectedAppointment.time;
      this.isEditing = true;
      this.rescheduleError = '';
      this.rescheduleSuccess = '';

      this.loadAvailableTimes(false);
    },

    // 5A return without saving changes
    cancelEditing() {
      this.editDate = '';
      this.editTime = '';
      this.isEditing = false;
      this.rescheduleError = '';
      this.availabilityError = '';
    },

    // 5B check available time slots
    async loadAvailableTimes(clearTime) {
      if (clearTime) {
        this.editTime = '';
      }

      this.availabilityError = '';
      this.rescheduleError = '';
      this.bookedTimeSlots = [];

      if (!this.selectedAppointment ||
        !this.editDate ||
        this.editDate < this.minimumDate()) {
        return;
      }

      this.isLoadingAvailability = true;

      try {
        const booked = await getBookedTimeSlots({
          doctorId: this.selectedAppointment.doctorId,
          appointmentDate: this.editDate
        });

        this.bookedTimeSlots = Array.from(booked);

      } catch (error) {
        console.error('error checking availability:', error);
        this.availabilityError = 'Unable to check available time slots';
      } finally {
        this.isLoadingAvailability = false;
      }
    },

    isCurrentSlot(slot) {
      return this.editDate === this.selectedAppointment.date &&
        slot === this.selectedAppointment.time;
    },

    minimumDate() {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const year = tomorrow.getFullYear();
      const month = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const day = String(tomorrow.getDate()).padStart(2, '0');

      return `${year}-${month}-${day}`;
    },

    // 5B save rescheduled appointment
    async saveChanges() {
      if (this.isSaving ||
        this.isLoadingAvailability ||
        this.availabilityError ||
        !this.canModifyAppointment()) {
        return;
      }

      this.rescheduleError = '';
      this.rescheduleSuccess = '';

      if (!this.editDate || this.editDate < this.minimumDate()) {
        this.rescheduleError = 'Please choose a date after today';
        return;
      }

      if (!this.editTime || !this.timeSlots.includes(this.editTime)) {
        this.rescheduleError = 'Please choose a valid time slot';
        return;
      }

      if (this.bookedTimeSlots.includes(this.editTime) &&
        !this.isCurrentSlot(this.editTime)) {
        this.rescheduleError = 'That time slot is already booked';
        return;
      }

      const patientId = auth.currentUser && auth.currentUser.uid;

      if (!patientId) {
        this.rescheduleError = 'Please log in to reschedule your appointment';
        return;
      }

      this.isSaving = true;

      try {
        const newId = await rescheduleAppointment({
          appointmentId: this.selectedAppointment.id,
          patientId: patientId,
          appointmentDate: this.editDate,
          appointmentTime: this.editTime
        });

        if (auth.currentUser && auth.currentUser.uid === patientId) {
          this.selectedAppointment.id = newId;
          this.selectedAppointment.date = this.editDate;
          this.selectedAppointment.time = this.editTime;

          this.appointments.sort((a, b) => {
            return (b.date + b.time).localeCompare(a.date + a.time);
          });

          this.isEditing = false;
          this.rescheduleSuccess = 'Appointment rescheduled successfully';
        }

      } catch (error) {
        console.error('error rescheduling appointment:', error);

        const messages = {
          'invalid-date': 'Please choose a date after today',
          'invalid-time-slot': 'Please choose a valid time slot',
          'slot-taken': 'That time slot is no longer available, please choose another slot',
          'invalid-doctor': 'That doctor is no longer available',
          'cannot-reschedule': 'This appointment can no longer be rescheduled',
          'appointment-not-found': 'This appointment could not be found',
          'no-changes': 'Please select a different date or time',
          'unauthenticated': 'Please log in to reschedule your appointment'
        };

        if (error.code === 'slot-taken') {
          await this.loadAvailableTimes(true);
        }

        this.rescheduleError =
          messages[error.code] || 'Unable to reschedule appointment';

      } finally {
        this.isSaving = false;
      }
    },

    // 5C cancel appointment
    openCancelConfirm() {
      if (!this.canModifyAppointment()) return;

      this.cancelError = '';
      this.cancelSuccess = '';
      this.showCancelConfirm = true;
    },

    closeCancelConfirm() {
      if (this.isCancelling) return;

      this.showCancelConfirm = false;
      this.cancelError = '';
    },

    async confirmCancellation() {
      if (this.isCancelling || !this.canModifyAppointment()) return;

      const patientId = auth.currentUser && auth.currentUser.uid;
      if (!patientId) {
        this.cancelError = 'Please log in to cancel your appointment';
        return;
      }

      this.isCancelling = true;
      this.cancelError = '';

      try {
        const archivedId = await cancelAppointment({
          appointmentId: this.selectedAppointment.id,
          patientId: patientId
        });

        if (auth.currentUser && auth.currentUser.uid === patientId) {
          this.selectedAppointment.id = archivedId;
          this.selectedAppointment.status = 'cancelled';
          this.showCancelConfirm = false;
          this.cancelSuccess = 'Appointment cancelled successfully';
        }
      } catch (error) {
        console.error('error cancelling appointment:', error);

        const messages = {
          'appointment-not-found': 'This appointment could not be found',
          'cannot-cancel': 'This appointment can no longer be cancelled',
          'unauthenticated': 'Please log in to cancel your appointment'
        };

        this.cancelError = messages[error.code] || 'Unable to cancel appointment';
      } finally {
        this.isCancelling = false;
      }
    },

    formatDate(date) {
      if (!date) {
        return 'Date unavailable';
      }

      return new Date(date + 'T00:00:00').toLocaleDateString('en-SG', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    }
  }
};
</script>

<style scoped>
.history-page {
  max-width: 1050px;
}

.eyebrow {
  color: var(--color-primary-dark);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  margin: 0 0 6px;
  text-transform: uppercase;
}

.appointment-tabs {
  border-bottom: 1px solid var(--color-border);
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  margin: 24px 0 20px;
}

.appointment-tab {
  background: transparent;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  color: var(--color-text-muted);
  font-size: 14px;
  font-weight: 600;
  padding: 11px 2px;
}

.appointment-tab:hover:not(:disabled) {
  background: transparent;
  color: var(--color-primary-dark);
}

.appointment-tab.active {
  border-bottom-color: var(--color-primary-dark);
  color: var(--color-primary-dark);
}

.history-grid {
  align-items: stretch;
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.history-message {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.6;
  padding: 32px 20px;
  text-align: center;
}

.history-message h2 {
  color: var(--color-text);
  font-size: 17px;
  margin: 0 0 8px;
}

/* appointment details view */
.appointment-detail-view {
  margin: 0 auto;
  max-width: 640px;
}

.back-button {
  background: transparent;
  border: 0;
  color: var(--color-primary-dark);
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 20px;
  padding: 4px 0;
}

.back-button:hover:not(:disabled) {
  background: transparent;
  text-decoration: underline;
}

.detail-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  color: var(--color-text);
  padding: 24px;
}

.detail-card p {
  margin: 0;
}

.status-badge {
  border-radius: var(--radius-badge);
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  padding: 5px 9px;
}

.status-booked {
  background: var(--color-primary-soft);
  color: var(--color-primary-dark);
}

.status-completed {
  background: var(--color-success-soft);
  color: var(--color-success);
}

.status-cancelled {
  background: #eef2f4;
  color: var(--color-text-muted);
}

.detail-doctor {
  font-size: 21px;
  font-weight: 650;
  margin: 16px 0 6px;
  overflow-wrap: anywhere;
}

.detail-reason {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.detail-schedule {
  border-top: 1px solid var(--color-border);
  color: var(--color-text-muted);
  display: flex;
  flex-wrap: wrap;
  font-size: 13px;
  gap: 20px;
  margin-top: 20px;
  padding-top: 16px;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 24px;
}

.action-buttons button,
.cancel-dialog-actions button {
  border-radius: var(--radius-control);
  font-size: 13px;
  font-weight: 600;
  min-height: 40px;
  padding: 9px 14px;
}

.button-primary {
  background: var(--color-primary-dark);
  border: 1px solid var(--color-primary-dark);
  color: white;
}

.button-primary:hover:not(:disabled) {
  background: var(--color-primary-deep);
}

.button-secondary {
  background: white;
  border: 1px solid var(--color-border);
  color: var(--color-text);
}

.button-secondary:hover:not(:disabled) {
  background: var(--color-background);
}

.button-danger {
  background: white;
  border: 1px solid #efc7c4;
  color: var(--color-danger);
}

.button-danger:hover:not(:disabled) {
  background: var(--color-danger-soft);
}

.action-buttons button:disabled,
.cancel-dialog-actions button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.detail-card .action-note {
  color: var(--color-text-muted);
  font-size: 13px;
  margin-top: 20px;
}

/* 5A Edit form */
.edit-form {
  border-top: 1px solid var(--color-border);
  margin-top: 24px;
  padding-top: 22px;
}

.form-row {
  display: flex;
  gap: 16px;
}

.form-field {
  flex: 1;
  min-width: 0;
}

.form-field label {
  color: var(--color-text);
  display: block;
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.form-field input,
.form-field select {
  background: white;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  font: inherit;
  font-size: 14px;
  min-height: 44px;
  padding: 10px 12px;
  width: 100%;
}

.form-field input:focus-visible,
.form-field select:focus-visible {
  border-color: var(--color-primary-dark);
}

.detail-card .edit-message,
.detail-card .edit-error,
.detail-card .edit-success {
  font-size: 13px;
  line-height: 1.5;
  margin-top: 12px;
}

.detail-card .edit-message {
  color: var(--color-text-muted);
}

.detail-card .edit-error {
  color: var(--color-danger);
}

.detail-card .edit-success {
  color: var(--color-success);
}

/* 7C: consultation details */
.consultation-details {
  border-top: 1px solid var(--color-border);
  margin-top: 24px;
  padding-top: 20px;
}

.consultation-details h3 {
  font-size: 17px;
  margin: 0 0 16px;
}

.detail-card .consultation-details p {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 12px;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.consultation-details strong {
  color: var(--color-text);
}

/* 5C cancellation confirmation popup */
.cancel-overlay {
  align-items: flex-start;
  background: rgb(31 41 55 / 40%);
  display: flex;
  inset: 0;
  justify-content: center;
  overflow-y: auto;
  padding: clamp(24px, 10vh, 96px) 16px 24px;
  position: fixed;
  z-index: 1000;
}

.cancel-dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-dialog);
  box-shadow: var(--shadow-overlay);
  max-height: calc(100dvh - 48px);
  max-width: 480px;
  overflow-y: auto;
  padding: 24px;
  width: 100%;
}

.cancel-dialog h2 {
  color: var(--color-text);
  font-size: 20px;
  margin: 0 0 12px;
}

.cancel-dialog p {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.6;
  margin: 0;
}

.cancel-dialog .edit-error {
  color: var(--color-danger);
  margin-top: 12px;
}

.cancel-dialog-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  margin-top: 24px;
}

.cancel-dialog-actions .button-danger {
  background: var(--color-danger);
  border-color: var(--color-danger);
  color: white;
}

.cancel-dialog-actions .button-danger:hover:not(:disabled) {
  background: #912018;
}

@media (max-width: 700px) {
  .history-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .appointment-tabs {
    gap: 14px;
  }

  .form-row {
    flex-direction: column;
  }

  .detail-card {
    padding: 20px 16px;
  }
}
</style>
