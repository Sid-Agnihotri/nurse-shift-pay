// One place that owns the app's data and every way to change it.
// Screens call useAppData() and never touch storage themselves, so swapping localStorage for a
// real backend later only changes this file and storage.ts.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { NurseProfile, ShiftInput } from "../pay/types.ts";
import { addDays, nowLocal } from "../lib/dates.ts";
import { EMPTY_DATA, localStore, newId, type AppData, type SavedShift, type Settings } from "./storage.ts";

interface AppDataValue {
  data: AppData;
  saveProfile: (profile: NurseProfile) => void;
  saveSettings: (settings: Partial<Settings>) => void;
  addShift: (shift: ShiftInput) => void;
  updateShift: (id: string, shift: ShiftInput) => void;
  deleteShift: (id: string) => void;
  clockIn: () => void;
  cancelClockIn: () => void;
  /** Save the shift that was clocked and stop the clock. */
  finishClockedShift: (shift: ShiftInput) => void;
  addExampleShifts: () => void;
  deleteEverything: () => void;
}

const AppDataContext = createContext<AppDataValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(() => localStore.load());

  // Save every time anything changes.
  useEffect(() => localStore.save(data), [data]);

  const value = useMemo<AppDataValue>(
    () => ({
      data,
      saveProfile: (profile) => setData((d) => ({ ...d, profile })),
      saveSettings: (settings) => setData((d) => ({ ...d, settings: { ...d.settings, ...settings } })),
      addShift: (shift) => setData((d) => ({ ...d, shifts: [...d.shifts, { ...shift, id: newId() }] })),
      updateShift: (id, shift) =>
        setData((d) => ({ ...d, shifts: d.shifts.map((s) => (s.id === id ? { ...s, ...shift } : s)) })),
      deleteShift: (id) => setData((d) => ({ ...d, shifts: d.shifts.filter((s) => s.id !== id) })),
      clockIn: () => setData((d) => ({ ...d, clockedInAt: nowLocal() })),
      cancelClockIn: () => setData((d) => ({ ...d, clockedInAt: null })),
      finishClockedShift: (shift) =>
        setData((d) => ({ ...d, clockedInAt: null, shifts: [...d.shifts, { ...shift, id: newId() }] })),
      addExampleShifts: () =>
        setData((d) => (d.profile ? { ...d, shifts: [...d.shifts, ...exampleShifts(d.profile, nowLocal())] } : d)),
      deleteEverything: () => setData(EMPTY_DATA),
    }),
    [data],
  );

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataValue {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("useAppData must be used inside <AppDataProvider>");
  return value;
}

/** The profile, for screens that only render after onboarding. */
export function useProfile(): NurseProfile {
  const { data } = useAppData();
  if (!data.profile) throw new Error("No pay details yet");
  return data.profile;
}

/** Realistic shifts around today, so a first-time user can see what the app does. */
function exampleShifts(profile: NurseProfile, now: string): SavedShift[] {
  const day = (offset: number) => addDays(now.slice(0, 10), offset);
  const make = (start: string, end: string, extra: Partial<ShiftInput> = {}): SavedShift => ({
    id: newId(),
    start,
    end,
    mealMinutes: profile.extendedWorkDay ? 60 : 30,
    meal: "unpaid",
    example: true,
    ...extra,
  });
  if (profile.extendedWorkDay) {
    return [
      make(`${day(-6)}T07:00`, `${day(-6)}T19:00`),
      make(`${day(-5)}T07:00`, `${day(-5)}T19:00`),
      make(`${day(-2)}T19:00`, `${day(-1)}T07:00`),
      make(`${day(-1)}T19:00`, `${day(0)}T07:30`, { meal: "missed" }),
      make(`${day(3)}T07:00`, `${day(3)}T19:00`),
      make(`${day(4)}T19:00`, `${day(5)}T07:00`),
    ];
  }
  return [
    make(`${day(-6)}T07:30`, `${day(-6)}T15:30`),
    make(`${day(-5)}T07:30`, `${day(-5)}T15:30`),
    make(`${day(-3)}T15:30`, `${day(-3)}T23:30`, { shortNotice: true }),
    make(`${day(-2)}T23:30`, `${day(-1)}T07:30`),
    make(`${day(2)}T07:30`, `${day(2)}T17:30`),
    make(`${day(4)}T15:30`, `${day(4)}T23:30`),
  ];
}
