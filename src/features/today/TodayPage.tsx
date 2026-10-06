import { useAppData, useProfile } from "../../data/AppDataContext.tsx";
import { formatLongDay, formatShortDate, relativeDay } from "../../lib/dates.ts";
import { byStart, formatMoney, payPeriodFor, shiftsInPeriod, totalsFor } from "../../lib/payFormat.ts";
import { useNow } from "../../lib/useNow.ts";
import { ShiftRow } from "../shifts/ShiftRow.tsx";
import { useShiftEditor } from "../shifts/ShiftEditorContext.tsx";
import { ClockCard } from "./ClockCard.tsx";

export function TodayPage() {
  const { data, addExampleShifts } = useAppData();
  const profile = useProfile();
  const editor = useShiftEditor();
  const now = useNow();

  const upcoming = data.shifts.filter((s) => s.end > now).sort(byStart);
  const recent = data.shifts.filter((s) => s.end <= now).sort(byStart).reverse();
  const next = upcoming[0];

  const period = payPeriodFor(now, data.settings.payPeriodStart);
  const inPeriod = shiftsInPeriod(data.shifts, period);
  const earned = totalsFor(inPeriod.filter((s) => s.end <= now), profile);
  const scheduled = totalsFor(inPeriod.filter((s) => s.end > now), profile);

  return (
    <div className="page">
      <p className="eyebrow-date">{formatLongDay(now)}</p>

      {/* The headline number: what this pay period has earned so far. */}
      <a className="hero" href="#pay">
        <span className="hero-label">Earned this pay period</span>
        <span className="hero-amount">{formatMoney(earned.cents)}</span>
        <span className="hero-sub">
          {formatShortDate(period.start)} to {formatShortDate(period.end)}
          {scheduled.cents > 0 && <>. {formatMoney(scheduled.cents)} more scheduled</>}
        </span>
      </a>

      <ClockCard now={now} />

      {data.shifts.length === 0 ? (
        <section className="empty">
          <h2>Add your shifts to see your pay</h2>
          <p className="muted">
            Clock in when a shift starts, or add the shifts you've worked and the ones coming up. Each one shows what it pays,
            premiums included.
          </p>
          <div className="actions">
            <button type="button" className="button primary" onClick={() => editor.openNew()}>
              Add a shift
            </button>
            <button type="button" className="button" onClick={addExampleShifts}>
              Try it with example shifts
            </button>
          </div>
        </section>
      ) : (
        <>
          <section aria-labelledby="next-title">
            <div className="section-head">
              <h2 id="next-title">{next ? `Next shift ${relativeDay(next.start, now)}` : "No upcoming shifts"}</h2>
              <a href="#calendar" className="text-link">
                Calendar
              </a>
            </div>
            {upcoming.length > 0 ? (
              <ul className="shift-list">
                {upcoming.slice(0, 3).map((s) => (
                  <ShiftRow key={s.id} shift={s} profile={profile} />
                ))}
              </ul>
            ) : (
              <p className="muted">Add the shifts you're booked for to see what's coming in.</p>
            )}
          </section>

          {recent.length > 0 && (
            <section aria-labelledby="recent-title">
              <div className="section-head">
                <h2 id="recent-title">Recently worked</h2>
                <a href="#pay" className="text-link">
                  Pay
                </a>
              </div>
              <ul className="shift-list">
                {recent.slice(0, 3).map((s) => (
                  <ShiftRow key={s.id} shift={s} profile={profile} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
