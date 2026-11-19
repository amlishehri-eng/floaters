#!/usr/bin/env bash
# SessionStart + UserPromptSubmit hook: fetch, pull --rebase, report what's new and any blocked push.
# Never blocks Claude: always exits 0.

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
gitdir=$(git rev-parse --absolute-git-dir 2>/dev/null) || exit 0

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

busy=""
for f in MERGE_HEAD rebase-merge rebase-apply CHERRY_PICK_HEAD autosync.lock; do
  [ -e "$gitdir/$f" ] && busy="$f"
done

if [ -n "$busy" ]; then
  echo "[sync] skipped pull ($busy in progress)."
elif [ "$branch" != "HEAD" ] && git rev-parse --verify --quiet "origin/$branch" >/dev/null; then
  if ! git pull --rebase --autostash --quiet origin "$branch" >/dev/null 2>&1; then
    if [ -d "$gitdir/rebase-merge" ] || [ -d "$gitdir/rebase-apply" ]; then
      git rebase --abort >/dev/null 2>&1
      echo "[sync] WARNING: pull --rebase hit a conflict and was aborted. Resolve manually: git pull --rebase origin $branch"
    else
      echo "[sync] WARNING: pull --rebase failed. Run it manually: git pull --rebase origin $branch"
    fi
  fi
fi

last_log=$(tail -n 1 "$gitdir/autosync.log" 2>/dev/null)
case "$last_log" in
  *FAIL:*) echo "[sync] last autosync: $last_log (see .git/autosync.log). Fix this before anything else." ;;
esac

echo "[sync] STATUS.md on origin/main:"
git show origin/main:STATUS.md 2>/dev/null || echo "(no STATUS.md on main yet)"
exit 0
