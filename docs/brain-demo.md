# Screening demo (3 minutes, draft)

The screening part of the live demo: from "we read everything public" to "call this team this week".
Draft for Meto's `docs/pitch.md`. Numbers in `{{…}}` are filled after the Final run (STATUS.md → Final run), from the route named in the placeholder.

**Before going on stage (5 min earlier)**
1. `npm run dev` is running on :4000 with `USE_MOCKS=false`.
2. `node scripts/demo-check.mjs`: every row PASS. It also warms the briefing audio cache (the `briefing audio` row), so the spoken briefing starts instantly on stage.
3. Note which rows say `mocked: true`. If `leads` is mocked, flow "20 Leads for the screen" is not published (Amli); say "snapshot from tonight's run" instead of "live" on stage.
4. Open three tabs: `/proof/live`, `/api/funnel` (or the slide with its numbers), `/api/briefing?format=audio`.
5. Dead wifi plan: restart with `USE_MOCKS=true npm run dev`. Everything below then runs on `data/` (leads, funnel snapshot, briefing script and mp3). The screen says "Showing demo leads".

## Step 1 (0:00–0:40): the funnel, why this scales
**Click:** nothing yet, or the funnel slide / `/api/funnel`.
**Say:** "Tonight our engine read {{traces_in from /api/funnel}} public traces from {{source count}} kinds of sources: demo days, university spin-off lists, job ads for first hires, GitHub, pitch podcasts. Code throws out {{stage0_skipped from /api/funnel}} without spending a cent: too old, agencies, investors, events only. A small model reads the rest, {{read_by_mini from /api/funnel}} so far, for about {{cost.per_trace_read_usd from /api/funnel}} each. That left {{leads from /api/funnel}} teams, {{survivors from /api/funnel}} passed every HTGF gate, and {{call_now from /api/funnel}} are worth a call now."
**Number on screen:** the funnel stages from `/api/funnel` → `stages[]` (`traces_in`, `stage0_skipped`, `read_by_mini`, `leads`, `survivors`, `call_now`) and `cost.per_trace_read_usd` / `cost.per_call_now_usd`.
**If it fails:** `/api/funnel` falls back to `data/funnel.sample.json` after 8 s (`mocked: true`, its own `as_of`). Say "numbers from tonight's run at {{as_of from data/funnel.sample.json}}".

## Step 2 (0:40–1:40): the top lead, evidence per criterion
**Click:** `/proof/live` → the top lead in the review queue (today: {{top lead name, from /api/briefing leads[0]}}).
**Say:** "This is {{top lead name}}: {{what, one line}}. We did not take a model's word for it. Every point of the fit score points to a trace: {{criterion 1}} because of {{quote, trace}}, {{criterion 2}} because of {{quote, trace}}. Fit {{fit_score}}, team {{team_score_known}} on what the evidence actually tells us."
**Number on screen:** fit score and team strength on the lead card; the evidence quotes under "Sources".
**Gap today:** the live card does not show points per criterion yet. `lib/n8n.js` `getLeads()` does not pass `fit_breakdown` / `team_breakdown` to the dashboard (see STATUS.md, Blocked: "live profile ratings need the Leads feed to expose each criterion's points"). Until that lands, show the criterion table from the n8n Leads row (`fit_breakdown`: points, why, trace_id) on a slide.
**If it fails:** `/proof/live` shows the demo leads with the banner "Showing demo leads" (fallback in `getLeads()`, `data/proof-leads.json`). Walk through the same card on a demo lead and say it is the format, then show the real lead's slide.

## Step 3 (1:40–2:20): days ahead, the earliness proof
**Click:** the "Public mention" / "Still invisible" badge on the lead card; then one lead that is still invisible.
**Say:** "We found {{lead with the largest days_ahead}} {{days_ahead}} days before the first press article. {{a still-invisible lead}} has no press at all, {{days since first trace}} days after our first trace. That is the window in which HTGF is the first investor to call."
**Number on screen:** `days_ahead` and `first_public_at` on the card. Top numbers come from `/api/briefing?format=json` → `leads[].days_ahead`, `still_invisible`.
**Honest note for Q&A:** for some leads the press was first (negative `days_ahead`, e.g. OmicsDiscoveries −98 on 20 Nov). We show them anyway; they rank by HTGF fit, not by luck.
**If it fails:** the numbers are in the briefing sample (`data/briefing.sample.json` → `by_lang.en.leads`).

## Step 4 (2:20–3:00): the spoken briefing
**Click:** play `/api/briefing?format=audio` (or Meto's "Play briefing" button). Subtitles: `/api/briefing?format=json` → `segments[]` in speaking order.
**Say (before):** "And because a partner reads nothing at 7 a.m.: the top five, spoken." Then let it play (about {{est_seconds from /api/briefing?format=json}} seconds; cut after lead 2 if time is short).
**What plays (20 Nov, live data):** "We read 1,259 public traces, 153 became leads, 25 passed every gate, and 1 is worth a call now. Today's top 5. Number one: OmicsDiscoveries, Munich. …" (full text in `data/briefing.sample.json`).
**If it fails:**
- ElevenLabs down or slow (20 s limit on a first render): the route serves `data/briefing.sample.mp3` with header `X-Mocked: true`; subtitles then from `/api/briefing?format=json&source=sample`.
- No sample mp3 either: the route answers JSON with the script; the button speaks it with the browser's `speechSynthesis`.
- Everything dead: read the first two leads from the script yourself.

## Fallback summary
| What | Live source | Fallback | Signal |
|---|---|---|---|
| Funnel numbers | n8n "44 Funnel stats" via `/api/funnel` | `data/funnel.sample.json` after 8 s | `mocked: true`, `n8n_error` |
| Lead cards | n8n "20 Leads for the screen" via `getLeads()` | `data/proof-leads.json` after 10 s | banner "Showing demo leads" |
| Briefing script | Leads + funnel webhooks via `/api/briefing` | `data/briefing.sample.json` after 8 s | `mocked: true`, `source: "sample"` |
| Briefing audio | ElevenLabs, cached in `data/briefing-cache/` | `data/briefing.sample.mp3`, else script for `speechSynthesis` | header `X-Mocked: true` |
| Thumbs up/down | n8n "42 Feedback" via `/api/feedback` | `data/feedback.local.json` after 8 s | `mocked: true` |
