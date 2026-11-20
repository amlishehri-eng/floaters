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
- **42 Feedback** `4NvaofydeNfFZaQ1`: `POST /webhook/htgf-feedback` ← `/api/feedback` → table **Feedback**. **43 Calibration** `H89AIsfbEkdXFET9` (Mondays): up- vs down-voted leads per criterion → proposal in **Calibration** (never changes a weight).
- **44 Funnel stats** `uXusnZJq4EuW303i`: `GET /webhook/htgf-funnel` → `/api/funnel` (counts per stage, cost per stage from **Run costs**, per trace, per call_now lead).
- Test helpers: 18 Calibrate `Q00KDMeS9bbjb6ki`, 19 Reset test traces `dWvlW57gLVfClgcF`.

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
