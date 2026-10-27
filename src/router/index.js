import { createRouter, createWebHistory } from "vue-router";
import AppointmentBooking from "@/views/patient/AppointmentBooking.vue";
import AppointmentDetails from "@/views/patient/AppointmentDetails.vue";
import History from "@/views/patient/History.vue";
import Main from "@/views/patient/Main.vue";
import PersonalDetails from "@/views/patient/PersonalDetails.vue";
import Login from "@/views/auth/Login.vue";
import StaffMain from "@/views/staff/Main.vue";
import DoctorMain from "@/views/doctor/Main.vue";
import { auth, db } from "@/services/firebase";

const routes = [
  {
    path: "/",
    name: "Main",
    component: Main,
    meta: { requiresAuth: true, role: "patient" },
  },
  {
    path: "/login",
    name: "Login",
    component: Login,
  },
  {
    path: "/staff",
    name: "StaffMain",
    component: StaffMain,
    meta: { requiresAuth: true, role: "staff" },
  },
  {
    path: "/doctor",
    name: "DoctorMain",
    component: DoctorMain,
    meta: { requiresAuth: true, role: "doctor" },
  },
  {
    path: "/appointment-booking",
    name: "AppointmentBooking",
    component: AppointmentBooking,
    meta: { requiresAuth: true, role: "patient" },
  },
  {
    path: "/history",
    name: "History",
    component: History,
    meta: { requiresAuth: true, role: "patient" },
  },
  {
    path: "/appointment-details",
    name: "AppointmentDetails",
    component: AppointmentDetails,
    meta: { requiresAuth: true, role: "patient" },
  },
  {
    path: "/personal-details",
    name: "PersonalDetails",
    component: PersonalDetails,
    meta: { requiresAuth: true, role: "patient" },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

function getAuthenticatedUser() {
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }

  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

// Navigation guard to check authentication and role
router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) {
    return true;
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    return { name: "Login" };
  }

  const userSnapshot = await db.collection("users").doc(user.uid).get();
  const role = userSnapshot.data()?.role;

  if (role !== to.meta.role) {
    if (role === "staff") {
      return { name: "StaffMain" };
    }

    if (role === "doctor") {
      return { name: "DoctorMain" };
    }

    if (role === "patient") {
      return { name: "Main" };
    }

    return { name: "Login" };
  }

  return true;
});

export default router;
