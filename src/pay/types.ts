// Shared types for the pay calculator. No logic in this file.

export type EmploymentStatus = "regularFullTime" | "regularPartTime" | "casual";

export type NurseLevel = 1 | 2 | 3 | 4 | 5 | 6;

/** Increment step on the wage grid (Year 1 to Year 10). */
export type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/** Year 15-30 Add Pay tier the nurse has reached (0 = not yet eligible). */
export type AddPayTier = 0 | 15 | 20 | 25 | 30;

/** Things about the nurse that rarely change. */
export interface NurseProfile {
  level: NurseLevel;
  step: Step;
  status: EmploymentStatus;
  addPayTier: AddPayTier;
  /**
   * Normal daily full shift hours, excluding meal breaks.
   * 7.5 under the main agreement. For 10-12 hour shifts the site's agreement sets it (often 11 or 11.25).
   */
  dailyFullShiftHours: number;
  /** True if the nurse's unit works under the Extended Work Day MOA (shifts longer than 8 hours). */
  extendedWorkDay: boolean;
  /** Regular nurse permanently assigned to OR/PAR, ER, or ICU/CCU (Art 28.06). */
  specialtyArea: boolean;
  /** Employer's standard night shift is 2300-0700 instead of 2330-0730. Moves the super shift window (Art 28.03). */
  nightShiftStarts2300?: boolean;
}

/** What happened with the meal break (Art 26.03). */
export type MealBreak =
  | "unpaid" // took the break, not paid
  | "paidAvailable" // employer required them to stay available: paid at straight time
  | "missed"; // didn't get the break, or was called back during it: paid at 1.5x

/** One shift, as the nurse would enter it or clock it. */
export interface ShiftInput {
  /** Local wall-clock time, the format an <input type="datetime-local"> gives you: "2023-10-14T19:00" */
  start: string;
  end: string;
  /** Length of the meal break(s) in minutes: usually 30, or 60 for shifts of 10+ hours. */
  mealMinutes: number;
  meal: MealBreak;
  /** A regular full-time nurse working on a scheduled day off (all hours double time). */
  scheduledDayOff?: boolean;
  /** Shift offered and accepted less than 24 hours before it started (Art 28.04). */
  shortNotice?: boolean;
  /** Designated preceptor for this shift (Appendix GG). */
  preceptor?: boolean;
  /** Minutes designated in charge of the unit (Art 30). Paid only if 120 or more. */
  inChargeMinutes?: number;
}

/** One row of the pay breakdown, e.g. "Night premium: 6.5 h x $5.00". */
export interface PayLine {
  code: string;
  label: string;
  minutes: number;
  /** Hourly rate in cents, before the multiplier. */
  rateCents: number;
  /** 1 for straight time, 1.5 or 2 for overtime, 2.5 for a super stat, 0.13 for casual in-lieu pay. */
  multiplier: number;
  amountCents: number;
  /** Where the rule comes from, so the UI (and the nurse) can check it. */
  source: string;
}

export interface ShiftPayResult {
  lines: PayLine[];
  totalCents: number;
  workedMinutes: number;
  /** Which wage table was used. */
  ruleSet: string;
  /** Plain-language notes and warnings to show next to the result. */
  notes: string[];
}
