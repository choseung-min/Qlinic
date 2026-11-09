<template>
  <div v-if="visible" class="reminder-banner" role="status">
    <span class="reminder-icon" aria-hidden="true">ⓘ</span>
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
  border: 1px solid #c4e7e2;
  border-left: 3px solid var(--color-primary-dark);
  border-radius: var(--radius-card);
  color: var(--color-text);
  display: flex;
  font-size: 14px;
  gap: 12px;
  line-height: 1.5;
  margin: 16px auto;
  padding: 12px 14px;
  width: 100%;
}

.reminder-icon {
  color: var(--color-primary-dark);
  font-size: 19px;
  font-weight: 600;
}

.reminder-text {
  flex: 1;
  min-width: 0;
}

.dismiss-button {
  background: transparent;
  border: 0;
  border-radius: var(--radius-control);
  color: var(--color-text-muted);
  flex-shrink: 0;
  font-size: 16px;
  padding: 5px 8px;
}

.dismiss-button:hover:not(:disabled) {
  background: #d4eee9;
  color: var(--color-text);
}
</style>