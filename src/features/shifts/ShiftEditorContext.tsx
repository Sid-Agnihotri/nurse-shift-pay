// Lets any screen open the shift editor ("Add shift", "Edit", "Clock out") without passing
// callbacks through every component.

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { nowLocal } from "../../lib/dates.ts";
import { ShiftEditor, type EditorMode } from "./ShiftEditor.tsx";

interface ShiftEditorApi {
  /** Add a shift, optionally on a given day ("YYYY-MM-DD"). */
  openNew: (date?: string) => void;
  openEdit: (id: string) => void;
  /** Clock out: finish the shift that's being clocked. */
  openFinish: () => void;
}

const ShiftEditorContext = createContext<ShiftEditorApi | null>(null);

export function ShiftEditorProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<EditorMode | null>(null);

  const api = useMemo<ShiftEditorApi>(
    () => ({
      openNew: (date) => setMode({ kind: "new", date: date ?? nowLocal().slice(0, 10) }),
      openEdit: (id) => setMode({ kind: "edit", id }),
      openFinish: () => setMode({ kind: "finish", end: nowLocal() }),
    }),
    [],
  );

  return (
    <ShiftEditorContext.Provider value={api}>
      {children}
      {/* The key makes a fresh editor (fresh form state) every time it opens. */}
      {mode && <ShiftEditor key={JSON.stringify(mode)} mode={mode} onClose={() => setMode(null)} />}
    </ShiftEditorContext.Provider>
  );
}

export function useShiftEditor(): ShiftEditorApi {
  const api = useContext(ShiftEditorContext);
  if (!api) throw new Error("useShiftEditor must be used inside <ShiftEditorProvider>");
  return api;
}
