import assert from "node:assert/strict";
import test from "node:test";
import { getClinicDate, isClinicOpen } from "./clinicHours.js";

test("walk-in entry opens at 09:00 and closes at 17:00 Singapore time", () => {
  for (const [time, expected] of [
    ["2026-11-10T08:59:59+08:00", false],
    ["2026-11-10T09:00:00+08:00", true],
    ["2026-11-10T12:00:00+08:00", true],
    ["2026-11-10T16:59:59+08:00", true],
    ["2026-11-10T17:00:00+08:00", false],
    ["2026-11-10T23:59:59+08:00", false],
    ["2026-11-11T00:00:00+08:00", false],
  ]) {
    assert.equal(isClinicOpen(new Date(time)), expected, time);
  }
});

test("clinic time and queue date use Singapore time across UTC day boundaries", () => {
  assert.equal(isClinicOpen(new Date("2026-11-10T01:00:00Z")), true);
  assert.equal(isClinicOpen(new Date("2026-11-10T09:00:00Z")), false);
  assert.equal(getClinicDate(new Date("2026-11-10T16:00:00Z")), "2026-11-11");
});

test("operating days follow the Singapore weekday", () => {
  const weekdaysOnly = {
    opensAt: "09:00",
    closesAt: "17:00",
    openDays: [1, 2, 3, 4, 5],
  };
  assert.equal(isClinicOpen(new Date("2026-11-13T09:00:00+08:00"), weekdaysOnly), true);
  assert.equal(isClinicOpen(new Date("2026-11-14T09:00:00+08:00"), weekdaysOnly), false);
  assert.equal(isClinicOpen(new Date("2026-11-15T09:00:00+08:00"), weekdaysOnly), false);
});
