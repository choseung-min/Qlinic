<template>
  <div id="nav">
    <router-link class="brand" to="/">Qlinic</router-link>

    <nav
      v-if="user && role === 'patient'"
      class="patient-nav"
      aria-label="Patient navigation"
    >
      <router-link to="/">Dashboard</router-link>
      <router-link to="/appointment-booking">Book Appointment</router-link>
      <router-link to="/history">History</router-link>
      <router-link to="/personal-details">Profile</router-link>
    </nav>

    <nav class="account-nav" aria-label="Account navigation">
      <router-link v-if="!user" to="/login">Login</router-link>

      <router-link v-if="user && role === 'staff'" to="/staff"
        >Staff Main</router-link
      >

      <button
        v-if="user"
        class="contact-button"
        type="button"
        @click="showContact = true"
      >
        Contact Us
      </button>

      <button v-if="user" type="button" @click="handleLogout">Log out</button>
    </nav>
  </div>

  <div
    v-if="showContact"
    class="contact-backdrop"
    @click.self="showContact = false"
  >
    <section
      class="contact-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-title"
    >
      <button
        class="close-button"
        type="button"
        aria-label="Close contact details"
        @click="showContact = false"
      >
        X
      </button>
      <h2 id="contact-title">Contact Us</h2>
      <p>Call the clinic at <strong>+65 6123 4567</strong>.</p>
    </section>
  </div>
  <RouterView />
</template>

<script setup>
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { auth, db } from "@/services/firebase";
import { signOutUser } from "@/services/auth";

const router = useRouter();
const user = ref(null);
const role = ref(null);
const showContact = ref(false);
let unsubscribeAuth;

onMounted(() => {
  unsubscribeAuth = auth.onAuthStateChanged(async (firebaseUser) => {
    user.value = firebaseUser;
    role.value = null;

    if (firebaseUser) {
      const userSnapshot = await db
        .collection("users")
        .doc(firebaseUser.uid)
        .get();

      if (user.value?.uid === firebaseUser.uid) {
        role.value = userSnapshot.data()?.role || null;
      }
    }
  });
});

onUnmounted(() => {
  unsubscribeAuth?.();
});

async function handleLogout() {
  try {
    await signOutUser();
    await router.push({ name: "Login" });
  } catch (error) {
    console.error("Unable to log out.", error);
  }
}
</script>

<style scoped>
#nav {
  justify-content: space-between;
}

.brand {
  color: var(--color-primary-dark) !important;
  font-size: 18px !important;
  font-weight: 800 !important;
  padding-left: 0 !important;
}

.patient-nav,
.account-nav {
  align-items: center;
  display: flex;
  gap: 4px;
}

.account-nav {
  margin-left: auto;
}

.contact-button {
  background: transparent;
  color: var(--color-text-muted);
  padding: 9px 13px;
}

.contact-button:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary-dark);
}

.contact-backdrop {
  align-items: flex-start;
  background: rgb(31 41 55 / 25%);
  display: flex;
  inset: 0;
  justify-content: center;
  padding-top: 96px;
  position: fixed;
  z-index: 10;
}

.contact-dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  box-shadow: 0 12px 32px rgb(31 41 55 / 18%);
  max-width: 360px;
  padding: 24px;
  position: relative;
  width: calc(100% - 32px);
}

.contact-dialog h2 {
  font-size: 20px;
  margin: 0 0 8px;
}

.contact-dialog p {
  color: var(--color-text-muted);
  margin: 0;
}

.close-button {
  background: transparent;
  color: var(--color-text-muted);
  padding: 4px 8px;
  position: absolute;
  right: 12px;
  top: 12px;
}

.close-button:hover {
  background: var(--color-background);
  color: var(--color-text);
}

@media (max-width: 760px) {
  #nav {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .patient-nav {
    order: 3;
    width: 100%;
  }
}
</style>
