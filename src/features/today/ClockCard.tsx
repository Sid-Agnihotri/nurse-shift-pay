import { useAppData, useProfile } from "../../data/AppDataContext.tsx";
import { formatDuration, formatTime, minutesBetween } from "../../lib/dates.ts";
import { formatMoney, tryCalculate } from "../../lib/payFormat.ts";
import { useShiftEditor } from "../shifts/ShiftEditorContext.tsx";

/** The time clock: one quiet row with the current state and one button. */
export function ClockCard({ now }: { now: string }) {
  const { data, clockIn, cancelClockIn } = useAppData();
  const profile = useProfile();
  const editor = useShiftEditor();
  const { clockedInAt } = data;

  if (!clockedInAt) {
    return (
      <section className="clock" aria-label="Time clock">
        <div className="clock-face">
          <span className="clock-label">Not clocked in</span>
          <span className="clock-digits">{formatTime(now)}</span>
        </div>
        <button type="button" className="button primary" onClick={clockIn}>
          Clock in
        </button>
      </section>
    );
  }

  const elapsed = Math.max(0, minutesBetween(clockedInAt, now));
  // Pay so far, as if the shift ended right now, before the meal break comes off.
  const soFar = elapsed > 0 ? tryCalculate({ start: clockedInAt, end: now, mealMinutes: 0, meal: "unpaid" }, profile) : null;

  return (
    <section className="clock on" aria-label="Time clock">
      <div className="clock-face">
        <span className="clock-label">
          <span className="live-dot" aria-hidden="true" />
          On shift since {formatTime(clockedInAt)}
        </span>
        <span className="clock-digits">{formatDuration(elapsed)}</span>
        <span className="clock-sub">
          {soFar?.ok ? `About ${formatMoney(soFar.result.totalCents)} so far, before your meal break` : "Your shift has started"}
        </span>
      </div>
      <div className="clock-actions">
        <button type="button" className="button primary" onClick={editor.openFinish}>
          Clock out
        </button>
        <button type="button" className="text-link quiet-link" onClick={cancelClockIn}>
          Undo clock-in
        </button>
      </div>
    </section>
  );
}
