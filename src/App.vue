<template>
  <div v-if="role !== 'doctor'" id="nav">
    <router-link class="brand" to="/">
      <span class="brand-mark" aria-hidden="true">✚</span>
      Qlinic
    </router-link>

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
      <router-link v-if="user && role === 'staff'" to="/staff/patient-overview"
        >Patient Overview</router-link
      >
      <router-link v-if="user && role === 'staff'" to="/staff/medicine-collection"
        >Medicine Collection</router-link
      >

      <router-link v-if="user && role === 'doctor'" to="/doctor"
        >Doctor Main</router-link
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
      <div class="contact-detail">
        <span aria-hidden="true">⌕</span>
        <p><strong>Phone</strong><br />+65 6123 4567</p>
      </div>
      <div class="contact-detail">
        <span aria-hidden="true">⌖</span>
        <p><strong>Address</strong><br />123 Wellness Ave, Suite 200</p>
      </div>
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
  gap: 12px 20px;
  justify-content: space-between;
}

/* keep the brand separate from navigation link styling */
#nav .brand {
  align-items: center;
  color: var(--color-primary-dark);
  display: inline-flex;
  font-size: 18px;
  font-weight: 800;
  gap: 8px;
  padding: 4px 0;
  text-decoration: none;
  white-space: nowrap;
}

#nav .brand:hover,
#nav .brand.router-link-exact-active {
  background: transparent;
  color: var(--color-primary-dark);
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

.patient-nav,
.account-nav {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.account-nav {
  justify-content: flex-end;
  margin-left: auto;
}

.contact-button {
  background: transparent;
  color: var(--color-text-muted);
  font-size: 13px;
  padding: 9px 13px;
}

.contact-button:hover {
  background: var(--color-primary-soft);
  color: var(--color-primary-dark);
}

.contact-backdrop {
  align-items: flex-start;
  background: rgb(31 41 55 / 35%);
  display: flex;
  inset: 0;
  justify-content: center;
  overflow-y: auto;
  padding: clamp(24px, 10vh, 96px) 16px 24px;
  position: fixed;
  z-index: 10;
}

.contact-dialog {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-dialog, 12px);
  box-shadow: var(--shadow-overlay, 0 16px 40px rgb(31 41 55 / 14%));
  max-height: calc(100dvh - 48px);
  max-width: 360px;
  overflow-y: auto;
  padding: 24px;
  position: relative;
  width: 100%;
}

.contact-dialog h2 {
  font-size: 20px;
  margin: 0 0 8px;
}

.contact-dialog p {
  color: var(--color-text-muted);
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}

.contact-detail {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.contact-detail > span {
  color: var(--color-primary-dark);
  font-size: 20px;
  line-height: 1;
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

@media (max-width: 900px) {
  #nav {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .patient-nav,
  .account-nav {
    justify-content: flex-start;
    width: 100%;
  }

  .account-nav {
    margin-left: 0;
  }
}

@media (max-width: 760px) {
  .patient-nav {
    order: 3;
  }
}
</style>
