// The pay rules, written as data.
//
// Source: HEABC-NBA Provincial Collective Agreement, April 1, 2022 - March 31, 2025 (still in force
// until a new agreement is ratified). Article numbers point to that agreement.
//
// Everything that changes when a new agreement comes out (wages, premium amounts) lives in a
// RuleSet with an effective date. When a new wage grid is published, you add a RuleSet here.
// You don't touch the calculation code.

import type { AddPayTier, NurseLevel, NurseProfile } from "./types.ts";
import { addDays, easterSunday, hm, mondayOnOrBefore, nthWeekday, type MinuteInfo } from "./time.ts";

/** Premium amounts, in cents per hour. */
export interface Premiums {
  evening: number; // Art 28.01
  night: number; // Art 28.01
  weekend: number; // Art 28.02
  superShift: number; // Art 28.03
  shortNotice: number; // Art 28.04
  regular: number; // Art 28.05
  specialty: number; // Art 28.06 (OR/PAR, ER, ICU/CCU)
  preceptor: number; // Appendix GG
  inCharge: number; // Art 30
}

export interface RuleSet {
  /** First day these rates apply, "YYYY-MM-DD". */
  effectiveFrom: string;
  label: string;
  /** False when the numbers are our estimate rather than taken from a published table. */
  confirmed: boolean;
  /** Hourly wage in cents. wages[level][step - 1] */
  wages: Record<NurseLevel, number[]>;
  /** Year 15-30 Add Pay in cents per hour, added on top of the step rate. */
  addPay: Record<AddPayTier, number>;
  premiums: Premiums;
}

// ---------------------------------------------------------------------------
// Wage tables
// ---------------------------------------------------------------------------

const APRIL_2023: RuleSet = {
  effectiveFrom: "2023-04-01",
  label: "April 1, 2023 wage grid (Art 63)",
  confirmed: true,
  wages: {
    // Step:  1     2     3     4     5     6     7     8     9    10
    1: [3189, 3280, 3350, 3445, 3540, 3635, 3730, 3825, 3920, 4015], // LPN
    2: [3320, 3415, 3490, 3585, 3680, 3775, 3870, 3965, 4060, 4155], // LPN
    3: [4021, 4175, 4329, 4486, 4643, 4800, 4957, 5114, 5271, 5428], // RN/RPN
    4: [4777, 4927, 5077, 5232, 5387, 5542, 5697, 5852, 6007, 6162], // RN/RPN
    5: [5086, 5236, 5386, 5541, 5696, 5851, 6006, 6161, 6316, 6471], // RN/RPN
    6: [5292, 5442, 5592, 5747, 5902, 6057, 6212, 6367, 6522, 6677], // RN/RPN
  },
  addPay: { 0: 0, 15: 50, 20: 125, 25: 225, 30: 350 }, // Appendix WW
  premiums: {
    evening: 140,
    night: 500,
    weekend: 350,
    superShift: 185,
    shortNotice: 200,
    regular: 215,
    specialty: 200,
    preceptor: 150,
    inCharge: 250,
  },
};

/**
 * Build an estimated rule set by raising wages and add pay by a percentage.
 * Premiums stay the same (the agreement doesn't raise them in 2024).
 */
function estimateRaise(base: RuleSet, percent: number, effectiveFrom: string, label: string): RuleSet {
  const raise = (cents: number) => Math.round(cents * (1 + percent / 100));
  const wages = {} as Record<NurseLevel, number[]>;
  for (const level of [1, 2, 3, 4, 5, 6] as NurseLevel[]) {
    wages[level] = base.wages[level].map(raise);
  }
  const addPay = { 0: 0, 15: raise(50), 20: raise(125), 25: raise(225), 30: raise(350) };
  return { ...base, effectiveFrom, label, confirmed: false, wages, addPay };
}

/** Oldest first. ruleSetFor() picks the newest one that has started by the shift date. */
export const RULE_SETS: RuleSet[] = [
  APRIL_2023,
  // Art 63 gives April 1, 2024 as +2% plus up to 1% COLA. The public service nurses' agreement
  // applied the full 3%. No NBA 2024 table has been published, so this is an ESTIMATE.
  estimateRaise(APRIL_2023, 3, "2024-04-01", "April 1, 2024 (April 2023 rates + 3%)"),
];

/** The nurse's hourly base rate in cents: step rate + Year 15-30 Add Pay (Appendix WW). */
export function baseRateCents(rules: RuleSet, nurse: Pick<NurseProfile, "level" | "step" | "addPayTier">): number {
  return rules.wages[nurse.level][nurse.step - 1] + rules.addPay[nurse.addPayTier];
}

export function ruleSetFor(date: string): RuleSet {
  // "YYYY-MM-DD" strings sort the same way as the dates they stand for, so a plain string
  // comparison is enough.
  const matching = RULE_SETS.filter((rules) => rules.effectiveFrom <= date);
  const newest = matching[matching.length - 1];
  if (!newest) {
    throw new Error(`No wage table for ${date}. The earliest one starts ${RULE_SETS[0].effectiveFrom}.`);
  }
  return newest;
}

// ---------------------------------------------------------------------------
// Overtime, meals, casual pay (Art 26, 27, 11.04)
// ---------------------------------------------------------------------------

export const OVERTIME = {
  /** Minutes past the full shift paid at 1.5x before double time starts (Art 27.05(A)(1)). */
  firstTierMinutes: 120,
  firstTierRate: 1.5,
  secondTierRate: 2,
  /** Under 15 minutes past the shift end is paid at straight time (Art 26.07). */
  minimumMinutes: 15,
  /** Overtime on a stat holiday = 1.5x the stat rate (Art 27.05(C)). */
  statFactor: 1.5,
};

/** Missed meal break is paid at 1.5x, never more (Art 26.03(B)(2), (D)). */
export const MISSED_MEAL_RATE = 1.5;

/** Casual nurses get 13% of straight-time pay, excluding premiums, instead of vacation and stats (Art 11.04(G)(2)). */
export const CASUAL_IN_LIEU_RATE = 0.13;

/** In-charge pay needs at least 2 hours in charge (Art 30). */
export const IN_CHARGE_MINIMUM_MINUTES = 120;

/** Under the Extended Work Day MOA, shifts longer than this pay evening/night premiums hour by hour. */
export const EXTENDED_SHIFT_PREMIUM_THRESHOLD_MINUTES = 8 * 60;

// ---------------------------------------------------------------------------
// Time windows for premiums (Art 1.02, 28.01-28.03)
// ---------------------------------------------------------------------------

/** Evening: 1530-2330 */
export function isEvening(m: MinuteInfo): boolean {
  return m.minuteOfDay >= hm(15, 30) && m.minuteOfDay < hm(23, 30);
}

/** Night: 2330-0730 */
export function isNight(m: MinuteInfo): boolean {
  return m.minuteOfDay >= hm(23, 30) || m.minuteOfDay < hm(7, 30);
}

/** Weekend: 2300 Friday to 2300 Sunday */
export function isWeekend(m: MinuteInfo): boolean {
  const FRIDAY = 5;
  const SATURDAY = 6;
  const SUNDAY = 0;
  if (m.weekday === FRIDAY) return m.minuteOfDay >= hm(23);
  if (m.weekday === SATURDAY) return true;
  if (m.weekday === SUNDAY) return m.minuteOfDay < hm(23);
  return false;
}

/**
 * Super shift: 2330 Friday-0730 Saturday and 2330 Saturday-0730 Sunday.
 * If the employer's night shift is 2300-0700, the window is 2300-0700 instead.
 */
export function isSuperShift(m: MinuteInfo, nightStarts2300 = false): boolean {
  const start = nightStarts2300 ? hm(23) : hm(23, 30);
  const end = nightStarts2300 ? hm(7) : hm(7, 30);
  const FRIDAY = 5;
  const SATURDAY = 6;
  const SUNDAY = 0;
  const lateFridayOrSaturday = (m.weekday === FRIDAY || m.weekday === SATURDAY) && m.minuteOfDay >= start;
  const earlySaturdayOrSunday = (m.weekday === SATURDAY || m.weekday === SUNDAY) && m.minuteOfDay < end;
  return lateFridayOrSaturday || earlySaturdayOrSunday;
}

// ---------------------------------------------------------------------------
// Stat holidays (Art 39.01, 39.03)
// ---------------------------------------------------------------------------

export interface StatHoliday {
  date: string;
  name: string;
  /** Pay rate for working it: 2x, or 2.5x for the "super stats". */
  rate: number;
}

const STAT_RATE = 2;
const SUPER_STAT_RATE = 2.5; // Christmas Day, Labour Day, Good Friday

export function statHolidaysForYear(year: number): StatHoliday[] {
  const easter = easterSunday(year);
  const stat = (date: string, name: string, rate = STAT_RATE): StatHoliday => ({ date, name, rate });
  return [
    stat(`${year}-01-01`, "New Year's Day"),
    stat(nthWeekday(year, 2, 1, 3), "BC Family Day"), // 3rd Monday of February
    stat(addDays(easter, -2), "Good Friday", SUPER_STAT_RATE),
    stat(addDays(easter, 1), "Easter Monday"),
    stat(mondayOnOrBefore(year, 5, 24), "Victoria Day"),
    stat(`${year}-07-01`, "Canada Day"),
    stat(nthWeekday(year, 8, 1, 1), "BC Day"), // 1st Monday of August
    stat(nthWeekday(year, 9, 1, 1), "Labour Day", SUPER_STAT_RATE), // 1st Monday of September
    stat(`${year}-09-30`, "National Day for Truth and Reconciliation"),
    stat(nthWeekday(year, 10, 1, 2), "Thanksgiving Day"), // 2nd Monday of October
    stat(`${year}-11-11`, "Remembrance Day"),
    stat(`${year}-12-25`, "Christmas Day", SUPER_STAT_RATE),
    stat(`${year}-12-26`, "Boxing Day"),
  ];
}

const statCache = new Map<number, Map<string, StatHoliday>>();

/** The stat holiday on a date, if there is one. */
export function statHolidayOn(date: string): StatHoliday | undefined {
  const year = Number(date.slice(0, 4));
  if (!statCache.has(year)) {
    statCache.set(year, new Map(statHolidaysForYear(year).map((s) => [s.date, s])));
  }
  return statCache.get(year)!.get(date);
}
