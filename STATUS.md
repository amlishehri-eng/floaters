# STATUS

Update this file whenever you start, finish or get stuck on something. Keep entries one line each.

## Where we work (read first, keep current)
- **Code**: GitHub `amlishehri-eng/floaters`, branch `main`. Everyone pushes to main; the hooks pull before and push after every Claude turn.
- **Local app**: `npm run dev` → http://localhost:4000 (home `/`, proof screen `/proof`, test panel `/test`).
- **n8n**: floaters.app.n8n.cloud → project **HTGF** (shared; nothing in anyone's Personal project). The Traces and Leads tables live there. Workflow and table ids: `n8n/README.md`.
- **Pipeline**: sources (Amli, n8n flows 00–09) → **Traces** → brain (Nils, `/api/brain/run`, called by n8n) → **Leads** → screen and pitch (Meto, `/proof`).
- **Plans**: team plan https://claude.ai/artifact/Fn8ks5JuzbgW7tM85s7hMb · Person 1 sources plan https://claude.ai/artifact/2r75xemMjuU3K5xVvZaUMQ
- **Who's on what right now**: see *In progress* below. Update your line when you start or finish something.

## Team
| Person | Role | Owns |
|---|---|---|
| _Name 1_ | Frontend | `app/` (not `app/api/`), `components/` |
| Nils | Backend + AI (Person 2, the brain) | `app/api/`, `lib/ai/`, `lib/voice/` |
| Amli | Sources (Person 1) | `lib/n8n.js`, `n8n/`, the source flows in the n8n workspace (project HTGF) |

## Timeline
| Hour | Checkpoint | Done? |
|---|---|---|
| H0–1 | SPEC.md filled in, Next.js skeleton on main, Vercel connected | ☐ |
| H4 | Happy path clickable with **mock data** only | ☐ |
| H10 | Happy path works with **real** Claude / ElevenLabs / n8n | ☐ |
| H16 | Polish + fallbacks for every external API | ☐ |
| H20 | **Feature freeze**: only bugfixes from here | ☐ |
| H22 | Demo rehearsed twice, tag `demo-v1` | ☐ |
| H24 | Demo | ☐ |

## Sleep rotation
Staggered ~3h slots so two people are always awake. **Nobody sleeps H20–24** (freeze, rehearsal, demo).

| Slot | Who sleeps |
|---|---|
| H8–11 | _Name_ |
| H11–14 | _Name_ |
| H14–17 | _Name_ |

## In progress
- Amli: next source flows in n8n (TUM Venture Labs teams, then GitHub / podcasts); fix Traces for the contract (`extraction` column, pinboard source = `campus`).
- Meto: connect the proof dashboard at `/proof` to the real Leads table.
- Nils: next: calibration of "Read trace with OpenAI" on 20 hand-labelled traces (task 3)

## Done
- Nils: n8n "10 Make leads" v2.3: old `pinboard` source counts as `campus` (Amli's rename), one-time repair of rows with stale sources/counts, tie on score keeps the reading with a reason. All Leads rows now have consistent source_count/trace_count (Klarvus, ReXanh, nexpaper = 1 source, 2 traces).
- Nils: n8n "11 Days ahead" (called at the end of 10): Brave news search per vc_backable lead + gpt-5-mini relevance check → `first_public_at`, `first_public_url`, `days_ahead` (negative = press was first; invisible = days so far), `still_invisible`, `news_checked_at`. Own site, our sources and listing pages don't count. Tested: Klarvus −51 (Startup-Radar 2026-09-23), KyNext invisible 14, ReXanh invisible 6.
- Nils: n8n "10 Make leads" v2.1 convergence: same lead_key merges (in one batch and into existing Leads): trace_ids/sources deduped, source_count, new `trace_count`, earliest first_trace_at, higher fit/team score kept with its reason. Leads got `trace_count`, `fit_reason`, `team_reason`. Test helper "19 Reset test traces" sets listed trace_ids back to new. Tested: Klarvus = pinboard:5028 + 5033, trace_count 2.
- Amli: n8n project HTGF with tables Traces + Leads, flows 00 Run all, 01 Luma Munich, 02 LMU pinboard, 10 Make leads (stand-in until n8n calls `/api/brain/run`). First run: 46 traces → 8 leads. Code and ids in `n8n/README.md`.
- Meto: launched the Founders First homepage at `/` with a fictional lead preview and two-way navigation to `/proof`.
- Meto: polished the proof dashboard and added sector filtering, sortable score badges and direct shortlist access.
- Meto: proof dashboard at `/proof` with ten fictional leads, funnel counts, ranking, filters, evidence cards, shortlisting and Markdown memo export.
- Nils: brain `/api/brain/run` + `/api/brain/extract` (extract → convergence → filter → scoring → days ahead, cost per trace/lead), 10 sample traces `data/traces.sample.json`, mock `data/leads.sample.json` for the screen, n8n wiring in `docs/brain.md`, test `node scripts/test-brain.mjs`
- Setup fixes: geist fonts (offline builds), cacheComponents/partialPrefetching off, Node >=20.9, mock-first helpers in `lib/` + `/api/chat`, `/api/voice/tts`, `/api/voice/stt`, `/api/automation`, default model `claude-sonnet-5-5` (branch `backend/setup`)
- Hackathon starter top-up: `/test` integration panel, `scripts/sync.sh` + session hooks, `reviewer` agent, `openai` installed, SPEC wow/jury sections (main)

## Blocked / needs help
- Nils + Amli: n8n tables reserve `id`, so Traces uses `trace_id` and Leads `lead_key`: map them when n8n calls `/api/brain/run` (see `n8n/README.md`).
- Nils + Amli: `engine/src/sources` (github, ct, incubator) overlaps Person 1's sources: agree who runs which source.
- Amli (from Nils): "00 Run all" re-imports the 4 Luma traces and sets their `status` back to `new`, so 10 Make leads reads them again on every run (4 wasted gpt-5-mini calls per run; data stays correct). Fix: when a trace_id already exists, don't overwrite `status`. Pinboard/campus is fine.
- _what, waiting on whom_

## Deploy and bugs
- Last deployment: _URL, time, commit_
- Open bugs: _none yet_

## Decisions
- _short note of anything we agreed on, so nobody re-argues it at 3am_
- Decision: two columns added to the contract: Traces gets `extraction` (JSON string, so no trace is extracted twice); Leads gets `fit_reason`, `team_reason`, `match_reasons`, `evidence_hash`, `still_invisible`, `worth_a_call`. Nothing renamed.
- Decision: everyone works directly on main with auto-commit/push hooks (replaces branch+PR flow).
