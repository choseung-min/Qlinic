<template>
    <div class="history-card" :class="{ 'is-selected': selected }" role="button" tabindex="0" @click="selectCard"
        @keydown.enter="selectCard" @keydown.space.prevent="selectCard">
        <div class="card-topline">
            <p v-if="appointment.status === 'completed'" class="status-badge status-completed">
                Completed
            </p>
            <p v-else class="status-badge status-cancelled">
                Cancelled
            </p>
            <p class="chevron">></p>
        </div>

        <p class="doctor-name">
            {{ appointment.doctorName || 'Doctor unavailable' }}
        </p>

        <p class="visit-reason">
            {{ appointment.reason || 'No reason for visit provided' }}
        </p>

        <div class="appointment-schedule">
            <p>{{ formatDate(appointment.date) }}</p>
            <p>{{ appointment.time || 'Time unavailable' }}</p>
        </div>
    </div>
</template>

<script>
export default {
    name: 'AppointmentHistoryCard',

    props: {
        appointment: Object,
        selected: Boolean
    },

    emits: ['select'],

    methods: {
        selectCard() {
            this.$emit('select', this.appointment.id);
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
    box-shadow: var(--shadow-card);
    color: var(--color-text);
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 20px;
    height: 100%;
    cursor: pointer;
    text-align: left;
    font-size: 14px;
    line-height: 1.5;
}

.history-card:hover,
.history-card.is-selected {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 1px var(--color-primary);
}

.history-card:focus-visible {
    outline: 3px solid var(--color-primary);
    outline-offset: 4px;
}

.history-card p {
    margin: 0;
}

.card-topline {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2px;
}

.status-badge {
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    padding: 3px 8px;
}

.status-completed {
    background: var(--color-primary-soft);
    color: var(--color-primary-dark);
}

.status-cancelled {
    background: #f0f3f7;
    color: #536078;
}

.chevron {
    color: var(--color-text-muted);
    font-size: 24px;
}

.doctor-name {
    font-size: 15px;
    font-weight: 600;
}

.doctor-name,
.visit-reason {
    overflow-wrap: anywhere;
}

.visit-reason,
.appointment-schedule {
    color: #5d6d83;
    font-size: 13px;
}

.appointment-schedule {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-top: auto;
    padding-top: 8px;
}
</style>
