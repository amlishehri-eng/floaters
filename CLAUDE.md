# Read first, every time
@STATUS.md
@SPEC.md

`scripts/sync.sh` runs on every session start and prompt (hook in `.claude/settings.json`) and prints `[sync]` lines: what's new on origin/main and the current STATUS.md. Read them before anything else.

After finishing a task: update your own entry in STATUS.md and commit it.

# Project
Hackathon prototype, 24h, 3 people. Goal: one clean happy path that can be demoed live.
Idea and flow are defined in SPEC.md. If anything conflicts, SPEC.md wins.
Who owns what and what's in progress: STATUS.md. How each external service is wired: docs/integrations.md.

# Stack
- Next.js 16 (App Router), JavaScript, Tailwind v4, shadcn/ui
  - Next 16 has breaking changes vs. older versions: check `node_modules/next/dist/docs/` before writing Next-specific code
- API routes under /app/api for everything that uses keys (never keys in the frontend)
- LLM: Claude (@anthropic-ai/sdk) by default, OpenAI only if SPEC.md requires it
- Voice: ElevenLabs (TTS/STT) through our own API route
- Automations: n8n via webhook (URL from .env)
- Deployment: Vercel, auto-deploy on push to main

# Folders
| Folder | What goes there | Owner |
|---|---|---|
| `app/` (except `app/api/`) | Pages and layouts | Frontend |
| `components/` | UI components (shadcn lives in `components/ui/`) | Frontend |
| `app/api/` | API routes, the only place keys are used | Backend |
| `lib/ai/`, `lib/voice/` | Claude, OpenAI, ElevenLabs helpers | Backend |
| `lib/n8n.js`, `n8n/` | Webhook calls + exported n8n workflow JSON | n8n |
| `data/` | Mock data and fallback responses | Whoever owns the API it mocks |
| `docs/` | Integrations, pitch, demo script | Pitch |

# Commands
- `npm run dev` start locally on :4000 (first runs `scripts/predev.mjs`: fetches, fast-forwards a clean branch, warns if behind main, runs `npm install` if deps changed)
- `npm run build` before every merge into main
- `npm run lint`

# Working rules
- Small changes, keep it runnable after every step, commit often
- One branch per person: `frontend/…`, `backend/…`, `ai/…`, `n8n/…`, `pitch/…`
- Never push directly to main, except bugfixes in the final phase (announce in chat first)
- Merge into main via pull request, small and often (at least every few hours)
- Respect folder ownership, only touch other people's files after agreeing
- No new libraries without a short reason in chat
- Mock data lives in /data so the demo can run without external APIs
- Every external API has a fallback (mock response) in case it fails during the demo
- Never commit .env, add new variables to .env.example immediately

# Code style
- Short functions, clear names, no over-engineered abstractions
- Catch errors and show them in the UI, don't swallow them silently
- Comments only where the reason isn't obvious

# Before starting a task: catch up first
Three people push in parallel, so never work blind. Every Claude Code session already starts by running `scripts/predev.mjs` (SessionStart hook in `.claude/settings.json`); its `[predev]` lines tell you whether it pulled, what's behind, and whether it ran `npm install`. Then follow **"Before you start any task"** in AGENTS.md. In short:
1. `git fetch origin`, then read `git log --oneline -15 origin/main` and `git log --oneline --all --since="6 hours ago"`; `git show --stat` anything touching your files
2. `git status` (never overwrite the human's uncommitted work) and `git log --oneline HEAD..origin/main` (if behind, tell the human to update from main; don't merge yourself unless asked)
3. Read STATUS.md (In progress, Blocked, Decisions) and SPEC.md if it changed
4. Give the human a 3-line catch-up (what changed, who's on what, what affects this task, e.g. new deps → `npm install`)
5. Add your task to STATUS.md → In progress

# Before finishing a task
1. Does `npm run build` pass?
2. Does the happy path from SPEC.md work?
3. Is STATUS.md updated?
