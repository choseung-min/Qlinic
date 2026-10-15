<template>
  <div id="nav">
    <router-link v-if="!user" to="/login">Login</router-link>

    <template v-if="user && role === 'patient'">
      <router-link to="/">Main</router-link> |
      <router-link to="/appointment-booking">Appointment Booking</router-link> |
      <router-link to="/appointment-details">Appointment Details</router-link> |
      <router-link to="/history">History</router-link> |
      <router-link to="/personal-details">Personal Details</router-link>
    </template>

    <router-link v-if="user && role === 'staff'" to="/staff">
      Staff Main
    </router-link>

    <button v-if="user" type="button" @click="handleLogout">
      Log out
    </button>
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
