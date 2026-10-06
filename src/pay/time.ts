// Time helpers.
//
// Every time is treated as "wall clock" time (what the clock on the unit says) and turned into a
// plain count of minutes. We store those minutes in a UTC Date only because UTC has no daylight
// saving, so adding 1 minute always moves the clock by exactly 1 minute. The "UTC" here is just a
// convenient container. These are NOT real UTC times.

/** What we need to know about a single minute of a shift. */
export interface MinuteInfo {
  /** Calendar date of this minute, "YYYY-MM-DD". */
  date: string;
  /** 0 = Sunday ... 5 = Friday, 6 = Saturday */
  weekday: number;
  /** Minutes after midnight, 0-1439. 19:30 -> 1170. */
  minuteOfDay: number;
}

const LOCAL_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

/** "2023-10-14T19:00" -> a minute count we can do arithmetic with. */
export function parseLocal(value: string): number {
  const match = LOCAL_TIME.exec(value);
  if (!match) {
    throw new Error(`Expected a time like "2023-10-14T19:00", got "${value}"`);
  }
  const [, year, month, day, hour, minute] = match.map(Number);
  return Date.UTC(year, month - 1, day, hour, minute) / 60_000;
}

/** A minute count -> its date, weekday and time of day. */
export function describeMinute(minute: number): MinuteInfo {
  const d = new Date(minute * 60_000);
  return {
    date: d.toISOString().slice(0, 10),
    weekday: d.getUTCDay(),
    minuteOfDay: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

/** Helper for writing times in rules: hm(23, 30) -> 1410 minutes after midnight. */
export function hm(hours: number, minutes = 0): number {
  return hours * 60 + minutes;
}

function isoDate(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10);
}

/** The nth weekday of a month. nthWeekday(2026, 10, 1, 2) = second Monday of October 2026. */
export function nthWeekday(year: number, month: number, weekday: number, n: number): string {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const day = 1 + ((weekday - firstWeekday + 7) % 7) + (n - 1) * 7;
  return isoDate(year, month, day);
}

/** The Monday on or before a date. Victoria Day = the Monday on or before May 24. */
export function mondayOnOrBefore(year: number, month: number, day: number): string {
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return isoDate(year, month, day - ((weekday + 6) % 7));
}

/** Easter Sunday (Gregorian calendar), using the well-known "anonymous" algorithm. */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return isoDate(year, month, day);
}

/** Move a "YYYY-MM-DD" date by a number of days. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * True if the shift covers 2:00 am on a daylight-saving change night
 * (second Sunday in March, first Sunday in November).
 */
export function crossesDaylightSavingChange(start: number, end: number): boolean {
  const startYear = describeMinute(start).date.slice(0, 4);
  const endYear = describeMinute(end).date.slice(0, 4);
  for (const year of new Set([Number(startYear), Number(endYear)])) {
    for (const date of [nthWeekday(year, 3, 0, 2), nthWeekday(year, 11, 0, 1)]) {
      const twoAm = parseLocal(`${date}T02:00`);
      if (start <= twoAm && end > twoAm) return true;
    }
  }
  return false;
}
