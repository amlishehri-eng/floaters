#!/usr/bin/env bash
# Stop hook: runs after every Claude turn. Commits everything, then starts autopush.sh
# in the background (pull --rebase, build gate, push). Never blocks Claude: always exits 0.
# Works on macOS, Linux and Git Bash on Windows.

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
gitdir=$(git rev-parse --absolute-git-dir 2>/dev/null) || exit 0

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
[ -z "$branch" ] || [ "$branch" = "HEAD" ] && exit 0

for f in MERGE_HEAD rebase-merge rebase-apply CHERRY_PICK_HEAD; do
  [ -e "$gitdir/$f" ] && { echo "[autosync] merge/rebase/cherry-pick in progress, skipped."; exit 0; }
done

# 1. Commit whatever changed.
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  staged=$(git diff --cached --name-only)
  if printf '%s\n' "$staged" | grep -E '(^|/)\.env(\..*)?$' | grep -vqE '(^|/)\.env\.example$'; then
    git reset -q
    echo "[autosync] .env staged, aborted"
    exit 0
  fi
  count=$(printf '%s\n' "$staged" | grep -c .)
  names=$(printf '%s\n' "$staged" | head -5 | paste -sd, - | sed 's/,/, /g')
  if git commit -q -m "wip: auto-commit ($count files: $names)" >/dev/null 2>&1; then
    echo "[autosync] committed $count file(s)."
  fi
fi

# 2. Start the push in the background, unless one is running or the last one started < 3 min ago.
now=$(date +%s)
lock="$gitdir/autosync.lock"
if [ -d "$lock" ]; then
  started=$(cat "$lock/started" 2>/dev/null || echo 0)
  if [ $((now - started)) -lt 600 ]; then
    exit 0  # a push is already running
  fi
  rm -rf "$lock"  # stale lock from a crashed run
fi

last=$(cat "$gitdir/autosync.last" 2>/dev/null || echo 0)
if [ $((now - last)) -lt 180 ]; then
  exit 0
fi

script="$(pwd)/scripts/autopush.sh"
if command -v nohup >/dev/null 2>&1; then
  nohup bash "$script" >>"$gitdir/autosync.log" 2>&1 </dev/null &
else
  bash "$script" >>"$gitdir/autosync.log" 2>&1 </dev/null &
fi
echo "[autosync] pull/build/push running in background (log: .git/autosync.log)."
exit 0
