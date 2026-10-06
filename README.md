# Shift Pay

A shift and pay tracker for BC nurses. A nurse sets her pay details once, then clocks in and out
or plans shifts on a calendar. Every shift shows what it pays, with evening, night, weekend,
stat holiday and overtime pay worked out from the nurses' collective agreement, and each pay
period adds up to an estimated gross.

There's no backend yet. Data is saved in the browser on the device being used, so a tester's
shifts never leave her phone.

## Run it

You need Node 22 (22.18 or newer runs the tests directly).

```bash
npm install
npm run dev        # http://localhost:5173
npm run host       # also on your Wi-Fi: open the "Network" address on a phone
npm test           # 16 hand-checked pay calculations
npm run build      # type-check + production build
```

## Screens

| Screen | What it does |
|---|---|
| **Today** | Time clock, this pay period (earned so far and still scheduled), next shifts, recent shifts |
| **Calendar** | Month view with D / E / N shifts and stat holidays. Tap a day to see or add its shifts |
| **Pay** | One 14-day pay period at a time: estimated gross, how it adds up, every shift in it |
| **Settings** | Pay details, pay period start date, copy shifts as CSV, delete data |
| **Add shift** sheet | Opens from the + button, a calendar day or "Clock out". Shows each premium as it's added |

## Design

Minimal: white space, near-monochrome, a serif (Newsreader) for big numbers and titles and Geist
for everything else, black pill buttons, hairline lists instead of boxes. Colour only carries
meaning: soft tints for D / E / N shifts, red for stat holidays, green for "on shift". All colours
are tokens at the top of `src/index.css`, with a dark-mode set.

## How the code is organised

```
src/
  pay/          The pay calculator. Rules as data (rules.ts) + the calculation. No React.
  data/         storage.ts (where data is saved) and AppDataContext.tsx (the only way screens read or change data)
  app/          AppShell (navigation + pages), router.ts (#today, #calendar...), Onboarding, icons
  features/
    today/      TodayPage, ClockCard
    calendar/   CalendarPage
    pay/        PayPage
    settings/   SettingsPage, ProfileForm, DataTools
    shifts/     ShiftEditor (the sheet), ShiftRow, PayBreakdown, ShiftEditorContext
  lib/          Dates, money formatting, totals, pay periods
  ui/           Sheet (a bottom sheet / dialog)
tests/          Calculator tests (Node's built-in test runner)
```

Two rules keep it easy to grow:

1. **Screens never touch storage.** They call `useAppData()`. Moving to a real backend means
   changing `data/storage.ts` and `data/AppDataContext.tsx`, not the screens.
2. **Pay rules are data.** A new wage grid is a new entry in `pay/rules.ts`. The calculation code
   doesn't change.

To add a screen: add its name to `ROUTES` in `app/router.ts`, a page in `features/`, and a line
in `NAV_ITEMS` in `app/AppShell.tsx`.

## Roadmap toward the SaaS version

1. **Accounts and sync.** A hosted database with sign-in (for example Supabase or Postgres plus an auth
   library), so shifts follow a nurse across devices. Swap `localStore` for an API-backed store.
2. **Rotations.** Enter a rotation once (for example D D N N, then 4 off) and fill the calendar from it.
3. **Whole-schedule rules.** Weekly overtime, part-time consecutive-shift double time, and the 225 hours
   over three pay periods rule. These need the calendar's full schedule, not one shift.
4. **Pay stub check.** Enter what was actually paid and compare it line by line.
5. **Ask the agreement.** The chat over the BCNU documents, citing articles.
6. **Other agreements.** PSA, CBA and employer-specific agreements as extra rule sets.

