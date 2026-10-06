import { useState } from "react";
import { useAppData, useProfile } from "../../data/AppDataContext.tsx";
import type { SavedShift } from "../../data/storage.ts";
import { statHolidayOn } from "../../pay/rules.ts";
import { addMonths, formatHours, formatLongDay, formatMonth, formatShortDate, monthGrid } from "../../lib/dates.ts";
import { byStart, formatMoney, shiftKind, totalsFor } from "../../lib/payFormat.ts";
import { useNow } from "../../lib/useNow.ts";
import { KindTile, ShiftRow } from "../shifts/ShiftRow.tsx";
import { useShiftEditor } from "../shifts/ShiftEditorContext.tsx";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarPage() {
  const { data } = useAppData();
  const profile = useProfile();
  const editor = useShiftEditor();
  const today = useNow().slice(0, 10);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);

  // Shifts are filed under the day they start, like on a unit schedule.
  const byDay = new Map<string, SavedShift[]>();
  for (const shift of [...data.shifts].sort(byStart)) {
    const day = shift.start.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), shift]);
  }
  const monthTotals = totalsFor(data.shifts.filter((s) => s.start.startsWith(month)), profile);
  const selectedShifts = byDay.get(selected) ?? [];
  const selectedStat = statHolidayOn(selected);

  function pick(day: string) {
    setSelected(day);
    if (!day.startsWith(month)) setMonth(day.slice(0, 7));
  }

  return (
    <div className="page">
      <header className="page-head calendar-head">
        <h1>{formatMonth(month)}</h1>
        <div className="month-nav">
          <button type="button" className="icon-button" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="button small" onClick={() => pick(today)}>
            Today
          </button>
          <button type="button" className="icon-button" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>

      <p className="month-total">
        {monthTotals.shifts > 0 ? (
          <>
            <strong className="money">{formatMoney(monthTotals.cents)}</strong> for {monthTotals.shifts}{" "}
            {monthTotals.shifts === 1 ? "shift" : "shifts"} ({formatHours(monthTotals.minutes)}) this month
          </>
        ) : (
          "No shifts this month yet. Pick a day to add one."
        )}
      </p>

      <div className="calendar-layout">
        <div className="calendar">
          <div className="calendar-grid" role="group" aria-label={formatMonth(month)}>
            {WEEKDAYS.map((d) => (
              <span key={d} className="weekday" aria-hidden="true">
                {d}
              </span>
            ))}
            {monthGrid(month).map((day) => {
              const shifts = byDay.get(day) ?? [];
              const stat = statHolidayOn(day);
              const label = [
                formatLongDay(day),
                stat?.name,
                shifts.length ? `${shifts.length} ${shifts.length === 1 ? "shift" : "shifts"}` : undefined,
              ]
                .filter(Boolean)
                .join(", ");
              return (
                <button
                  key={day}
                  type="button"
                  className={[
                    "day",
                    day.startsWith(month) ? "" : "outside",
                    day === today ? "today" : "",
                    stat ? "stat" : "",
                  ].join(" ")}
                  aria-pressed={day === selected}
                  aria-label={label}
                  onClick={() => pick(day)}
                >
                  <span className="day-number">{Number(day.slice(8))}</span>
                  {stat && <span className="day-stat">Stat</span>}
                  <span className="day-shifts">
                    {shifts.slice(0, 2).map((s) => (
                      <KindTile key={s.id} kind={shiftKind(s)} size="sm" />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
          <ul className="legend" aria-label="Key">
            <li>
              <KindTile kind="D" size="sm" /> Day
            </li>
            <li>
              <KindTile kind="E" size="sm" /> Evening
            </li>
            <li>
              <KindTile kind="N" size="sm" /> Night
            </li>
            <li>
              <span className="legend-stat">Stat</span> Stat holiday
            </li>
          </ul>
        </div>

        <section className="day-panel" aria-labelledby="day-title">
          <h2 id="day-title">{formatLongDay(selected)}</h2>
          {selectedStat && (
            <p className="stat-note">
              {selectedStat.name}. Hours worked on it pay {selectedStat.rate}×.
            </p>
          )}
          {selectedShifts.length > 0 ? (
            <ul className="shift-list">
              {selectedShifts.map((s) => (
                <ShiftRow key={s.id} shift={s} profile={profile} showDate={false} />
              ))}
            </ul>
          ) : (
            <p className="muted">No shift on this day.</p>
          )}
          <button type="button" className="button primary" onClick={() => editor.openNew(selected)}>
            Add a shift on {formatShortDate(selected)}
          </button>
        </section>
      </div>
    </div>
  );
}
