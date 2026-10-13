import { createRouter, createWebHistory } from "vue-router";
import AppointmentBooking from "@/views/patient/AppointmentBooking.vue";
import AppointmentDetails from "@/views/patient/AppointmentDetails.vue";
import History from "@/views/patient/History.vue";
import Main from "@/views/patient/Main.vue";
import PersonalDetails from "@/views/patient/PersonalDetails.vue";

const routes = [
  {
    path: "/",
    name: "Main",
    component: Main,
  },
  {
    path: "/appointment-booking",
    name: "AppointmentBooking",
    component: AppointmentBooking,
  },
  {
    path: "/history",
    name: "History",
    component: History,
  },
  {
    path: "/appointment-details",
    name: "AppointmentDetails",
    component: AppointmentDetails,
  },
  {
    path: "/personal-details",
    name: "PersonalDetails",
    component: PersonalDetails,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
