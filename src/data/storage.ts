// Where the app's data lives.
//
// Today: the browser's localStorage, on this device only. A tester's shifts never leave her phone.
// Later (the SaaS version): replace `localStore` with a store that calls your API. Nothing else in
// the app reads localStorage directly; every screen goes through useAppData() in AppDataContext.

import type { NurseProfile, ShiftInput } from "../pay/types.ts";

export interface SavedShift extends ShiftInput {
  id: string;
  /** Added by "Try it with example shifts", so it can be labelled. */
  example?: boolean;
}

export interface Settings {
  /** Any date that starts one of your pay periods. Periods repeat every 14 days from it. */
  payPeriodStart: string;
}

export interface AppData {
  profile: NurseProfile | null;
  shifts: SavedShift[];
  /** Set while the nurse is clocked in: the clock-in time, "YYYY-MM-DDTHH:mm". */
  clockedInAt: string | null;
  settings: Settings;
}

export const DEFAULT_SETTINGS: Settings = { payPeriodStart: "2026-01-04" };

export const EMPTY_DATA: AppData = { profile: null, shifts: [], clockedInAt: null, settings: DEFAULT_SETTINGS };

/** The contract any storage has to meet. A server-backed version would make these async. */
export interface DataStore {
  load(): AppData;
  save(data: AppData): void;
}

const STORAGE_KEY = "shift-pay:v1";

export const localStore: DataStore = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return EMPTY_DATA;
      const saved = JSON.parse(raw) as Partial<AppData>;
      // Older saves have no settings yet: fill in the defaults.
      return { ...EMPTY_DATA, ...saved, settings: { ...DEFAULT_SETTINGS, ...saved.settings } };
    } catch {
      // Private browsing, blocked storage or corrupted data: start fresh, in memory.
      return EMPTY_DATA;
    }
  },
  save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Storage isn't available. The app keeps working, but data is lost on reload.
    }
  },
};

/** Unique enough for one person's shift list. (crypto.randomUUID needs https, which a phone on your Wi-Fi won't have.) */
export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
