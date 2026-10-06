// Small line icons for the navigation. Plain SVG, so no icon library is needed.

const common = {
  viewBox: "0 0 24 24",
  width: 24,
  height: 24,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function TodayIcon() {
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg {...common}>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
      <path d="M8 13.5h2M14 13.5h2M8 17h2" />
    </svg>
  );
}

/** A pay stub with a torn edge. */
export function PayIcon() {
  return (
    <svg {...common}>
      <path d="M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </svg>
  );
}

export function SettingsIcon() {
  return (
    <svg {...common}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
    </svg>
  );
}

/** The app mark: a time-clock face. */
export function AppIcon() {
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <rect width="32" height="32" rx="16" fill="var(--ink)" />
      <circle cx="16" cy="16" r="9" fill="none" stroke="var(--bg)" strokeWidth="2.5" />
      <path d="M16 10v6l4 3" fill="none" stroke="var(--bg)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
