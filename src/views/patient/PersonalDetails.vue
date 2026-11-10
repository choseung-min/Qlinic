<template>
  <main class="page profile-page">
    <header class="profile-header">
      <div>
        <p class="eyebrow">Account</p>
        <h1>My Profile</h1>
        <p>View and manage your account information.</p>
      </div>
      <button
        v-if="!isEditing"
        class="edit-button button-secondary"
        type="button"
        @click="startEditing"
      >
        <span aria-hidden="true">✎</span> Edit Profile
      </button>
    </header>

    <p v-if="isLoading" class="status-message" role="status">
      Loading your profile...
    </p>

    <section v-else class="card profile-card" aria-labelledby="personal-info-title">
      <div class="card-heading">
        <h2 id="personal-info-title">Personal Information</h2>
      </div>

      <form v-if="isEditing" class="profile-form" @submit.prevent="saveProfile">
        <div class="field">
          <label for="display-name">Full name</label>
          <input id="display-name" v-model.trim="form.displayName" required />
        </div>
        <div class="field">
          <label for="date-of-birth">Date of birth</label>
          <input id="date-of-birth" v-model="form.dateOfBirth" type="date" />
        </div>
        <div class="field">
          <label for="sex">Sex</label>
          <select id="sex" v-model="form.sex">
            <option value="">Select sex</option>
            <option>Female</option>
            <option>Male</option>
            <option>Prefer not to say</option>
          </select>
        </div>
        <div class="field">
          <label for="patient-identifier">NRIC/FIN or patient identifier</label>
          <input id="patient-identifier" v-model.trim="form.patientIdentifier" />
        </div>
        <div class="field field-wide">
          <label for="address">Residential address</label>
          <input id="address" v-model.trim="form.address" />
        </div>
        <div class="field">
          <label for="language">Preferred language</label>
          <input id="language" v-model.trim="form.preferredLanguage" />
        </div>
        <div class="field">
          <label for="mobile-number">Mobile number</label>
          <input id="mobile-number" v-model.trim="form.mobileNumber" type="tel" />
        </div>
        <div class="field field-wide">
          <label for="allergies">Allergies</label>
          <textarea
            id="allergies"
            v-model.trim="form.allergies"
            rows="2"
            placeholder="List any known allergies"
          ></textarea>
        </div>
        <div class="field field-wide">
          <label for="medical-conditions">Existing medical conditions</label>
          <textarea
            id="medical-conditions"
            v-model.trim="form.medicalConditions"
            rows="2"
            placeholder="List any existing medical conditions"
          ></textarea>
        </div>
        <div class="field field-wide">
          <label for="current-medications">Current medications</label>
          <textarea
            id="current-medications"
            v-model.trim="form.currentMedications"
            rows="2"
            placeholder="List any current medications"
          ></textarea>
        </div>
        <div class="field">
          <label for="email">Email address</label>
          <input id="email" :value="form.email" disabled type="email" />
        </div>

        <p v-if="errorMessage" class="error-message" role="alert">{{ errorMessage }}</p>
        <p v-if="successMessage" class="success-message" role="status">{{ successMessage }}</p>
        <div class="form-actions">
          <button class="button-secondary" type="button" @click="cancelEditing">
            Cancel
          </button>
          <button :disabled="isSaving" type="submit">
            {{ isSaving ? "Saving..." : "Save Changes" }}
          </button>
        </div>
      </form>

      <div v-else class="profile-grid">
        <div class="profile-field">
          <dt>Full name</dt>
          <dd>{{ profile.displayName || "—" }}</dd>
        </div>
        <div class="profile-field">
          <dt>Date of birth</dt>
          <dd>{{ profile.dateOfBirth || "—" }}</dd>
        </div>
        <div class="profile-field">
          <dt>Sex</dt>
          <dd>{{ profile.sex || "—" }}</dd>
        </div>
        <div class="profile-field">
          <dt>NRIC/FIN or patient identifier <span>(optional)</span></dt>
          <dd>{{ profile.patientIdentifier || "—" }}</dd>
        </div>
        <div class="profile-field field-wide">
          <dt>Residential address <span>(optional)</span></dt>
          <dd>{{ profile.address || "—" }}</dd>
        </div>
        <div class="profile-field">
          <dt>Preferred language <span>(optional)</span></dt>
          <dd>{{ profile.preferredLanguage || "—" }}</dd>
        </div>
        <div class="profile-field">
          <dt>Mobile number</dt>
          <dd>{{ profile.mobileNumber || "—" }}</dd>
        </div>
        <div class="profile-field">
          <dt>Email address</dt>
          <dd>{{ profile.email || "—" }}</dd>
        </div>
        <div class="profile-field field-wide">
          <dt>Allergies</dt>
          <dd>{{ profile.allergies || "—" }}</dd>
        </div>
        <div class="profile-field field-wide">
          <dt>Existing medical conditions</dt>
          <dd>{{ profile.medicalConditions || "—" }}</dd>
        </div>
        <div class="profile-field field-wide">
          <dt>Current medications</dt>
          <dd>{{ profile.currentMedications || "—" }}</dd>
        </div>
      </div>
    </section>
  </main>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref } from "vue";
import { auth, db } from "@/services/firebase";

const isLoading = ref(true);
const isEditing = ref(false);
const isSaving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");
const profile = reactive(createEmptyProfile());
const form = reactive(createEmptyProfile());
let unsubscribeAuth;

function createEmptyProfile() {
  return {
    displayName: "",
    dateOfBirth: "",
    sex: "",
    patientIdentifier: "",
    address: "",
    preferredLanguage: "",
    mobileNumber: "",
    email: "",
    allergies: "",
    medicalConditions: "",
    currentMedications: "",
  };
}

function applyProfile(data) {
  Object.assign(profile, {
    ...createEmptyProfile(),
    ...data,
  });
  Object.assign(form, profile);
}

async function loadProfile(user) {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    const snapshot = await db.collection("users").doc(user.uid).get();
    applyProfile({
      ...(snapshot.data() || {}),
      displayName: snapshot.data()?.displayName || user.displayName || "",
      email: snapshot.data()?.email || user.email || "",
    });
  } catch (error) {
    console.error("Unable to load patient profile.", error);
    errorMessage.value = "Unable to load your profile.";
  } finally {
    isLoading.value = false;
  }
}

function startEditing() {
  Object.assign(form, profile);
  errorMessage.value = "";
  successMessage.value = "";
  isEditing.value = true;
}

function cancelEditing() {
  Object.assign(form, profile);
  errorMessage.value = "";
  isEditing.value = false;
}

async function saveProfile() {
  const user = auth.currentUser;
  if (!user) {
    errorMessage.value = "Please sign in before updating your profile.";
    return;
  }

  isSaving.value = true;
  errorMessage.value = "";
  successMessage.value = "";

  const profileData = {
    displayName: form.displayName,
    dateOfBirth: form.dateOfBirth,
    sex: form.sex,
    patientIdentifier: form.patientIdentifier,
    address: form.address,
    preferredLanguage: form.preferredLanguage,
    mobileNumber: form.mobileNumber,
    allergies: form.allergies,
    medicalConditions: form.medicalConditions,
    currentMedications: form.currentMedications,
  };

  try {
    await Promise.all([
      db.collection("users").doc(user.uid).set(profileData, { merge: true }),
      db.collection("patients").doc(user.uid).set(profileData, { merge: true }),
    ]);
    applyProfile({ ...profile, ...profileData });
    isEditing.value = false;
    successMessage.value = "Profile updated successfully.";
  } catch (error) {
    console.error("Unable to save patient profile.", error);
    errorMessage.value = "Unable to save your profile. Please try again.";
  } finally {
    isSaving.value = false;
  }
}

onMounted(() => {
  unsubscribeAuth = auth.onAuthStateChanged((user) => {
    if (user) {
      loadProfile(user);
    } else {
      isLoading.value = false;
      errorMessage.value = "Please sign in to view your profile.";
    }
  });
});

onUnmounted(() => {
  unsubscribeAuth?.();
});
</script>

<style scoped>
.profile-page {
  max-width: 1000px;
}

.profile-header {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: space-between;
  margin-bottom: 24px;
}

.profile-header h1 {
  font-size: var(--font-size-page-title, 28px);
  margin-bottom: 6px;
}

.profile-header p:last-child {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
}

.eyebrow {
  color: var(--color-primary-dark);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  margin: 0 0 6px;
  text-transform: uppercase;
}

.edit-button {
  align-items: center;
  display: inline-flex;
  font-size: 13px;
  gap: 8px;
  min-height: 40px;
  padding: 9px 14px;
}

.profile-card {
  border-radius: var(--radius-card);
  padding: 24px;
}

.card-heading {
  margin-bottom: 24px;
}

.card-heading h2 {
  font-size: 19px;
  margin: 0;
}

.profile-grid,
.profile-form {
  display: grid;
  gap: 22px 32px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.profile-field {
  min-width: 0;
}

.profile-field dt,
.field label {
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
  margin-bottom: 6px;
}

.profile-field dt span {
  font-weight: 400;
}

.profile-field dd {
  color: var(--color-text);
  font-size: 15px;
  line-height: 1.5;
  margin: 0;
  overflow-wrap: anywhere;
  white-space: pre-line;
}

.field {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.field-wide {
  grid-column: 1 / -1;
}

.field input,
.field select,
.field textarea {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text);
  font: inherit;
  font-size: 14px;
  min-height: 44px;
  padding: 10px 12px;
  width: 100%;
}

.field input:focus-visible,
.field select:focus-visible,
.field textarea:focus-visible {
  border-color: var(--color-primary-dark);
}

.field textarea {
  line-height: 1.5;
  resize: vertical;
}

.field input:disabled {
  background: var(--color-background);
  color: var(--color-text-muted);
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  grid-column: 1 / -1;
  justify-content: flex-end;
}

.error-message {
  color: var(--color-danger);
  font-size: 13px;
  grid-column: 1 / -1;
  margin: 0;
}

.success-message {
  color: var(--color-success);
  font-size: 13px;
  grid-column: 1 / -1;
  margin: 0;
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

@media (max-width: 700px) {
  .profile-header {
    align-items: flex-start;
  }

  .profile-card {
    padding: 20px 16px;
  }

  .profile-grid,
  .profile-form {
    gap: 20px;
    grid-template-columns: 1fr;
  }

  .field-wide,
  .form-actions,
  .error-message,
  .success-message {
    grid-column: auto;
  }
}
</style>
