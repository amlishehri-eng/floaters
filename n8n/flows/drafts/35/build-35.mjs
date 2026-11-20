// Builds n8n/flows/35-age-funding.sdk.ts from the three code files in this folder (JSON.stringify keeps every escape right).
import fs from "node:fs";
import path from "node:path";
const here = path.dirname(new URL(import.meta.url).pathname);
const code = (f) => JSON.stringify(fs.readFileSync(path.join(here, f), "utf8"));
const LEADS = "{ __rl: true, mode: 'id', value: 'CmDqydXaXEK5mg6F', cachedResultName: 'Leads' }";
const TRACES = "{ __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' }";
const COSTS = "{ __rl: true, mode: 'id', value: 'XEd20PPsoX0z9G5V', cachedResultName: 'Run costs' }";
const costCols = ["run_at", "flow", "step", "model", "calls", "input_tokens", "output_tokens", "web_searches", "usd", "seconds", "execution_id"];
const costType = { run_at: "dateTime", flow: "string", step: "string", model: "string", execution_id: "string" };
const ts = `import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

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
    output: [{ lead_key: 'liquid-mirror', name: 'Liquid Mirror', verdict: 'call_now', trace_ids: 'uni:tu-ilmenau.de:liquid-mirror', what: 'Liquid mirror optics', priority: 590, age_check: null }]
  }
});

const pickLeads = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pick leads',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${code("pick-leads.js")} },
    output: [{ lead_key: 'liquid-mirror', name: 'Liquid Mirror', body: { model: 'gpt-5-mini' } }]
  }
});

const askModel = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Web check with gpt-5-mini (10 at a time)',
    onError: 'continueRegularOutput',
    retryOnFail: true,
    maxTries: 2,
    waitBetweenTries: 2000,
    parameters: {
      method: 'POST',
      url: 'https://api.openai.com/v1/responses',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'openAiApi',
      sendBody: true,
      contentType: 'json',
      specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json.body) }}'),
      options: { timeout: 240000, batching: { batch: { batchSize: 10, batchInterval: 0 } } }
    },
    credentials: { openAiApi: { id: 'CGwebxN9hCQpUEFW', name: 'OpenAI Team Key' } },
    output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"founded_year":2024,"founded_url":"https://example.com","founded_quote":"founded in 2024","rounds":[],"hq_country":"DE"}' }] }], usage: { input_tokens: 900, output_tokens: 300 } }]
  }
});

const readAnswers = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Read answers',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${code("read-answers.js")} },
    output: [{ lead_key: 'liquid-mirror', age_check: '{"founded_year":2024}', _usage: { input: 900, output: 300, searches: 2 } }]
  }
});

const saveCapital = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save age check',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: ${LEADS},
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'lead_key', condition: 'eq', keyValue: expr('{{ $json.lead_key }}') }] },
      columns: { mappingMode: 'defineBelow', matchingColumns: [], value: { age_check: expr('{{ $json.age_check }}') },
        schema: [{ id: 'age_check', displayName: 'age_check', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }] },
      options: {}
    },
    output: [{ id: 1, lead_key: 'liquid-mirror' }]
  }
});

const runClassify = node({
  type: 'n8n-nodes-base.executeWorkflow',
  version: 1.2,
  config: {
    name: 'Run 13 Classify leads',
    executeOnce: true,
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: { source: 'database', workflowId: { __rl: true, mode: 'id', value: 'pqLJklAO79NPAGa4', cachedResultName: '13 Classify leads' }, mode: 'once', options: { waitForSubWorkflow: true } },
    output: [{ ok: true }]
  }
});

const cost = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Cost of this run',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${code("cost.js")} },
    output: [{ run_at: '2026-11-20T22:00:00Z', flow: '35 Age and funding check', step: 'web check', model: 'gpt-5-mini', calls: 10, input_tokens: 90000, output_tokens: 9000, web_searches: 20, usd: 0.24, seconds: null, execution_id: '1' }]
  }
});

const saveCost = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save cost',
    parameters: {
      resource: 'row',
      operation: 'insert',
      dataTableId: ${COSTS},
      columns: { mappingMode: 'defineBelow', matchingColumns: [], value: { ${costCols.map((c) => `${c}: expr('{{ $json.${c} }}')`).join(", ")} },
        schema: [${costCols.map((c) => `{ id: '${c}', displayName: '${c}', required: false, defaultMatch: false, display: true, type: '${costType[c] || "number"}', canBeUsedToMatch: true }`).join(", ")}] },
      options: {}
    },
    output: [{ id: 99 }]
  }
});

const howItWorks = sticky('## 35 Age and funding check (Person 1, scoring v3)\\nHTGF only invests in companies **at most 3 years old** without an institutional round. Our traces rarely say when a company was founded or who funded it, so on 20 Nov Vyoma (2020), AlixLabs (2019), SaxonQ (2021) and Devanthro (2018) reached call now.\\n- Picks call_now and watchlist leads, plus needs_enrichment leads whose website flow 34 read; skips leads checked in the last 14 days; max 60 per run, best first.\\n- gpt-5-mini with **OpenAI web search** finds the founding year and every round, each with a source URL (~$0.02 per lead). Facts without a URL are dropped.\\n- Writes only the Leads column **age_check** (JSON), then runs **13 Classify leads**: founded more than 3 years ago = too_late, seed led by a VC or Series A+ = too_late, age still unknown = not call now.\\n- Called by **00 Run all** after 33.', [getLeads, pickLeads, askModel, readAnswers, saveCapital, runClassify, cost, saveCost], { color: 7 });

export default workflow('age-funding', '35 Age and funding check')
  .add(runByHand)
  .to(getLeads)
  .to(pickLeads)
  .to(askModel)
  .to(readAnswers)
  .to(saveCapital)
  .to(runClassify)
  .add(readAnswers)
  .to(cost)
  .to(saveCost)
  .add(calledByRunAll)
  .to(getLeads)
  .add(howItWorks)
  .group('Web check', [getLeads, pickLeads, askModel, readAnswers], { description: 'Call now, watchlist and enriched leads -> gpt-5-mini with web search finds founding year and rounds, each with a source URL' })
  .group('Save and classify', [saveCapital, runClassify], { description: 'Only the age_check column, then 13 Classify leads re-checks age and funding' })
  .group('Cost', [cost, saveCost], { description: 'Tokens and dollars of this run -> Run costs table' });
`;
fs.writeFileSync(path.resolve(here, "../../35-age-funding.sdk.ts"), ts);
console.log("wrote n8n/flows/35-age-funding.sdk.ts", ts.length, "chars");
