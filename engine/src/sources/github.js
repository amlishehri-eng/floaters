// GitHub source: (a) young orgs located in German cities, (b) young starred repos on deep-tech topics
// whose owner is an organisation with a German location. Organisations only (no personal profiles).
import config from '../../config.js';
import { makeSignal } from '../signals.js';
import { isGermanLocation } from '../score.js';
import { sleep, log, warn, daysAgo } from '../util.js';

// Word-boundary match so "uni" kills "uni-course" but not "unicorn".
export const NOISE_RE = /(^|[^a-z0-9])(uni|university|universit[aä]t|hochschule|course|kurs|seminar|lecture|vorlesung|praktikum|team\d+|group\d+|gruppe\d*|ws\d{2,4}|ss\d{2,4}|wise\d*|sose\d*|hackathon|hack|hacks|vibecoding|vibe-coding|student|students|studenten|demo|test|tests|testing|workshop|bootcamp|class|homework|assignment|tutorial|exercise|uebung|übung|fachschaft|club|meetup|ctf|gdg|mlh|lab-course|thesis|masterarbeit|bachelorarbeit|playground|sandbox|archive|mirror|fork)([^a-z0-9]|$)/i;

export function isNoiseOrg(...texts) {
  return texts.some((t) => t && NOISE_RE.test(String(t).toLowerCase()));
}

let lastSearch = 0;
let stopped = null;

async function gh(path, { search = false } = {}) {
  if (stopped) throw new Error(stopped);
  if (search) {
    // Search API: 30/min with token, 10/min without.
    const gap = config.github.token ? 2100 : 6500;
    const wait = lastSearch + gap - Date.now();
    if (wait > 0) await sleep(wait);
    lastSearch = Date.now();
  }
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': config.userAgent,
      'x-github-api-version': '2022-11-28',
      ...(config.github.token ? { authorization: `Bearer ${config.github.token}` } : {}),
    },
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 401) {
    stopped = 'GitHub 401: GITHUB_TOKEN is invalid or expired';
    warn('github', stopped);
    throw new Error(stopped);
  }
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset');
    const remaining = res.headers.get('x-ratelimit-remaining');
    const until = reset ? new Date(+reset * 1000).toLocaleTimeString() : 'later';
    if (remaining === '0' || res.status === 429) {
      stopped = `GitHub rate limit hit (${search ? 'search' : 'core'} API), resets at ${until}.${config.github.token ? '' : ' Set GITHUB_TOKEN for 30 searches/min and 5000 calls/h.'}`;
    } else {
      stopped = `GitHub 403 (secondary rate limit or abuse detection): ${(await res.text()).slice(0, 120)}`;
    }
    warn('github', stopped);
    throw new Error(stopped);
  }
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}`);
  return res.json();
}

const orgCache = new Map();

async function orgDetails(login) {
  if (orgCache.has(login)) return orgCache.get(login);
  const p = (async () => {
    const org = await gh(`/orgs/${encodeURIComponent(login)}`);
    let repos = [];
    try {
      repos = await gh(`/orgs/${encodeURIComponent(login)}/repos?sort=pushed&per_page=30&type=public`);
    } catch (e) {
      if (stopped) throw e;
    }
    repos = repos.filter((r) => !r.fork).sort((a, b) => b.stargazers_count - a.stargazers_count);
    return { org, repos };
  })();
  orgCache.set(login, p);
  return p;
}

function orgSignal({ org, repos }, extra = {}) {
  const top = repos.slice(0, config.github.reposPerOrg).map((r) => ({
    name: r.name, stars: r.stargazers_count, description: r.description || '', topics: r.topics || [], language: r.language, created: r.created_at, url: r.html_url,
  }));
  const stars = repos.reduce((a, r) => a + r.stargazers_count, 0);
  return makeSignal({
    source: 'github',
    type: 'github_org',
    name: org.name || org.login,
    domain: org.blog || undefined,
    url: org.html_url,
    date: org.created_at,
    data: {
      login: org.login, location: org.location || '', description: org.description || '', publicRepos: org.public_repos,
      stars, topRepos: top, topics: [...new Set(top.flatMap((r) => r.topics))].slice(0, 12), ...extra,
    },
  });
}

/**
 * @param {{since?: string, reduced?: boolean, maxOrgs?: number}} opts
 * @returns {Promise<{signals: object[], log: string[], errors: string[]}>}
 */
export async function collectGithub({ since = daysAgo(config.sinceDays), maxOrgs } = {}) {
  stopped = null;
  const reduced = !config.github.token;
  const cities = reduced ? ['Germany', 'Berlin', 'München'] : config.github.cities;
  const topics = reduced ? config.github.topics.slice(0, 4) : config.github.topics;
  const limit = maxOrgs ?? (reduced ? 12 : 120);
  const notes = [];
  const errors = [];
  if (reduced) {
    const msg = 'no GITHUB_TOKEN: reduced mode (3 cities, 4 topics, 12 orgs, 10 searches/min)';
    warn('github', msg);
    notes.push(msg);
  }

  const candidates = new Map(); // login -> extra data
  try {
    for (const city of cities) {
      const q = `type:org location:"${city}" created:>=${since}`;
      const res = await gh(`/search/users?q=${encodeURIComponent(q)}&per_page=50`, { search: true });
      for (const item of res.items || []) if (!candidates.has(item.login)) candidates.set(item.login, { foundVia: `org search: ${city}` });
      log('github', `orgs in ${city}: ${res.total_count ?? 0}`);
    }
    for (const topic of topics) {
      const q = `topic:${topic} created:>=${since} stars:>=${config.github.minStars}`;
      const res = await gh(`/search/repositories?q=${encodeURIComponent(q)}&sort=stars&per_page=50`, { search: true });
      let n = 0;
      for (const r of res.items || []) {
        if (r.owner?.type !== 'Organization') continue;
        const prev = candidates.get(r.owner.login) || { foundVia: `topic: ${topic}` };
        prev.matchedRepos = [...(prev.matchedRepos || []), { name: r.name, stars: r.stargazers_count, topic, created: r.created_at, url: r.html_url }];
        candidates.set(r.owner.login, prev);
        n++;
      }
      log('github', `topic ${topic}: ${n} org-owned repos`);
    }
  } catch (e) {
    errors.push(e.message);
  }

  const signals = [];
  let checked = 0;
  for (const [login, extra] of candidates) {
    if (checked >= limit || stopped) break;
    if (isNoiseOrg(login)) continue;
    checked++;
    try {
      const det = await orgDetails(login);
      const { org } = det;
      if (isNoiseOrg(org.name, org.description)) continue;
      if (extra.matchedRepos && !isGermanLocation(org.location)) continue; // topic hits need a German owner
      if (!det.repos.length && !org.blog) continue; // empty shell
      signals.push(orgSignal(det, extra));
    } catch (e) {
      errors.push(`${login}: ${e.message}`);
      if (stopped) break;
    }
  }
  if (stopped && !errors.includes(stopped)) errors.push(stopped);
  notes.push(`${candidates.size} candidate orgs, ${checked} checked, ${signals.length} kept`);
  return { signals, log: notes, errors };
}

/** Look up a single org by login (used for manual checks when a judge names a company). */
export async function githubOrgByLogin(login) {
  try {
    const det = await orgDetails(login);
    return orgSignal(det, { foundVia: 'manual lookup' });
  } catch {
    return null;
  }
}
