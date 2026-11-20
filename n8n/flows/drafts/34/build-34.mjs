// Builds n8n/flows/34-team-enrichment.sdk.ts from the code files in this folder.
import fs from "node:fs";
import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname);
const code = (f) => JSON.stringify(fs.readFileSync(path.join(here, f), "utf8"));
const LEADS = "{ __rl: true, mode: 'id', value: 'CmDqydXaXEK5mg6F', cachedResultName: 'Leads' }";
const TRACES = "{ __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' }";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";
const http = (name, url, batch, interval) => `node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: '${name}',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      method: 'GET',
      url: expr(${JSON.stringify(url)}),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: '${UA}' }] },
      options: { timeout: 10000, redirect: { redirect: { maxRedirects: 3 } }, response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }, batching: { batch: { batchSize: ${batch}, batchInterval: ${interval} } } }
    },
    output: [{ data: '<html>...</html>' }]
  }
})`;
const col = (id, type) => `{ id: '${id}', displayName: '${id}', required: false, defaultMatch: false, display: true, type: '${type}', canBeUsedToMatch: true }`;
const traceCols = ["trace_id", "source", "url", "happened_at", "found_at", "title", "text", "people", "org_name", "city", "status", "website"];
const traceType = { happened_at: "dateTime", found_at: "dateTime" };
const ts = `import { workflow, node, trigger, sticky, expr, ifElse } from '@n8n/workflow-sdk';

const runByHand = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Run by hand' } });

const calledByRunAll = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.3,
  config: { name: 'Called by Run all', parameters: { inputSource: 'passthrough' } }
});

const getLeads = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Get all leads',
    executeOnce: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: ${LEADS}, matchType: 'allConditions', returnAll: true },
    output: [{ lead_key: 'acme', name: 'Acme Robotics', verdict: 'needs_enrichment', website: 'https://acme-robotics.de/', priority: 450, site_checked_at: null }]
  }
});

const pickLeads = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pick leads',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${code("pick-leads.js")} },
    output: [{ lead_key: 'acme', name: 'Acme Robotics', city: 'Munich', trace_ids: 'uni:x:acme', host: 'acme-robotics.de', origin: 'https://acme-robotics.de', home: 'https://acme-robotics.de/', robots: 'https://acme-robotics.de/robots.txt' }]
  }
});

const fetchRobots = ${http("Fetch robots.txt", "{{ $json.robots }}", 10, 1000)};

const fetchHome = ${http("Fetch home", "{{ $('Pick leads').item.json.home }}", 10, 2000)};

const planPages = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Plan pages',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${code("plan-pages.js")} },
    output: [{ lead_key: 'acme', kind: 'team', url: 'https://acme-robotics.de/team', home_text: 'We build robot grippers' }]
  }
});

const fetchPages = ${http("Fetch pages (2 s apart)", "{{ $json.url }}", 10, 2000)};

const buildTraces = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build site traces',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${code("build-traces.js")} },
    output: [{ ok: true, lead_key: 'acme', trace_id: 'site:acme-robotics.de', site_checked_at: '2026-11-20T23:00:00Z', trace_ids: 'uni:x:acme, site:acme-robotics.de', trace: { trace_id: 'site:acme-robotics.de', source: 'website', url: 'https://acme-robotics.de/team', happened_at: '2026-11-20T23:00:00Z', found_at: '2026-11-20T23:00:00Z', title: 'Acme Robotics: own website', text: 'Website text (...): Team page: ...', people: '', org_name: 'Acme Robotics', city: 'Munich', status: 'processed', website: 'https://acme-robotics.de/' } }]
  }
});

const hasText = ifElse({
  version: 2.2,
  config: {
    name: 'Useful text?',
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' }, conditions: [{ leftValue: expr('{{ $json.ok }}'), operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' } }
  }
});

const saveTrace = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save site trace',
    parameters: {
      resource: 'row',
      operation: 'upsert',
      dataTableId: ${TRACES},
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'trace_id', condition: 'eq', keyValue: expr('{{ $json.trace.trace_id }}') }] },
      columns: { mappingMode: 'defineBelow', matchingColumns: [], value: { ${traceCols.map((c) => `${c}: expr('{{ $json.trace.${c} }}')`).join(", ")} },
        schema: [${traceCols.map((c) => col(c, traceType[c] || "string")).join(", ")}] },
      options: {}
    },
    output: [{ id: 1, trace_id: 'site:acme-robotics.de' }]
  }
});

const addToLead = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Add trace to lead',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: ${LEADS},
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'lead_key', condition: 'eq', keyValue: expr("{{ $('Build site traces').item.json.lead_key }}") }] },
      columns: { mappingMode: 'defineBelow', matchingColumns: [], value: { trace_ids: expr("{{ $('Build site traces').item.json.trace_ids }}"), site_checked_at: expr("{{ $('Build site traces').item.json.site_checked_at }}") },
        schema: [${col("trace_ids", "string")}, ${col("site_checked_at", "string")}] },
      options: {}
    },
    output: [{ id: 1, lead_key: 'acme' }]
  }
});

const markChecked = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Mark checked (no useful text)',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: ${LEADS},
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'lead_key', condition: 'eq', keyValue: expr('{{ $json.lead_key }}') }] },
      columns: { mappingMode: 'defineBelow', matchingColumns: [], value: { site_checked_at: expr('{{ $json.site_checked_at }}') }, schema: [${col("site_checked_at", "string")}] },
      options: {}
    },
    output: [{ id: 2, lead_key: 'thin' }]
  }
});

const howItWorks = sticky('## 34 Team enrichment (Person 1, scoring v3)\\nMost leads that pass the gates are stuck on **needs enrichment**: strong tech, but the traces say nothing about the team. This reads the startup\\'s **own website** (team, about and Impressum pages; robots.txt respected, 10 sites at a time, 2 s between batches, emails and phone numbers removed) and saves it as one extra trace **site:<host>** (source website, status processed) on the lead.\\n- Only leads with tech_depth >= 18/25, a website and no earlier check (site_checked_at); best first, max 100 per run.\\n- 15 Score leads then sees changed evidence and judges the team again (by hand: 50 per run, enriched leads first).\\n- Called by **00 Run all** after 10 Make leads. Plan: n8n/scoring-v3-plan.md', [getLeads, pickLeads, fetchRobots, fetchHome, planPages, fetchPages, buildTraces, hasText, saveTrace, addToLead, markChecked], { color: 7 });

export default workflow('team-enrichment', '34 Team enrichment')
  .add(runByHand)
  .to(getLeads)
  .to(pickLeads)
  .to(fetchRobots)
  .to(fetchHome)
  .to(planPages)
  .to(fetchPages)
  .to(buildTraces)
  .to(hasText.onTrue(saveTrace.to(addToLead)).onFalse(markChecked))
  .add(calledByRunAll)
  .to(getLeads)
  .add(howItWorks)
  .group('Pick and fetch', [getLeads, pickLeads, fetchRobots, fetchHome, planPages, fetchPages, buildTraces], { description: 'Leads with strong tech and a website -> robots.txt, home, team, about, Impressum -> one site trace per lead' })
  .group('Save', [hasText, saveTrace, addToLead], { description: 'Useful text -> Traces (site:<host>) and the lead\\'s trace_ids' });
`;
fs.writeFileSync(path.resolve(here, "../../34-team-enrichment.sdk.ts"), ts);
console.log("wrote n8n/flows/34-team-enrichment.sdk.ts", ts.length, "chars");
