// Run with:  npm test
// (Node 22.18+ runs TypeScript files directly. On older Node 22, add --experimental-strip-types.)
//
// Every expected number below was worked out by hand from the agreement. The comment above
// each one shows the maths, so if a test fails you can tell whether the code or the
// expectation is wrong.
//
// Most tests use dates between April 2023 and March 2024, because those rates are confirmed.

import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateShiftPay } from "../src/pay/calculateShiftPay.ts";
import { statHolidaysForYear } from "../src/pay/rules.ts";
import type { NurseProfile, ShiftInput } from "../src/pay/types.ts";

/** Level 3 RN, step 5 ($46.43/h), regular full-time, 7.5 h shifts. */
const rn: NurseProfile = {
  level: 3,
  step: 5,
  status: "regularFullTime",
  addPayTier: 0,
  dailyFullShiftHours: 7.5,
  extendedWorkDay: false,
  specialtyArea: false,
};

const dayShift = (date: string, extra: Partial<ShiftInput> = {}): ShiftInput => ({
  start: `${date}T07:30`,
  end: `${date}T15:30`,
  mealMinutes: 30,
  meal: "unpaid",
  ...extra,
});

/** Look up a line's amount by its code (and label, when a code appears more than once). */
function amount(result: ReturnType<typeof calculateShiftPay>, code: string, label?: string): number | undefined {
  return result.lines.find((l) => l.code === code && (label === undefined || l.label === label))?.amountCents;
}

test("weekday day shift: base pay + regular premium", () => {
  const r = calculateShiftPay(dayShift("2023-10-17"), rn); // Tuesday
  // 7.5 h x $46.43 = $348.225 -> $348.23
  assert.equal(amount(r, "base"), 34823);
  // 7.5 h x $2.15 = $16.125 -> $16.13
  assert.equal(amount(r, "regular"), 1613);
  assert.equal(r.totalCents, 36436);
  assert.equal(r.workedMinutes, 450);
});

test("evening shift: half or more in the evening window -> evening premium on the whole shift", () => {
  const r = calculateShiftPay(dayShift("2023-10-18", { start: "2023-10-18T15:30", end: "2023-10-18T23:30" }), rn);
  // 7.5 h x $1.40 = $10.50
  assert.equal(amount(r, "evening"), 1050);
  assert.equal(r.totalCents, 34823 + 1050 + 1613);
});

test("12-hour Saturday night under the Extended Work Day MOA", () => {
  const profile: NurseProfile = { ...rn, extendedWorkDay: true, dailyFullShiftHours: 11 };
  const r = calculateShiftPay(
    { start: "2023-10-14T19:00", end: "2023-10-15T07:00", mealMinutes: 60, meal: "unpaid" },
    profile,
  );
  // Meal assumed mid-shift: 00:30-01:30. Worked 19:00-00:30 and 01:30-07:00 = 11 h.
  // Base: 11 h x $46.43 = $510.73
  assert.equal(amount(r, "base"), 51073);
  // Evening 19:00-23:30 = 4.5 h x $1.40 = $6.30 (hour by hour, because it's an extended shift)
  assert.equal(amount(r, "evening"), 630);
  // Night 23:30-00:30 + 01:30-07:00 = 6.5 h x $5.00 = $32.50
  assert.equal(amount(r, "night"), 3250);
  // Weekend: every worked hour is between Fri 23:00 and Sun 23:00 -> 11 h x $3.50 = $38.50
  assert.equal(amount(r, "weekend"), 3850);
  // Super shift 23:30 Sat - 07:30 Sun -> 6.5 h x $1.85 = $12.025 -> $12.03
  assert.equal(amount(r, "superShift"), 1203);
  // Regular premium: 11 h x $2.15 = $23.65
  assert.equal(amount(r, "regular"), 2365);
  assert.equal(r.totalCents, 62371);
});

test("overtime: first 2 hours past the full shift at 1.5x, the rest at 2x", () => {
  const r = calculateShiftPay(dayShift("2023-10-19", { end: "2023-10-19T19:30" }), rn);
  // Worked 11.5 h: 7.5 straight + 2 at 1.5x + 2 at 2x
  assert.equal(amount(r, "base", "Straight time"), 34823);
  // 2 h x $46.43 x 1.5 = $139.29
  assert.equal(amount(r, "base", "Overtime 1.5×"), 13929);
  // 2 h x $46.43 x 2 = $185.72
  assert.equal(amount(r, "base", "Overtime 2×"), 18572);
  // Only 4 of 11.5 hours are in the evening window, so no evening premium
  assert.equal(amount(r, "evening"), undefined);
  // Regular premium only on the 7.5 straight-time hours
  assert.equal(amount(r, "regular"), 1613);
  assert.equal(r.totalCents, 68937);
});

test("less than 15 minutes over is straight time", () => {
  const r = calculateShiftPay(dayShift("2023-10-17", { end: "2023-10-17T15:40" }), rn);
  assert.equal(r.lines.filter((l) => l.label.startsWith("Overtime")).length, 0);
  assert.equal(r.lines.find((l) => l.label === "Straight time")?.minutes, 460);
  assert.ok(r.notes.some((n) => n.includes("15 minutes")));
});

test("exactly 15 minutes over is overtime", () => {
  const r = calculateShiftPay(dayShift("2023-10-17", { end: "2023-10-17T15:45" }), rn);
  assert.equal(r.lines.find((l) => l.label === "Overtime 1.5×")?.minutes, 15);
});

test("Christmas Day is a super stat: 2.5x", () => {
  const r = calculateShiftPay(dayShift("2023-12-25"), rn);
  // 7.5 h x $46.43 x 2.5 = $870.5625 -> $870.56
  assert.equal(amount(r, "base"), 87056);
  assert.equal(r.totalCents, 87056 + 1613);
  assert.ok(r.notes.some((n) => n.includes("another day off")));
});

test("night shift starting late Christmas Day: most of it is on Boxing Day -> whole shift at 2x", () => {
  const r = calculateShiftPay(
    { start: "2023-12-25T23:30", end: "2023-12-26T07:30", mealMinutes: 30, meal: "unpaid" },
    rn,
  );
  // 30 min on Christmas, 7 h on Boxing Day: Boxing Day rate (2x) for the whole shift
  // 7.5 h x $46.43 x 2 = $696.45
  assert.equal(amount(r, "base", "Boxing Day 2×"), 69645);
  // Night premium on the whole shift: 7.5 h x $5.00 = $37.50
  assert.equal(amount(r, "night"), 3750);
  assert.equal(r.totalCents, 69645 + 3750 + 1613);
});

test("Extended Work Day MOA: only the hours on the stat get the stat rate", () => {
  const profile: NurseProfile = { ...rn, extendedWorkDay: true, dailyFullShiftHours: 11 };
  const r = calculateShiftPay(
    { start: "2023-12-24T19:00", end: "2023-12-25T07:00", mealMinutes: 60, meal: "unpaid" },
    profile,
  );
  // Dec 24: 19:00-24:00 = 5 h straight. Dec 25: 00:00-00:30 + 01:30-07:00 = 6 h at 2.5x.
  assert.equal(r.lines.find((l) => l.label === "Straight time")?.minutes, 300);
  assert.equal(r.lines.find((l) => l.label === "Christmas Day 2.5×")?.minutes, 360);
});

test("full-time nurse working a scheduled day off: all hours double time, no regular premium", () => {
  const r = calculateShiftPay(dayShift("2023-10-17", { scheduledDayOff: true }), rn);
  // 7.5 h x $46.43 x 2 = $696.45
  assert.equal(amount(r, "base", "Overtime 2×"), 69645);
  assert.equal(amount(r, "regular"), undefined);
  assert.equal(r.totalCents, 69645);
});

test("casual nurse: no regular premium, plus 13% in lieu", () => {
  const r = calculateShiftPay(dayShift("2023-10-17"), { ...rn, status: "casual" });
  assert.equal(amount(r, "regular"), undefined);
  // 7.5 h x $46.43 x 13% = $45.269 -> $45.27
  assert.equal(amount(r, "casualInLieu"), 4527);
  assert.equal(r.totalCents, 34823 + 4527);
});

test("missed meal break: 30 min at 1.5x", () => {
  const r = calculateShiftPay(dayShift("2023-10-17", { meal: "missed" }), rn);
  // 0.5 h x $46.43 x 1.5 = $34.8225 -> $34.82
  assert.equal(amount(r, "meal"), 3482);
});

test("Year 15-30 add pay goes into the base rate", () => {
  const r = calculateShiftPay(dayShift("2023-10-17"), { ...rn, addPayTier: 20 });
  // $46.43 + $1.25 = $47.68/h
  assert.equal(r.lines.find((l) => l.code === "base")?.rateCents, 4768);
});

test("shifts after April 1, 2024 use the estimated rates and say so", () => {
  const r = calculateShiftPay(dayShift("2024-10-15"), rn);
  // $46.43 x 1.03 = $47.8229 -> $47.82
  assert.equal(r.lines.find((l) => l.code === "base")?.rateCents, 4782);
  assert.ok(r.notes.some((n) => n.includes("estimate")));
});

test("stat holiday dates for 2024", () => {
  const dates = Object.fromEntries(statHolidaysForYear(2024).map((s) => [s.name, s.date]));
  assert.equal(dates["BC Family Day"], "2024-02-19");
  assert.equal(dates["Good Friday"], "2024-03-29");
  assert.equal(dates["Easter Monday"], "2024-04-01");
  assert.equal(dates["Victoria Day"], "2024-05-20");
  assert.equal(dates["BC Day"], "2024-08-05");
  assert.equal(dates["Labour Day"], "2024-09-02");
  assert.equal(dates["Thanksgiving Day"], "2024-10-14");
});

test("bad input is rejected", () => {
  assert.throws(() => calculateShiftPay(dayShift("2023-10-17", { end: "2023-10-17T07:00" }), rn));
  assert.throws(() => calculateShiftPay(dayShift("2022-10-17"), rn), /No wage table/);
  assert.throws(() => calculateShiftPay(dayShift("2023-10-17", { start: "10/17/2023 7:30" }), rn));
});
