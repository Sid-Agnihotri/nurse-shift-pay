// Helpers for the "YYYY-MM-DDTHH:mm" local-time strings the pay calculator uses,
// and for plain "YYYY-MM-DD" dates.
//
// Tip: these strings sort the same way as the times they stand for, so comparing them with
// < and > works. That's why the app stores times as strings instead of Date objects.

import { addDays, parseLocal } from "../pay/time.ts";

export { addDays };

const pad = (n: number) => String(n).padStart(2, "0");

/** A JS Date -> "2026-10-05T19:30", in the phone's local time. */
export function toLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nowLocal(): string {
  return toLocal(new Date());
}

/**
 * Build a shift's start and end from one date and two clock times.
 * If the end time is earlier than the start time, the shift ends the next day (a night shift).
 * Equal times stay on the same day, so the calculator reports a zero-length shift instead of
 * quietly treating it as 24 hours.
 */
export function buildRange(date: string, startTime: string, endTime: string): { start: string; end: string } {
  const endDate = endTime < startTime ? addDays(date, 1) : date;
  return { start: `${date}T${startTime}`, end: `${endDate}T${endTime}` };
}

export function minutesBetween(start: string, end: string): number {
  return parseLocal(end) - parseLocal(start);
}

/** Whole days from one "YYYY-MM-DD" to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function asDate(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "2023-10-14..." -> "Sat, Oct 14" */
export function formatDay(value: string): string {
  return asDate(value).toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" });
}

/** "2023-10-14..." -> "Saturday, October 14" */
export function formatLongDay(value: string): string {
  return asDate(value).toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });
}

/** "2023-10-14..." -> "Oct 14" */
export function formatShortDate(value: string): string {
  return asDate(value).toLocaleDateString("en-CA", { month: "short", day: "numeric" });
}

/** "2023-10" -> "October 2023" */
export function formatMonth(month: string): string {
  return asDate(`${month}-01`).toLocaleDateString("en-CA", { month: "long", year: "numeric" });
}

/** "2023-10-14T19:00" -> "19:00" (nurses use the 24-hour clock) */
export function formatTime(value: string): string {
  return value.slice(11, 16);
}

/** 450 -> "7.5 h", 660 -> "11 h", 470 -> "7.83 h" */
export function formatHours(minutes: number): string {
  return `${Number((minutes / 60).toFixed(2))} h`;
}

/** 134 -> "2 h 14 min" */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

/** "in 2 days", "tomorrow", "today" for a future date, relative to today. */
export function relativeDay(date: string, today: string): string {
  const days = daysBetween(today.slice(0, 10), date.slice(0, 10));
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/** Move a "YYYY-MM" month by n months. */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * The days to draw for a month view: whole weeks from the Sunday on or before the 1st
 * to the Saturday on or after the last day.
 */
export function monthGrid(month: string): string[] {
  const first = `${month}-01`;
  const firstWeekday = new Date(`${first}T00:00:00Z`).getUTCDay();
  const gridStart = addDays(first, -firstWeekday);
  const nextMonthFirst = `${addMonths(month, 1)}-01`;
  const days: string[] = [];
  for (let d = gridStart; d < nextMonthFirst || days.length % 7 !== 0; d = addDays(d, 1)) {
    days.push(d);
  }
  return days;
}
