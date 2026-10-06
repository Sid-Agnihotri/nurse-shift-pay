// Core pay calculation for one shift.
//
// The approach: walk through the shift one minute at a time and tag each minute
// (evening? night? weekend? overtime? stat holiday?). Then count the minutes in each
// category and multiply by the rate. A 12-hour shift is only 720 minutes, so this is fast,
// and it is much easier to get right than working out where time windows overlap.
//
// Money is kept in whole cents and time in whole minutes. Each line is rounded to the
// cent once, at the end, so floating-point errors don't creep in.

import {
  CASUAL_IN_LIEU_RATE,
  EXTENDED_SHIFT_PREMIUM_THRESHOLD_MINUTES,
  IN_CHARGE_MINIMUM_MINUTES,
  MISSED_MEAL_RATE,
  OVERTIME,
  baseRateCents,
  isEvening,
  isNight,
  isSuperShift,
  isWeekend,
  ruleSetFor,
  statHolidayOn,
  type StatHoliday,
} from "./rules.ts";
import { crossesDaylightSavingChange, describeMinute, parseLocal, type MinuteInfo } from "./time.ts";
import type { NurseProfile, PayLine, ShiftInput, ShiftPayResult } from "./types.ts";

type TimeKind = "straight" | "overtime1.5" | "overtime2";

interface TaggedMinute extends MinuteInfo {
  kind: TimeKind;
  stat: StatHoliday | undefined;
}

export function calculateShiftPay(shift: ShiftInput, profile: NurseProfile): ShiftPayResult {
  const notes: string[] = [];
  const lines: PayLine[] = [];

  // ---- 1. Check the input -------------------------------------------------------------
  const start = parseLocal(shift.start);
  const end = parseLocal(shift.end);
  const elapsed = end - start;
  if (elapsed <= 0) throw new Error("The shift must end after it starts.");
  if (elapsed > 24 * 60) throw new Error("A shift can't be longer than 24 hours.");
  const workedMinutes = elapsed - shift.mealMinutes;
  if (workedMinutes <= 0) throw new Error("The meal break is longer than the shift.");

  // ---- 2. Pick the wage table and the nurse's hourly rate ----------------------------
  const rules = ruleSetFor(shift.start.slice(0, 10));
  if (!rules.confirmed) notes.push(`Rates are an estimate: ${rules.label}.`);
  const isRegular = profile.status !== "casual";
  // Year 15-30 Add Pay counts toward overtime, so it goes into the base rate (Appendix WW).
  const baseCents = baseRateCents(rules, profile);

  // ---- 3. List every worked minute ----------------------------------------------------
  // We don't know when the meal break was taken, so we assume it was in the middle of the shift.
  const mealStart = start + Math.floor(workedMinutes / 2);
  const mealEnd = mealStart + shift.mealMinutes;
  const worked: MinuteInfo[] = [];
  for (let minute = start; minute < end; minute++) {
    if (minute >= mealStart && minute < mealEnd) continue;
    worked.push(describeMinute(minute));
  }

  // ---- 4. Overtime: which minutes are straight time, 1.5x or 2x (Art 27.05, 26.07) ---
  const fullShiftMinutes = Math.round(profile.dailyFullShiftHours * 60);
  const allDoubleTime = shift.scheduledDayOff === true && profile.status === "regularFullTime";
  if (shift.scheduledDayOff && !allDoubleTime) {
    notes.push(
      "Double time for working a day off applies to regular full-time nurses. For part-time and casual " +
        "nurses an extra shift is straight time unless the consecutive-shift rules apply (not calculated yet).",
    );
  }
  const minutesPastFullShift = Math.max(0, workedMinutes - fullShiftMinutes);
  const overtimeApplies = minutesPastFullShift >= OVERTIME.minimumMinutes;
  if (minutesPastFullShift > 0 && !overtimeApplies) {
    notes.push("Less than 15 minutes past the end of the shift is paid at straight time (Art 26.07).");
  }

  function kindOf(index: number): TimeKind {
    if (allDoubleTime) return "overtime2";
    if (!overtimeApplies || index < fullShiftMinutes) return "straight";
    return index < fullShiftMinutes + OVERTIME.firstTierMinutes ? "overtime1.5" : "overtime2";
  }

  // ---- 5. Stat holidays (Art 39.03) ---------------------------------------------------
  // Main agreement: if half or more of the shift falls on a stat, the whole shift gets the stat rate.
  // Extended Work Day MOA: only the minutes actually on the stat get it.
  let wholeShiftStat: StatHoliday | undefined;
  if (!profile.extendedWorkDay) {
    const minutesPerStat = new Map<StatHoliday, number>();
    for (const m of worked) {
      const stat = statHolidayOn(m.date);
      if (stat) minutesPerStat.set(stat, (minutesPerStat.get(stat) ?? 0) + 1);
    }
    for (const [stat, minutesOnStat] of minutesPerStat) {
      const isHalfOrMore = minutesOnStat * 2 >= workedMinutes;
      // If a shift is split exactly 50/50 between two stats, use the higher rate.
      if (isHalfOrMore && (!wholeShiftStat || stat.rate > wholeShiftStat.rate)) wholeShiftStat = stat;
    }
  }

  const tagged: TaggedMinute[] = worked.map((m, index) => ({
    ...m,
    kind: kindOf(index),
    stat: profile.extendedWorkDay ? statHolidayOn(m.date) : wholeShiftStat,
  }));

  // ---- 6. Base pay lines --------------------------------------------------------------
  // Group minutes by their multiplier, so a shift with some overtime gives e.g.
  // "Straight time 7.5 h" + "Overtime 1.5x 2 h" + "Overtime 2x 0.5 h".
  const groups = new Map<string, { label: string; source: string; multiplier: number; minutes: number }>();
  for (const m of tagged) {
    const { label, source, multiplier } = describeBasePay(m);
    const group = groups.get(label) ?? { label, source, multiplier, minutes: 0 };
    group.minutes++;
    groups.set(label, group);
  }
  for (const g of groups.values()) {
    lines.push(makeLine("base", g.label, g.minutes, baseCents, g.multiplier, g.source));
  }

  const stats = new Set(tagged.filter((m) => m.stat).map((m) => m.stat!.name));
  if (stats.size > 0 && isRegular) {
    notes.push(`Working ${[...stats].join(" / ")} also earns you another day off with pay (Art 39.03).`);
  }

  // ---- 7. Meal break (Art 26.03) ------------------------------------------------------
  if (shift.meal === "paidAvailable" && shift.mealMinutes > 0) {
    lines.push(
      makeLine("meal", "Meal break, required to stay available", shift.mealMinutes, baseCents, 1, "Art 26.03(B)(1)"),
    );
  }
  if (shift.meal === "missed" && shift.mealMinutes > 0) {
    lines.push(
      makeLine("meal", "Missed meal break", shift.mealMinutes, baseCents, MISSED_MEAL_RATE, "Art 26.03(B)(2)"),
    );
  }

  // ---- 8. Premiums (flat dollars per hour, added on top) ------------------------------
  // Assumption: premiums are NOT multiplied by overtime or stat rates. The agreement doesn't say
  // they are. Check this against a real pay stub.
  const p = rules.premiums;
  const count = (test: (m: TaggedMinute) => boolean) => tagged.filter(test).length;
  const straightMinutes = count((m) => m.kind === "straight");

  // Evening / night (Art 28.01)
  const eveningMinutes = count(isEvening);
  const nightMinutes = count(isNight);
  if (profile.extendedWorkDay && workedMinutes > EXTENDED_SHIFT_PREMIUM_THRESHOLD_MINUTES) {
    // Long shifts under the Extended Work Day MOA: pay each premium only for the hours in its window.
    lines.push(makeLine("evening", "Evening premium", eveningMinutes, p.evening, 1, "Extended Work Day MOA, Art 28.01"));
    lines.push(makeLine("night", "Night premium", nightMinutes, p.night, 1, "Extended Work Day MOA, Art 28.01"));
  } else if (nightMinutes * 2 >= workedMinutes) {
    // Half or more of the shift at night: the night premium is paid on the whole shift.
    lines.push(makeLine("night", "Night premium (whole shift)", workedMinutes, p.night, 1, "Art 28.01"));
  } else if (eveningMinutes * 2 >= workedMinutes) {
    lines.push(makeLine("evening", "Evening premium (whole shift)", workedMinutes, p.evening, 1, "Art 28.01"));
  }

  lines.push(makeLine("weekend", "Weekend premium", count(isWeekend), p.weekend, 1, "Art 28.02"));
  lines.push(
    makeLine(
      "superShift",
      "Super shift premium",
      count((m) => isSuperShift(m, profile.nightShiftStarts2300)),
      p.superShift,
      1,
      "Art 28.03",
    ),
  );

  if (shift.shortNotice) {
    lines.push(makeLine("shortNotice", "Short notice premium", straightMinutes, p.shortNotice, 1, "Art 28.04"));
  }
  if (isRegular) {
    lines.push(makeLine("regular", "Regular premium (excludes overtime)", straightMinutes, p.regular, 1, "Art 28.05"));
  }
  if (isRegular && profile.specialtyArea) {
    lines.push(makeLine("specialty", "OR/PAR/ER/ICU/CCU premium", workedMinutes, p.specialty, 1, "Art 28.06"));
  }
  if (shift.preceptor) {
    lines.push(makeLine("preceptor", "Preceptor premium", workedMinutes, p.preceptor, 1, "Appendix GG"));
  }

  const inCharge = shift.inChargeMinutes ?? 0;
  if (inCharge >= IN_CHARGE_MINIMUM_MINUTES) {
    if (profile.level === 1 || profile.level === 3) {
      lines.push(makeLine("inCharge", "In-charge pay", inCharge, p.inCharge, 1, "Art 30"));
    } else {
      notes.push("In-charge pay in Art 30 is for Level 3 nurses (and Level 1 in some cases). Not added.");
    }
  }

  // ---- 9. Casual pay in lieu of vacation and stats (Art 11.04(G)(2)) ----------------
  if (profile.status === "casual") {
    lines.push(
      makeLine("casualInLieu", "13% in lieu of vacation and stats", straightMinutes, baseCents, CASUAL_IN_LIEU_RATE, "Art 11.04(G)(2)"),
    );
  }

  // ---- 10. Warnings ------------------------------------------------------------------
  if (crossesDaylightSavingChange(start, end)) {
    notes.push(
      "This shift crosses a daylight saving time change. You're paid for the hours actually worked, " +
        "at straight time (Art 26.06), but this calculator uses clock times, so it may be off by an hour.",
    );
  }

  const paidLines = lines.filter((line) => line.minutes > 0);
  return {
    lines: paidLines,
    totalCents: paidLines.reduce((sum, line) => sum + line.amountCents, 0),
    workedMinutes,
    ruleSet: rules.label,
    notes,
  };
}

/** Label, multiplier and source for one worked minute's base pay. */
function describeBasePay(m: TaggedMinute): { label: string; source: string; multiplier: number } {
  if (m.stat) {
    if (m.kind === "straight") {
      return { label: `${m.stat.name} ${m.stat.rate}×`, source: "Art 39.03", multiplier: m.stat.rate };
    }
    const multiplier = OVERTIME.statFactor * m.stat.rate;
    return { label: `Overtime on ${m.stat.name} ${multiplier}×`, source: "Art 27.05(C)", multiplier };
  }
  if (m.kind === "overtime1.5") return { label: "Overtime 1.5×", source: "Art 27.05(A)", multiplier: OVERTIME.firstTierRate };
  if (m.kind === "overtime2") return { label: "Overtime 2×", source: "Art 27.05(B)", multiplier: OVERTIME.secondTierRate };
  return { label: "Straight time", source: "Art 63 wage grid", multiplier: 1 };
}

/**
 * amount = minutes / 60 x hourly rate x multiplier, rounded to the cent.
 * The multiplier is turned into a whole number of hundredths first (1.5 -> 150), so the maths
 * is whole numbers until a single division at the end. That keeps the rounding correct.
 */
function makeLine(code: string, label: string, minutes: number, rateCents: number, multiplier: number, source: string): PayLine {
  const multiplierHundredths = Math.round(multiplier * 100);
  const amountCents = Math.round((minutes * rateCents * multiplierHundredths) / 6000);
  return { code, label, minutes, rateCents, multiplier, amountCents, source };
}

/** 62371 -> "$623.71" */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
