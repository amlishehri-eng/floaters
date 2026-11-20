// Step 3: Convergence. One "mention" = one project in one trace (or one lead from an earlier run).
// Union-find links mentions by handle → name + affiliation/city → project name → fuzzy (asked to the fast model).
import { createHash } from "node:crypto";
import { MODEL_FAST } from "../openai.js";
import { SAME_ENTITY_SYSTEM } from "../prompts/brain.js";
import { CONCURRENCY, MAX_EVIDENCE_CHARS_PER_TRACE, MAX_SIMILARITY_CHECKS, ROLES, SIMILARITY_THRESHOLD, STAGES } from "./config.js";
import { mapLimit } from "./pool.js";
import {
  mostCommon,
  normCity,
  normHandle,
  normName,
  normProject,
  parseJson,
  parsePeople,
  similarity,
  slug,
  toDay,
} from "./normalize.js";

const SAME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["same", "why"],
  properties: { same: { type: "boolean" }, why: { type: "string" } },
};

class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(i) {
    while (this.parent[i] !== i) i = this.parent[i] = this.parent[this.parent[i]];
    return i;
  }
  union(a, b) {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return false;
    this.parent[Math.max(ra, rb)] = Math.min(ra, rb);
    return true;
  }
}

// ---------- mentions ----------

function traceDay(trace) {
  return toDay(trace.happened_at) || toDay(trace.found_at);
}

// The scout's people list often has handles the extraction missed: copy them over by name.
function withScoutHandles(people, trace) {
  const scout = parsePeople(trace.people);
  return people.map((p) => {
    const handle = normHandle(p.handle) || scout.find((s) => s.handle && normName(s.name) === normName(p.name))?.handle || null;
    return { ...p, handle };
  });
}

export function mentionsFromTraces(traces) {
  const mentions = [];
  for (const trace of traces) {
    const projects = trace.extraction?.projects || [];
    projects.forEach((project, i) => {
      const people = withScoutHandles(project.people || [], trace);
      const name = project.name || (projects.length === 1 ? trace.org_name || null : null);
      if (!name && people.length === 0) return;
      mentions.push({
        kind: "trace",
        label: trace.id,
        trace,
        day: traceDay(trace),
        project: { ...project, name, city: project.city || trace.city || null },
        people,
        index: i,
      });
    });
  }
  return mentions.sort((a, b) => String(a.day).localeCompare(String(b.day)));
}

export function mentionsFromLeads(previousLeads) {
  return previousLeads
    .filter((lead) => lead?.id)
    .map((lead) => {
      const people = (parseJson(lead.people, null) ?? parsePeople(lead.people)).map((p) => ({
        name: p.name,
        handle: normHandle(p.handle),
        role: p.role || "other",
        affiliation: p.affiliation || null,
        links: Array.isArray(p.links) ? p.links : [],
      }));
      return {
        kind: "lead",
        label: lead.id,
        lead,
        day: toDay(lead.first_trace_at),
        project: {
          name: lead.name || null,
          what: lead.what || null,
          sector: lead.sector || "other",
          city: lead.city || null,
          country: lead.country || null,
          stage: lead.stage || "unknown",
          quotes: [],
          funding_mentioned: { mentioned: false, what: null },
        },
        people,
        signals: parseJson(lead.signals, []) || [],
      };
    });
}

// ---------- linking ----------

const isFullName = (n) => n.split(" ").length >= 2 && n.length >= 5;

function linkByKey(mentions, uf, reasons, keysOf) {
  const first = new Map();
  mentions.forEach((m, i) => {
    for (const { key, describe } of keysOf(m)) {
      if (!first.has(key)) {
        first.set(key, { i, m });
        continue;
      }
      const prev = first.get(key);
      if (uf.union(prev.i, i)) reasons.push({ i, text: `${describe(prev.m, m)} (${prev.m.label} ↔ ${m.label})` });
    }
  });
}

const handleKeys = (m) =>
  m.people
    .filter((p) => p.handle)
    .map((p) => ({ key: p.handle, describe: () => `certain: same handle @${p.handle}` }));

const personKeys = (m) =>
  m.people.flatMap((p) => {
    const n = normName(p.name);
    if (!isFullName(n)) return [];
    const keys = [];
    const aff = normProject(p.affiliation);
    const city = normCity(m.project.city);
    if (aff) keys.push({ key: `${n}|aff:${aff}`, describe: () => `likely: same person "${p.name}" at ${p.affiliation}` });
    if (city) keys.push({ key: `${n}|city:${city}`, describe: () => `likely: same person "${p.name}" in ${m.project.city}` });
    return keys;
  });

const projectKeys = (m) => {
  const key = normProject(m.project.name);
  if (key.length < 3) return [];
  return [{ key, describe: (a) => `likely: same project "${a.project.name}" = "${m.project.name}"` }];
};

function describeForCheck(m, personName) {
  const p = m.people.find((x) => x.name === personName);
  return [
    `source: ${m.trace?.source || "earlier lead"} (${m.label}), date ${m.day || "?"}`,
    `project: ${m.project.name || "(unnamed)"}: ${m.project.what || ""}`,
    `city: ${m.project.city || "?"}`,
    p ? `person: ${p.name}, role ${p.role}, affiliation ${p.affiliation || "?"}, handle ${p.handle || "none"}` : null,
    `all people: ${m.people.map((x) => x.name).join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

// Rule 4: names that are close but not equal, in different groups.
function fuzzyCandidates(mentions, uf) {
  const best = new Map();
  const consider = (i, j, sim, what, a, b) => {
    if (sim < SIMILARITY_THRESHOLD || sim === 1) return;
    const ri = uf.find(i);
    const rj = uf.find(j);
    if (ri === rj) return;
    const pair = ri < rj ? `${ri}-${rj}` : `${rj}-${ri}`;
    if (!best.has(pair) || best.get(pair).sim < sim) best.set(pair, { i, j, sim, what, a, b });
  };

  for (let i = 0; i < mentions.length; i++) {
    for (let j = i + 1; j < mentions.length; j++) {
      const mi = mentions[i];
      const mj = mentions[j];
      // Two leads from earlier runs were already compared back then: don't pay for it again.
      if (mi.kind === "lead" && mj.kind === "lead") continue;
      for (const pi of mi.people) {
        for (const pj of mj.people) {
          const a = normName(pi.name);
          const b = normName(pj.name);
          if (isFullName(a) && isFullName(b)) consider(i, j, similarity(a, b), "person", pi.name, pj.name);
        }
      }
      const a = normProject(mi.project.name);
      const b = normProject(mj.project.name);
      if (a.length >= 3 && b.length >= 3) consider(i, j, similarity(a, b), "project", mi.project.name, mj.project.name);
    }
  }
  return [...best.values()].sort((x, y) => y.sim - x.sim);
}

/**
 * Groups mentions into teams. Returns { groups: [{ mentions, reasons }], checks }.
 * track(usage, meta) records cost, onError(meta, err) records failed checks.
 */
export async function converge(mentions, { llm, track, onError }) {
  const uf = new UnionFind(mentions.length);
  const reasons = [];

  linkByKey(mentions, uf, reasons, handleKeys);
  linkByKey(mentions, uf, reasons, personKeys);
  linkByKey(mentions, uf, reasons, projectKeys);

  const candidates = fuzzyCandidates(mentions, uf).slice(0, MAX_SIMILARITY_CHECKS);
  const verdicts = await mapLimit(candidates, CONCURRENCY, async (c) => {
    const [ma, mb] = [mentions[c.i], mentions[c.j]];
    try {
      const { data, usage } = await llm({
        step: "same",
        model: MODEL_FAST,
        effort: "low",
        system: SAME_ENTITY_SYSTEM,
        input: `Is ${c.what} "${c.a}" the same as "${c.b}"?\n\nRecord A\n${describeForCheck(ma, c.a)}\n\nRecord B\n${describeForCheck(mb, c.b)}`,
        schema: SAME_SCHEMA,
        name: "same_entity",
        pair: c,
      });
      track(usage, { step: "same" });
      return { ...c, same: Boolean(data.same), why: data.why };
    } catch (err) {
      if (err.usage) track(err.usage, { step: "same" });
      onError({ step: "same", pair: `${ma.label} ↔ ${mb.label}` }, err);
      return { ...c, same: false };
    }
  });

  for (const v of verdicts) {
    if (v.same && uf.union(v.i, v.j)) {
      reasons.push({ i: v.i, text: `checked: ${v.what} "${v.a}" ≈ "${v.b}": ${v.why} (${mentions[v.i].label} ↔ ${mentions[v.j].label})` });
    }
  }

  const byRoot = new Map();
  mentions.forEach((m, i) => {
    const root = uf.find(i);
    if (!byRoot.has(root)) byRoot.set(root, { mentions: [], reasons: [] });
    byRoot.get(root).mentions.push(m);
  });
  for (const r of reasons) byRoot.get(uf.find(r.i)).reasons.push(r.text);

  return { groups: [...byRoot.values()], checks: verdicts.length };
}

// ---------- one lead per group ----------

function mergePeople(mentions) {
  const merged = [];
  for (const m of mentions) {
    for (const p of m.people) {
      const n = normName(p.name);
      const handle = normHandle(p.handle);
      let e = merged.find((x) => (handle && x.handle === handle) || (n && normName(x.name) === n));
      if (!e) {
        e = { name: p.name || handle, handle: null, role: p.role || "other", affiliation: null, links: [] };
        merged.push(e);
      }
      e.handle ||= handle;
      e.affiliation ||= p.affiliation || null;
      if (ROLES.indexOf(p.role) !== -1 && ROLES.indexOf(p.role) < ROLES.indexOf(e.role)) e.role = p.role;
      const host = m.trace?.source === "huggingface" ? "https://huggingface.co" : "https://github.com";
      const links = [...(p.links || []), ...(handle ? [`${host}/${handle}`] : [])];
      for (const l of links) if (l && !e.links.includes(l)) e.links.push(l);
    }
  }
  return merged;
}

function signalsOf(mentions) {
  const signals = [];
  const seen = new Set();
  const add = (s) => {
    const key = `${s.trace_id}|${s.kind}|${s.quote}|${s.timestamp}`;
    if (seen.has(key)) return;
    seen.add(key);
    signals.push(s);
  };

  for (const m of mentions.filter((x) => x.kind === "trace")) {
    const t = m.trace;
    const base = { trace_id: t.id, source: t.source, url: t.url || null, happened_at: m.day, title: t.title || null };
    const quotes = m.project.quotes || [];
    if (quotes.length === 0) add({ ...base, kind: "appearance", quote: null, timestamp: null });
    for (const q of quotes) add({ ...base, kind: q.kind, quote: q.text, timestamp: q.timestamp || null });
  }
  // Signals from earlier runs whose traces aren't in this batch. The web check is redone or reused separately.
  for (const m of mentions.filter((x) => x.kind === "lead")) {
    for (const s of m.signals) if (s?.trace_id) add(s);
  }
  return signals.sort((a, b) => String(a.happened_at || "9999").localeCompare(String(b.happened_at || "9999")));
}

export function evidenceHash(traceIds) {
  return createHash("sha256").update([...traceIds].sort().join("\n")).digest("hex").slice(0, 16);
}

function pickId(group, usedIds) {
  const prev = group.mentions.find((m) => m.kind === "lead");
  let id = prev?.lead.id;
  if (!id) {
    const projectKey = mostCommon(group.mentions.map((m) => normProject(m.project.name)).filter((k) => k.length >= 3));
    const handle = group.mentions.flatMap((m) => m.people).find((p) => p.handle)?.handle;
    const person = group.mentions.flatMap((m) => m.people).find((p) => p.name)?.name;
    id = `lead:${slug(projectKey || handle || person || "unknown")}`;
  }
  let unique = id;
  for (let n = 2; usedIds.has(unique); n++) unique = `${id}-${n}`;
  usedIds.add(unique);
  return unique;
}

export function buildLead(group, usedIds) {
  const ms = group.mentions;
  const projects = ms.map((m) => m.project);
  const signals = signalsOf(ms);
  const traceSignals = signals.filter((s) => s.trace_id);
  const days = [...traceSignals.map((s) => s.happened_at), ...ms.map((m) => m.day)].filter(Boolean).sort();

  const byName = new Map();
  for (const p of projects) if (p.name) byName.set(normProject(p.name), [...(byName.get(normProject(p.name)) || []), p.name]);
  const topKey = mostCommon(projects.map((p) => (p.name ? normProject(p.name) : null)));
  const name = topKey ? mostCommon(byName.get(topKey).sort((a, b) => a.length - b.length)) : null;

  const sectors = projects.map((p) => p.sector).filter((s) => s && s !== "other");
  const city = mostCommon(projects.map((p) => p.city));
  const traceWhat = ms.filter((m) => m.kind === "trace" && m.project.what).map((m) => m.project.what);
  const stage = projects.map((p) => p.stage || "unknown").sort((a, b) => STAGES.indexOf(b) - STAGES.indexOf(a))[0];

  const lead = {
    id: pickId(group, usedIds),
    name,
    people: mergePeople(ms),
    what: traceWhat.at(-1) || projects.find((p) => p.what)?.what || null,
    sector: mostCommon(sectors) || "other",
    city,
    country: mostCommon(projects.map((p) => p.country)) || (normCity(city) === "munich" ? "DE" : null),
    stage,
    label: null,
    label_reason: null,
    fit_score: null,
    team_score: null,
    signals,
    source_count: new Set(traceSignals.map((s) => s.source)).size,
    first_trace_at: days[0] || null,
    first_public_at: null,
    days_ahead: null,
    fit_reason: null,
    team_reason: null,
    match_reasons: [...new Set([...group.reasons, ...ms.flatMap((m) => (m.kind === "lead" ? parseJson(m.lead.match_reasons, []) || [] : []))])],
    evidence_hash: evidenceHash(new Set(traceSignals.map((s) => s.trace_id))),
    still_invisible: null,
    worth_a_call: false,
  };
  const funding = projects.filter((p) => p.funding_mentioned?.mentioned).map((p) => p.funding_mentioned.what || "yes");
  return { lead, evidence: evidenceText(lead, ms, funding) };
}

// The combined evidence the filter and the scorer read.
function evidenceText(lead, mentions, funding) {
  const people = lead.people
    .map((p) => `- ${p.name}${p.handle ? ` (@${p.handle})` : ""}, ${p.role}${p.affiliation ? `, ${p.affiliation}` : ""}`)
    .join("\n");
  const sources = mentions.map((m) => {
    if (m.kind === "lead") {
      return `[earlier lead ${m.lead.id}] ${m.lead.name || ""}: ${m.lead.what || ""}\nlabel then: ${m.lead.label || "?"}, ${m.lead.label_reason || ""}`;
    }
    const t = m.trace;
    const quotes = (m.project.quotes || []).map((q) => `  quote${q.timestamp ? ` [${q.timestamp}]` : ""} (${q.kind}): "${q.text}"`);
    return [
      `[${t.source}] ${t.title || ""} (${m.day || "?"}) ${t.url || ""}`,
      `  project as written here: ${m.project.name || "(unnamed)"}: ${m.project.what || ""} (stage: ${m.project.stage})`,
      ...quotes,
      `  text excerpt: ${String(t.text || "").replace(/\s+/g, " ").slice(0, MAX_EVIDENCE_CHARS_PER_TRACE)}`,
    ].join("\n");
  });
  return [
    `Team: ${lead.name || "(unnamed)"}`,
    `What: ${lead.what || "?"}`,
    `Sector: ${lead.sector} · City: ${lead.city || "?"}, ${lead.country || "?"} · Stage: ${lead.stage}`,
    `Sources: ${lead.source_count} different source types, first trace ${lead.first_trace_at || "?"}`,
    `Funding mentioned: ${funding.length ? funding.join("; ") : "no"}`,
    "People:",
    people || "- none named",
    "",
    "Evidence:",
    ...sources,
  ].join("\n");
}
