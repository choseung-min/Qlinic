<template>
  <main class="page auth-page">
    <section class="card auth-card">
      <header class="page-header">
        <h1>{{ isRegistering ? "Create your patient account" : "Welcome to Qlinic" }}</h1>
        <p>
          {{
            isRegistering
              ? "Register to manage your appointments."
              : "Sign in to manage your appointments."
          }}
        </p>
      </header>

      <form @submit.prevent="handleSubmit">
        <template v-if="isRegistering">
          <label for="display-name">Name</label>
          <input id="display-name" v-model.trim="displayName" type="text" required />
        </template>

        <label for="email">Email</label>
        <input id="email" v-model.trim="email" type="email" required />

        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" required />

        <template v-if="!isRegistering">
          <label for="staff-id">Staff ID</label>
          <input
            id="staff-id"
            v-model.trim="staffId"
            type="text"
            placeholder="Leave blank if you are a patient"
          />
        </template>

        <p v-if="errorMessage" class="error-message" role="alert">
          {{ errorMessage }}
        </p>

        <button :disabled="isSubmitting" type="submit">
          {{
            isSubmitting
              ? isRegistering
                ? "Creating account..."
                : "Signing in..."
              : isRegistering
                ? "Create account"
                : "Sign in"
          }}
        </button>
      </form>

      <button class="button-secondary mode-button" type="button" @click="toggleMode">
        {{
          isRegistering
            ? "Already have an account? Sign in"
            : "Need an account? Register as a patient"
        }}
      </button>
    </section>
  </main>
</template>

<script setup>
import { ref } from "vue";
import { useRouter } from "vue-router";
import { registerPatient, signInUser } from "@/services/auth";

const router = useRouter();
const isRegistering = ref(false);
const displayName = ref("");
const email = ref("");
const password = ref("");
const staffId = ref("");
const errorMessage = ref("");
const isSubmitting = ref(false);

async function handleSubmit() {
  errorMessage.value = "";
  isSubmitting.value = true;

  try {
    if (isRegistering.value) {
      await registerPatient({
        displayName: displayName.value,
        email: email.value,
        password: password.value,
      });
    } else {
      const { role } = await signInUser({
        email: email.value,
        password: password.value,
        staffId: staffId.value,
      });

      await router.push({ name: role === "staff" ? "StaffMain" : "Main" });
      return;
    }

    await router.push({ name: "Main" });
  } catch (error) {
    errorMessage.value =
      error.code === "auth/invalid-credential"
        ? "The email or password is incorrect."
        : error.code === "auth/email-already-in-use"
          ? "An account already exists for this email."
        : error.message || "Unable to sign in. Please try again.";
  } finally {
    isSubmitting.value = false;
  }
}

function toggleMode() {
  isRegistering.value = !isRegistering.value;
  errorMessage.value = "";
  staffId.value = "";
}
</script>

<style scoped>
.auth-page {
  align-items: center;
  display: flex;
  justify-content: center;
  min-height: calc(100vh - 72px);
}

.auth-card {
  max-width: 460px;
  width: 100%;
}

form {
  display: grid;
  gap: 10px;
}

label,
legend {
  color: var(--color-text);
  font-size: 13px;
  font-weight: 600;
}

input[type="email"],
input[type="password"],
input[type="text"] {
  border: 1px solid var(--color-border);
  border-radius: 7px;
  color: var(--color-text);
  padding: 11px 12px;
}

input:focus {
  border-color: var(--color-primary);
  outline: 2px solid var(--color-primary-soft);
}

.error-message {
  color: #b42318;
  font-size: 13px;
  margin: 4px 0;
}

button:disabled {
  cursor: wait;
  opacity: 0.65;
}

.mode-button {
  margin-top: 16px;
  width: 100%;
}
</style>
