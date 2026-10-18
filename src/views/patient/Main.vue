<template>
  <div class="main">
    <PatientReminders />
    <h1>Welcome to Qlinic</h1>
    <p>
      This is a web application that allows patients to book appointments with
      doctors and view their medical records.
    </p>
  </div>
</template>

import PatientReminders from "@/components/patient/PatientReminders.vue";

<script>
import PatientReminders from "@/components/patient/PatientReminders.vue";
export default {
  name: "Main",
  components: {
    PatientReminders
  },
  data() {
    return {};
  },
  methods: {},
};
</script>
