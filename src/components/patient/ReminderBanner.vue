<template>
  <div v-if="visible" class="reminder-banner" role="status">
    <span class="reminder-icon" aria-hidden="true">🔔</span>
    <span class="reminder-text">{{ message }}</span>
    <button class="dismiss-button" type="button" aria-label="Dismiss reminder" @click="visible = false">
      ✕
    </button>
  </div>
</template>

<script setup>
import { ref } from "vue";

defineProps({
  message: { type: String, required: true },
});

const visible = ref(true);
</script>

<style scoped>
.reminder-banner {
  align-items: center;
  background: var(--color-primary-soft);
  border: 1px solid var(--color-primary);
  border-left: 5px solid var(--color-primary);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgb(31 41 55 / 8%);
  color: var(--color-text);
  display: flex;
  font-size: 15px;
  gap: 12px;
  line-height: 1.4;
  margin: 16px auto;
  max-width: none;
  padding: 14px 16px;
  width: auto;
}

.reminder-icon {
  font-size: 20px;
}

.reminder-text {
  flex: 1;
  font-weight: 500;
}

.dismiss-button {
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
}

.dismiss-button:hover {
  background: var(--color-surface);
  color: var(--color-text);
}
</style>