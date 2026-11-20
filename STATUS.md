# STATUS

Update this file whenever you start, finish or get stuck on something. Keep entries one line each.

## Team
| Person | Role | Owns |
|---|---|---|
| _Name 1_ | Frontend | `app/` (not `app/api/`), `components/` |
| Nils | Backend + AI (Person 2, the brain) | `app/api/`, `lib/ai/`, `lib/voice/` |
| _Name 3_ | n8n + pitch | `lib/n8n.js`, `n8n/`, the n8n workspace, `docs/pitch.md` |

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
- Nils: the brain is built and tested offline; next: first real run with `OPENAI_API_KEY` on Person 1's traces, then calibrate the filter on 20 hand-labelled traces

## Done
- Nils: brain `/api/brain/run` + `/api/brain/extract` (extract → convergence → filter → scoring → days ahead, cost per trace/lead), 10 sample traces `data/traces.sample.json`, mock `data/leads.sample.json` for the screen, n8n wiring in `docs/brain.md`, test `node scripts/test-brain.mjs`
- Setup fixes: geist fonts (offline builds), cacheComponents/partialPrefetching off, Node >=20.9, mock-first helpers in `lib/` + `/api/chat`, `/api/voice/tts`, `/api/voice/stt`, `/api/automation`, default model `claude-sonnet-5-5` (branch `backend/setup`)
- Hackathon starter top-up: `/test` integration panel, `scripts/sync.sh` + session hooks, `reviewer` agent, `openai` installed, SPEC wow/jury sections (main)

## Blocked / needs help
- _what, waiting on whom_

## Deploy and bugs
- Last deployment: _URL, time, commit_
- Open bugs: _none yet_

## Decisions
- _short note of anything we agreed on, so nobody re-argues it at 3am_
- Decision: two columns added to the contract: Traces gets `extraction` (JSON string, so no trace is extracted twice); Leads gets `fit_reason`, `team_reason`, `match_reasons`, `evidence_hash`, `still_invisible`, `worth_a_call`. Nothing renamed.
- Decision: everyone works directly on main with auto-commit/push hooks (replaces branch+PR flow).
