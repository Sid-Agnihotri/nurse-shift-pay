import { useState } from "react";
import type { NurseProfile } from "../../pay/types.ts";
import type { SavedShift } from "../../data/storage.ts";
import { byStart, tryCalculate } from "../../lib/payFormat.ts";

/** One row per shift, with the pay breakdown, ready to paste into a spreadsheet or a message. */
function toCsv(shifts: SavedShift[], profile: NurseProfile): string {
  const header = ["start", "end", "meal_minutes", "meal", "short_notice", "day_off", "preceptor", "in_charge_minutes", "worked_hours", "total", "breakdown"];
  const rows = [...shifts].sort(byStart).map((s) => {
    const outcome = tryCalculate(s, profile);
    const worked = outcome.ok ? (outcome.result.workedMinutes / 60).toFixed(2) : "";
    const total = outcome.ok ? (outcome.result.totalCents / 100).toFixed(2) : "error";
    const breakdown = outcome.ok
      ? outcome.result.lines.map((l) => `${l.label} ${(l.amountCents / 100).toFixed(2)}`).join("; ")
      : outcome.error;
    return [s.start, s.end, s.mealMinutes, s.meal, !!s.shortNotice, !!s.scheduledDayOff, !!s.preceptor, s.inChargeMinutes ?? 0, worked, total, breakdown];
  });
  const escape = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;
  return [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

interface Props {
  shifts: SavedShift[];
  profile: NurseProfile;
  onDeleteEverything: () => void;
}

export function DataTools({ shifts, profile, onDeleteEverything }: Props) {
  const [csv, setCsv] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [confirming, setConfirming] = useState(false);

  async function copyCsv() {
    const text = toCsv(shifts, profile);
    try {
      await navigator.clipboard.writeText(text);
      setStatus(`Copied ${shifts.length} shifts. Paste them into a message or a spreadsheet.`);
      setCsv(null);
    } catch {
      // Copying isn't allowed here (for example on a phone over plain http): show the text to copy by hand.
      setCsv(text);
      setStatus("Select the text below and copy it.");
    }
  }

  return (
    <div className="form">
      <p className="muted">Your shifts and pay details are saved in this browser, on this device only.</p>
      <div className="actions">
        <button type="button" className="button" onClick={copyCsv} disabled={shifts.length === 0}>
          Copy shifts as CSV
        </button>
        {confirming ? (
          <span className="confirm">
            <span>Delete all shifts and pay details?</span>
            <button type="button" className="button danger" onClick={onDeleteEverything}>
              Delete everything
            </button>
            <button type="button" className="button" onClick={() => setConfirming(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" className="button quiet danger-text" onClick={() => setConfirming(true)}>
            Delete all my data
          </button>
        )}
      </div>
      {status && (
        <p className="small" role="status">
          {status}
        </p>
      )}
      {csv && <textarea id="csv-output" className="csv" readOnly value={csv} rows={6} onFocus={(e) => e.target.select()} />}
    </div>
  );
}
