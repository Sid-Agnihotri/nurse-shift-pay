// Glue between the screens and the pay calculator: safe calculation, totals, labels, money format.

import { calculateShiftPay } from "../pay/calculateShiftPay.ts";
import type { NurseProfile, PayLine, ShiftInput, ShiftPayResult } from "../pay/types.ts";
import { addDays, daysBetween } from "./dates.ts";

export type PayOutcome = { ok: true; result: ShiftPayResult } | { ok: false; error: string };

/** Like calculateShiftPay, but returns an error message instead of throwing, so one bad shift can't break a screen. */
export function tryCalculate(shift: ShiftInput, profile: NurseProfile): PayOutcome {
  try {
    return { ok: true, result: calculateShiftPay(shift, profile) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-CA", { style: "currency", currency: "CAD" });
}

/** "$46.43 × 1.5" or "$5.00" */
export function formatRate(rateCents: number, multiplier: number): string {
  const rate = formatMoney(rateCents);
  return multiplier === 1 ? rate : `${rate} × ${multiplier}`;
}

// ---- Shift type: the D / E / N letters used on unit schedules --------------------------

export type ShiftKind = "D" | "E" | "N";

export const SHIFT_KIND_NAMES: Record<ShiftKind, string> = { D: "Day", E: "Evening", N: "Night" };

/** Day, evening or night, from the start time: the way a unit schedule labels shifts. */
export function shiftKind(shift: ShiftInput): ShiftKind {
  const hour = Number(shift.start.slice(11, 13));
  if (hour >= 5 && hour < 14) return "D";
  if (hour >= 14 && hour < 18) return "E";
  return "N";
}

/** Extra labels for a shift row: weekend, stat holiday, overtime. */
export function tagsFor(result: ShiftPayResult): { label: string; tone: "weekend" | "stat" | "overtime" }[] {
  const tags: { label: string; tone: "weekend" | "stat" | "overtime" }[] = [];
  if (result.lines.some((l) => l.code === "weekend")) tags.push({ label: "Weekend", tone: "weekend" });
  for (const line of result.lines) {
    if (line.code === "base" && line.source.startsWith("Art 39.03")) {
      tags.push({ label: line.label.replace(/ [\d.]+×$/, ""), tone: "stat" });
    }
  }
  if (result.lines.some((l) => l.code === "base" && l.label.startsWith("Overtime"))) {
    tags.push({ label: "Overtime", tone: "overtime" });
  }
  return tags;
}

// ---- Totals across many shifts ---------------------------------------------------------

/** How pay lines are grouped in summaries, in display order. */
const CATEGORIES = [
  "Base pay",
  "Overtime",
  "Stat holiday pay",
  "Evening and night premiums",
  "Weekend premiums",
  "Regular premium",
  "Other premiums",
  "Meal breaks",
  "13% in lieu (casual)",
] as const;

export type Category = (typeof CATEGORIES)[number];

function categoryOf(line: PayLine): Category {
  switch (line.code) {
    case "base":
      if (line.label.startsWith("Overtime")) return "Overtime";
      if (line.source.startsWith("Art 39.03")) return "Stat holiday pay";
      return "Base pay";
    case "evening":
    case "night":
      return "Evening and night premiums";
    case "weekend":
    case "superShift":
      return "Weekend premiums";
    case "regular":
      return "Regular premium";
    case "meal":
      return "Meal breaks";
    case "casualInLieu":
      return "13% in lieu (casual)";
    default:
      return "Other premiums";
  }
}

export interface Totals {
  cents: number;
  minutes: number;
  shifts: number;
  /** Shifts the calculator couldn't price (bad times etc.). */
  errors: number;
  byCategory: { category: Category; cents: number }[];
}

export function totalsFor(shifts: ShiftInput[], profile: NurseProfile): Totals {
  const sums = new Map<Category, number>();
  let cents = 0;
  let minutes = 0;
  let errors = 0;
  for (const shift of shifts) {
    const outcome = tryCalculate(shift, profile);
    if (!outcome.ok) {
      errors++;
      continue;
    }
    cents += outcome.result.totalCents;
    minutes += outcome.result.workedMinutes;
    for (const line of outcome.result.lines) {
      const category = categoryOf(line);
      sums.set(category, (sums.get(category) ?? 0) + line.amountCents);
    }
  }
  const byCategory = CATEGORIES.filter((c) => sums.has(c)).map((category) => ({ category, cents: sums.get(category)! }));
  return { cents, minutes, shifts: shifts.length, errors, byCategory };
}

// ---- Pay periods -----------------------------------------------------------------------

export interface PayPeriod {
  /** First day, "YYYY-MM-DD" */
  start: string;
  /** Last day (inclusive), "YYYY-MM-DD" */
  end: string;
}

/** The 14-day pay period that contains `date`, given any one period start date. */
export function payPeriodFor(date: string, anyPeriodStart: string): PayPeriod {
  const offset = Math.floor(daysBetween(anyPeriodStart, date.slice(0, 10)) / 14) * 14;
  const start = addDays(anyPeriodStart, offset);
  return { start, end: addDays(start, 13) };
}

export function shiftsInPeriod<T extends ShiftInput>(shifts: T[], period: PayPeriod): T[] {
  return shifts.filter((s) => s.start.slice(0, 10) >= period.start && s.start.slice(0, 10) <= period.end);
}

export function byStart<T extends ShiftInput>(a: T, b: T): number {
  return a.start.localeCompare(b.start);
}
