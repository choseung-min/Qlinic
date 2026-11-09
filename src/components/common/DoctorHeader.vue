<template>
  <header class="doctor-nav">
    <router-link class="doctor-brand" to="/doctor" aria-label="Qlinic doctor dashboard">
      <span class="brand-mark" aria-hidden="true">✚</span>
      <span class="brand-name">
        <strong>Qlinic</strong>
        <small>DOCTOR</small>
      </span>
    </router-link>

    <router-link class="dashboard-link" to="/doctor">Dashboard</router-link>

    <div class="doctor-account">
      <span class="doctor-name" :title="doctorName">{{ doctorName }}</span>
      <button class="logout-button" type="button" @click="$emit('logout')">
        Log out
      </button>
    </div>
  </header>
</template>

<script setup>
defineProps({
  doctorName: { type: String, default: "Doctor" },
});

defineEmits(["logout"]);
</script>

<style scoped>
.doctor-nav {
  align-items: center;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  display: grid;
  gap: 20px;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  min-height: 76px;
  padding: 12px max(24px, calc((100vw - var(--width-content, 1150px)) / 2));
}

.doctor-brand {
  align-items: center;
  color: var(--color-primary-dark);
  display: inline-flex;
  gap: 8px;
  justify-self: start;
  text-decoration: none;
}

.brand-mark {
  align-items: center;
  background: var(--color-primary);
  border-radius: var(--radius-control, 6px);
  color: white;
  display: inline-flex;
  font-size: 13px;
  height: 26px;
  justify-content: center;
  width: 26px;
}

.brand-name strong,
.brand-name small {
  display: block;
}

.brand-name strong {
  font-size: 18px;
  line-height: 1.1;
}

.brand-name small {
  color: var(--color-primary-dark);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.07em;
  margin-top: 4px;
}

.dashboard-link {
  border-radius: var(--radius-control, 6px);
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 600;
  padding: 9px 13px;
  text-decoration: none;
  transition: background-color 0.2s ease, color 0.2s ease;
}

.dashboard-link:hover,
.dashboard-link.router-link-exact-active {
  background: var(--color-primary-soft);
  color: var(--color-primary-dark);
}

.doctor-account {
  align-items: center;
  display: flex;
  gap: 16px;
  justify-self: end;
  min-width: 0;
}

.doctor-name {
  color: var(--color-text-muted);
  font-size: 13px;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.logout-button {
  background: var(--color-primary-dark);
  border-radius: var(--radius-control, 6px);
  color: white;
  flex-shrink: 0;
  font-size: 13px;
  padding: 10px 16px;
}

.logout-button:hover {
  background: var(--color-primary-deep, #0b5d5a);
}

@media (max-width: 760px) {
  .doctor-nav {
    gap: 12px;
    grid-template-columns: minmax(0, 1fr) auto;
    padding: 12px 16px;
  }

  .dashboard-link {
    grid-column: 1 / -1;
    justify-self: start;
  }

  .doctor-account {
    gap: 10px;
  }

  .doctor-name {
    max-width: 120px;
  }
}

@media (max-width: 420px) {
  .doctor-name {
    max-width: 75px;
  }
}
</style>
