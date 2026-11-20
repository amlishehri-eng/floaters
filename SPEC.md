# SPEC

> Fill this in together at kickoff (first 30–45 min). If anything in the code or other docs conflicts with this file, **this file wins**.

## One-liner
_TODO: what it does, for whom, in one sentence._

## Problem
_TODO: who has the problem and why it hurts (2–3 sentences)._

## Wow moment
_TODO: what we show live in the first 30 seconds._

## Target user
_TODO: one specific person, e.g. "a freelance designer sending 20 invoices a month"._

## Happy path (the live demo)
The **one** flow that must work end to end. Everything else is optional.

1. _TODO: user opens …_
2. _TODO: user says / types / uploads …_
3. _TODO: app calls … (Claude / ElevenLabs / n8n)_
4. _TODO: user sees / hears …_
5. _TODO: the "wow" moment_

## Screens
| Screen | Route | What's on it |
|---|---|---|
| _Home_ | `/` | _TODO_ |
| _TODO_ | `/…` | _TODO_ |

## Data model
Keep it small. Mock versions live in `/data`.

| Entity | Fields | Notes |
|---|---|---|
| Trace (Person 1 writes, Person 2 reads) | `id` (source:own-id, unique), `source` (luma, eventbrite, campus, github, huggingface, recording), `url`, `happened_at`, `found_at`, `title`, `text`, `people`, `org_name`, `city`, `status` (new, processed), `extraction` (added: JSON string, set by the brain) | `data/traces.sample.json` |
| Lead (Person 2 writes, Person 3 reads) | `id` (stable, `lead:<slug>`), `name`, `people`, `what`, `sector`, `city`, `country`, `stage`, `label`, `label_reason`, `fit_score`, `team_score`, `signals`, `source_count`, `first_trace_at`, `first_public_at`, `days_ahead`, added: `fit_reason`, `team_reason`, `match_reasons`, `evidence_hash`, `still_invisible`, `worth_a_call` | `data/leads.sample.json`; lists are JSON strings in the table |

## API routes (contract between frontend and backend)
Agree on these first so frontend can build against mocks while backend builds the real thing.

| Method + path | Request body | Response | Calls |
|---|---|---|---|
| `POST /api/brain/run` | `{ traces: [...], previous_leads?: [...], options?: { daysAhead } }` | `{ leads, rows, trace_updates, funnel, cost, errors, mocked? }` | OpenAI (called by n8n, see `docs/brain.md`) |
| `POST /api/brain/extract` | `{ trace }` | `{ extraction, usage }` | OpenAI (debugging) |
| `POST /api/chat` | `{ messages: [...] }` | `{ reply: "..." }` | Claude |
| `POST /api/voice/tts` | `{ text: "..." }` | `audio/mpeg` | ElevenLabs |
| `POST /api/voice/stt` | form-data `audio` | `{ text: "..." }` | ElevenLabs |
| `POST /api/automation` | `{ ... }` | `{ ok: true, ... }` | n8n (`N8N_WEBHOOK_URL_MAIN`) |

Optional header `x-brain-key` on `/api/brain/*` when `BRAIN_API_KEY` is set.

## Which AI does what
| Job | Service | Why |
|---|---|---|
| Brain: extract people/projects/quotes, noise filter, same-person checks, days-ahead web search | OpenAI `OPENAI_MODEL_FAST` (gpt-5.4-mini) | The team plan requires OpenAI: strict structured output so n8n writes answers straight into tables, plus its built-in web_search tool for "days ahead"; the cheap model keeps cost per trace low |
| Brain: fit and team scoring | OpenAI `OPENAI_MODEL` (gpt-5.5) | Stronger model where judgement matters; weights fixed in `lib/ai/prompts/brain.js` |
| Main reasoning / text generation elsewhere | Claude | default LLM |
| Voice output / input | ElevenLabs | STT for pitch recordings (speakers told apart), founder clip, audio briefing |
| Fetch sources on a schedule, read/write the Traces and Leads tables, alerts | n8n | every flow; calls `/api/brain/run` |

## Out of scope
Things we deliberately won't build in 24h:
- Auth / accounts (use a hardcoded demo user)
- _TODO_

## Jury criteria and how we hit them
| Criterion | How we hit it |
|---|---|
| _TODO_ | _TODO_ |
