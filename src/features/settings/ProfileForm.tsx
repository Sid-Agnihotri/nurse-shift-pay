import { useState, type FormEvent } from "react";
import { baseRateCents, ruleSetFor } from "../../pay/rules.ts";
import type { AddPayTier, NurseLevel, NurseProfile, Step } from "../../pay/types.ts";
import { nowLocal } from "../../lib/dates.ts";
import { formatMoney } from "../../lib/payFormat.ts";

const LEVEL_LABELS: Record<NurseLevel, string> = {
  1: "Level 1, LPN",
  2: "Level 2, LPN",
  3: "Level 3, RN or RPN",
  4: "Level 4, RN or RPN",
  5: "Level 5, RN or RPN",
  6: "Level 6, RN or RPN",
};

const STATUS_LABELS: Record<NurseProfile["status"], string> = {
  regularFullTime: "Regular full-time",
  regularPartTime: "Regular part-time",
  casual: "Casual",
};

const DEFAULT_PROFILE: NurseProfile = {
  level: 3,
  step: 5,
  status: "regularFullTime",
  addPayTier: 0,
  dailyFullShiftHours: 7.5,
  extendedWorkDay: false,
  specialtyArea: false,
  nightShiftStarts2300: false,
};

interface Props {
  initial: NurseProfile | null;
  submitLabel: string;
  onSave: (profile: NurseProfile) => void;
}

/** The pay details a nurse can read off her pay stub: level, step, status, seniority and shift length. */
export function ProfileForm({ initial, submitLabel, onSave }: Props) {
  const [profile, setProfile] = useState<NurseProfile>(initial ?? DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);
  const update = (changes: Partial<NurseProfile>) => {
    setProfile((p) => ({ ...p, ...changes }));
    setSaved(false);
  };

  const rules = ruleSetFor(nowLocal().slice(0, 10));
  const rate = baseRateCents(rules, profile);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSave(profile);
    setSaved(true);
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <div className="field-pair">
        <label className="field">
          <span className="field-label">Nurse level</span>
          <select id="profile-level" value={profile.level} onChange={(e) => update({ level: Number(e.target.value) as NurseLevel })}>
            {([1, 2, 3, 4, 5, 6] as NurseLevel[]).map((level) => (
              <option key={level} value={level}>
                {LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Wage step</span>
          <select id="profile-step" value={profile.step} onChange={(e) => update({ step: Number(e.target.value) as Step })}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((step) => (
              <option key={step} value={step}>
                Step {step}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="field-pair">
        <label className="field">
          <span className="field-label">Employment status</span>
          <select id="profile-status" value={profile.status} onChange={(e) => update({ status: e.target.value as NurseProfile["status"] })}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Seniority</span>
          <select id="profile-addpay" value={profile.addPayTier} onChange={(e) => update({ addPayTier: Number(e.target.value) as AddPayTier })}>
            <option value={0}>Under 15 years</option>
            <option value={15}>15 years or more</option>
            <option value={20}>20 years or more</option>
            <option value={25}>25 years or more</option>
            <option value={30}>30 years or more</option>
          </select>
        </label>
      </div>

      <fieldset className="field">
        <legend className="field-label">Usual shift length</legend>
        <div className="segmented" role="radiogroup" aria-label="Usual shift length">
          <button
            type="button"
            role="radio"
            aria-checked={!profile.extendedWorkDay}
            onClick={() => update({ extendedWorkDay: false, dailyFullShiftHours: 7.5 })}
          >
            <span>8-hour shifts</span>
            <small>7.5 h paid</small>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={profile.extendedWorkDay}
            onClick={() => update({ extendedWorkDay: true, dailyFullShiftHours: 11 })}
          >
            <span>12-hour shifts</span>
            <small>Extended work day</small>
          </button>
        </div>
      </fieldset>

      <label className="field">
        <span className="field-label">Paid hours in a full shift</span>
        <input
          id="profile-fullshift"
          type="number"
          inputMode="decimal"
          min={1}
          max={16}
          step={0.25}
          value={profile.dailyFullShiftHours}
          onChange={(e) => update({ dailyFullShiftHours: Number(e.target.value) })}
        />
        <small className="muted">Overtime starts after this. For 12-hour shifts it's set by your unit, often 11 or 11.25.</small>
      </label>

      <div className="toggles">
        <label className="toggle" htmlFor="profile-specialty">
          <span className="toggle-text">
            <span>OR, PAR, ER, ICU or CCU</span>
            <small>Permanently assigned there (adds $2.00 an hour)</small>
          </span>
          <input id="profile-specialty" type="checkbox" role="switch" checked={profile.specialtyArea} onChange={(e) => update({ specialtyArea: e.target.checked })} />
        </label>
        <label className="toggle" htmlFor="profile-night2300">
          <span className="toggle-text">
            <span>Night shift starts at 23:00</span>
            <small>Instead of 23:30</small>
          </span>
          <input
            id="profile-night2300"
            type="checkbox"
            role="switch"
            checked={profile.nightShiftStarts2300 ?? false}
            onChange={(e) => update({ nightShiftStarts2300: e.target.checked })}
          />
        </label>
      </div>

      <div className="rate-callout">
        <span>Your base rate</span>
        <strong className="money big">{formatMoney(rate)} an hour</strong>
        <small className="muted">{rules.confirmed ? rules.label : "Estimated April 2024 rate. No newer wage grid has been published."}</small>
      </div>

      <div className="actions">
        <button type="submit" className="button primary">
          {submitLabel}
        </button>
        {saved && (
          <span className="saved" role="status">
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
