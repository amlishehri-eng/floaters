# Agent instructions

All project rules live in **CLAUDE.md**. Read it before doing anything; it applies to every AI tool (Codex, Cursor, Copilot, Claude Code).

Also read:
- **SPEC.md**: the idea, the happy path and the data model. If anything conflicts, SPEC.md wins.
- **STATUS.md**: who owns which folders and what's in progress. Stay inside the owner's folders.
- **docs/integrations.md**: how Claude, OpenAI, ElevenLabs and n8n are wired in.
- **docs/brain.md**: how n8n calls the brain (`/api/brain/run`).

## Before you start any task: catch up first
Three people are pushing in parallel. Never work from a stale picture.

1. **Fetch and read the latest commits**
   - `git fetch origin`
   - `git log --oneline -15 origin/main` (what landed on main)
   - `git log --oneline --all --since="6 hours ago"` (what everyone pushed recently)
   - For anything touching the files you're about to change: `git show --stat <sha>`, and read the diff if it's relevant.
2. **Check your working tree**
   - `git status` (uncommitted changes from the human: never overwrite or discard them)
   - Everyone works directly on main. `scripts/sync.sh` already ran `git pull --rebase` before this prompt, and `scripts/autosync.sh` auto-commits, rebases and pushes (only if the build passes) after every turn. If the `[sync]` lines report a conflict or FAIL, fix that with the human before anything else.
3. **Read STATUS.md**: *In progress*, *Blocked* and *Decisions*. Don't start something someone else is already doing, and follow decisions already made.
4. **Re-read SPEC.md** if any recent commit touched it.
5. **Give the human a 3-line catch-up** before writing code: what changed since their last session, who's working on what, and anything that affects this task (conflicts, changed API contracts, new env vars, new dependencies → `npm install`).
6. **Add your task to STATUS.md → In progress** (name, task).

## What we're building: "Find the Founders First" (HTGF challenge)
- Founders leave public traces before they're written about: they pitch at demo days, publish code, win campus grants.
- Our engine catches the same people showing up in several sources (**convergence**) and measures how many days earlier we found them than the news, Crunchbase or a funding announcement (**days ahead**).
- Scope: Munich only, three source groups: events (Luma, Eventbrite), campus (TUM, LMU, UnternehmerTUM, EXIST news), developers (GitHub, Hugging Face), plus pitch recordings transcribed with ElevenLabs.
- More cities or sources only after these three work.
- Pipeline: sources → brain → proof. Each person reads one table and writes the next.
- Jury weights: technical execution 25%, lead quality 25%, earliness 20%, creativity of signals 20%, scalability 10%.

## Roles
| Person | Role | Reads | Writes | Owns |
|---|---|---|---|---|
| Person 1 | Sources (scout) | Sources table | Traces | n8n fetch flows, `n8n/` |
| Person 2 (Nils) | Brain | Traces | Leads | `app/api/brain/`, `lib/ai/`, the brain's n8n flow |
| Person 3 | Proof and pitch | Leads | screen, backtest, pitch | `app/` pages, `components/`, `docs/pitch.md` |

## The contract: two tables
- Adding a column is fine. Renaming or removing one needs all three to agree, because it silently breaks someone else's flow.
- Trace id = source + its own id (e.g. `luma:evt-8f2k`). Every write is an upsert on id, so nothing is stored twice.
- Sample rows to build against: `data/traces.sample.json`, `data/leads.sample.json`.

**Traces** (Person 1 writes, Person 2 reads): one row per thing found in the world.
| Column | Type | Meaning |
|---|---|---|
| id | text, unique | source + its own id, e.g. `luma:evt-8f2k` |
| source | luma, eventbrite, campus, github, huggingface, recording | where it was found |
| url | link | the event, repo or news page |
| happened_at | date | event date, repo created, news published |
| found_at | date-time | when our engine found it |
| title | text | e.g. "Demo Day Winter Batch" |
| text | long text | page text or transcript, trimmed to what matters |
| people | list or comma/newline text | names and handles, e.g. "Lena Müller (@lmueller)" |
| org_name | text | project or company name, if any |
| city | text | e.g. Munich |
| status | new, processed | the brain sets it to processed |
| extraction | long text (JSON) | added: the brain's extraction, so no trace is extracted twice |

**Leads** (Person 2 writes, Person 3 reads): one row per team that might become a startup. Lists are JSON strings in the table.
| Column | Type | Meaning |
|---|---|---|
| id | text | stable per team, `lead:<slug>` |
| name | text | project or company name |
| people | list | each: name, handle, role, affiliation, links |
| what | text | one sentence: what they build, for whom |
| sector | text | digital tech, industrial tech, life sciences, chemistry, other |
| city, country | text | Munich, DE |
| stage | idea, prototype, pilot customers, revenue, unknown | from the evidence |
| label | hobby, agency, assignment, vc_backable | the noise filter |
| label_reason | text | one line why |
| fit_score | 0–100 | HTGF fit |
| team_score | 0–100 | team strength |
| signals | list | each: trace_id, source, kind, quote, timestamp, url, happened_at, title; date order |
| source_count | number | how many different sources (convergence) |
| first_trace_at | date | our earliest trace |
| first_public_at | date or empty | first news, Crunchbase or funding mention; empty = still invisible |
| days_ahead | number | first_public_at − first_trace_at, or days since first trace if still invisible |
| fit_reason | text | added: one line for the lead card |
| team_reason | text | added: one line for the lead card |
| match_reasons | list | added: why traces were linked (certain/likely/checked) |
| evidence_hash | text | added: hash of the trace ids; unchanged = scores are reused |
| still_invisible | boolean | added: no public mention found |
| worth_a_call | boolean | added: vc_backable, fit ≥ 70 and team ≥ 60 |

## AI services
- OpenAI does the brain: extraction, noise filter, linking people, scoring, web search for days ahead, best-find memo. The team plan requires it; this overrides "Claude by default" in CLAUDE.md (see SPEC.md "Which AI does what").
- Cheap model (`OPENAI_MODEL_FAST`) for extraction, filtering and same-person checks; strong model (`OPENAI_MODEL`) for scoring and the memo.
- Every OpenAI call uses structured output (fixed JSON schema), so n8n can write the answer straight into a table.
- ElevenLabs: speech-to-text for pitch recordings with speaker separation and timestamps; founder clip and audio briefing for the demo.
- n8n: every schedule, fetch, dedupe, table write and alert. Each flow has a schedule trigger (every 6h) and a manual webhook for the live demo.

## How we work: work packages
- Work is split into small work packages (WP). One WP = one Claude Code session.
- Do only the WP you were given, test it, push, update STATUS.md.
- A WP is done only when its "done when" check passes. Don't start the next one before that.
- Each person's current WP goes in STATUS.md → In progress, as "Name: WPx short title".
- Agents: never build ahead into a later WP, never "improve" another person's area without asking.

## Team rules
- Hour 6 checkpoint: one real trace must reach a real lead on the screen. Nothing new starts until it does.
- Hour 14: Person 1 stops adding sources; only fixing and reliability from then on.
- Hour 22: feature freeze, called by Person 3. Bugfixes only after that.
- Stand-up every 3 hours, 5 minutes: done, next, blocked. Blockers go in STATUS.md → Blocked.
- Before the real flows run, everyone builds against the 10 made-up rows of the table they read.
- Fallbacks as in CLAUDE.md (mock or pre-run data for every external call): the demo must survive dead wifi.
- Keys: on top of CLAUDE.md's rules, never in chat or screenshots; in n8n they live in credentials only.
- Only public, professional facts about people (EU privacy rules). No private addresses, no personal social media.
- The backtest runs blind: never tell the model a company was funded (`options.daysAhead: false`).
- Small and working beats big and broken: three sources that work beat six that half-work.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
