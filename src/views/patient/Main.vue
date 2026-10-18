<template>
  <main class="page dashboard-page">
    <header class="page-header">
      <h1>Welcome to Qlinic</h1>
      <p>Here's what's happening with your visits today.</p>
    </header>

    <section class="card queue-card" aria-labelledby="queue-title">
      <div>
        <h2 id="queue-title">Not currently in the queue</h2>
        <p>Join the walk-in queue remotely, no need to wait at the clinic.</p>
        <p v-if="queueError" class="error-message" role="alert">
          {{ queueError }}
        </p>
      </div>

      <button :disabled="isJoining" type="button" @click="handleJoinQueue">
        {{ isJoining ? "Joining..." : "Join Queue" }}
      </button>
    </section>
  </main>
</template>

<script setup>
import { ref } from "vue";
import { auth } from "@/services/firebase";

const isJoining = ref(false);
const queueError = ref("");

async function handleJoinQueue() {
  queueError.value = "";

  if (!auth.currentUser?.uid) {
    queueError.value = "Please sign in before joining the queue.";
    return;
  }

  isJoining.value = true;

  try {
    await Promise.resolve();
    queueError.value =
      "Queue joining is not available yet. Please try again shortly.";
  } catch (error) {
    console.error("Unable to join the walk-in queue.", error);
    queueError.value = "Unable to join the queue. Please try again.";
  } finally {
    isJoining.value = false;
  }
}
</script>

<style scoped>
.dashboard-page {
  max-width: 900px;
}

.queue-card {
  align-items: center;
  display: flex;
  gap: 24px;
  justify-content: space-between;
  margin-top: 24px;
}

.queue-card h2 {
  font-size: 16px;
  margin: 0 0 6px;
}

.queue-card p {
  color: var(--color-text-muted);
  font-size: 13px;
  margin: 0;
}

.queue-card button {
  flex: 0 0 auto;
}

.error-message {
  color: #b42318 !important;
  margin-top: 10px !important;
}

button:disabled {
  cursor: wait;
  opacity: 0.65;
}

@media (max-width: 560px) {
  .queue-card {
    align-items: flex-start;
    flex-direction: column;
  }

  .queue-card button {
    width: 100%;
  }
}
</style>
