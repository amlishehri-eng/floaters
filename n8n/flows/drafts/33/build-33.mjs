// Builds n8n/flows/33-capital-need.sdk.ts from the three code files in this folder (JSON.stringify keeps every escape right).
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
    output: [{ lead_key: 'liquid-mirror', name: 'Liquid Mirror', verdict: 'call_now', trace_ids: 'uni:tu-ilmenau.de:liquid-mirror', what: 'Liquid mirror optics', priority: 590, capital_need: null }]
  }
});

const getTraces = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Get processed traces',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: ${TRACES}, matchType: 'allConditions', filters: { conditions: [{ keyName: 'status', condition: 'eq', keyValue: 'processed' }] }, returnAll: true },
    output: [{ trace_id: 'uni:tu-ilmenau.de:liquid-mirror', url: 'https://www.tu-ilmenau.de/', title: 'Liquid Mirror', text: 'We build adaptive liquid mirrors ...', status: 'processed' }]
  }
});

const pickLeads = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pick leads',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${code("pick-leads.js")} },
    output: [{ lead_key: 'liquid-mirror', name: 'Liquid Mirror', hash: 'abc123', trace_meta: [{ id: 'uni:tu-ilmenau.de:liquid-mirror', url: 'https://www.tu-ilmenau.de/', text: 'We build adaptive liquid mirrors' }], body: { model: 'gpt-5-mini' } }]
  }
});

const askModel = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Ask gpt-5-mini (10 at a time)',
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
      options: { timeout: 120000, batching: { batch: { batchSize: 10, batchInterval: 0 } } }
    },
    credentials: { openAiApi: { id: 'CGwebxN9hCQpUEFW', name: 'OpenAI Team Key' } },
    output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"points":13,"known":true,"why":"builds optical hardware","evidence":[]}' }] }], usage: { input_tokens: 900, output_tokens: 300 } }]
  }
});

const readAnswers = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Read answers',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: ${code("read-answers.js")} },
    output: [{ lead_key: 'liquid-mirror', capital_need: '{"points":13,"max":15}', _usage: { input: 900, output: 300 } }]
  }
});

const saveCapital = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save capital need',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: ${LEADS},
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'lead_key', condition: 'eq', keyValue: expr('{{ $json.lead_key }}') }] },
      columns: { mappingMode: 'defineBelow', matchingColumns: [], value: { capital_need: expr('{{ $json.capital_need }}') },
        schema: [{ id: 'capital_need', displayName: 'capital_need', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }] },
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
    output: [{ run_at: '2026-11-20T22:00:00Z', flow: '33 Capital need', step: 'capital need', model: 'gpt-5-mini', calls: 10, input_tokens: 9000, output_tokens: 3000, web_searches: 0, usd: 0.0083, seconds: null, execution_id: '1' }]
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

const howItWorks = sticky('## 33 Capital need (Person 1, scoring v3)\\nHTGF\\'s first ticket in pre-seed and seed is **EUR 800k+** (htgf.de). This rates, for every lead that passed the gates, how much money it needs before it can earn at scale: **capital_need 0-15** (hardware, lab, clinical or regulatory work = high; small apps, agencies, AI wrappers = low), with a cited trace.\\n- Only leads whose reading is missing or whose evidence changed; gpt-5-mini, 10 at a time (~$0.003 per lead).\\n- Writes only the Leads column **capital_need** (JSON), then runs **13 Classify leads**, which puts it into fit (15 of 100 points).\\n- Called by **00 Run all** after 10 Make leads. Plan: n8n/scoring-v3-plan.md', [getLeads, getTraces, pickLeads, askModel, readAnswers, saveCapital, runClassify, cost, saveCost], { color: 7 });

export default workflow('capital-need', '33 Capital need')
  .add(runByHand)
  .to(getLeads)
  .to(getTraces)
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
  .group('Read capital need', [getLeads, getTraces, pickLeads, askModel, readAnswers], { description: 'Survivors without a current reading -> gpt-5-mini rates capital need 0-15 with a cited trace' })
  .group('Save and classify', [saveCapital, runClassify], { description: 'Only the capital_need column, then 13 Classify leads recomputes fit' })
  .group('Cost', [cost, saveCost], { description: 'Tokens and dollars of this run -> Run costs table' });
`;
fs.writeFileSync(path.resolve(here, "../../33-capital-need.sdk.ts"), ts);
console.log("wrote n8n/flows/33-capital-need.sdk.ts", ts.length, "chars");
