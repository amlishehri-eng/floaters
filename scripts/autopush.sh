#!/usr/bin/env bash
# Background half of autosync.sh: pull --rebase, build gate, push.
# Output is appended to .git/autosync.log; sync.sh shows the last line if it starts with FAIL.

cd "$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
gitdir=$(git rev-parse --absolute-git-dir 2>/dev/null) || exit 0
lock="$gitdir/autosync.lock"

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

# Put a system/Homebrew Node first on PATH. Other Nodes earlier on PATH (e.g. the one RStudio puts in
# ~/.local/bin) can't load Next's native compiler on macOS, and the build then fails on WASM.
for d in /usr/local/bin /opt/homebrew/bin; do
  [ -x "$d/node" ] && PATH="$d:$PATH"
done
export PATH

mkdir "$lock" 2>/dev/null || exit 0  # another run holds the lock
trap 'rm -rf "$lock"' EXIT
date +%s >"$lock/started"
date +%s >"$gitdir/autosync.last"

branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
[ -z "$branch" ] || [ "$branch" = "HEAD" ] && exit 0

# Returns 0 on success; on failure aborts any half-done rebase and logs FAIL.
pull_rebase() {
  if git pull --rebase --autostash --quiet origin "$branch" >/dev/null 2>&1; then
    return 0
  fi
  if [ -d "$gitdir/rebase-merge" ] || [ -d "$gitdir/rebase-apply" ]; then
    git rebase --abort >/dev/null 2>&1
    log "FAIL: rebase conflict, resolve manually"
  else
    log "FAIL: pull failed (offline or no access?), not pushed"
  fi
  return 1
}

lock_before=$(git rev-parse HEAD:package-lock.json 2>/dev/null)
pull_rebase || exit 0

if git rev-parse --verify --quiet "origin/$branch" >/dev/null; then
  ahead=$(git rev-list --count "origin/$branch..HEAD")
else
  ahead=1  # branch not on GitHub yet
fi
[ "$ahead" -eq 0 ] && exit 0

# Someone else's commits may have changed dependencies.
if [ "$(git rev-parse HEAD:package-lock.json 2>/dev/null)" != "$lock_before" ]; then
  npm install --no-audit --no-fund >/dev/null 2>&1 || log "warning: npm install failed"
fi

# Build gate. Separate distDir so a running `npm run dev` (.next) isn't corrupted.
sha=$(git rev-parse HEAD)
if ! out=$(NEXT_BUILD_DIR=.next-autosync NO_COLOR=1 npm run build 2>&1); then
  log "FAIL: build broken, not pushed"
  printf '%s\n' "$out" | tail -15
  log "FAIL: build broken, not pushed (details above)"
  exit 0
fi

# Push exactly the commit that was built (Claude may have committed more since).
if git push --quiet origin "$sha:refs/heads/$branch" >/dev/null 2>&1; then
  log "OK: pushed $(git rev-parse --short "$sha")"
  exit 0
fi

# Rejected: someone pushed in between. Rebase once more and retry once.
pull_rebase || exit 0
if git push --quiet origin "HEAD:refs/heads/$branch" >/dev/null 2>&1; then
  log "OK: pushed $(git rev-parse --short HEAD) (after retry)"
else
  log "FAIL: push rejected"
fi
exit 0
