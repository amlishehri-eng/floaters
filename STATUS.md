# STATUS

Update this file whenever you start, finish or get stuck on something. Keep entries one line each.

## Where we work (read first, keep current)
- **Code**: GitHub `amlishehri-eng/floaters`, branch `main`. Everyone pushes to main; the hooks pull before and push after every Claude turn.
- **Local app**: `npm run dev` → http://localhost:4000 (home `/`, candidate gallery `/proof`, sourcing demo `/proof/demo`, test panel `/test`).
- **n8n**: floaters.app.n8n.cloud → project **HTGF** (shared; nothing in anyone's Personal project). The Traces and Leads tables live there. Workflow and table ids: `n8n/README.md`.
- **Pipeline**: scraping (Amli, n8n flows 00–09) → **Traces** → screening and eligibility (Nils, n8n flows 10–19) → **Leads** → screen and pitch (Meto, `/` and `/proof` on :4000).
- **Plans**: team plan https://claude.ai/artifact/Fn8ks5JuzbgW7tM85s7hMb · Person 1 sources plan https://claude.ai/artifact/2r75xemMjuU3K5xVvZaUMQ
- **Who's on what right now**: see *In progress* below. Update your line when you start or finish something.

## Team
| Person | Role | Owns |
|---|---|---|
| Meto | Screen and pitch (Person 3): the look of `/` and `/proof` | `app/` (not `app/api/`), `components/`, `docs/pitch.md` |
| Nils | Screening and eligibility (Person 2) | n8n flows 10–19, `app/api/`, `lib/ai/`, `lib/voice/` |
| Amli | Scraping, all sources (Person 1) | n8n flows 00–09, `n8n/`, `lib/n8n.js` |

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
- Amli: sources live in Run all (01 Luma, 02 LMU pinboard, 03 TUM Venture Labs, 05 GitHub, 06 podcasts with ElevenLabs transcripts); next: reliability, then Eventbrite from the laptop.
- Meto: connect the proof dashboard at `/proof` to the real Leads table.
- Nils: next: calibration of "Read trace with OpenAI" on 20 hand-labelled traces (task 3)

## Done
- Amli: podcast transcripts work (ElevenLabs, speakers told apart): each run transcribes the 3 newest episodes without one; the trace goes back to `new` with the transcript. Luma flow now skips events already in Traces, so their status is no longer reset (Nils's note).
- Meto: added six sourced portfolio example profiles and a candidate grid at `/proof`, with the fictional sourcing workspace at `/proof/demo`.
- Amli: source flows 03 TUM Venture Labs (84 teams with founders), 05 GitHub Munich (new orgs + Hugging Face), 06 pitch podcasts (65 episodes), 04 Eventbrite built but blocked by Eventbrite for n8n Cloud. Traces: `extraction` column added, pinboard source = `campus`. Run all keeps going when a source has nothing new.
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

## To do later
- Amli: Eventbrite from the laptop. Eventbrite blocks n8n Cloud, but its pages load from a home connection. A small script on Amli's Mac reads the Eventbrite Munich startup pages gently (one every 2 s, same code as flow 04) and sends new events into Traces through an n8n webhook. Runs only while the laptop is on: run it once before the demo. Local test found 17 events (TUM IDEAward, Migrant Accelerator demo day, Female Founder Society kick-off).

## Blocked / needs help
- Nils: please read "Handover to screening" in `n8n/README.md`: ~180 traces wait as `new` (10 per run), a transcribed podcast trace comes back as `new`, TUM `happened_at` is a page-edit date, podcast topics can be investors or associations.
- _what, waiting on whom_

## Deploy and bugs
- Last deployment: _URL, time, commit_
- Open bugs: _none yet_

## Decisions
- _short note of anything we agreed on, so nobody re-argues it at 3am_
- Decision: two columns added to the contract: Traces gets `extraction` (JSON string, so no trace is extracted twice); Leads gets `fit_reason`, `team_reason`, `match_reasons`, `evidence_hash`, `still_invisible`, `worth_a_call`. Nothing renamed.
- Decision (20 Nov): all scraping is Amli's n8n flows 00–09; `engine/src/sources` is not used for the pipeline. Nils does screening and eligibility, Meto the screen's look.
- Decision: STATUS.md is shared: when merging, keep everyone's lines (a merge on 20 Nov dropped some; they were restored).
- Decision: everyone works directly on main with auto-commit/push hooks (replaces branch+PR flow).
