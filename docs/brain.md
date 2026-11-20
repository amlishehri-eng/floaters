# The brain (Person 2)

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
