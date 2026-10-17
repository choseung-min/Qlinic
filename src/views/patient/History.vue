<template>
  <main class="page history-page">
    <div class="page-header">
      <h1>Appointment History</h1>
      <p>Review your completed and cancelled appointments.</p>
    </div>

    <div v-if="appointments.length > 0" class="history-grid">
      <AppointmentHistoryCard
        v-for="appointment in appointments"
        :key="appointment.id"
        :appointment="appointment"
        :selected="selectedId === appointment.id"
        @select="selectAppointment"
      />
    </div>

    <div v-else class="card history-message">
      <h2>No past appointments yet</h2>
      <p>Your completed and cancelled appointments will appear here.</p>
    </div>
  </main>
</template>

<script>
import AppointmentHistoryCard from '@/components/patient/AppointmentHistoryCard.vue';

export default {
  name: 'History',

  components: {
    AppointmentHistoryCard
  },

  data() {
    return {
      // Temporary data for Task 7B
      appointments: [
        {
          id: '1',
          doctorName: 'Dr Tan',
          reason: 'General consultation',
          date: '2026-10-08',
          time: '10:30',
          status: 'completed'
        },
        {
          id: '2',
          doctorName: 'Dr Lim',
          reason: 'Follow-up consultation',
          date: '2026-09-25',
          time: '14:00',
          status: 'completed'
        },
        {
          id: '3',
          doctorName: 'Dr Lee',
          reason: 'Health screening',
          date: '2026-09-12',
          time: '09:00',
          status: 'cancelled'
        }
      ],

      selectedId: null
    };
  },

  methods: {
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