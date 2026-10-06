import { useState } from "react";
import { useAppData, useProfile } from "../../data/AppDataContext.tsx";
import { addDays, formatHours, formatShortDate } from "../../lib/dates.ts";
import { byStart, formatMoney, payPeriodFor, shiftsInPeriod, totalsFor } from "../../lib/payFormat.ts";
import { useNow } from "../../lib/useNow.ts";
import { ShiftRow } from "../shifts/ShiftRow.tsx";

/** One pay period at a time: the estimated gross, how it adds up, and the shifts in it. */
export function PayPage() {
  const { data } = useAppData();
  const profile = useProfile();
  const now = useNow();
  const current = payPeriodFor(now, data.settings.payPeriodStart);
  const [periodStart, setPeriodStart] = useState(current.start);

  const period = { start: periodStart, end: addDays(periodStart, 13) };
  const shifts = shiftsInPeriod(data.shifts, period).sort(byStart);
  const totals = totalsFor(shifts, profile);
  const worked = totalsFor(shifts.filter((s) => s.end <= now), profile);
  const isCurrent = periodStart === current.start;
  const year = period.end.slice(0, 4);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Pay</h1>
      </header>

      <div className="period-nav">
        <button type="button" className="icon-button" onClick={() => setPeriodStart(addDays(periodStart, -14))} aria-label="Previous pay period">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="period-label">
          <strong>
            {formatShortDate(period.start)} to {formatShortDate(period.end)}, {year}
          </strong>
          <span className="muted">{isCurrent ? "Current pay period" : "Pay period"}</span>
        </div>
        <button type="button" className="icon-button" onClick={() => setPeriodStart(addDays(periodStart, 14))} aria-label="Next pay period">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {!isCurrent && (
        <button type="button" className="text-link align-start" onClick={() => setPeriodStart(current.start)}>
          Back to the current pay period
        </button>
      )}

      <section className="pay-hero" aria-label="Estimated gross pay">
        <span className="figure-label">Estimated gross pay</span>
        <strong className="money hero">{formatMoney(totals.cents)}</strong>
        <span className="muted">
          {totals.shifts} {totals.shifts === 1 ? "shift" : "shifts"}, {formatHours(totals.minutes)}
          {worked.cents !== totals.cents && totals.shifts > 0 && `. ${formatMoney(worked.cents)} worked so far.`}
        </span>
      </section>

      {totals.byCategory.length > 0 && (
        <section aria-labelledby="adds-up">
          <h2 id="adds-up">How it adds up</h2>
          <table className="category-table">
            <tbody>
              {totals.byCategory.map((c) => (
                <tr key={c.category}>
                  <th scope="row">{c.category}</th>
                  <td className="num">{formatMoney(c.cents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total before tax and deductions</th>
                <td className="num">{formatMoney(totals.cents)}</td>
              </tr>
            </tfoot>
          </table>
          <p className="muted small">
            Weekly overtime and the part-time consecutive-shift rules aren't included yet. Check against your pay stub.
          </p>
        </section>
      )}

      <section aria-labelledby="period-shifts">
        <h2 id="period-shifts">Shifts in this period</h2>
        {shifts.length > 0 ? (
          <ul className="shift-list">
            {shifts.map((s) => (
              <ShiftRow key={s.id} shift={s} profile={profile} />
            ))}
          </ul>
        ) : (
          <p className="muted">No shifts in this pay period.</p>
        )}
      </section>
    </div>
  );
}
