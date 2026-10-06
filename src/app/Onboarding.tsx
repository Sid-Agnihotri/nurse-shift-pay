import { useAppData } from "../data/AppDataContext.tsx";
import { ProfileForm } from "../features/settings/ProfileForm.tsx";
import { AppIcon } from "./icons.tsx";

/** First visit: explain the app in two sentences, then ask for pay details. */
export function Onboarding() {
  const { saveProfile } = useAppData();
  return (
    <div className="onboarding">
      <div className="onboarding-intro">
        <span className="brand">
          <AppIcon />
          <span>Shift Pay</span>
        </span>
        <h1>See what every shift pays</h1>
        <p>
          Shift Pay works out each shift's pay for BC nurses, with evening, night, weekend, stat holiday and overtime pay,
          from the nurses' collective agreement.
        </p>
        <p className="muted">Start with the pay details from your pay stub. You can change them any time.</p>
      </div>
      <ProfileForm initial={null} submitLabel="Start tracking shifts" onSave={saveProfile} />
    </div>
  );
}
