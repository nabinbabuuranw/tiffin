# Tiffin: design notes

## Direction

"Stacked Tiers": a steel tiffin with three tiers and a lid handle is the mark and the hero art. Each tier is a part of the product:
the menu is a week of tiers, the plan is a stack of meals, the route sheet is a stack of stops. The kitchen desk is a ruled
ledger with numbered sections (01 Today, 02 Menu, 03 Subscribers, 04 Routes, 05 Settings). Warm paper, not white; plum for
action; saffron for emphasis; chilli and teal only where they carry meaning (non-veg and veg marks, delivered and cancelled states).

Dark mode is not offered. Light only, one theme.

## Palette (Coolors, one fresh palette for this project)

- Source: https://coolors.co/5f0f40-9a031e-fb8b24-e36414-0f4c5c (Coolors popular list, read 2026-11-06).
- Source colours: #5F0F40 plum, #9A031E chilli, #FB8B24 saffron, #E36414 burnt orange, #0F4C5C deep teal.
- Not used by Palo, Chukta, Kotha, Basta, Sahakari or NEXA; the palette log has the entry.
- DEVIATION, stated plainly: Nabin's standing rule asks for a pick from his logged-in Coolors account. This pick was made from
  the public popular list read in a browser without logging in, the same route Day 5 took. The tokens live in one file
  (`src/styles.css` and `palette.json`) and can be re-picked on his account.

Tokens and contrast (WCAG 2.x, computed):

| Pair | Ratio | Text AA |
|---|---|---|
| ink on paper | 16.06 | pass |
| ink on surface | 17.01 | pass |
| muted on paper | 6.18 | pass |
| muted on surface | 6.54 | pass |
| paper on plum (primary button) | 12.23 | pass |
| plum on paper | 11.81 | pass |
| ink on saffron (accent button) | 7.36 | pass |
| ember text on paper | 5.97 | pass |
| teal on paper (veg) | 8.71 | pass |
| chilli on paper (non-veg) | 7.99 | pass |
| ember text on saffron-soft (today) | 5.48 | pass |
| muted on saffron-soft (today row) | 5.67 | pass |
| muted on sunk (skipped, pills) | 5.53 | pass |

## Type

- Display: Young Serif (one weight, Latin and Latin-ext; a warm, slightly literary serif for headings and big numbers).
- Text: Hanken Grotesk Variable (grotesk with tabular figures used for every amount and date).
- Nepali: Noto Sans Devanagari, for the Nepali names of dishes and plans.
- Fonts are self-hosted from the package, not loaded from a font CDN. CSP allows `font-src 'self' data:`.

## Motif and components

- Tier mark: three stacked rounded rectangles under a lid handle; the bottom tier is filled plum.
- Veg and non-veg: a square outline with a dot inside (teal for veg, chilli for non-veg), drawn in CSS. Not an emoji and not a stock icon.
- Calendar: a ruled list of 21 days; each row shows the day, the meal, and one state (Scheduled, Paused, Delivered, On the way, Locked).
- Route sheet: numbered stops with status buttons (Out, Delivered, Skipped) and up/down reordering.
- Pills are square-cornered labels in uppercase, not rounded chips.
- Radius 4 px on controls and 6 px on panels. No shadows. Notices have a 3 px left rule (notices only, not cards).

## Layout

- Landing: hero with the tier art, a week strip of seven day columns (stacked on phones), plans as ruled rows (not three price cards),
  four numbered steps, and a question list.
- App: a left rail with numbered sections on desktop; a bottom bar on phones.
- Forms: one column; the plan form has a summary panel beside it on desktop.

## Motion

- Hero tiers drop in once, staggered (about 500 ms). Skeletons shimmer while data loads. Everything respects
  `prefers-reduced-motion` (animations drop to 1 ms).
- No scroll-triggered effects, no parallax, no hover animations on every element.

## Skills and workflow (what was and was not done)

- UI UX Pro Max: run with `search.py "subscription tiffin meal delivery Nepal kitchen customers weekly menu" --design-system -p Tiffin`.
  Its suggestion (red and gold, Playfair Display SC with Karla) was read as a cross-check and not used. Its pre-delivery checklist
  was checked (focus states, reduced motion, 375/768/1024/1440 px, 4.5:1 text).
- 21st.dev: not run for this build. No component was taken from it.
- Coolors login: not done (see deviation above).
- Unslop, taste-skill, design-md-library and humanizer were read as rules for copy and layout: copy avoids em dashes and
  "not X, it's Y" phrasing; no testimonials or invented stats; labels and marks are hand-drawn; the 30-point audit is in AUDIT_30.md.

## Copy rules applied

- English only in UI and docs; Nepali only in dish and plan names and the brand's Nepali tagline.
- No em dashes in the UI. Demo labels appear wherever data is invented (menu, kitchen name, customers).
