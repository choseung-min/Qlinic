export const QUEUED_VISIT_STATUSES = new Set(["Waiting", "Called", "Late", "Absent"]);
export const IN_PROGRESS_VISIT_STATUSES = new Set([
  ...QUEUED_VISIT_STATUSES,
  "In Consultation",
  "Awaiting Medicine",
  "Awaiting Medicine Collection",
  "Ready for Collection",
]);

export const WALK_IN_MESSAGES = {
  "appointment-today": "You have a booked appointment today. Please check in with reception instead of joining the walk-in queue.",
  "already-in-queue": "You already have a visit in progress today. Please continue with that visit.",
  "walk-in-already-used": "You have already had a walk-in visit today. Please speak to reception if you need another visit.",
  "visit-completed-today": "Need another consultation? Book an appointment or contact reception.",
  "cannot-leave-queue": "You can no longer leave this queue yourself. Please speak to reception.",
};

export function isWalkInVisit(visit) {
  return visit.visitType === "walk-in" || String(visit.id || "").startsWith("walkin_");
}

export function findRelevantVisit(visits) {
  return visits.find((visit) => IN_PROGRESS_VISIT_STATUSES.has(visit.visitStatus))
    || visits.find((visit) => visit.visitStatus === "Completed")
    || visits.find(isWalkInVisit)
    || null;
}

export function getVisitBlockCode(visit) {
  if (visit.visitStatus === "Completed") return "visit-completed-today";
  return IN_PROGRESS_VISIT_STATUSES.has(visit.visitStatus)
    ? "already-in-queue" : "walk-in-already-used";
}

export function getPatientQueueErrorMessage(error, action = "join") {
  if (WALK_IN_MESSAGES[error.code]) return WALK_IN_MESSAGES[error.code];
  if (error.code === "unauthenticated") return "Please sign in to manage your queue.";
  if (action === "read") {
    return "We couldn't verify your queue or appointment status. Please refresh the page. If this continues, contact clinic staff for help.";
  }
  if (action === "leave") {
    return "We couldn't remove you from the queue. Please refresh the page or contact clinic staff for help.";
  }
  return "We couldn't add you to the walk-in queue. Please refresh the page or contact clinic staff for help.";
}

export function canPatientLeaveVisit(visit, patientId) {
  return Boolean(
    visit && visit.patientId === patientId &&
    visit.id?.startsWith(`walkin_${patientId}_`) &&
    ["Waiting", "Late"].includes(visit.visitStatus),
  );
}

export function hasBookedAppointmentToday(appointments, date) {
  return appointments.some((appointment) =>
    appointment.appointmentDate === date && appointment.status === "booked",
  );
}
