import { useAppData, useProfile } from "../../data/AppDataContext.tsx";
import { formatShortDate } from "../../lib/dates.ts";
import { payPeriodFor } from "../../lib/payFormat.ts";
import { useNow } from "../../lib/useNow.ts";
import { DataTools } from "./DataTools.tsx";
import { ProfileForm } from "./ProfileForm.tsx";

export function SettingsPage() {
  const { data, saveProfile, saveSettings, deleteEverything } = useAppData();
  const profile = useProfile();
  const now = useNow();
  const period = payPeriodFor(now, data.settings.payPeriodStart);

  return (
    <div className="page">
      <header className="page-head">
        <h1>Settings</h1>
      </header>

      <section className="settings-section" aria-labelledby="settings-pay">
        <h2 id="settings-pay">Pay details</h2>
        <ProfileForm initial={profile} submitLabel="Save pay details" onSave={saveProfile} />
      </section>

      <section className="settings-section" aria-labelledby="settings-period">
        <h2 id="settings-period">Pay period</h2>
        <label className="field">
          <span className="field-label">A day one of your pay periods starts</span>
          <input
            id="settings-period-start"
            type="date"
            value={data.settings.payPeriodStart}
            onChange={(e) => e.target.value && saveSettings({ payPeriodStart: e.target.value })}
          />
          <small className="muted">
            Pay periods are 14 days. Check the period dates on your pay stub. The current one is{" "}
            {formatShortDate(period.start)} to {formatShortDate(period.end)}.
          </small>
        </label>
      </section>

      <section className="settings-section" aria-labelledby="settings-data">
        <h2 id="settings-data">Your data</h2>
        <DataTools shifts={data.shifts} profile={profile} onDeleteEverything={deleteEverything} />
      </section>

      <section className="settings-section" aria-labelledby="settings-about">
        <h2 id="settings-about">About these numbers</h2>
        <p className="muted">
          Pay is estimated from the 2022 to 2025 NBA Provincial Collective Agreement, which stays in force until a new one is
          ratified. Rates from April 2024 on are estimated as April 2023 rates plus 3%. Weekly overtime, the part-time
          consecutive-shift rules, on-call and call-back aren't calculated yet. This isn't your official pay: always check
          it against your pay stub.
        </p>
      </section>
    </div>
  );
}
