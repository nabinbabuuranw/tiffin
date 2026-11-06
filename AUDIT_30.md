# 30-point anti-AI UI audit: Tiffin (Day 6)

Method: each point checked against the built CSS, the components and the rendered pages at 375, 768 and 1440 px
(local copy and live site). "Pass" means the point is absent or handled on purpose. Notes say where a point is partly present.

| # | Point | Result | Note |
|---|---|---|---|
| 1 | Harsh gradients | Pass | No gradients in the UI. Skeletons use a light sweep only. |
| 2 | Pure white backgrounds | Pass | Page is warm paper #FBF4EA. Surface #FFFBF5 is near-white and used only inside panels. |
| 3 | Rainbow coloring | Pass | Five source colours; each has one job (plum action, saffron emphasis, chilli non-veg, teal veg and delivered, ember for numbers). |
| 4 | Heavy drop shadows | Pass | No box shadows. |
| 5 | Liquid glass | Pass | No blur, no translucency. |
| 6 | Generic purple and black | Pass | Plum is paired with warm paper and saffron, and there is no black. |
| 7 | Radial orbs | Pass | None. |
| 8 | Excessive neon | Pass | None. |
| 9 | Basic pastel palettes | Pass | Deep plum, chilli and teal, with saffron as accent. |
| 10 | Default icon library | Pass | No icon library. Tier mark and veg/non-veg marks are drawn in CSS and SVG. |
| 11 | Emojis as UI icons | Pass | None. |
| 12 | Default Inter, Geist or Space Grotesk | Pass | Young Serif, Hanken Grotesk, Noto Sans Devanagari. |
| 13 | Sparkle icons | Pass | None. |
| 14 | Animated arrows | Pass | Arrows are text ("Up", "Down", "Previous", "Next"). |
| 15 | Hover animation on every element | Pass | Hover changes background or colour only, on buttons and nav. |
| 16 | Repetitive three-feature cards | Pass | Landing uses a numbered ruled list for the process and ruled rows for plans. |
| 17 | Coloured left stripes on cards | Pass (notices only) | Notices have a 3 px left rule. Panels and cards have none. |
| 18 | Repetitive bento grids | Pass | Kitchen overview is a three-column stat row with one wide panel; no bento. |
| 19 | Terminal mockups | Pass | None. |
| 20 | Generic three-tier pricing | Pass | Plans are ruled rows with the day strip and price, not three tier cards. |
| 21 | Soft rounded corners everywhere | Pass | Radius 4 px controls, 6 px panels, square pills. |
| 22 | Dot-grid backgrounds | Pass | None. |
| 23 | Excessive em dashes | Pass | Checked: no em dash in any UI string, doc or component. |
| 24 | "It's not X, it's Y" copy | Pass | Checked by reading the UI copy; none found. |
| 25 | Checkmark bullet lists | Pass | Lists are plain or numbered. |
| 26 | Fake testimonials | Pass | None. No reviews, ratings, customer counts or revenue. |
| 27 | Missing real product demo | Pass | The customer app and kitchen desk are working flows on seeded demo data, labelled DEMO. |
| 28 | Missing skeleton loaders | Pass | Skeletons on the menu, plan, billing, kitchen overview, route sheet and subscribers. |
| 29 | Missing Terms of Service | Pass | /terms, short and plain, labelled as a demo. |
| 30 | Missing Privacy Policy | Pass | /privacy, states what is stored and how to delete. |

Result: 30 of 30 pass, with notes on points 2, 17 and 23 above. The audit was done by reading the code and the rendered pages, not by a
second tool.
