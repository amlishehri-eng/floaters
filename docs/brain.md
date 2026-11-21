# The brain (Person 2)

## Live pipeline in n8n

This is what runs. Project **HTGF** on floaters.app.n8n.cloud; tables Traces `crxSUMWXcPfMrXt4`, Leads `CmDqydXaXEK5mg6F`. One rule: code first, then gpt-5-mini, the strong model (gpt-5.5) only for the few leads that matter. Model credential everywhere: "OpenAI Team Key". Amli's **00 Run all** only has to call **10** at the end; everything below is chained.

| Step | Flow (id) | What | Model | Cap per run | Cost |
|---|---|---|---|---|---|
| 1 Thin rescue | 14 Enrich thin traces `PiwnuWhQvsKsYUGB` | traces that are only a name and have a website: robots.txt, home page, Impressum (legal form, register, managing directors, city, country), 1 request / 2 s; no site = `thin_no_site` | none | 40 sites | 0 |
| 2 Stage 0 | 10 Make leads `jLWKNwEC08SHfAfP` | code rules: unreadable/thin, duplicate, event only, investor/ecosystem org, agency, assignment, established company (succession prizes), too old (> 3 years), not Germany | none | all new traces | 0 |
| 3 Stage 1 | 10 Make leads | one trace at a time: lead type, people, quotes, funding, points per criterion (tech_depth anchored 0–5 / 6–14 / 15–25, team `known`); 10 requests in parallel over HTTP | gpt-5-mini | 100 traces | ≈ $0.003 per trace |
| 4 Merge | 10 Make leads + 16 Merge duplicate leads `DogDSN2JZaEWnUON` | same lead_key; website host, register number, name root + city/person, person + affiliation; close names to the model | gpt-5-mini (close names only) | all | ≈ $0 |
| 5 Days ahead | 11 Days ahead `adcNukRVwIHJHONh` | Brave news search + judge: first editorial mention (no own site, listings, databases) → `first_public_at`, `days_ahead` | gpt-5-mini | 20 leads | ≈ $0.001 per lead |
| 6 Register | 12 Registry check `gYc6PMjzMDMYAwjc` | handelsregister.ai: registered, legal form, investor shareholders, capital increase, founder's earlier companies | none | 5 survivors (≈ 16 credits per matched lead) | credits |
| 7 Verdict | 13 Classify leads `pqLJklAO79NPAGa4` | gates in code: not_a_lead, not_a_startup, too_late (funding found / older than 3 years), out_of_scope, not_high_tech (tech_depth < 15), then needs_enrichment / call_now (fit ≥ 70, team_score_known ≥ 60) / watchlist; unsupported criteria count 0 | none | all leads | 0 |
| 8 Scoring | 15 Score leads `6fSUcccfgSt5h58T` | survivors + gray zone (tech_depth 10–14), only when the evidence changed: all evidence at once, points per criterion with `evidence` [{trace_id, url, quote}] checked in code, anti-signals, timing | gpt-5.5 | 10 leads (5 during package 4 tests) | ≈ $0.09 per lead |
| 9 Deep checks | 17 Deep checks `JcqOQLvpgh9CNa4b` | top 30 call_now/watchlist with changed evidence: GitHub bus factor/commitment, domain age (RDAP, crt.sh), web search for flight risk / IP / competitors / funding / HQ, Series A risk for the top 10, intro path from the HTGF portfolio (code only) | gpt-5-mini + web search; gpt-5.5 top 10 | 10 leads (5 during package 4 tests) | ≈ $0.05–0.15 per lead |
| 10 Verdict again | 13 | deep-check gates (investor money → too_late, HQ abroad → out_of_scope), flight risk adds priority | none | all | 0 |

Order of one run of 10: 14 → stage 0 → stage 1 → merge → 16 → 11 (→ 12) → 13 → 15 → 13 → 17 → 13.

Around it:
- **40 Lab gap** `ssXskgf3ZjosRanr` (daily 06:00): institutions and TUM research fields with many OpenAlex works in HTGF fields and few spin-offs we know → table **Labs**; gpt-5-mini writes "why visit" for the top 10.
- **41 Blind backtest** `Tno68Cy081sQ5Q9a`: HTGF portfolio companies on their earliest Wayback snapshot (blinded in code) vs random processed traces, through the same stage 0 / stage 1 / Shape / 13 code → table **Backtest**.
- **42 Feedback** `4NvaofydeNfFZaQ1`: `POST /webhook/htgf-feedback` ← `/api/feedback` → table **Feedback**; `GET /webhook/htgf-feedback` → every vote `{ as_of, votes: [{ lead_key, vote, reason, created_at }] }` for the Candidates page (`getCandidates()` in `lib/n8n.js`; latest vote per lead wins, "up" = candidate). **43 Calibration** `H89AIsfbEkdXFET9` (Mondays): up- vs down-voted leads per criterion → proposal in **Calibration** (never changes a weight).
- **44 Funnel stats** `uXusnZJq4EuW303i`: `GET /webhook/htgf-funnel` → `/api/funnel` (counts per stage, cost per stage from **Run costs**, per trace, per call_now lead).
- **46 Screen extras** `qyIgfO2oAjk2szm0`: `GET /webhook/htgf-screen-extras` → `/api/extras` (Labs top 10 by gap_score, summary of the latest Backtest run), for `/proof/labs`, `/proof/methodology` and the home backtest band. Read-only.
- Test helpers: 18 Calibrate `Q00KDMeS9bbjb6ki`, 19 Reset test traces `dWvlW57gLVfClgcF`.

## How the screen reads n8n

- `lib/n8n.js`: `getLeads()` (flow 20, `N8N_LEADS_URL`), `getFunnel()` (flow 44), `getExtras()` (flow 46). Each waits at most 8 s, then falls back to its snapshot in `data/`. Results are cached in the server process for 60 s (15 s for a fallback), so clicking between pages does not refetch; Next's own fetch cache is not used because it refuses entries over 2 MB and the Leads payload is far bigger.
- Every page that shows numbers says where they come from: "Live from n8n, as of <time>." or "Snapshot from <time>, n8n not reachable." (`sourceHint` in `lib/screen/format.js`). Home and call list count call-now teams from the same leads they show.
- `/api/briefing`: with flow 20 down, the script is built from the Leads snapshot (+ funnel snapshot) and still spoken by flow 45 (`X-Briefing-Source: snapshot`, `X-Mocked: true`).
- **Candidates** (`/proof/candidates`): `getVotes()` reads flow 42's GET through Next's cache (`unstable_cache`, tag `candidates`, 60 s); `/api/feedback` calls `revalidateTag("candidates", { expire: 0 })` after every saved vote, so a "Good lead" shows on the page at the next visit. n8n down: the votes kept in `data/feedback.local.json`.
- **Funnel definitions** (`honestFunnel` in `lib/screen/funnel.js`): flow 44 for traces, code filter, small model and teams, and for every cost. From there down, from the Leads rows (live leads, not `merged_into:*`), each a subset of the one above: past the HTGF gates = scored (`score_version` 2) or now call_now / watchlist / needs_enrichment; scored = `score_version` 2; still standing = scored and not moved to too_late / out_of_scope / htgf_portfolio later (age and funding check 35, 13 v8.1); deep-checked = still standing with `deep_checked_at`; to call now = verdict call_now. The code checks every stage ≤ the one above and drop-outs + next = this stage (throws in development, shows the mismatch in production). Flow 44's own "survivors" (today's verdict) and "scored_v2" (every scored lead) are different sets, which is how it showed 284 scored > 279 past the gates. With the Leads snapshot (n8n down) the filtered page is off and the lower stages show flow 44's counts, said on the page.
- **Filtered page** (`/proof/funnel/filtered`, `lib/screen/filtered.js`): every lead that stopped after the HTGF gates, from `lowerFunnel()` / `dropReason()` (same stages and counts as the funnel), with one plain reason sentence (register date, disclosed amount, lead investor, tech depth, fit), a stats row and the reason strip (`?stage=`, `?reason=`). Needs the live Leads table; on the snapshot it says so. **Near-miss rules** (code, not a model; first match wins, shown round-robin over the rules, at most six): (1) older than three years by an exact register date and at most 6 months over the limit ("Missed the age limit by 4 months"); (2) stopped for raising €3M or more with a disclosed €3M–€4M ("€3.4M, just over the line"); (3) stopped for fit below 55 with a strong-model fit of 50–54 ("Fit 53, call now starts at 55"); (4) stopped by a hard gate (age, funding, VC round, sector, Germany, high-tech) with fit 65 or more, or with a known-team score in the top quarter of all scored leads ("Fit 66, stopped by the age check"). A founding year alone never counts as a near miss on age (not exact). **Bring to the front** = `POST /api/feedback { vote: "up", reason: "brought back from the funnel: <sentence>" }`, Undo = `vote: "down", reason: "undo bring to the front"`; the verdict in n8n never changes. Candidates and the company page read the reason and show "Brought back, filtered for: …".
- **English everywhere** (`lib/ai/translate.js`): the Leads table carries German from the sources. Every visible free-text field of a lead (what, reasons, people roles, quotes, funding evidence, co-investors, deep-check notes, and the why/quote/claim texts inside the breakdowns, eligibility, capital need and age check) is checked by a cheap German detector; the German ones go to gpt-5-mini in ONE structured call per lead (names, company, court and programme names kept). Cache: `data/translations.json` (committed, so the demo works offline), keyed by lead_key + field path + a hash of the source text, so a changed source is translated again. `getLeads()` lays the cache over each raw row before it becomes a screen lead; call-now leads and a company page translate anything still missing on the server (8 s, else the original and a log line). `node scripts/translate-leads.mjs` translates every lead past the HTGF gates plus candidates and call-now leads (first run 21 Nov: 262 leads, 1,584 texts, $0.31; second pass for German quotes inside English sentences and co-investors: $0.035). `refresh-leads-snapshot.mjs` calls it for new leads. The company page notes "Translated from German." under translated quotes.
- **Briefing segments** (`/api/briefing`, `buildSegments` in `lib/voice/briefing.js`): `?format=segments` → `{ segments: [{ lead_key | null, name, text }] }` = an intro, one segment per call-now lead in call-list order (the same `getLeads()` order and English text), a close. `?format=audio&segment=<i>` → that segment's audio through flow 45, cached on disk per text hash (`data/briefing-cache/`, gitignored), so ElevenLabs is never paid twice for the same sentence (log: "segment <i> cache hit (… characters, no ElevenLabs call)"). Text to speech down: JSON with the text, and the screen speaks it. The single-file `?format=json|audio` mode is unchanged.
- **Outreach** (`POST /api/outreach { lead_key, language }`, `lib/ai/outreach.js`): gpt-5.5 (low effort, up to 45 s, about 5 to 12 s, $0.013 to $0.034 per draft, logged as `[outreach] <company> (<lang>): gpt-5.5, <words> words, $<cost>`) writes a first email from an HTGF investment manager to the founders. Founders = people with a founder role, the register's managing director (age_check quote) and the name that opens the technical_founder sentence; never mentors or pilot customers. Input = only the lead: what, founders with what the team criteria say about them, the two strongest fit criteria (capital need excluded, it is our inference) with facts, quotes and source, research or patent with the IP evidence, corporate pull, where we found them and whether the press has, HTGF fit notes (funding, founding year, capital need, next step, intro path), two time slots next week (Tuesday 10:00, Thursday 15:00) and the sender. Structure: greeting by first name (or "Hi <company> team"), one specific observation, why it matters (real pull), one line on who writes and why HTGF (earliest stage, first ticket at seed, follow-on, corporate and research network), the 20-minute ask with the two slots or "reply with a time", sign-off. German is its own prompt ("Sie", "Guten Tag <full name>", not a translation). Code checks every draft: dashes and exclamation marks replaced, 90 to 140 words, no buzzwords; a draft that fails goes back to the model once with the exact fix, a second failure falls back to the template. Returns `{ to_name, founders, to_email | null, website, linkedin | null, subject, subjects[3], body, words, model, cost_usd }`; the template in code has the same structure (`mocked: true`, `error`; `test_fallback: true` forces it). Sender from `OUTREACH_SENDER_NAME` / `OUTREACH_SENDER_TITLE`. `POST /api/outreach/contacted { lead_key, channel }` -> `data/outreach.local.json` (gitignored); the call list row and the company page show "Contacted 21 Nov". The dialog (`app/proof/live/outreach-sheet.js`): centred, max 680 px, focus trap, Esc, three subject chips, auto-growing message, sticky actions (Copy, Open in mail, Open LinkedIn, Mark as contacted, Redraft).
- **Last-run costs** (`lastRun` in `lib/screen/funnel.js`): flow 44 returns the raw Run costs rows as `cost.rows`. A run = rows clustered by time, where a gap of more than 30 minutes starts a new run; the last run = the newest cluster. Deep checks log no row, so their cost is added from the leads whose `deep_checked_at` falls inside the window (with the same 30-minute allowance after the last row, because flow 17 runs last). Per last run: total, per trace read (stage-1 dollars / stage-1 calls), per team scored (strong-model dollars / calls), per deep check, per new call-now lead (call-now leads updated in the window; none: "no new call-now lead this run"). The funnel page, its cost column and home's "how it works" show these; the all-time total (all runs, tests and rescoring) is one sentence on the Method page.
- **Refresh the snapshot** after a run: `node scripts/refresh-leads-snapshot.mjs`. It reads flow 20 and flow 44 in the same minute and rewrites `data/leads.live-snapshot.json` (rows with verdict call_now, watchlist, htgf_portfolio, their traces, all column names, counts, timestamp) and `data/funnel.sample.json`. While flow 20 answers 404 it changes nothing and says so. Then `node scripts/field-coverage.mjs` (every Leads column shown or on its INTERNAL list) and `node scripts/test-screen.mjs` (data functions, every fallback).

## The coded brain (offline reference)

Everything below describes `/api/brain/run` in this repo: the first version of the brain, kept as an offline reference and for local tests. The live pipeline above does not call it.

Turns **Traces** into **Leads**. JSON in, JSON out: n8n does all table I/O, so the brain doesn't care whether we pick Airtable, Supabase or a Sheet.

```
n8n: Traces (status=new) + Leads ──POST /api/brain/run──▶ brain ──▶ rows → upsert Leads on id
                                                                └─▶ trace_updates → update Traces
```

| Step | What | Model | Code |
|---|---|---|---|
| 1 Extract | projects, people, quotes, funding per trace (one trace can hold several teams) | `OPENAI_MODEL_FAST` | `lib/ai/brain/extract.js` |
| 3 Convergence | union-find over mentions: same handle (certain) → same name + affiliation/city (likely) → same project name (likely) → close names asked to the model (max 30/run) | JS + fast model | `lib/ai/brain/converge.js` |
| 2 Noise filter | hobby / agency / assignment / vc_backable on the combined evidence | `OPENAI_MODEL_FAST` | `lib/ai/brain/filter.js` |
| 4 Scoring | fit_score + team_score, points per criterion, code clamps and sums | `OPENAI_MODEL` | `lib/ai/brain/score.js` |
| 5 Days ahead | web search for the first press / Crunchbase / funding mention | `OPENAI_MODEL_FAST` + web_search | `lib/ai/brain/days-ahead.js` |

All prompts and the scoring weights: `lib/ai/prompts/brain.js`. All thresholds (worth-a-call, concurrency, similarity): `lib/ai/brain/config.js`.

## Wire it in n8n (5 steps)

1. **Trigger**: a Schedule node (every 6 h) plus a Webhook node, so Person 3 can fire it live.
2. **Read the tables**: all Traces where `status = new`, and **all** current Leads. Pass the rows as they are; JSON-string columns (`extraction`, `signals`, `people`, …) are parsed by the brain.
3. **HTTP Request** node: `POST https://<our-vercel-app>/api/brain/run`, body JSON `{ "traces": [...], "previous_leads": [...] }`, header `x-brain-key: <BRAIN_API_KEY>` if it's set, timeout 300 s.
4. **Upsert Leads** from `rows` (one item per row, "create or update" matched on `id`). `rows` are the leads with arrays/objects as JSON strings, so every field maps straight to a text column.
5. **Update Traces** from `trace_updates`, matched on `id`: set `status = processed` and `extraction` (a long text column we added). A trace whose extraction failed is not in `trace_updates`, stays `new` and is retried next run; the reason is in `errors`.

Optional: alert on `funnel.worth_a_call` going up, and log `cost.total_usd` per run.

## What makes repeat runs cheap
- A trace with an `extraction` is never extracted again.
- Old leads come back in through `previous_leads`, so a new trace still converges with teams found weeks ago (their signals are kept, their id stays the same).
- A lead whose `evidence_hash` (hash of its trace ids) didn't change keeps its label, scores and reasons: no model calls.
- A found `first_public_at` is reused forever; a "still invisible" lead is searched again only when its evidence changes. `days_ahead` is recomputed every run.

## Request and response

```bash
curl -s -X POST http://localhost:4000/api/brain/run \
  -H 'content-type: application/json' \
  -H "x-brain-key: $BRAIN_API_KEY" \
  -d @<(jq '{traces: ., previous_leads: []}' data/traces.sample.json) | jq '.funnel, .cost'
```

Body: `{ traces: [Traces rows], previous_leads?: [Leads rows], options?: { daysAhead: true } }`. Send `options.daysAhead: false` for the blind backtest: no web search, so the model never learns the company was funded (`first_public_at`, `days_ahead`, `still_invisible` stay null).

Response:

| Field | What |
|---|---|
| `leads` | native JSON, one per team, Leads columns + `fit_reason`, `team_reason`, `match_reasons`, `evidence_hash`, `still_invisible`, `worth_a_call` |
| `rows` | the same leads flattened for the table |
| `trace_updates` | `[{ id, status: "processed", extraction: "<json>" }]` |
| `funnel` | `{ traces, teams, vc_backable, worth_a_call }`, e.g. 412 → 37 → 9 → 3 |
| `cost` | `total_usd`, `per_trace_usd`, `per_lead_usd`, `per_vc_backable_lead_usd`, `by_step` (calls, tokens, web searches, usd) |
| `errors` | `[{ step, trace_id or lead_id, error }]`, never swallowed |
| `mocked` | `true` when `USE_MOCKS=true` or no `OPENAI_API_KEY`: the body is `data/leads.sample.json` |

Lead details worth knowing for the screen:
- `signals` are in date order: `{ trace_id, source, kind, quote, timestamp, url, happened_at, title }`. `kind` is a quote kind (`looking_for_cofounder`, `planning_to_raise`, …), `appearance` for a trace without quotes, or `first_public_mention` (source `web`) for the press/Crunchbase hit found in step 5.
- `people`: `{ name, handle, role, affiliation, links }`.
- `days_ahead`: first public mention minus first trace; if `still_invisible`, days since the first trace.
- `worth_a_call` = vc_backable, fit ≥ 70 and team ≥ 60.

Debug one trace: `POST /api/brain/extract` with `{ "trace": { ...one Traces row } }` → `{ extraction, usage }`.

## Test offline

```bash
node scripts/test-brain.mjs
```

Runs the full pipeline on the 10 made-up traces in `data/traces.sample.json` with a fake LLM (no key, no network), checks 10 traces → 6 teams, Kelvio in 3 sources, Synthera and Gripr linked, and an incremental second run. It rewrites `data/leads.sample.json`, the mock the screen can build on.
