<template>
  <main class="page history-page">

    <!-- appointment details view -->
    <div v-if="selectedAppointment" class="appointment-detail-view">
      <button class="back-button" @click="backToHistory">
        &larr; Back
      </button>

      <div class="detail-card">
        <p v-if="selectedAppointment.status === 'booked'"
           class="status-badge status-booked">
          Booked
        </p>

        <p v-else-if="selectedAppointment.status === 'completed'"
           class="status-badge status-completed">
          Completed
        </p>

        <p v-else-if="selectedAppointment.status === 'cancelled'"
           class="status-badge status-cancelled">
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

        <div class="detail-schedule">
          <p>🗓 {{ formatDate(selectedAppointment.date) }}</p>
          <p>⏲ {{ selectedAppointment.time || 'Time unavailable' }}</p>
        </div>

        <!-- 7C consultation details for completed appointments -->
        <div v-if="selectedAppointment.status === 'completed'"
             class="consultation-details">
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

        <div v-else-if="selectedAppointment.status === 'cancelled'"
             class="consultation-details">
          <h3>Appointment Details</h3>
          <p>This appointment was cancelled</p>
          <p>No consultation details are available</p>
        </div>

      </div>
    </div>

    <!-- appointment history grid -->
    <div v-else>
      <div class="page-header">
        <h1>Appointment History</h1>
        <p>All your past and upcoming appointments</p>
      </div>

      <div v-if="loading" class="history-message">
        <p>Loading appointments...</p>
      </div>

      <div v-else-if="errorMessage" class="history-message">
        <p>{{ errorMessage }}</p>
      </div>

      <div v-else-if="appointments.length > 0" class="history-grid">
        <AppointmentHistoryCard
          v-for="appointment in appointments"
          :key="appointment.id"
          :appointment="appointment"
          @select="selectAppointment"
        />
      </div>

      <div v-else class="card history-message">
        <h2>No appointments yet</h2>
        <p>Your appointments will appear here</p>
      </div>
    </div>
  </main>
</template>

<script>
import AppointmentHistoryCard from '@/components/patient/AppointmentHistoryCard.vue';
import { auth, db } from '@/services/firebase.js';

export default {
  name: 'History',

  components: {
    AppointmentHistoryCard
  },

  data() {
    return {
      appointments: [],
      selectedAppointment: null,
      loading: true,
      errorMessage: '',
      unsubscribeAuth: null
    };
  },

  mounted() {
    this.unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (user) {
        this.getAppointments(user.uid);
      } else {
        this.appointments = [];
        this.selectedAppointment = null;
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
    async getAppointments(patientId) {
      this.loading = true;
      this.errorMessage = '';
      this.appointments = [];
      this.selectedAppointment = null;

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

        // check patient is still logged in
        if (auth.currentUser && auth.currentUser.uid === patientId) {
          this.appointments = patientAppointments;
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
    },

    backToHistory() {
      this.selectedAppointment = null;
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
.history-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: 16px;
}

.history-message {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.6;
  padding: 36px 24px;
  text-align: center;
}

.history-message h2 {
  color: var(--color-text);
  font-size: 16px;
  margin-bottom: 8px;
}

/* appointment details view */
.appointment-detail-view {
  max-width: 560px;
}

.back-button {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 14px;
  margin-bottom: 20px;
  padding: 0;
}

.back-button:hover {
  color: var(--color-primary);
}

.back-button:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 4px;
}

.detail-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  color: var(--color-text);
  padding: 24px;
}

.detail-card p {
  margin: 0;
}

.status-badge {
  display: inline-block;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
}

.status-booked {
  background: var(--color-primary-soft);
  color: var(--color-primary-dark);
}

.status-completed {
  background: var(--color-primary-soft);
  color: var(--color-primary-dark);
}

.status-cancelled {
  background: #f0f3f7;
  color: #536078;
}

.detail-doctor {
  font-size: 18px;
  font-weight: 600;
  margin: 16px 0 6px;
  overflow-wrap: anywhere;
}

.detail-reason {
  color: #5d6d83;
  font-size: 14px;
  overflow-wrap: anywhere;
}

.detail-schedule {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  color: #5d6d83;
  font-size: 13px;
  margin-top: 24px;
}

/* 7C consultation details */
.consultation-details {
  border-top: 1px solid var(--color-border);
  margin-top: 24px;
  padding-top: 20px;
}

.consultation-details h3 {
  font-size: 15px;
  margin: 0 0 16px;
}

.consultation-details p {
  color: #5d6d83;
  font-size: 13px;
  margin-bottom: 12px;
  overflow-wrap: anywhere;
}

.consultation-details strong {
  color: var(--color-text);
}

@media (max-width: 900px) {
  .history-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 600px) {
  .history-grid {
    grid-template-columns: 1fr;
  }
}
</style>