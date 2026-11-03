<template>
  <main class="page">
    <header class="page-header">
      <h1>Staff dashboard</h1>
      <p>Manage today's patient flow and medicine collection.</p>
    </header>

    <section class="dashboard-grid" aria-label="Staff dashboard options">
      <router-link
        class="dashboard-card"
        :to="{ name: 'StaffWalkInRegistration' }"
      >
        <span class="card-icon" aria-hidden="true">+</span>
        <span>
          <strong>Register walk-in patient</strong>
          <small>Add a patient to the clinic queue.</small>
        </span>
      </router-link>

      <router-link
        class="dashboard-card"
        :to="{ name: 'StaffPatientOverview' }"
      >
        <span class="card-icon" aria-hidden="true">▣</span>
        <span>
          <strong>Patient overview</strong>
          <small
            >View patients, visit types, doctors, and current clinic
            status.</small
          >
        </span>
      </router-link>

      <router-link
        class="dashboard-card"
        :to="{ name: 'StaffMedicineCollection' }"
      >
        <span class="card-icon" aria-hidden="true">+</span>
        <span>
          <strong>Medicine collection</strong>
          <small
            >Track patients who are waiting for or collecting medicine.</small
          >
        </span>
      </router-link>
    </section>
  </main>
</template>

<style scoped>
.dashboard-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  margin-top: 24px;
  max-width: 760px;
}

.dashboard-card {
  align-items: flex-start;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  color: var(--color-text);
  display: flex;
  gap: 14px;
  padding: 20px;
  text-decoration: none;
}

.dashboard-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 4px 12px rgb(31 41 55 / 8%);
}

.card-icon {
  align-items: center;
  background: var(--color-primary-soft);
  border-radius: 8px;
  color: var(--color-primary-dark);
  display: inline-flex;
  flex: 0 0 36px;
  font-size: 20px;
  height: 36px;
  justify-content: center;
}

.dashboard-card strong,
.dashboard-card small {
  display: block;
}

.dashboard-card strong {
  margin-bottom: 6px;
}

.dashboard-card small {
  color: var(--color-text-muted);
  line-height: 1.45;
}
</style>
