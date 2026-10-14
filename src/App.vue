<template>
  <div id="nav">
    <router-link to="/login">Login</router-link> |
    <router-link to="/">Main</router-link> |
    <router-link to="/staff">Staff Main</router-link> |
    <router-link to="/appointment-booking">Appointment Booking</router-link> |
    <router-link to="/appointment-details">Appointment Details</router-link> |
    <router-link to="/history">History</router-link> |
    <router-link to="/personal-details">Personal Details</router-link> |
  </div>
  <RouterView />
</template>

<script>
import router from "./router";

export default {
  name: "App",
};
</script>
