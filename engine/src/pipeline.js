// sources -> signals -> lead merge -> enrichment -> scoring
import { randomUUID } from 'node:crypto';
import config from '../config.js';
import store from './store.js';
import { mergeSignals, dedupeByDomain } from './merge.js';
import { enrichLead } from './enrich/index.js';
import { scoreLead } from './score.js';
import { familyOf } from './signals.js';
import { collectGithub } from './sources/github.js';
import { collectCt } from './sources/ct.js';
import { collectIncubators } from './sources/incubator.js';
import { setLlmDisabled, llmLabel } from './llm.js';
import { pool, log } from './util.js';

export const SOURCES = {
  github: collectGithub,
  ct: collectCt,
  incubator: collectIncubators,
};

let current = null;
export const isRunning = () => Boolean(current);

const familyCount = (lead) => new Set(lead.signals.map((s) => familyOf(s.source)).filter(Boolean)).size;
// Enrichment budget goes to the most informative sources first.
const SOURCE_WEIGHT = { manual: 5, incubator: 4, press_release: 3, idw: 3, text: 3, podcast: 3, competition: 3, github: 2, ct: 1 };
const weight = (lead) => Math.max(0, ...lead.signals.map((s) => SOURCE_WEIGHT[s.source] ?? 2));

/** Leads that have new signals since their last enrichment, multi-source first. */
function needsWork(lead) {
  if (lead.demo) return false;
  return !lead.enrichedAt || lead.signalsUpdatedAt > lead.enrichedAt;
}

export function enrichQueue(leads, limit) {
  return leads
    .filter(needsWork)
    .sort((a, b) => familyCount(b) - familyCount(a) || weight(b) - weight(a) || (b.signalsUpdatedAt || '').localeCompare(a.signalsUpdatedAt || ''))
    .slice(0, limit);
}

/** Enrich + score a set of leads and persist each as it finishes. */
export async function processLeads(leads, { enrich = true, useLlm = true, force = false, onDone } = {}) {
  return pool(leads, config.enrichConcurrency, async (lead) => {
    try {
      if (enrich) await enrichLead(lead, { force });
      await scoreLead(lead, { rethink: true, useLlm });
    } catch (e) {
      lead.enrichment = { ...(lead.enrichment || {}), errors: { ...(lead.enrichment?.errors || {}), pipeline: e.message } };
    }
    await store.upsertLead(lead);
    onDone?.(lead);
    return lead;
  });
}

/** Merge signals into the store. Returns { created, updated, removed } id sets. */
export async function ingestSignals(signals) {
  const leads = await store.listLeads();
  const res = mergeSignals(leads, signals);
  await store.saveLeads(res.leads);
  return res;
}

/**
 * Full sourcing run. Options: sources (array), since (YYYY-MM-DD), noLlm, noEnrich, limit.
 * Resolves when done; use startRun() for fire-and-forget.
 */
export async function runPipeline(opts = {}) {
  if (current) throw Object.assign(new Error('a run is already in progress'), { code: 'RUNNING' });
  const sources = (opts.sources?.length ? opts.sources : Object.keys(SOURCES)).filter((s) => SOURCES[s]);
  const run = {
    id: 'run_' + randomUUID().slice(0, 8),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'running',
    options: { sources, since: opts.since || null, noLlm: Boolean(opts.noLlm), noEnrich: Boolean(opts.noEnrich), limit: opts.limit ?? config.enrichLimit },
    llm: opts.noLlm ? 'disabled for this run' : llmLabel(),
    counts: { signals: 0, newLeads: 0, updatedLeads: 0, enriched: 0, rescored: 0 },
    bySource: {},
    log: [],
    errors: [],
  };
  current = run;
  await store.addRun(run);
  const note = (msg) => { run.log.push(`${new Date().toISOString().slice(11, 19)} ${msg}`); log('run', msg); };
  if (opts.noLlm) setLlmDisabled(true);

  try {
    const signals = [];
    for (const s of sources) {
      note(`source ${s}…`);
      try {
        const r = await SOURCES[s]({ since: opts.since });
        signals.push(...r.signals);
        run.bySource[s] = r.signals.length;
        r.log?.forEach((l) => note(`  ${s}: ${l}`));
        r.errors?.forEach((e) => run.errors.push(`${s}: ${e}`));
      } catch (e) {
        run.errors.push(`${s}: ${e.message}`);
        note(`  ${s} failed: ${e.message}`);
      }
      await store.updateRun(run.id, run);
    }
    run.counts.signals = signals.length;

    const merged = await ingestSignals(signals);
    run.counts.newLeads = merged.created.size;
    run.counts.updatedLeads = merged.updated.size;
    note(`merged ${signals.length} signals: ${merged.created.size} new leads, ${merged.updated.size} updated, ${merged.removed.size} merged away`);
    await store.updateRun(run.id, run);

    const leads = await store.listLeads();
    const queue = enrichQueue(leads, run.options.limit);
    note(`${opts.noEnrich ? 'scoring' : 'enriching + scoring'} ${queue.length} leads (limit ${run.options.limit}, concurrency ${config.enrichConcurrency})`);
    await processLeads(queue, {
      enrich: !opts.noEnrich,
      useLlm: !opts.noLlm,
      onDone: () => { run.counts.enriched++; },
    });

    // Domain discovery can reveal that two leads are one company.
    const all = await store.listLeads();
    const removed = dedupeByDomain(all);
    if (removed.size) note(`merged ${removed.size} leads that turned out to share a domain`);

    // Cheap pass: refresh rule score + earliness of everything else (thesis kept, no network).
    for (const lead of all) {
      if (lead.demo || queue.includes(lead)) continue;
      await scoreLead(lead, { rethink: !lead.score, useLlm: false });
      run.counts.rescored++;
    }
    await store.saveLeads(all);
    run.status = run.errors.length ? 'done_with_errors' : 'done';
  } catch (e) {
    run.status = 'failed';
    run.errors.push(e.message);
    note(`run failed: ${e.message}`);
  } finally {
    run.finishedAt = new Date().toISOString();
    note(`finished: ${run.status}`);
    await store.updateRun(run.id, run);
    setLlmDisabled(false);
    current = null;
  }
  return run;
}

/** Start a run in the background; returns the run id. */
export function startRun(opts) {
  if (current) throw Object.assign(new Error('a run is already in progress'), { code: 'RUNNING' });
  const p = runPipeline(opts); // sets `current` before its first await
  const id = current?.id;
  p.catch((e) => log('run', `crashed: ${e.message}`));
  return id;
}
