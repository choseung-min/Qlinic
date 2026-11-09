<template>
  <div
    class="history-card"
    role="button"
    tabindex="0"
    @click="selectCard"
    @keydown.enter="selectCard"
    @keydown.space.prevent="selectCard"
  >
    <div class="card-topline">
      <p v-if="appointment.status === 'booked'"
         class="status-badge status-booked">
        Booked
      </p>

      <p v-else-if="appointment.status === 'completed'"
         class="status-badge status-completed">
        Completed
      </p>

      <p v-else-if="appointment.status === 'cancelled'"
         class="status-badge status-cancelled">
        Cancelled
      </p>

      <p v-else class="status-badge">
        {{ appointment.status || 'Unknown' }}
      </p>

      <p class="chevron">»</p>
    </div>

    <p class="doctor-name">
      {{ appointment.doctorName || 'Doctor unavailable' }}
    </p>

    <p class="visit-reason">
      {{ appointment.reason || 'No reason for visit provided' }}
    </p>

    <div class="appointment-schedule">
      <p>Date: {{ formatDate(appointment.date) }}</p>
      <p>Time: {{ appointment.time || 'Time unavailable' }}</p>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AppointmentHistoryCard',

  props: {
    appointment: Object
  },

  emits: ['select'],

  methods: {
    selectCard() {
      this.$emit('select', this.appointment);
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
.history-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  color: var(--color-text);
  cursor: pointer;
  display: flex;
  flex-direction: column;
  font-size: 14px;
  gap: 10px;
  height: 100%;
  line-height: 1.5;
  padding: 20px;
  text-align: left;
  transition: border-color 0.2s ease;
}

.history-card:hover {
  border-color: var(--color-primary);
}

.history-card:focus-visible {
  outline: 2px solid var(--color-primary-dark);
  outline-offset: 3px;
}

.history-card p {
  margin: 0;
}

.card-topline {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 2px;
}

.status-badge {
  border-radius: var(--radius-badge);
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

.chevron {
  color: var(--color-text-muted);
  font-size: 19px;
  line-height: 1;
}

.doctor-name {
  font-size: 16px;
  font-weight: 600;
}

.doctor-name,
.visit-reason {
  overflow-wrap: anywhere;
}

.visit-reason,
.appointment-schedule {
  color: var(--color-text-muted);
  font-size: 13px;
}

.appointment-schedule {
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin-top: auto;
  padding-top: 12px;
}
</style>