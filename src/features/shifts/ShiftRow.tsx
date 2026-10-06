import { useState } from "react";
import type { NurseProfile } from "../../pay/types.ts";
import type { SavedShift } from "../../data/storage.ts";
import { formatDay, formatHours, formatTime } from "../../lib/dates.ts";
import { SHIFT_KIND_NAMES, formatMoney, shiftKind, tagsFor, tryCalculate } from "../../lib/payFormat.ts";
import { PayBreakdown } from "./PayBreakdown.tsx";
import { useShiftEditor } from "./ShiftEditorContext.tsx";

/** The schedule letter for a shift (D, E or N), coloured like a unit schedule. */
export function KindTile({ kind, size = "md" }: { kind: "D" | "E" | "N"; size?: "sm" | "md" }) {
  return (
    <span className={`kind kind-${kind} kind-${size}`} title={SHIFT_KIND_NAMES[kind]}>
      <span aria-hidden="true">{kind}</span>
      <span className="visually-hidden">{SHIFT_KIND_NAMES[kind]} shift</span>
    </span>
  );
}

interface Props {
  shift: SavedShift;
  profile: NurseProfile;
  /** Hide the date when the list is already for one day. */
  showDate?: boolean;
}

/** One shift in a list. Tap to see how the pay adds up. */
export function ShiftRow({ shift, profile, showDate = true }: Props) {
  const [open, setOpen] = useState(false);
  const editor = useShiftEditor();
  const outcome = tryCalculate(shift, profile);
  const nextDay = shift.end.slice(0, 10) !== shift.start.slice(0, 10);

  return (
    <li className={`shift-row ${open ? "open" : ""}`}>
      <button type="button" className="shift-row-main" onClick={() => setOpen(!open)} aria-expanded={open}>
        <KindTile kind={shiftKind(shift)} />
        <span className="shift-row-when">
          {showDate && <span className="shift-row-date">{formatDay(shift.start)}</span>}
          <span className="shift-row-times">
            {formatTime(shift.start)} to {formatTime(shift.end)}
            {nextDay && <span className="next-day"> next day</span>}
          </span>
          <span className="tags">
            {shift.example && <span className="tag example">Example</span>}
            {outcome.ok &&
              tagsFor(outcome.result).map((t) => (
                <span key={t.label} className={`tag ${t.tone}`}>
                  {t.label}
                </span>
              ))}
          </span>
        </span>
        <span className="shift-row-pay">
          {outcome.ok ? (
            <>
              <strong className="money">{formatMoney(outcome.result.totalCents)}</strong>
              <span className="muted">{formatHours(outcome.result.workedMinutes)}</span>
            </>
          ) : (
            <span className="error-text">Check times</span>
          )}
        </span>
      </button>

      {open && (
        <div className="shift-row-detail">
          {outcome.ok ? <PayBreakdown result={outcome.result} /> : <p className="error-text">{outcome.error}</p>}
          <button type="button" className="button" onClick={() => editor.openEdit(shift.id)}>
            Edit shift
          </button>
        </div>
      )}
    </li>
  );
}
