import { useState, type FormEvent } from "react";
import type { MealBreak, ShiftInput } from "../../pay/types.ts";
import { useAppData } from "../../data/AppDataContext.tsx";
import { buildRange, formatHours, minutesBetween, nowLocal } from "../../lib/dates.ts";
import { formatMoney, tryCalculate } from "../../lib/payFormat.ts";
import { Sheet } from "../../ui/Sheet.tsx";
import { PayBreakdown } from "./PayBreakdown.tsx";

export type EditorMode =
  | { kind: "new"; date: string }
  | { kind: "edit"; id: string }
  | { kind: "finish"; end: string };

const PRESETS_8H = [
  { label: "Day", start: "07:30", end: "15:30" },
  { label: "Evening", start: "15:30", end: "23:30" },
  { label: "Night", start: "23:30", end: "07:30" },
];
const PRESETS_12H = [
  { label: "Day", start: "07:00", end: "19:00" },
  { label: "Night", start: "19:00", end: "07:00" },
];

const MEAL_OPTIONS: { value: MealBreak; label: string; hint: string }[] = [
  { value: "unpaid", label: "Took it", hint: "Unpaid" },
  { value: "paidAvailable", label: "Stayed available", hint: "Paid" },
  { value: "missed", label: "Missed it", hint: "Paid at 1.5×" },
];

const FORM_ID = "shift-form";

export function ShiftEditor({ mode, onClose }: { mode: EditorMode; onClose: () => void }) {
  const { data, addShift, updateShift, deleteShift, finishClockedShift } = useAppData();
  const profile = data.profile;
  const existing = mode.kind === "edit" ? data.shifts.find((s) => s.id === mode.id) : undefined;
  const presets = profile?.extendedWorkDay ? PRESETS_12H : PRESETS_8H;

  // Starting values for the form.
  const initial: Partial<ShiftInput> & { start: string; end: string } =
    mode.kind === "edit" && existing
      ? existing
      : mode.kind === "finish"
        ? { start: data.clockedInAt ?? mode.end, end: mode.end }
        : buildRange(mode.kind === "new" ? mode.date : nowLocal().slice(0, 10), presets[0].start, presets[0].end);

  const [date, setDate] = useState(initial.start.slice(0, 10));
  const [startTime, setStartTime] = useState(initial.start.slice(11, 16));
  const [endTime, setEndTime] = useState(initial.end.slice(11, 16));
  const [mealMinutes, setMealMinutes] = useState(initial.mealMinutes ?? (profile?.extendedWorkDay ? 60 : 30));
  const [meal, setMeal] = useState<MealBreak>(initial.meal ?? "unpaid");
  const [shortNotice, setShortNotice] = useState(initial.shortNotice ?? false);
  const [scheduledDayOff, setScheduledDayOff] = useState(initial.scheduledDayOff ?? false);
  const [preceptor, setPreceptor] = useState(initial.preceptor ?? false);
  const [inChargeHours, setInChargeHours] = useState((initial.inChargeMinutes ?? 0) / 60);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (!profile || (mode.kind === "edit" && !existing)) return null;

  const range = buildRange(date, startTime, endTime);
  const shift: ShiftInput = {
    ...range,
    mealMinutes,
    meal,
    shortNotice,
    scheduledDayOff: profile.status === "regularFullTime" ? scheduledDayOff : false,
    preceptor,
    inChargeMinutes: Math.round(inChargeHours * 60),
  };
  // Recalculated on every change, so the nurse sees each premium appear as she edits.
  const outcome = tryCalculate(shift, profile);
  const endsNextDay = range.end.slice(0, 10) !== date;
  const activePreset = presets.find((p) => p.start === startTime && p.end === endTime);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!outcome.ok) return;
    if (mode.kind === "edit" && existing) updateShift(existing.id, shift);
    else if (mode.kind === "finish") finishClockedShift(shift);
    else addShift(shift);
    onClose();
  }

  const title = mode.kind === "edit" ? "Edit shift" : mode.kind === "finish" ? "Clock out" : "Add shift";
  const submitLabel = mode.kind === "edit" ? "Save changes" : mode.kind === "finish" ? "Save shift" : "Add shift";

  const footer = (
    <div className="sheet-actions">
      {mode.kind === "edit" &&
        existing &&
        (confirmingDelete ? (
          <span className="confirm">
            <span>Delete this shift?</span>
            <button
              type="button"
              className="button danger"
              onClick={() => {
                deleteShift(existing.id);
                onClose();
              }}
            >
              Delete
            </button>
            <button type="button" className="button" onClick={() => setConfirmingDelete(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button type="button" className="button quiet danger-text" onClick={() => setConfirmingDelete(true)}>
            Delete
          </button>
        ))}
      <span className="spacer" />
      <button type="button" className="button" onClick={onClose}>
        Cancel
      </button>
      <button type="submit" form={FORM_ID} className="button primary" disabled={!outcome.ok}>
        {submitLabel}
      </button>
    </div>
  );

  return (
    <Sheet title={title} onClose={onClose} footer={footer}>
      <form id={FORM_ID} className="editor" onSubmit={handleSubmit}>
        <section className="editor-section" aria-labelledby="editor-when">
          <h3 id="editor-when">When</h3>
          <label className="field">
            <span className="field-label">Date</span>
            <input id="shift-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="segmented" role="group" aria-label="Shift">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                aria-pressed={activePreset === p}
                onClick={() => {
                  setStartTime(p.start);
                  setEndTime(p.end);
                }}
              >
                <span>{p.label}</span>
                <small>
                  {p.start} to {p.end}
                </small>
              </button>
            ))}
          </div>
          <div className="field-pair">
            <label className="field">
              <span className="field-label">Start</span>
              <input id="shift-start" type="time" required value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">
                End {endsNextDay && <span className="next-day">next day</span>}
              </span>
              <input id="shift-end" type="time" required value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>
        </section>

        <section className="editor-section" aria-labelledby="editor-meal">
          <div className="section-head">
            <h3 id="editor-meal">Meal break</h3>
            <select
              id="shift-meal-minutes"
              aria-label="Meal break length"
              value={mealMinutes}
              onChange={(e) => setMealMinutes(Number(e.target.value))}
            >
              {[0, 30, 45, 60].map((m) => (
                <option key={m} value={m}>
                  {m === 0 ? "None" : `${m} min`}
                </option>
              ))}
            </select>
          </div>
          {mealMinutes > 0 && (
            <div className="segmented" role="radiogroup" aria-label="What happened with the meal break">
              {MEAL_OPTIONS.map((o) => (
                <button key={o.value} type="button" role="radio" aria-checked={meal === o.value} onClick={() => setMeal(o.value)}>
                  <span>{o.label}</span>
                  <small>{o.hint}</small>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="editor-section" aria-labelledby="editor-extras">
          <h3 id="editor-extras">Also on this shift</h3>
          <div className="toggles">
            <Toggle id="shift-short-notice" checked={shortNotice} onChange={setShortNotice} label="Short notice" hint="Picked up less than 24 hours before it started" />
            {profile.status === "regularFullTime" && (
              <Toggle id="shift-day-off" checked={scheduledDayOff} onChange={setScheduledDayOff} label="On my day off" hint="All hours at double time" />
            )}
            <Toggle id="shift-preceptor" checked={preceptor} onChange={setPreceptor} label="Precepting" hint="Supervising a student or new nurse" />
            <Toggle
              id="shift-in-charge"
              checked={inChargeHours > 0}
              onChange={(on) => setInChargeHours(on ? Math.max(0, (minutesBetween(range.start, range.end) - mealMinutes) / 60) : 0)}
              label="In charge"
              hint="Paid when it's 2 hours or more"
            />
            {inChargeHours > 0 && (
              <label className="field inline">
                <span className="field-label">Hours in charge</span>
                <input
                  id="shift-in-charge-hours"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={24}
                  step={0.25}
                  value={Number(inChargeHours.toFixed(2))}
                  onChange={(e) => setInChargeHours(Number(e.target.value))}
                />
              </label>
            )}
          </div>
        </section>

        <section className="editor-section preview" aria-labelledby="editor-pay" aria-live="polite">
          <div className="section-head">
            <h3 id="editor-pay">Pay for this shift</h3>
            {outcome.ok && <strong className="money big">{formatMoney(outcome.result.totalCents)}</strong>}
          </div>
          {outcome.ok ? (
            <>
              <p className="muted">
                {formatHours(outcome.result.workedMinutes)} worked. Evening, night, weekend, stat holiday and overtime pay are
                added from the date and times.
              </p>
              <PayBreakdown result={outcome.result} showRates={false} />
            </>
          ) : (
            <p className="error-text">{outcome.error}</p>
          )}
        </section>
      </form>
    </Sheet>
  );
}

function Toggle({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (on: boolean) => void; label: string; hint: string }) {
  return (
    <label className="toggle" htmlFor={id}>
      <span className="toggle-text">
        <span>{label}</span>
        <small>{hint}</small>
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
