// `npm run run -- --sources=github,ct --since=2026-08-01 --no-llm --no-enrich --limit=10`
import { runPipeline, SOURCES } from './pipeline.js';
import store from './store.js';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

if (args.help) {
  console.log(`Usage: npm run run -- [--sources=${Object.keys(SOURCES).join(',')}] [--since=YYYY-MM-DD] [--no-llm] [--no-enrich] [--limit=N]`);
  process.exit(0);
}

const run = await runPipeline({
  sources: typeof args.sources === 'string' ? args.sources.split(',').map((s) => s.trim()) : undefined,
  since: typeof args.since === 'string' ? args.since : undefined,
  noLlm: Boolean(args['no-llm']),
  noEnrich: Boolean(args['no-enrich']),
  limit: args.limit ? +args.limit : undefined,
});

const leads = (await store.listLeads()).filter((l) => !l.hidden && l.score).sort((a, b) => b.score.total - a.score.total);
console.log(`\n${run.status}: ${run.counts.signals} signals, ${run.counts.newLeads} new leads, ${run.counts.enriched} enriched`);
if (run.errors.length) console.log('Errors:\n  ' + run.errors.slice(0, 10).join('\n  '));
console.log('\nTop leads:');
for (const l of leads.slice(0, 10)) {
  console.log(`  ${String(l.score.total).padStart(3)}  ${l.name.padEnd(32).slice(0, 32)} ${(l.domain || '-').padEnd(28).slice(0, 28)} ${l.earliness?.summary || ''}`);
}
