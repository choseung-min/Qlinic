// days before appt that reminder is triggered
const REMINDER_DAYS = [7, 3, 1];

export function daysUntil(dateString) {
  const target = new Date(`${dateString}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today) / (1000 * 60 * 60 * 24));
}

// true if the appointment is booked and the reminder should be shown
export function shouldShowReminder(appt) {
  if (appt.status !== "booked") return false;
  return REMINDER_DAYS.includes(daysUntil(appt.appointmentDate));
}

// true if the patient is next in line 
export function isTurnComingUp(patientsAhead) {
  return typeof patientsAhead === "number" && patientsAhead <= 1;
}

export function buildReminderText(appt, doctorName = "your doctor") {
  const days = daysUntil(appt.appointmentDate);
  const when = days === 1 ? "tomorrow" : `in ${days} days`;
  return `Reminder: you have an appointment with ${doctorName} ${when} (${appt.appointmentDate} at ${appt.appointmentTime}) at Qlinic Clinic.`;
}