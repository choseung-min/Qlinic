export const CLINIC_TIME_ZONE = "Asia/Singapore";

// Local testing only: never use a simulated time in production builds.
const configuredTestTime = import.meta.env?.DEV
  ? import.meta.env.VITE_DEV_CLINIC_TIME || ""
  : "";
export const CLINIC_TEST_TIME = /^([01]\d|2[0-3]):[0-5]\d$/.test(configuredTestTime)
  ? configuredTestTime
  : "";

// Provisional daily hours, based on the existing 09:00–16:30 booking slots.
// Confirm the clinic's actual operating days and hours before deployment.
export const CLINIC_HOURS = {
  opensAt: "09:00",
  closesAt: "17:00",
  openDays: [0, 1, 2, 3, 4, 5, 6],
};

export const CLINIC_CLOSED_MESSAGE =
  "The clinic is closed. You can join the walk-in queue daily from 9:00 am to 5:00 pm (Singapore time).";

const clinicDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: CLINIC_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function getClinicDateTime(now) {
  const parts = Object.fromEntries(
    clinicDateTimeFormatter.formatToParts(now).map(({ type, value }) => [type, value]),
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

export function getClinicDate(now = new Date()) {
  return getClinicDateTime(now).date;
}

export function isClinicOpen(now = new Date(), hours = CLINIC_HOURS) {
  const { date, time: actualTime } = getClinicDateTime(now);
  const time = CLINIC_TEST_TIME || actualTime;
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return (
    hours.openDays.includes(weekday) &&
    time >= hours.opensAt &&
    time < hours.closesAt
  );
}
