<template>
  <main class="page profile-page">
    <header class="profile-header">
      <div>
        <p class="eyebrow">Account</p>
        <h1><span class="profile-icon" aria-hidden="true">♙</span> My Profile</h1>
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
        <span class="section-number" aria-hidden="true">1</span>
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
  max-width: 1150px;
}

.profile-header {
  align-items: flex-end;
  display: flex;
  justify-content: space-between;
  margin-bottom: 36px;
}

.profile-header h1 {
  align-items: center;
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.profile-header p:last-child {
  color: var(--color-text-muted);
  font-size: 16px;
  margin: 0;
}

.eyebrow {
  color: var(--color-primary);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin: 0 0 8px;
  text-transform: uppercase;
}

.profile-icon {
  color: var(--color-primary);
  font-size: 30px;
}

.edit-button {
  align-items: center;
  display: inline-flex;
  gap: 10px;
  padding: 12px 20px;
}

.profile-card {
  border-radius: 16px;
  padding: 40px;
}

.card-heading {
  align-items: center;
  display: flex;
  gap: 16px;
  margin-bottom: 32px;
}

.card-heading h2 {
  font-size: 20px;
  margin: 0;
}

.section-number {
  align-items: center;
  background: var(--color-primary);
  border-radius: 50%;
  color: white;
  display: inline-flex;
  font-size: 17px;
  font-weight: 700;
  height: 42px;
  justify-content: center;
  width: 42px;
}

.profile-grid,
.profile-form {
  display: grid;
  gap: 26px 64px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.profile-field dt,
.field label {
  color: #94a3b8;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin-bottom: 10px;
  text-transform: uppercase;
}

.profile-field dt span {
  text-transform: none;
}

.profile-field dd {
  color: var(--color-text);
  font-size: 16px;
  margin: 0;
}

.field {
  display: flex;
  flex-direction: column;
}

.field-wide {
  grid-column: 1 / -1;
}

.field input,
.field select {
  border: 1px solid var(--color-border);
  border-radius: 7px;
  padding: 10px 12px;
}

.field input:focus,
.field select:focus {
  border-color: var(--color-primary);
  outline: 2px solid var(--color-primary-soft);
}

.form-actions {
  display: flex;
  gap: 10px;
  grid-column: 1 / -1;
  justify-content: flex-end;
}

.error-message {
  color: #b42318;
  grid-column: 1 / -1;
  margin: 0;
}

.success-message {
  color: var(--color-primary-dark);
  grid-column: 1 / -1;
  margin: 0;
}

button:disabled {
  cursor: wait;
  opacity: 0.65;
}

@media (max-width: 700px) {
  .profile-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 20px;
  }

  .profile-card {
    padding: 24px;
  }

  .profile-grid,
  .profile-form {
    gap: 22px;
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
