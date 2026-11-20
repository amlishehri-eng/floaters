import { workflow, node, trigger } from '@n8n/workflow-sdk';

// 46 Screen extras (Nils, range 40-49). Read-only: GET /webhook/htgf-screen-extras
// -> { as_of, labs: top 10 of the Labs table by gap_score, backtest: summary of the latest run in the Backtest table }.
// Used by the app's /api/extras (pages /proof/labs, /proof/methodology and the home backtest band).

const hook = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.1,
  config: {
    name: 'GET /webhook/htgf-screen-extras',
    parameters: { httpMethod: 'GET', path: 'htgf-screen-extras', responseMode: 'responseNode', options: { allowedOrigins: '*' } },
  },
});

const byHand = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Run by hand' } });

const getLabs = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Get labs',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'LmTiFFdCbBriACc0', cachedResultName: 'Labs' },
      matchType: 'allConditions',
      filters: {},
      returnAll: true,
    },
  },
});

const getBacktest = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Get backtest',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'sNcoB7PMpMeIx5zU', cachedResultName: 'Backtest' },
      matchType: 'allConditions',
      filters: {},
      returnAll: true,
    },
  },
});

const build = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Screen extras',
    executeOnce: true,
    parameters: {
      mode: 'runOnceForAllItems',
      language: 'javaScript',
      jsCode: `// Read-only summary for the screen. Labs: top 10 by gap_score. Backtest: the latest run (max run_at), counted per group
// with the same stage definitions as the STATUS line: stage 0 pass, deep tech = tech_depth >= 15, kept = call_now/watchlist/needs_enrichment.
const parse = (v, fb) => { if (v && typeof v === 'object') return v; try { return v ? JSON.parse(v) : fb; } catch (e) { return fb; } };
const labs = $('Get labs').all().map(i => i.json).filter(l => l.lab_key)
  .sort((a, b) => (Number(b.gap_score) || 0) - (Number(a.gap_score) || 0)).slice(0, 10)
  .map(l => ({
    lab_key: l.lab_key, name: l.name, institution: l.institution, city: l.city,
    fields: parse(l.fields, {}), works_24m: Number(l.works_24m) || 0, spinoffs_known: Number(l.spinoffs_known) || 0,
    gap_score: Number(l.gap_score) || 0, top_works: parse(l.top_works, []), why_visit: l.why_visit || '',
    spinoff_examples: parse(l.spinoff_examples, []), updated_at: l.updated_at || null, gap_formula: l.gap_formula || '', note: l.note || '',
  }));

const rows = $('Get backtest').all().map(i => i.json).filter(r => r.item_key && r.run_at);
const runAt = rows.reduce((m, r) => (String(r.run_at) > m ? String(r.run_at) : m), '');
const run = rows.filter(r => String(r.run_at) === runAt);
const KEPT = ['call_now', 'watchlist', 'needs_enrichment'];
const group = g => {
  const items = run.filter(r => r.group === g);
  return {
    n: items.length,
    stage0_pass: items.filter(r => r.stage0 === 'pass').length,
    deep_tech: items.filter(r => (Number(r.tech_depth) || 0) >= 15).length,
    kept: items.filter(r => KEPT.includes(r.verdict)).length,
    call_now: items.filter(r => r.verdict === 'call_now').length,
    cost_usd: Math.round(items.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0) * 10000) / 10000,
  };
};
const backtest = runAt ? {
  run_at: runAt,
  portfolio: group('portfolio'),
  control: group('control'),
  deep_tech_min: 15,
  misses: run.filter(r => r.group === 'portfolio' && (Number(r.tech_depth) || 0) < 15)
    .map(r => ({ company: r.company, verdict: r.verdict || '', tech_depth: r.tech_depth ?? null, stage0_rule: r.stage0_rule || '', source_kind: r.source_kind || '' })),
} : null;

return [{ json: { as_of: new Date().toISOString(), labs, backtest } }];`,
    },
  },
});

const respond = node({
  type: 'n8n-nodes-base.respondToWebhook',
  version: 1.5,
  config: {
    name: 'Respond extras',
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify($json) }}', options: { responseCode: 200 } },
  },
});

export default workflow('screen-extras', '46 Screen extras')
  .add(hook)
  .to(getLabs)
  .to(getBacktest)
  .to(build)
  .to(respond)
  .add(byHand)
  .to(getLabs);
