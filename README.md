# Floaters

> _TODO: one-liner from SPEC.md_

24-hour hackathon prototype built with **Next.js**, **Claude**, **OpenAI**, **ElevenLabs** and **n8n**.

## Start here
| File | What it's for |
|---|---|
| [SPEC.md](SPEC.md) | The idea, the happy path, API contracts. **Source of truth.** |
| [STATUS.md](STATUS.md) | Who owns what, what's done, what's blocked. Update it constantly. |
| [CLAUDE.md](CLAUDE.md) | Rules for Claude Code (read automatically) |
| [AGENTS.md](AGENTS.md) | Points Codex/Cursor/Copilot to CLAUDE.md |
| [docs/integrations.md](docs/integrations.md) | How Claude, OpenAI, ElevenLabs and n8n are wired in |
| [.claude/agents/](.claude/agents/) | Claude Code subagents: `frontend`, `backend`, `ai-voice`, `n8n`, `pitch`, `demo-check` |
| [.env.example](.env.example) | Every environment variable, as placeholders |

## Folder structure
```
app/                 pages (frontend)
app/api/             API routes, the only place keys are used (backend)
components/          UI components, shadcn in components/ui/ (frontend)
lib/ai/              Claude + OpenAI helpers, prompts/ (backend/AI)
lib/voice/           ElevenLabs helper (backend/AI)
lib/n8n.js           webhook calls to n8n (n8n)
n8n/                 exported n8n workflows (JSON)
data/                mock data + fallback responses for the demo
public/demo/         pre-recorded audio / images for the demo
docs/                integrations, pitch
.claude/agents/      Claude Code subagents
```

## Getting started
1. Clone in GitHub Desktop (**File → Clone Repository…**).
2. `cp .env.example .env.local` and fill in the values you got privately.
3. `npm install`
4. `npm run dev`, then open http://localhost:4000

No keys yet? Set `USE_MOCKS=true` in `.env.local` and everything runs on mock data from `/data`.

## How we work
- **One branch per person and area**: `frontend/…`, `backend/…`, `ai/…`, `n8n/…`, `pitch/…`
  (GitHub Desktop: **Current Branch → New Branch**).
- **Commit small, push often.** Open a pull request into `main` when a piece works; merge at least every few hours so nobody drifts.
- **`npm run build` must pass before merging.** Vercel auto-deploys `main`, so a broken main is a broken demo.
- **No direct pushes to main**, except announced bugfixes in the final phase.
- **Stay in your folders** (see STATUS.md); ask before touching someone else's.
- **Every external API has a mock fallback** in `/data`.
- **Before judging:** run the `demo-check` subagent, rehearse twice, tag the working commit `demo-v1`.

### Using the subagents in Claude Code
Ask for them by name, e.g. _"use the frontend agent to build the home screen from SPEC.md"_ or _"run demo-check"_.

## Links
- Live app (Vercel): _TODO_
- n8n workspace: _TODO_
- Pitch / slides: _TODO_
