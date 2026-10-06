// The frame around every screen: navigation (a bottom bar on phones, a sidebar on wider screens),
// the "Add shift" button, and the current page. New sections (rotations, the chat assistant, an
// account page) get a route in router.ts and a line in NAV_ITEMS.

import type { ReactNode } from "react";
import { CalendarPage } from "../features/calendar/CalendarPage.tsx";
import { PayPage } from "../features/pay/PayPage.tsx";
import { SettingsPage } from "../features/settings/SettingsPage.tsx";
import { useShiftEditor } from "../features/shifts/ShiftEditorContext.tsx";
import { TodayPage } from "../features/today/TodayPage.tsx";
import { useRoute, type Route } from "./router.ts";
import { AppIcon, CalendarIcon, PayIcon, SettingsIcon, TodayIcon } from "./icons.tsx";

const NAV_ITEMS: { route: Route; label: string; icon: ReactNode }[] = [
  { route: "today", label: "Today", icon: <TodayIcon /> },
  { route: "calendar", label: "Calendar", icon: <CalendarIcon /> },
  { route: "pay", label: "Pay", icon: <PayIcon /> },
  { route: "settings", label: "Settings", icon: <SettingsIcon /> },
];

const PAGES: Record<Route, () => ReactNode> = {
  today: () => <TodayPage />,
  calendar: () => <CalendarPage />,
  pay: () => <PayPage />,
  settings: () => <SettingsPage />,
};

export function AppShell() {
  const route = useRoute();
  const editor = useShiftEditor();

  return (
    <div className="shell">
      <nav className="nav" aria-label="Main">
        <a className="brand" href="#today">
          <AppIcon />
          <span>Shift Pay</span>
        </a>
        <button type="button" className="button primary nav-add" onClick={() => editor.openNew()}>
          Add shift
        </button>
        <ul className="nav-links">
          {NAV_ITEMS.map((item) => (
            <li key={item.route}>
              <a href={`#${item.route}`} aria-current={route === item.route ? "page" : undefined}>
                {item.icon}
                <span>{item.label}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="nav-foot">
          Estimates from the BC nurses' collective agreement. Not your official pay.
        </p>
      </nav>

      <main className="content">{PAGES[route]()}</main>

      <button type="button" className="fab" onClick={() => editor.openNew()}>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
        <span>Add shift</span>
      </button>
    </div>
  );
}
