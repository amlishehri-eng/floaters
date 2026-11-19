// Runs automatically before `npm run dev` (npm "predev" hook) so nobody starts the app on stale code.
// 1. Fetches from GitHub.  2. Fast-forwards your branch if it's behind and you have no uncommitted work.
// 3. Warns if origin/main has commits your branch doesn't.  4. Runs `npm install` if dependencies changed.
// It never blocks the dev server: on any problem it prints a hint and lets `next dev` start.
import { execSync } from "node:child_process";
import { statSync } from "node:fs";

const log = (msg) => console.log(`\x1b[36m[predev]\x1b[0m ${msg}`);

function tryRun(cmd, timeout = 15000) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout }).trim();
  } catch {
    return null;
  }
}

const commitsIn = (range) => Number(tryRun(`git rev-list --count ${range}`) ?? 0);

function fetchLatest() {
  if (tryRun("git fetch origin --quiet") === null) {
    log("Couldn't reach GitHub (offline?). Starting with your local code.");
    return false;
  }
  return true;
}

function updateOwnBranch() {
  const upstream = tryRun("git rev-parse --abbrev-ref --symbolic-full-name @{u}");
  if (!upstream) return;

  const behind = commitsIn(`HEAD..${upstream}`);
  if (!behind) return log(`Up to date with ${upstream}.`);

  if (tryRun("git status --porcelain")) {
    return log(`${upstream} has ${behind} new commit(s), but you have uncommitted changes. Commit, then pull in GitHub Desktop.`);
  }
  if (tryRun("git pull --ff-only --quiet") === null) {
    return log(`Couldn't fast-forward to ${upstream} (branches diverged). Pull in GitHub Desktop.`);
  }
  log(`Pulled ${behind} new commit(s) from ${upstream}.`);
}

function checkMain() {
  const branch = tryRun("git branch --show-current");
  if (!branch || branch === "main") return;

  const behind = commitsIn("HEAD..origin/main");
  if (behind) log(`main has ${behind} commit(s) your branch doesn't. GitHub Desktop: Branch → Update from main.`);
}

const modifiedAt = (path) => {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
};

function syncDependencies() {
  // npm writes node_modules/.package-lock.json on every install; if the lockfile is newer, deps changed since.
  if (modifiedAt("package-lock.json") <= modifiedAt("node_modules/.package-lock.json")) return;

  log("Dependencies changed, running npm install...");
  try {
    execSync("npm install --no-audit --no-fund", { stdio: "inherit" });
  } catch {
    log("npm install failed. Run it manually.");
  }
}

if (fetchLatest()) {
  updateOwnBranch();
  checkMain();
}
syncDependencies();
