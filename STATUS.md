# STATUS

Update this file whenever you start, finish or get stuck on something. Keep entries one line each.

## Where we work (read first, keep current)
- **Code**: GitHub `amlishehri-eng/floaters`, branch `main`. Everyone pushes to main; the hooks pull before and push after every Claude turn.
- **Local app**: `npm run dev` → http://localhost:4000 (home `/`, candidate gallery `/proof`, sourcing demo `/proof/demo`, **real leads `/proof/live`**, test panel `/test`).
- **n8n**: floaters.app.n8n.cloud → project **HTGF** (shared; nothing in anyone's Personal project). The Traces and Leads tables live there. Workflow and table ids: `n8n/README.md`.
- **Pipeline**: scraping (Amli, n8n flows 00–09) → **Traces** → screening and eligibility (Nils, n8n flows 10–19) → **Leads** → screen and pitch (Meto, `/` and `/proof` on :4000).
- **Plans**: team plan https://claude.ai/artifact/Fn8ks5JuzbgW7tM85s7hMb · Person 1 sources plan https://claude.ai/artifact/2r75xemMjuU3K5xVvZaUMQ
- **Who's on what right now**: see *In progress* below. Update your line when you start or finish something.

## Team
| Person | Role | Owns |
|---|---|---|
| Meto | Screen and pitch (Person 3): the look of `/` and `/proof` | `app/` (not `app/api/`), `components/`, `docs/pitch.md` |
| Nils | Screening and eligibility (Person 2) | n8n flows 10–19, `app/api/`, `lib/ai/`, `lib/voice/` |
| Amli | Scraping, all sources (Person 1) | n8n flows 00–09 and 30–39, `n8n/`, `lib/n8n.js` |

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
- Amli: sources done for now (01–09, 30, 31 in Run all); next: reliability, Eventbrite from the laptop.
- Meto: connect the proof dashboard at `/proof` to the real Leads table.
- Nils: task 3 calibration: labelling sheet https://claude.ai/artifact/6Zw3hLcVpVcmXiH59mgjNX (20 traces, model labels sealed until reveal; baseline from "18 Calibrate" `Q00KDMeS9bbjb6ki`). Waiting for Nils's 20 labels, then tune "Read trace with OpenAI" and re-run 18 (before/after agreement). Then the Germany-wide backlog.
- Nils: task 5 n8n "12 Registry check" (`gYc6PMjzMDMYAwjc`, called at the end of 11, vc_backable only) built: handelsregister.ai search → fetch → founder's other companies → Leads `registered`, `legal_form`, `registered_at`, `register_id`, `registry_signals`, `registry_checked_at`; fit/team adjusted in code, 10 Make leads v2.4 keeps the adjustments. Waiting for the n8n Header Auth credential "handelsregister.ai" (Nils adds the key), then test on Klarvus, KyNext, ReXanh

## Done
- Amli: 32 Remove duplicate traces in Run all (before 09): same source + page + company name, keeps the oldest, only removes `new` rows. Removed 5 TUM double pages and 4 imperfect accelerator rows. Full run ≈ 27 min.
- Amli: new sources 30 First hires (Bundesagentur job API: startups hiring their first people, 36 ads, source `jobs`) and 31 Accelerators and competitions (28 cohort/winner pages Germany-wide, 301 startups, source `accelerator`). Both in Run all before 09 Find websites. Traces now ~1,240.
- Nils: package 1 funnel. **10 Make leads v4**: Get done traces + Get new traces (limit 500) → code node "Stage 0 pre-filter" (no model; rules unreadable, duplicate, event_only, investor/ecosystem_org, agency, assignment, too_old, not_germany; skipped traces get status `skipped` + `{stage0:{rule,reason}}` in extraction; MAX_LLM_PER_RUN 30, the rest stay `new`) → stage 1 prompt (no "Munich first", anchored tech_depth 0–5/6–14/15–25, `team_points.*.known`, `hq_evidence`); Merge: a re-read trace replaces its own older reading. **13 Classify leads v2**: `verdict` (not_a_lead X · not_a_startup D · too_late C · out_of_scope C · not_high_tech C (tech_depth < 15) · watchlist B · needs_enrichment B (3+ team unknown) · call_now A), `verdict_reason`, `team_score_known`; tier and worth_a_call follow the verdict. Dry run over all 900 Traces (nothing written): pass 367, unreadable 374 (university lists with only a name), too_old 153, agency 2, ecosystem_org 2, investor 1, event_only 1 → 30 per run to the model. Test on 10 pinboard traces: 10 passed and read. Leads (46): watchlist 17, not_a_startup 10, not_high_tech 7, too_late 6, not_a_lead 4, needs_enrichment 1, out_of_scope 1, call_now 0. Versions: 10 `f431e52c` → `ebdc045e`, 13 `b06f82f3` → `f7a17fcf` (old ids = rollback). New Leads columns `verdict`, `verdict_reason`, `team_score_known`. 10 is **not** run on the backlog yet; 00 Run all is unpublished, but Amli says it calls 10 again.
- Nils: audit scheme for Leads. "10 Make leads" v3: the model returns `lead_type` (startup_candidate, research_project, assignment, hobby, agency, established_company, investor, ecosystem_org, event_only) + reason, funding, founded_year, country and points per criterion (FIT/TEAM weights from `lib/ai/prompts/brain.js`); code sums and caps them; investor/ecosystem_org/event_only never become leads; each trace gets its reading in `Traces.extraction`. New "13 Classify leads" (`pqLJklAO79NPAGa4`, pure code, end of 10): 5 eligibility checks (germany, sector, stage < 3 years, no_funding, legal_entity) each pass/fail/unknown with evidence + trace_ids, `tier` A–D/X, `tier_reason`, `worth_a_call` (= tier A). First pass over 41 leads: A 2 (KyNext, Spontaction), B 19, C 9 (nexwise/Malao funded, Omegga/The Ocean Package older than 3 years), D 8, X 4.
- Amli: Germany-wide sources: Luma Munich/Berlin/Hamburg/Frankfurt, GitHub in 16 German places, new 07 university startup lists (15 universities/incubators, OpenAI reads each page), 08 university spin-off news (idw), 09 find websites (Brave, writes only `website`). Traces got a `website` column. Ids and details in `n8n/README.md`.
- Meto: built the local simulated search at `/proof/search` with a four-step funnel, exclusion reasons, and candidate details. Ready for review before pushing.
- Meto: refreshed the homepage and expanded the German portfolio gallery to ten companies, with illustrative fit scores for the frontend prototype.
- Amli: real leads on the screen: n8n flow "20 Leads for the screen" (read-only link) → `lib/n8n.js` `getLeads()` → new page `/proof/live` (uses Meto's ProofDashboard unchanged) and `/api/leads`. Falls back to the demo leads when n8n is unreachable. Tested with real data: 34 traces → 31 teams → 25 VC potential. The flow must be **published** in n8n for the live link to work.
- Amli: podcast transcripts work (ElevenLabs, speakers told apart): each run transcribes the 3 newest episodes without one; the trace goes back to `new` with the transcript. Luma flow now skips events already in Traces, so their status is no longer reset (Nils's note).
- Meto: added six sourced portfolio example profiles and a candidate grid at `/proof`, with the fictional sourcing workspace at `/proof/demo`.
- Amli: source flows 03 TUM Venture Labs (84 teams with founders), 05 GitHub Munich (new orgs + Hugging Face), 06 pitch podcasts (65 episodes), 04 Eventbrite built but blocked by Eventbrite for n8n Cloud. Traces: `extraction` column added, pinboard source = `campus`. Run all keeps going when a source has nothing new.
- Nils: n8n "10 Make leads" v2.3: old `pinboard` source counts as `campus` (Amli's rename), one-time repair of rows with stale sources/counts, tie on score keeps the reading with a reason. All Leads rows now have consistent source_count/trace_count (Klarvus, ReXanh, nexpaper = 1 source, 2 traces).
- Nils: n8n "11 Days ahead" (called at the end of 10): Brave news search per vc_backable lead + gpt-5-mini relevance check → `first_public_at`, `first_public_url`, `days_ahead` (negative = press was first; invisible = days so far), `still_invisible`, `news_checked_at`. Own site, our sources, listing pages and startup directories/databases (Startup-Radar, Crunchbase, Dealroom, startbase, North Data, company pages) don't count, only editorial coverage. Re-checked all 25: Klarvus, LexDial, Malao now still invisible; 7 leads were in the press first (e.g. Omegga 2022, simplysolve 2024 as Brakeable).
- Nils: n8n "10 Make leads" v2.1 convergence: same lead_key merges (in one batch and into existing Leads): trace_ids/sources deduped, source_count, new `trace_count`, earliest first_trace_at, higher fit/team score kept with its reason. Leads got `trace_count`, `fit_reason`, `team_reason`. Test helper "19 Reset test traces" sets listed trace_ids back to new. Tested: Klarvus = pinboard:5028 + 5033, trace_count 2.
- Amli: n8n project HTGF with tables Traces + Leads, flows 00 Run all, 01 Luma Munich, 02 LMU pinboard, 10 Make leads (stand-in until n8n calls `/api/brain/run`). First run: 46 traces → 8 leads. Code and ids in `n8n/README.md`.
- Meto: launched the Founders First homepage at `/` with a fictional lead preview and two-way navigation to `/proof`.
- Meto: polished the proof dashboard and added sector filtering, sortable score badges and direct shortlist access.
- Meto: proof dashboard at `/proof` with ten fictional leads, funnel counts, ranking, filters, evidence cards, shortlisting and Markdown memo export.
- Nils: brain `/api/brain/run` + `/api/brain/extract` (extract → convergence → filter → scoring → days ahead, cost per trace/lead), 10 sample traces `data/traces.sample.json`, mock `data/leads.sample.json` for the screen, n8n wiring in `docs/brain.md`, test `node scripts/test-brain.mjs`
- Setup fixes: geist fonts (offline builds), cacheComponents/partialPrefetching off, Node >=20.9, mock-first helpers in `lib/` + `/api/chat`, `/api/voice/tts`, `/api/voice/stt`, `/api/automation`, default model `claude-sonnet-5-5` (branch `backend/setup`)
- Hackathon starter top-up: `/test` integration panel, `scripts/sync.sh` + session hooks, `reviewer` agent, `openai` installed, SPEC wow/jury sections (main)

## To do later
- Amli + Meto: when Meto's frontend is done, publish n8n flow "20 Leads for the screen" so `/proof/live` shows the real leads instead of the demo ones (one click in n8n, Amli decides).
- Amli: Eventbrite from the laptop. Eventbrite blocks n8n Cloud, but its pages load from a home connection. A small script on Amli's Mac reads the Eventbrite Munich startup pages gently (one every 2 s, same code as flow 04) and sends new events into Traces through an n8n webhook. Runs only while the laptop is on: run it once before the demo. Local test found 17 events (TUM IDEAward, Migrant Accelerator demo day, Female Founder Society kick-off).

## Blocked / needs help
- Nils (from Amli): two new `source` values in Traces: `jobs` (flow 30: a job ad of a young company hiring its first people; employer = org_name, no people) and `accelerator` (flow 31: a startup listed by an accelerator or founder competition; some winners are established firms, e.g. DeepL, NEURA Robotics, succession prizes).
- Nils (from Amli, 20 Nov ~16:00): Traces was **emptied and rescanned** Germany-wide (Amli's call). Same trace_ids come back, all as `new`, plus many more (TUM Berlin, Max Planck, SpinLab, …). Your Leads table was not touched. Result: ~900 traces as `new` (university pages 682, TUM 84, podcasts 65, pinboard 42, GitHub 15, Luma 9, idw 3), 251 with a website. 10 per run won't keep up. Run all calls your step again (it was off only for the scan test).
- Meto (from Amli): `/proof/live` shows real leads in your ProofDashboard, but the dashboard still says "Fictional demo data" (badge, line 218) and "FICTIONAL DEMO DATA" in the memo (line 84). Could it take a prop like `demo={false}`? Also: your "worth a call" rule is fit ≥ 80, team ≥ 80, 2+ sources; the brain's is fit ≥ 70, team ≥ 60. Pick one with Nils (today 0 real leads pass yours).
- Nils (from Amli): the live leads show duplicates the name match misses, e.g. "Malao GmbH" and "Malao / Twinkle" (point 1 of the gap list).
- Nils (from Amli, 20 Nov): what n8n screening (10 + 11) is missing compared with the coded brain (`lib/ai/brain`) and `engine/`. Most important first:
  1. Link by person, not only by exact project name (same GitHub handle = certain; same name + same university/city = likely; close names checked by the model). Convergence is our pitch.
  2. Several projects per trace (a demo day or podcast can name five teams; n8n keeps one).
  3. Label the whole lead on all its traces, not each trace alone.
  4. Points per criterion with the fixed weights in `lib/ai/prompts/brain.js` (code clamps and sums), stronger model for scoring.
  5. `worth_a_call` (vc_backable, fit >= 70, team >= 60) and `match_reasons` (why traces were linked).
  6. Skip re-scoring when the evidence did not change (`evidence_hash`); funnel and cost per run (scalability score); blind backtest mode.
  7. From `engine/`: Impressum (GmbH/UG, register number, managing directors), domain age (registration, first certificate), press check (Google News), spoken top-5 briefing with ElevenLabs.
  Fastest route: flow 10 posts new traces to `/api/brain/run` (needs the app on Vercel + OPENAI_API_KEY there). If no time: do 1 and 2 in n8n first.
- Nils: please read "Handover to screening" in `n8n/README.md`: ~180 traces wait as `new` (10 per run), a transcribed podcast trace comes back as `new`, TUM `happened_at` is a page-edit date, podcast topics can be investors or associations.
- Meto (from Nils): Leads now has one `worth_a_call` (= `tier` A) and `tier` (A call now · B watch · C too late/out of scope · D not a startup · X not a lead) with `tier_reason`. Could `worthCalling()` in `app/proof/proof-dashboard.js` read `worth_a_call` instead of fit ≥ 80/team ≥ 80/2+ sources? New Leads columns: `lead_type`, `type_reason`, `type_trace_ids`, `eligibility` (JSON), `eligible`, `tier`, `tier_reason`, `worth_a_call`, `fit_breakdown`/`team_breakdown` (JSON, points per criterion with why + trace_id), `match_reasons` (JSON), `country`, `founded_year`; from 12: `registered`, `legal_form`, `registered_at`, `register_id`, `registry_signals`, `registry_checked_at`. `label` is still written (vc_backable etc.) so nothing breaks.
- Amli (from Nils): `n8n/README.md` lists 10–19 as one row; my flows are 10 `jLWKNwEC08SHfAfP`, 11 `adcNukRVwIHJHONh`, 12 `gYc6PMjzMDMYAwjc`, 13 `pqLJklAO79NPAGa4`, 18 `Q00KDMeS9bbjb6ki`, 19 `dWvlW57gLVfClgcF`. Add them when you next touch the README (your file), or tell me to.
- Meto (from Nils): Leads has three new columns from 13 v2: `verdict` (call_now, watchlist, needs_enrichment, not_high_tech, too_late, out_of_scope, not_a_startup, not_a_lead), `verdict_reason` (one line, why) and `team_score_known` (team score on the criteria the traces actually say something about). The screen can filter on `verdict`; `worth_a_call` = verdict call_now = tier A. Right now 0 leads are call_now: the high-tech gate (tech_depth < 15 of 25) moves KyNext, Spontaction, Klarvus, Palm Up, nexpaper to not_high_tech.
- _what, waiting on whom_

## Deploy and bugs
- Last deployment: _URL, time, commit_
- Open bugs: _none yet_

## Decisions
- _short note of anything we agreed on, so nobody re-argues it at 3am_
- Decision: two columns added to the contract: Traces gets `extraction` (JSON string, so no trace is extracted twice); Leads gets `fit_reason`, `team_reason`, `match_reasons`, `evidence_hash`, `still_invisible`, `worth_a_call`. Nothing renamed.
- Decision (20 Nov): all scraping is Amli's n8n flows 00–09; `engine/src/sources` is not used for the pipeline. Nils does screening and eligibility, Meto the screen's look.
- Decision: STATUS.md is shared: when merging, keep everyone's lines (a merge on 20 Nov dropped some; they were restored).
- Decision (Nils, 20 Nov): one "worth a call" for all three of us = `worth_a_call` = tier A (startup_candidate, no failed eligibility check, fit ≥ 70, team ≥ 60). More sources only sort within a tier, never gate. A company older than 3 years fails `stage` (HTGF invests in companies under 3 years). Old non-lead rows (4 Luma events) stay in Leads as tier X, nothing deleted. Meto, say if you disagree.
- Decision (Nils, 20 Nov): the high-tech gate stays at tech_depth >= 15 of 25 (13 Classify leads `HIGH_TECH_MIN`). Below that = verdict not_high_tech (tier C), even when fit and team are high (KyNext, Spontaction, Klarvus today).
- Decision: everyone works directly on main with auto-commit/push hooks (replaces branch+PR flow).
