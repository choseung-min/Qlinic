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

          <label for="mobile-number">Mobile number</label>
          <input
            id="mobile-number"
            v-model.trim="mobileNumber"
            type="tel"
            autocomplete="tel"
            required
          />

          <label for="date-of-birth">Date of birth</label>
          <input
            id="date-of-birth"
            v-model="dateOfBirth"
            type="date"
            autocomplete="bday"
            required
          />

          <label for="sex">Sex</label>
          <select id="sex" v-model="sex" required>
            <option disabled value="">Select sex</option>
            <option>Female</option>
            <option>Male</option>
            <option>Prefer not to say</option>
          </select>

          <label for="patient-identifier">
            NRIC/FIN or patient identifier <span class="optional-label">(optional)</span>
          </label>
          <input id="patient-identifier" v-model.trim="patientIdentifier" type="text" />

          <label for="address">
            Residential address <span class="optional-label">(optional)</span>
          </label>
          <input id="address" v-model.trim="address" type="text" />

          <label for="preferred-language">
            Preferred language <span class="optional-label">(optional)</span>
          </label>
          <input id="preferred-language" v-model.trim="preferredLanguage" type="text" />
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
const mobileNumber = ref("");
const dateOfBirth = ref("");
const sex = ref("");
const patientIdentifier = ref("");
const address = ref("");
const preferredLanguage = ref("");
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
        mobileNumber: mobileNumber.value,
        dateOfBirth: dateOfBirth.value,
        sex: sex.value,
        patientIdentifier: patientIdentifier.value,
        address: address.value,
        preferredLanguage: preferredLanguage.value,
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

.optional-label {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 400;
  text-transform: none;
}

input[type="email"],
input[type="password"],
input[type="text"],
input[type="tel"],
input[type="date"],
select {
  border: 1px solid var(--color-border);
  border-radius: 7px;
  color: var(--color-text);
  font: inherit;
  padding: 11px 12px;
}

input:focus,
select:focus {
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
