<template>
  <main class="page history-page">
    <div class="page-header">
      <h1>Appointment History</h1>
      <p>Review your completed and cancelled appointments</p>
    </div>

    <div v-if="loading" class="history-message">
      <p>Loading appointment history...</p>
    </div>

    <div v-else-if="errorMessage" class="history-message">
      <p>{{ errorMessage }}</p>
    </div>

    <div v-else-if="appointments.length > 0" class="history-grid">
      <AppointmentHistoryCard v-for="appointment in appointments" :key="appointment.id" :appointment="appointment"
        :selected="selectedId === appointment.id" @select="selectAppointment" />
    </div>

    <div v-else class="card history-message">
      <h2>No past appointments yet</h2>
      <p>Your completed and cancelled appointments will appear here</p>
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
      selectedId: null,
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
        this.selectedId = null;
        this.errorMessage = 'please log in to view your appointment history';
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
      this.selectedId = null;

      try {
        // retrieve appointments belonging to the logged-in patient
        const snapshot = await db.collection('appointments')
          .where('patientId', '==', patientId)
          .get();

        const pastAppointments = [];

        snapshot.forEach((doc) => {
          const appointment = doc.data();

          // only display completed and cancelled appointments
          if (appointment.status === 'completed' ||
            appointment.status === 'cancelled') {

            pastAppointments.push({
              id: doc.id,
              doctorName: appointment.doctorName,
              reason: appointment.reason,
              date: appointment.date,
              time: appointment.time,
              status: appointment.status
            });
          }
        });

        // display most recent appointments first
        pastAppointments.sort((a, b) => {
          return (b.date + b.time).localeCompare(a.date + a.time);
        });

        // check the patient still logged in
        if (auth.currentUser && auth.currentUser.uid === patientId) {
          this.appointments = pastAppointments;
        }

      } catch (error) {
        console.error('error retrieving appointments:', error);

        if (auth.currentUser && auth.currentUser.uid === patientId) {
          this.errorMessage = 'unable to load appointment history';
        }
      } finally {
        this.loading = false;
      }
    },

    selectAppointment(id) {
      if (this.selectedId === id) {
        this.selectedId = null;
      } else {
        this.selectedId = id;
      }
    }
  }
};
</script>

<style scoped>
.history-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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