# Tiffin

Subscription tiffin manager for Nepali tiffin and cloud kitchens: a weekly menu, customer subscriptions with a plan and a route, pause days with a cut-off, a route sheet for the rider, and a manual ledger for cash and bank-transfer payments.

- Live demo: https://tiffin.sites.tab.bot/
- Repository: https://github.com/nabinbabuuranw/tiffin (MIT)
- Day 6 of the 100 Platforms series. Demo data only; see "Limits".

## Two ways in (both demo accounts, no password)

- Customer app: "Open the customer app (DEMO)". A subscriber with a plan, a pause and a short payment history.
- Kitchen desk: "Open the kitchen desk (DEMO)". Seven subscribers on three routes, a weekly menu, the route sheet and settings.

Or sign up as a new customer and start a plan from the app.

## What it does

Customers: pick a plan (Sunday to Friday, Sunday to Thursday, or every day), veg or veg and non-veg, a route, an address and an optional phone. Pause or resume any day up to the cut-off the evening before, or pause a run of days in one go. See the next three weeks with the day's dish. Cancel. See the balance and payments.

Kitchen: see today's count to cook (veg and non-veg), deliveries in progress, pauses, collected and owed amounts. Edit the week's menu (up to six dishes a day, Nepali names optional). Browse subscribers, move a subscriber between routes, stop or restart a plan, record a cash or bank-transfer payment. Work the route sheet: mark stops out, delivered or skipped, reorder stops, print.

## Stack

- App: React 18, Vite, TypeScript, plain CSS with design tokens (no CSS framework, no icon library).
- Fonts: Young Serif, Hanken Grotesk Variable, Noto Sans Devanagari, all self-hosted from packages.
- API: one Cloudflare Worker over D1 (the `DB` binding), serving `/api/*` and the single-page shell; static files come from the `ASSETS` binding.
- Auth: PBKDF2-SHA256 password hashes (100,000 iterations), server-side sessions keyed by a SHA-256 of the token, HttpOnly/Secure/SameSite=Lax cookie, 14 days.
- Time: Nepal Time (UTC+05:45) for every date rule. The cut-off hour is set by the kitchen (12:00 to 23:00, default 20:00).

## Repository layout

```
api/src/worker.ts      Worker: routes, auth, validation, seed
api/src/schema.ts      D1 schema and the demo seed data
api/src/crypto.ts      PBKDF2 and token helpers (WebCrypto)
api/test/              node:test suites (logic and API), D1 stand-in over node:sqlite
shared/logic.ts        scheduling, pause lock, billing (used by the Worker and the tests)
src/                   React app: pages, shell, router, API client, messages
api/build.mjs          bundles the Worker and writes tab-site.json (D1 binding)
```

## Run it

```
npm install
npm test            # 23 tests (logic and API)
npm run build       # typecheck, vite build, Worker bundle into dist/site
```

Publishing is a folder upload of `dist/site`; `tab-site.json` declares the Worker entry and the `DB` binding.

## API (summary)

Public: `GET /api/health`, `GET /api/plans`, `GET /api/menu`, auth routes (`/api/auth/register|login|logout|me|demo`).
Customer (`/api/me/*`): `GET|PUT /subscription`, `POST /subscription/cancel`, `POST|DELETE /pauses`, `GET /billing`.
Kitchen (`/api/kitchen/*`): `GET /overview`, `GET|PUT /menu`, `GET /subscribers`, `GET|PATCH /subscribers/:id`, `GET /routes`,
`POST /routes/:id/order`, `POST /deliveries`, `POST /payments`, `GET|PUT /settings`.

Every mutating request must be JSON; errors come back with a closed code (for example `date_locked`), which the app turns into a sentence.

## Limits (stated, not hidden)

- Demo only. No orders are taken, no money moves, no SMS or email goes out.
- Payments are manual entries by the kitchen (cash or bank transfer). No gateway. eSewa and Khalti are not connected.
- One kitchen per deployment. The demo kitchen can be changed by anyone who uses the demo.
- Demo menu, prices, areas (Route A, B, C, labelled demo areas), addresses and customers are invented.
- Dates are shown in the Gregorian calendar only. Bikram Sambat is not shown yet.
- No self-service account deletion; the Privacy page says to email hello@tab.bot.
- Plan price changes apply to every delivery the plan has, not from a date.
- Cancelling stops deliveries from that moment, including a delivery already out.
- Not tested on a real phone or a slow network. See QA_REPORT.md.
