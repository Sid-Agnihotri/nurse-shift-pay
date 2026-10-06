import { AppShell } from "./app/AppShell.tsx";
import { Onboarding } from "./app/Onboarding.tsx";
import { AppDataProvider, useAppData } from "./data/AppDataContext.tsx";
import { ShiftEditorProvider } from "./features/shifts/ShiftEditorContext.tsx";

export default function App() {
  return (
    <AppDataProvider>
      <Root />
    </AppDataProvider>
  );
}

function Root() {
  const { data } = useAppData();
  if (!data.profile) return <Onboarding />;
  return (
    <ShiftEditorProvider>
      <AppShell />
    </ShiftEditorProvider>
  );
}
