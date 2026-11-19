#!/usr/bin/env bash
# Fetch from GitHub and report what is new. Only changes files on a safe fast-forward.

if ! git fetch --quiet origin 2>/dev/null; then
  echo "[sync] fetch failed (offline or no access). Work with the local state."
  exit 0
fi

branch=$(git rev-parse --abbrev-ref HEAD)
behind_main=$(git rev-list --count HEAD..origin/main 2>/dev/null || echo 0)

echo "[sync] branch: $branch | origin/main is $behind_main commit(s) ahead"

if [ "$behind_main" -gt 0 ]; then
  echo "[sync] new on main:"
  git log --oneline HEAD..origin/main | head -10
fi

if [ -z "$(git status --porcelain)" ] && git rev-parse --verify --quiet "origin/$branch" >/dev/null; then
  git merge --ff-only --quiet "origin/$branch" 2>/dev/null
fi

echo "[sync] STATUS.md on origin/main:"
git show origin/main:STATUS.md 2>/dev/null || echo "(no STATUS.md on main yet)"
