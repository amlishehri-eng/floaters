# STATUS

Update this file whenever you start, finish or get stuck on something. Keep entries one line each.

## Team
| Person | Role | Branch prefix | Owns |
|---|---|---|---|
| _Name 1_ | Frontend | `frontend/…` | `app/` (not `app/api/`), `components/` |
| _Name 2_ | Backend + AI | `backend/…`, `ai/…` | `app/api/`, `lib/ai/`, `lib/voice/` |
| _Name 3_ | n8n + pitch | `n8n/…`, `pitch/…` | `lib/n8n.js`, `n8n/`, the n8n workspace, `docs/pitch.md` |

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
- Meto / Codex: GitHub publication and real Leads-table integration for `/proof` pending (branch `codex/person-3-proof`).
- _Name_: _what_ (branch `…`)

## Done
- Meto / Codex: `/proof` dashboard with ten fictional leads, computed funnel, search/category/visibility filters, three ranking modes, evidence cards, session shortlist and Markdown memo export. Lint and browser checks passed, including empty results and responsive layouts.
- Setup fixes: geist fonts (offline builds), cacheComponents/partialPrefetching off, Node >=20.9, mock-first helpers in `lib/` + `/api/chat`, `/api/voice/tts`, `/api/voice/stt`, `/api/automation`, default model `claude-sonnet-5-5` (branch `backend/setup`)

## Blocked / needs help
- Codex: GitHub fetch/push requires authentication in this environment. Checkout started three cached commits behind `origin/main`.
- Codex: production build blocked by Turbopack's local process port permission (`Operation not permitted`), including after an escalated retry. Re-run `npm run build` in an unrestricted environment before integrating.
- _what, waiting on whom_

## Decisions
- _short note of anything we agreed on, so nobody re-argues it at 3am_
