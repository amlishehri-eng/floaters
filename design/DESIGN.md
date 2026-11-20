# Founders First design rules

The single source for how the site looks. The approved mockups are in `design/reference/` (one `.dc.html` file per page) and on the design canvas https://claude.ai/artifact/AozBmBhsAoZCm9xYMKpyK2. When this file and a reference file disagree, the reference file wins for layout and spacing, this file wins for rules.

## 1. Idea

The site is an observatory. Out of 1,259 faint signals, seven bright ones remain, and every page tells that story. It borrows Apple's web language: big confident type, lots of space, full-width sections that alternate black and light, specs laid out as label left and facts right. Futuristic comes from the wide type and the two signal colours, not from effects.

Spend boldness in two places only:
- the radar over the map of Germany in the home hero
- the three score rings (fit, team, timing) on the lead detail

Everything else stays quiet.

## 2. Colour

| Token | Hex | Use |
|---|---|---|
| `void` | `#000000` | Dark sections: home hero, funnel page, top-lead band, call-now band on Method, matched portfolio tile |
| `paper` | `#f5f5f7` | Light page background (call list `#f4f6f9`) |
| `white` | `#ffffff` | Detail sheet, Method page, backtest section |
| `ink` | `#1d1d1f` | Text on light, primary button background |
| `ink-2` | `#3a3a3f` / `#4a4a4f` | Body text and secondary text on light |
| `muted` | `#6e6e73` | Captions on light (passes 4.5:1 on white) |
| `fog` | `#a1a1a6` / `#86868b` | Body and captions on black |
| `mist` | `#f5f5f7` | Text on black |
| `ion` | `#33d1ff` | Signal and data: bars, radar, sweep, quote rule, links on black. Graphics only on light backgrounds |
| `ion-deep` | `#0a6e99` | Ion as text or bar on light (links, team ring, gap score) |
| `infrared` | `#ff5b3a` | Call now only: dots, glow, timing ring, last funnel bar |
| `infrared-text` | `#d93d1e` on light, `#ff8a70` on black, `#b8321a` on the pale call-now panel | Call-now text |
| `pass` | text `#1b7a4b`, dot `#2fbf71` | HTGF check pass, low risk |
| `amber` | text `#9a5b00` / `#7a4a00`, panel `#fff7e8` | Medium risk, age hint |
| `track` | `#e8ecf2` / `#eef1f6` / `#e3e7ee` | Empty part of bars and rings |
| `hairline` | `rgba(29,29,31,0.08–0.12)` on light, `rgba(255,255,255,0.08–0.1)` on black | Dividers |

Rules:
- Infrared means "call now" and nothing else. Never use it for errors, links or decoration.
- Ion means signal or data. Do not use it as a generic accent.
- No purple, no gradient washes as decoration. The only gradients are the radar sweep (conic, ion) and the score rings (conic, solid colour).
- Glow (`box-shadow` in ion or infrared) only on: call-now dots, the last two funnel bars, the radar points.
- Colours that must be told apart also differ in lightness (black fit ring, deep ion team ring, infrared timing ring).

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
- Top navigation on every page: sticky, 52–56px high, frosted (`backdrop-filter: saturate(180%) blur(20px)`), `rgba(0,0,0,0.72)` on dark pages, `rgba(245,245,247,0.78)` or white at 0.78 on light pages, hairline bottom border. Wordmark "Founders First" left (700, 125% width). Links right, 13px: Call list, Funnel, Labs, Portfolio, Method. The current page is ink/white and 600, the others `#4a4a4f` / `#d2d2d7`.
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

**Portfolio tiles.** White, 28px radius, 30px padding, min-height 220px. A company our engine matched as portfolio is the one black tile, with an ion dot and "Found by our engine and marked as portfolio".

## 6. Pages

| Page | Route | Reference | Background |
|---|---|---|---|
| Home | `/` | `home.dc.html` | black hero and top-lead band, light sections between |
| Call list | `/proof/live` | `call-list.dc.html` | `#f4f6f9` with a white detail sheet |
| Funnel | `/proof/funnel` | `funnel.dc.html` | black |
| Labs | `/proof/labs` | `labs.dc.html` | `#f5f5f7` |
| Method | `/proof/methodology` | `method.dc.html` | white, black band, `#f5f5f7` backtest |
| Portfolio | `/proof` | `portfolio.dc.html` | `#f5f5f7` |

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
