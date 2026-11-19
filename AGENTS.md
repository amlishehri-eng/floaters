# Agent instructions

All project rules live in **CLAUDE.md**. Read it before doing anything; it applies to every AI tool (Codex, Cursor, Copilot, Claude Code).

Also read:
- **SPEC.md**: the idea, the happy path and the data model. If anything conflicts, SPEC.md wins.
- **STATUS.md**: who owns which folders and what's in progress. Stay inside the owner's folders.
- **docs/integrations.md**: how Claude, OpenAI, ElevenLabs and n8n are wired in.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
