import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const runByHand = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Run by hand' } });

const calledByRunAll = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.3,
  config: { name: 'Called by Run all', parameters: { inputSource: 'passthrough' } }
});

const getAll = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Get all traces',
    executeOnce: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' },
      matchType: 'allConditions',
      returnAll: true
    },
    output: [{ id: 85, trace_id: 'tumvl:futurail-2', url: 'https://www.tum-venture-labs.de/teams/futurail-2/', org_name: 'Futurail', status: 'new' }]
  }
});

const findDuplicates = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Find duplicates',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// A duplicate = the same source and listing page naming the same company twice (two spellings, or a site with two pages for one team).\n// The same company in two DIFFERENT sources is not a duplicate: that is convergence, screening merges it.\n// Strict on purpose: names must match exactly once legal forms and words like GmbH, .ai, Technologies are ignored\n// (so Abberior and Abberior Instruments stay two companies). Keeps the oldest row; only removes rows still marked new.\nconst LEGAL = /\\b(gmbh|ug|haftungsbeschrankt|ag|se|kg|ohg|gbr|e ?v|inc|ltd|llc|co|the|technologies|technology|tech|ai|labs?|io|app|de|com)\\b/g;\nconst norm = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(LEGAL, ' ').replace(/\\s+/g, '');\nconst groups = {};\nfor (const item of $input.all()) {\n  const r = item.json;\n  if (!r || !r.trace_id) continue;\n  const prefix = String(r.trace_id).split(':')[0];\n  if (!['tumvl', 'uni', 'cohort'].includes(prefix)) continue;\n  const name = norm(r.org_name || String(r.trace_id).split(':').pop().replace(/-/g, ' '));\n  if (name.length < 3) continue;\n  const key = prefix + '|' + (prefix === 'tumvl' ? '' : r.url) + '|' + name;\n  (groups[key] = groups[key] || []).push(r);\n}\nconst out = [];\nfor (const g of Object.values(groups)) {\n  if (g.length < 2) continue;\n  g.sort((a, b) => a.id - b.id);\n  for (const r of g.slice(1)) if (r.status === 'new') out.push({ json: { trace_id: r.trace_id, kept: g[0].trace_id } });\n}\nreturn out;\n" },
    output: [{ trace_id: 'tumvl:futurail', kept: 'tumvl:futurail-2' }]
  }
});

const removeDuplicates = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Remove duplicates',
    parameters: {
      resource: 'row',
      operation: 'deleteRows',
      dataTableId: { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' },
      matchType: 'allConditions',
      filters: { conditions: [
        { keyName: 'trace_id', condition: 'eq', keyValue: expr('{{ $json.trace_id }}') },
        { keyName: 'status', condition: 'eq', keyValue: 'new' }
      ] },
      options: {}
    },
    output: [{ id: 96 }]
  }
});

const howItWorks = sticky('## 32 Remove duplicate traces\nRuns in **Run all** after the sources, before 09 Find websites. A duplicate is the **same source and listing page** naming the **same company** twice (e.g. TUM has two pages for Futurail; the AI spelled a name two ways). Names must match exactly once GmbH, .ai, Technologies and similar are ignored, so Abberior and Abberior Instruments stay separate. Keeps the oldest row and only removes rows still marked **new**, so nothing screening already read is touched.\n\nThe same company in two **different** sources is NOT removed: that is the convergence signal, screening merges it.', [getAll, findDuplicates, removeDuplicates], { color: 7 });

export default workflow('remove-duplicate-traces', '32 Remove duplicate traces')
  .add(runByHand)
  .to(getAll)
  .to(findDuplicates)
  .to(removeDuplicates)
  .add(calledByRunAll)
  .to(getAll)
  .add(howItWorks)
  .group('Find and remove duplicates', [getAll, findDuplicates, removeDuplicates], { description: 'All traces -> same source, same page, same company name -> remove the newer ones (only if still new)' });
