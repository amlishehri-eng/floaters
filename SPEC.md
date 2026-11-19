# SPEC

> Fill this in together at kickoff (first 30–45 min). If anything in the code or other docs conflicts with this file, **this file wins**.

## One-liner
_TODO: what it does, for whom, in one sentence._

## Problem
_TODO: who has the problem and why it hurts (2–3 sentences)._

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
| _TODO_ | `id`, … | _TODO_ |

## API routes (contract between frontend and backend)
Agree on these first so frontend can build against mocks while backend builds the real thing.

| Method + path | Request body | Response | Calls |
|---|---|---|---|
| `POST /api/chat` | `{ messages: [...] }` | `{ reply: "..." }` | Claude |
| `POST /api/voice/tts` | `{ text: "..." }` | `audio/mpeg` | ElevenLabs |
| `POST /api/voice/stt` | form-data `audio` | `{ text: "..." }` | ElevenLabs |
| `POST /api/automation` | `{ ... }` | `{ ok: true, ... }` | n8n (`N8N_WEBHOOK_URL_MAIN`) |

_Delete the rows you don't need; add your own._

## Which AI does what
| Job | Service | Why |
|---|---|---|
| Main reasoning / text generation | Claude | default LLM |
| _TODO (only if needed)_ | OpenAI | _TODO: why Claude isn't enough here_ |
| Voice output / input | ElevenLabs | TTS / STT |
| _TODO_ | n8n | _TODO: e.g. send email, save to sheet, notify Slack_ |

## Out of scope
Things we deliberately won't build in 24h:
- Auth / accounts (use a hardcoded demo user)
- _TODO_
