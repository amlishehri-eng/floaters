# Founders First design rules

The single source for how the site looks. **Recoloured on 21 Nov 2026 (section 2): the reference files predate the new palette; keep their layout, spacing and type, take every colour from this file.** The approved mockups are in `design/reference/` (one `.dc.html` file per page) and on the design canvas https://claude.ai/artifact/AozBmBhsAoZCm9xYMKpyK2. When this file and a reference file disagree, the reference file wins for layout and spacing, this file wins for rules.

## 1. Idea

The site is an observatory. Out of 1,259 faint signals, seven bright ones remain, and every page tells that story. It borrows Apple's web language: big confident type, lots of space, full-width sections that alternate black and light, specs laid out as label left and facts right. Futuristic comes from the wide type and the two signal colours, not from effects.

Spend boldness in two places only:
- the radar over the map of Germany in the home hero
- the three score rings (fit, team, timing) on the lead detail

Everything else stays quiet.

## 2. Colour

White and Stone are the primary colours; the rest support them. Tokens live in `app/ff.css` (`--ff-*`); `node scripts/contrast.mjs` checks every text/background pair.

| Token | Hex | Use | Contrast |
|---|---|---|---|
| `white` | `#ffffff` | Main page surface, about 60% of every page | |
| `stone` | `#8fa6b4` | Second primary: rules, bar and ring tracks (as `--ff-track`, Stone at 30%), hairlines (`--ff-hair`, 45%), quiet fills, radar rings and trace dots, beams of the early funnel stages. **Never text** | 2.54:1 on white, decoration only |
| `stone-deep` | `#4f6573` | Derived from Stone: captions and secondary text | **6.10:1 on white, 5.38:1 on Mist** |
| `mist` | `#f5f0e8` | Cards, panels, alternate bands, the radar's land | |
| `adriatic` | `#1a5276` | Links, primary buttons, data bars, the team ring, the radar sweep, focus rings | 8.36:1 on white, 7.37:1 on Mist; white on it 8.36:1 |
| `ink` (Harbour Ink) | `#0d2b3d` | All text; at most ONE deep band per page (home: "Top of today's list") | 14.68:1 on white, 12.94:1 on Mist; Mist on it 12.94:1, Stone on it 5.79:1 |
| `red` (Guest Red) | `#b4363b` | ONLY call-now markers: radar dots, the call-now funnel beam, the call-now chip and dot | 5.95:1 on white, 5.24:1 on Mist; white on it 5.95:1 |

Ratio on a page: about 60 white / 20 Stone / 10 Adriatic / 5 Ink / 5 Red.

Rules:
- **Guest Red means "call now" and nothing else, and never an area bigger than a chip.** The only larger red shape is the call-now beam on the funnel. Never red for errors, links, fail states or decoration.
- Status colours are not separate hues: pass = Adriatic, unknown = Stone deep text with a Stone dot, fail and high risk = Harbour Ink. The age hint and the "Why call now" panel are Mist.
- Funnel beams go Stone → Adriatic → Ink by stage (`#e3eaee`, `#c7d3db`, `#8fa6b4`, `#4f7891`, `#2f6385`, `#1a5276`, `#144461`, `#0d2b3d`: Stone and Adriatic tints and shades, numbers at least 4.74:1), call now is Guest Red.
- Rings: fit Harbour Ink, team Adriatic, timing Stone: they differ in lightness, not only hue.
- No black, no purple, no gradient washes. The only gradients are the radar sweep (conic, Adriatic fading to transparent) and the score rings (conic, solid colour).
- Halos (a soft ring of the same colour at low opacity) only on call-now dots and the call-now beam.
- Do not copy the all-caps tracked labels or middle-dot captions from the palette sheet the colours came from.

## 3. Type

One family: **Mona Sans** (variable, `wdth` 75–125, `wght` 200–900).
- Load it with `next/font/google` (`Mona_Sans`, `axes: ['wdth']`) if the installed Next version offers it (check `node_modules/next/dist/docs/` first). Otherwise use the Google Fonts css2 link: `https://fonts.googleapis.com/css2?family=Mona+Sans:wdth,wght@75..125,200..900&display=swap`.
- No second family, no monospace. Numbers use `font-variant-numeric: tabular-nums` on the page root.

| Role | Size / line-height | Weight | Width (`font-stretch`) | Tracking |
|---|---|---|---|---|
| Hero (home) | 88px / 0.98 | 800 | 125% | -3px |
| Top lead name (home) | 96px / 0.95 | 800 | 125% | -3.4px |
| Page title | 72px / 1.0 | 800 | 125% | -2.4px |
| Call list title | 56px / 1.02 | 750 | 125% | -1.6px |
| Section title | 48–56px / 1.04 | 750 | 118–125% | -1.2 to -1.6px |
| Lead name in detail | 52px / 1.0 | 750 | 125% | -1.4px |
| Card or row title | 30–32px / 1.05 | 750 | 118% | -0.6 to -0.8px |
| Big number | 40–72px | 700–800 | 112–118% | 0 |
| Sub-head | 21–26px | 650–700 | 100–112% | 0 |
| Lead | 19–21px / 1.45 | 400 | 100% | 0 |
| Body | 15–17px / 1.5 | 400 | 100% | 0 |
| Caption | 12–14px / 1.4 | 400–600 | 100% | 0 |

Rules:
- Sentence case everywhere. No all-caps labels, no eyebrow labels above headings.
- A headline may use a second line in a dimmer colour (`#6e6e73` on black) as a whole line, never one accented word.
- Lines of body text stay under about 80 characters (`max-width` 560–720px).

## 4. Layout

- Content width: `max-width: 1200px` (call list 1320px), side padding 28px, centred.
- Section rhythm: 88–120px vertical padding. Full-bleed sections alternate black and light.
- Top navigation on every page: sticky, 52–56px high, frosted (`backdrop-filter: saturate(180%) blur(20px)`), white at 0.82 on every page, Stone hairline bottom border. Wordmark "Founders First" left (700, 125% width). Links right, 13px: Call list, Funnel, Labs, Candidates, Method. The current page is Ink and 600, the others Stone deep.
- No sidebar.
- Specs layout for detail content: a grid of `200px | 1fr`, label left (17px, 650), facts right, separated by a hairline on top of each row, 22px vertical padding.
- Radius hierarchy: pills and buttons 999px, detail sheet 32px, portfolio tiles 28px, small panels 14–22px, bars 2–5px. Never one radius on everything.
- Shadow: only the detail sheet, `0 30px 60px -40px rgba(10,40,70,0.25)`. No other shadows except the glows in section 2.
- Responsive: everything wraps with flex `flex-wrap` / grid fallbacks; at 390px the call list stacks above the detail, spec rows become one column, the navigation wraps.

## 5. Components

**Buttons.** Primary: `#1d1d1f` background, white text, 999px radius, min-height 44–48px, padding 0 20–26px, weight 500–600. On black the primary is `#f5f5f7` with black text. Secondary: transparent with a `rgba(29,29,31,0.2)` border. Text links in ion-deep (light) or ion (black). No arrows appended to labels.

**Call-now marker.** 8–12px infrared dot with `box-shadow: 0 0 10–18px #ff5b3a`, then "Call now" in infrared text, 12px, 600.

**Lead row (call list).** Not a card: 18px padding, hairline bottom border, 18px radius, transparent; the selected row gets a white background. Name 18px/650/112% width, place line 13px muted, then days-ahead text (coloured by tone) and funding text, then "Fit / Team / Timing" with bold numbers.

**Score rings.** 104px circle, `conic-gradient(color X deg, track 0deg)` where X = score × 3.6, an 80px white inner circle with the number (26px, 700, 112%). Fit ring `#1d1d1f`, team ring `#0a6e99` (team on known criteria, sub-label "N of 8 known"), timing ring `#ff5b3a`. Each ring has `role="img"` and an `aria-label`.

**Why call now panel.** Background `#fff3ef`, 22px radius, 24–28px padding. Title with the infrared dot, reason in 17px, "Next step: …" below.

**Age hint.** `#fff7e8` panel, amber text, starts with "Check the age first."

**Bars.** Height 3–4px (criteria), 6–10px (backtest, gap score), track colour, fill ink (fit), ion-deep (team), ion (timing, gap score). Label left, "N of M" or "not known" right. "Not known" is grey `#9a9aa0` with an empty bar, never a zero that looks weak.

**HTGF check rows.** Label, then a 7px dot plus Pass / Fail / Unknown in the tone colour, then the evidence in muted text.

**Quotes.** 17px, 2px ion left border, 16px left padding.

**Funnel beam (funnel page, black).** One row per stage: label right-aligned, a centred pill bar 44px high whose width is the share of 1,259 (minimum 72px), cost on the right. Colours rise from `rgba(245,245,247,0.14)` through ion at rising opacity to solid ion for "deep-checked" and infrared with glow for "to call now".

**Radar (home hero).** The radar lives only inside the German border: its layer has the same box as the map and is clipped with `clip-path: polygon(...)` built from the border points. Inside it, a 740px circle with eight concentric ion rings (opacity 0.22 down to 0.1), two crosshair lines, and a conic sweep (`rgba(51,209,255,0.32)` fading to transparent over 70°) rotating once every 6 s. The sweep is the only animation on the whole site and stops under `prefers-reduced-motion: reduce`. The map of Germany is an SVG polygon (projection in `design/reference/home.dc.html`: x = (lon − 5.6) × 63, y = (55.2 − lat) × 100 in a 600 × 800 box), filled `rgba(51,209,255,0.05)`, stroked ion at 0.55. About 320 faint dots inside the border (white at 0.16–0.46, one in eight ion). The call-now teams are infrared glowing dots on their real cities with name and city labels; teams in the same city get stacked labels. Next to it, three big numbers: traces read (fog), past the gates (ion), worth a call (infrared-text). Decorative parts are `aria-hidden`; the section has an `aria-label` describing it.

**Home first screen.** At 1280×800, 1440×900 and 1920×1080 the headline, subline, both buttons, the whole radar (every border corner) and the three stats are visible without scrolling: two columns, text and stats left (headline `clamp(40px, min(4.6vw, 7.6vh), 84px)`), the radar right with its height from the viewport (`min(760px, 100svh − nav − 48px)`, 640:760). Below 900px it stacks. Order: first screen → "Top of today's list" (the one Harbour Ink band) → "The cheapest step runs first" → sources → backtest. The radar: Mist land, Stone border and rings, Adriatic sweep, Stone trace dots, Guest Red call-now dots with a soft halo.

**Briefing player.** "Play the briefing" plays the segments of `/api/briefing?format=segments` back to back (intro, one per call-now lead in call-list order, close). When a lead's segment starts, the call list selects it like a click (`?lead=` updates, the detail scrolls to its top, instantly under reduced motion). A slim bar fixed at the bottom shows the lead name ("Navou, 3 of 10"), the sentence as a caption, Previous lead, Pause/Play, Next lead, Stop; Esc stops; a hand click on a lead pauses.

**Outreach sheet.** "Draft outreach" (third button next to Good lead / Not a fit) opens a sheet from the right over the call list: To line (or "No email found, reach out on LinkedIn or the website"), editable subject and message, an English/German switch that redrafts, Copy, Open in mail (mailto), Open LinkedIn (when known), Mark as contacted. The row and the company page then say "Contacted 21 Nov" in Adriatic.

**Candidate cards.** Mist cards, 28px radius, 30px padding, min-height 220px, three per row: sector and city, the name, fit big ("72 fit"), "Marked good lead, 21 Nov", and for a lead brought back from the funnel one line "Brought back, filtered for: <reason>". A lead on the call list now gets the Guest Red chip "On the call list now". The whole card links to the company page; order: fit high to low, ties newest vote first.

**Fit dropdown.** Every fit and team row on the call list and the company page is a disclosure: the whole row is a button (`aria-expanded`, `aria-controls`), the bar itself never links out. The panel under the bar says in one or two sentences why the criterion got its points, shows up to two quotes (13px, 2px ion rule) and one "Source: <host>" link per source, the only links in the panel. Not known: "The sources say nothing about this yet, so it scores no points." The panel height opens in about 200 ms, no motion under reduced motion. Several rows may be open at once. Component: `components/ff/criteria-rows.js`, data from `bar()` in `lib/screen/call-list.js`.

**Funnel right column and report.** The right column shows only each stage's cost from the last run. Under the funnel one primary button, "See the full report", opens `/proof/funnel/filtered?stage=all`; the per-stage counts live in its stage switcher. "What the last run cost" carries the run's date and time; the all-time total is one sentence on the Method page.

**Filtered page.** Hero like Candidates ("Your shortlist.", best fit first), then a segmented stage switcher (links, `?stage=`, the current one white on the track colour), "Worth a second look" near-miss cards, the reason strip and the company grid.

**Reason strip.** One row per reason for the selected stage, biggest first: reason (16px, 600), count in ion-deep, a 4px ion count bar on the track, and one muted stat line from the data ("median 3 years 9 months since register"). A row is a link that filters the grid (`?reason=`); the current row is white, clicking it again clears the filter.

**Near-miss card.** Candidates card size (28px radius, 30px padding) in the paper grid, at most six, picked round-robin over the rules. The "missed by" line sits under the name in ion-deep, 15px, 600, then the reason sentence, the stats row and the footer ("Open profile", "Bring to the front"). A note under the heading says they are flagged by rule, not by a model.

**Stats row.** Three to five small figures under a hairline: label 12px muted, value 14px 600; fit as a 34px ring (ink on the track colour), "not known" in muted 400. Fit, team, age, funding (amount or status) and tech depth when scored.

**Bring to the front.** A primary button on light; after it: "On the candidates page" (a link) and an underlined "Undo". It is a vote ("up" with the reason sentence), never a verdict change; errors show next to it.

**Company page.** One lead in the call list's detail sheet, full width: header (place, name, verdict, "Visit the website", fit and team rings), then spec rows: About the company, Founders and team, Fit and team (with the fit dropdown), HTGF check, Age and register, Funding, Capital need, Why now, Deep checks, Research and labs, Sources, Feedback.

## 6. Pages

| Page | Route | Reference | Background |
|---|---|---|---|
| Home | `/` | `home.dc.html` | black hero and top-lead band, light sections between |
| Call list | `/proof/live` | `call-list.dc.html` | `#f4f6f9` with a white detail sheet |
| Funnel | `/proof/funnel` | `funnel.dc.html` | black |
| Labs | `/proof/labs` | `labs.dc.html` | `#f5f5f7` |
| Method | `/proof/methodology` | `method.dc.html` | white, black band, `#f5f5f7` backtest |
| Candidates | `/proof/candidates` (`/proof` and `/proof/portfolio` redirect) | `portfolio.dc.html` (tiles become candidate cards) | white, Mist cards |
| Company page | `/proof/company/[key]` | `call-list.dc.html` (detail sheet) | white, white sheet with a Stone hairline |
| Filtered | `/proof/funnel/filtered` (`?stage=`, `?reason=`) | `portfolio.dc.html` (cards), call list bars | white, Mist cards, nav current: Funnel |

Section order per page is exactly as in the reference file.

## 7. Data on screen

- Every column of the Leads table is either shown or on the internal list. Placement: `design/reference/field-map.dc.html`.
- Germany is a hard rule (HTGF check), never a fit criterion with points. Hide the `germany` row in the fit breakdown.
- A missing value shows its honest empty state: "not known", "Not checked yet. …", "No press found yet", "none named". Never invent a value and never show `null`.
- Numbers come from n8n (Leads, Labs, Backtest, `/api/funnel`), with a dated snapshot in `data/` as the fallback. The page says when the data is from.

## 8. Writing

- Plain words from the investor's side: "Call list", "Worth a call", "Why call now", "Next step", "Not known".
- Sentence case, active voice. Buttons say what happens: "Play the briefing", "Export memo", "Good lead", "Not a fit".
- No "A · B · C" meta strings, no "WORD — fragment" labels, no arrows in link text.
- Empty and error states say what happened and what comes next, in the interface's voice.

## 9. Accessibility

- Real `<button>` and `<a href>` elements, visible focus ring (2px ion-deep outline, 3px offset).
- Text contrast at least 4.5:1 (captions included). Ion `#33d1ff` is never text on light backgrounds; use `#0a6e99`.
- Touch targets at least 44px.
- Rings and the radar have text alternatives.
- `prefers-reduced-motion` stops the radar sweep.

## 10. Don't

- No sidebar, no purple, no Geist, no monospace labels.
- No identical rounded cards for everything; content lives in sections and spec rows.
- No fade-in or slide-up animations on scroll, no hover animations on cards.
- No decorative gradients or emoji.
