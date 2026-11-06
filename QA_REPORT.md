# QA report: Tiffin (Day 6)

Date: 2026-11-06 to 2026-11-07 (NPT). Build: the release published at https://tiffin.sites.tab.bot/ (asset index-Bv86WEt-.js).

## Automated

- `npm test`: 23 of 23 pass (node:test).
  - logic.test.ts (9): Nepal Time clock, date helpers, Sunday-first plan mask, delivery rules, pause lock at 20:00 the evening before,
    21-day schedule window, billing, input guards, month start and stop order.
  - api.test.ts (14): health and app shell headers (CSP, frame options), seed (plans, routes, 7-day menu),
    demo sign-in and overview, role separation (401 and 403), register, login, duplicate and weak passwords, non-JSON refused,
    subscription create and update rules, pauses (locked and out-of-range refused), delivery marking against paused days,
    payments validation, menu editor validation, settings validation, cancel, and route reordering.
- `tsc` on the app and the Worker: no errors.
- `vite build` and the Worker bundle: built; site folder 0.73 MB, 24 files.

## Browser (Playwright, Chromium, reduced motion on)

Local copy and live site, same script (qa/ and qa/live/). 32 checks each:

- Landing at 375, 768 and 1440 px: menu renders (7 days), no horizontal scroll.
- Landing when the menu request fails: a plain message, no blank page.
- Customer demo: 21-day calendar, plan name, resume a pause, pause a day (state flips to Paused), menu page, billing page.
- Customer refused the kitchen area, with a way back.
- Kitchen demo: today's count, route sheet lists stops, marking a stop delivered, subscribers table, opening a subscriber, recording a payment, saving the menu, settings.
- New customer sign-up on a 375 px phone, starting a plan, the calendar, bottom navigation, no horizontal scroll.
- Kitchen on a 375 px phone: no horizontal scroll on the overview and the route sheet.
- Unknown route shows a not-found page; Terms and Privacy render.

Results: local 32 of 32. Live: first run 32 of 32; second run 31 of 32. The one miss was "marking delivered updates the stop":
the live demo keeps its state between runs, so the first stop was already Delivered and the click toggled it back to Pending, as designed
(tapping the active status again clears it). The check is not idempotent; the behaviour is correct.
The only console error in every run is `Failed to load resource: ERR_FAILED`, from the deliberate abort of /api/menu in the failure test.

## Bugs found by QA and fixed (all before the live publish)

1. Sign-up crashed the plan page for a new customer: the no-subscription response left out the date, so the form got an invalid date.
2. Embedded font data URLs were blocked by the Content-Security-Policy (`font-src 'self'`); allowed `data:` for fonts only.
3. The sidebar highlighted both "Today" and "Routes" on the route sheet (prefix match); now the longest match wins.
4. The header's "Start a plan" text was dark on plum (a nav rule overrode the button colour).
5. On phones the route stop's status buttons shared a column with the address (a grid rule on the wrong element); fixed and rechecked on the live build.

## Contrast

Computed for every text pair used (see DESIGN.md). All 13 listed pairs pass WCAG AA for normal text (4.5:1 or better).

## Not tested (honest limits)

- No real phone, real Android, or real slow network. The 375 px checks are Chromium's mobile emulation.
- Lighthouse and INP were not measured for this build. No performance numbers are claimed.
- Screen readers were not tested. Labels, roles and focus outlines are in place; keyboard flow was not walked end to end.
- Saturday is the demo's quietest day (most plans skip it), so the kitchen screens look thin on Saturdays. Captured screenshots were taken on a Saturday.
- Payment flows record amounts only; no gateway was tested because none is connected.
- Data is in D1 on the live demo and is shared by everyone who uses the demo buttons.

## Verdict

Ready as a demo. Not ready for real orders: no payments, no notifications, one kitchen, no self-service account deletion.
