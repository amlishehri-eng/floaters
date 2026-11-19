# Agent instructions

All project rules live in **CLAUDE.md**. Read it before doing anything; it applies to every AI tool (Codex, Cursor, Copilot, Claude Code).

Also read:
- **SPEC.md**: the idea, the happy path and the data model. If anything conflicts, SPEC.md wins.
- **STATUS.md**: who owns which folders and what's in progress. Stay inside the owner's folders.
- **docs/integrations.md**: how Claude, OpenAI, ElevenLabs and n8n are wired in.

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

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
