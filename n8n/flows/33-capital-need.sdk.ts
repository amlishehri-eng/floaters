import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

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
    parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'CmDqydXaXEK5mg6F', cachedResultName: 'Leads' }, matchType: 'allConditions', returnAll: true },
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
    parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' }, matchType: 'allConditions', filters: { conditions: [{ keyName: 'status', condition: 'eq', keyValue: 'processed' }] }, returnAll: true },
    output: [{ trace_id: 'uni:tu-ilmenau.de:liquid-mirror', url: 'https://www.tu-ilmenau.de/', title: 'Liquid Mirror', text: 'We build adaptive liquid mirrors ...', status: 'processed' }]
  }
});

const pickLeads = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pick leads',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Which leads get a capital-need reading this run: survivors of the gates (call_now, watchlist, needs_enrichment)\n// whose reading is missing or whose evidence changed (hash of trace ids + what). One gpt-5-mini call per lead.\n// capital_need = how much money the company needs before it can earn at scale; HTGF's first ticket is EUR 800k+.\nconst MAX_PER_RUN = 400;\nconst TRACE_CHARS = 1500, MAX_TRACES = 4;\nconst SURVIVORS = ['call_now', 'watchlist', 'needs_enrichment'];\nconst MODEL = 'gpt-5-mini';\nconst INSTRUCTIONS = [\n  'You judge one early-stage startup for High-Tech Gruenderfonds (HTGF). HTGF\\'s first investment in pre-seed and seed is EUR 800,000 or more, so a fitting startup needs a round of that size to reach its next milestone.',\n  'Rate capital_need from 0 to 15: how much money this company needs before it can earn revenue at scale. Judge what they build, not how good they are.',\n  '- 12 to 15: hardware, sensors, robotics, photonics, quantum, materials, chemistry, biotech, medtech, energy systems, space; clinical trials, certification or regulatory approval (MDR, FDA, aviation); a lab, pilot plant or production line; or a stated raise of EUR 800k or more.',\n  '- 6 to 11: software that needs a team of engineers for one to two years, deep integration into regulated or industrial customers (hospitals, factories, banks), long enterprise sales cycles, expensive data or compute.',\n  '- 0 to 5: can be built by one to three people within months with little money: apps, websites, marketplaces, agencies or consulting, thin wrappers around someone else\\'s AI, small SaaS tools.',\n  'known: false (points 0) if the evidence says nothing about what they build. Never invent facts.',\n  'why: one line naming the concrete evidence. evidence: up to 2 items { trace_id, quote }; trace_id copied exactly from the TRACE IDS list, quote copied word for word from that trace (at most 200 characters). known true needs at least one evidence item.',\n  'Write umlauts and sharp s as plain characters.'\n].join('\\n');\nconst SCHEMA = { type: 'object', additionalProperties: false, required: ['points', 'known', 'why', 'evidence'], properties: {\n  points: { type: 'integer' }, known: { type: 'boolean' }, why: { type: 'string' },\n  evidence: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['trace_id', 'quote'], properties: { trace_id: { type: 'string' }, quote: { type: 'string' } } } } } };\nconst split = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);\nconst obj = s => { try { const v = typeof s === 'object' && s ? s : JSON.parse(s || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };\nconst djb2 = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };\nconst traces = new Map($('Get processed traces').all().map(i => [i.json.trace_id, i.json]));\nconst picked = [];\nfor (const item of $('Get all leads').all()) {\n  const l = item.json;\n  if (!l.lead_key || !SURVIVORS.includes(l.verdict)) continue;\n  const ids = split(l.trace_ids).sort();\n  const hash = djb2(ids.join(',') + '|' + (l.what || ''));\n  if (obj(l.capital_need).hash === hash) continue;\n  picked.push({ l, ids, hash });\n}\npicked.sort((a, b) => (Number(b.l.priority) || 0) - (Number(a.l.priority) || 0));\nreturn picked.slice(0, MAX_PER_RUN).map(({ l, ids, hash }) => {\n  const ts = ids.map(id => traces.get(id)).filter(Boolean).slice(0, MAX_TRACES);\n  const fitB = obj(l.fit_breakdown);\n  const tech = fitB.tech_depth && fitB.tech_depth.why ? 'Tech reading: ' + fitB.tech_depth.why : '';\n  const text = ts.map(t => '--- TRACE ' + t.trace_id + ' | ' + (t.title || '') + '\\n' + String(t.text || '').slice(0, TRACE_CHARS)).join('\\n\\n');\n  const input = 'STARTUP: ' + l.name + '\\nWhat: ' + (l.what || '') + '\\nSector: ' + (l.sector || '') + ' | Stage: ' + (l.stage || '') + ' | City: ' + (l.city || '') +\n    '\\n' + tech + '\\nQuotes:\\n' + (l.quotes || '(none)') + '\\n\\nTRACE IDS: ' + ts.map(t => t.trace_id).join(', ') + '\\n\\nEVIDENCE:\\n' + text;\n  return { json: { lead_key: l.lead_key, name: l.name, hash,\n    trace_meta: ts.map(t => ({ id: t.trace_id, url: t.url || null, text: String(t.text || '').slice(0, TRACE_CHARS) + ' ' + (t.title || '') })),\n    body: { model: MODEL, instructions: INSTRUCTIONS, input, max_output_tokens: 2000, reasoning: { effort: 'low' },\n      text: { format: { type: 'json_schema', name: 'capital_need', strict: true, schema: SCHEMA } } } } };\n});\n" },
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
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Model answer -> the capital_need column (JSON): points 0-15, known, why, evidence [{ trace_id, url, quote }], unsupported.\n// Code keeps only trace ids of this lead and a quote only when it really is in that trace. A known reading without\n// valid evidence is marked unsupported (13 counts it 0). No readable answer: nothing is written, the lead is tried next run.\nconst MAX = 15;\nconst norm = s => String(s || '').toLowerCase().split('\"').join('').split('“').join('').split('”').join('').split(/\\s+/).join(' ').trim();\nconst out = [];\n$input.all().forEach((item, i) => {\n  let p; try { p = $('Pick leads').itemMatching(i).json; } catch (e) { p = $('Pick leads').all()[i].json; }\n  let a = null;\n  for (const o of (item.json && item.json.output) || []) for (const x of o.content || []) if (x.type === 'output_text') { try { a = JSON.parse(x.text); } catch (e) {} }\n  if (!a) return;\n  const byId = new Map((p.trace_meta || []).map(t => [t.id, t]));\n  const evidence = [];\n  for (const e of Array.isArray(a.evidence) ? a.evidence : []) {\n    const t = byId.get(String(e && e.trace_id || '').trim());\n    if (!t || evidence.some(x => x.trace_id === t.id) || evidence.length >= 2) continue;\n    const q = String(e.quote || '').trim().slice(0, 200);\n    const ok = q.length >= 8 && norm(t.text).includes(norm(q).slice(0, 120));\n    evidence.push({ trace_id: t.id, url: t.url, quote: ok ? q : '' });\n  }\n  const known = a.known !== false;\n  const points = known ? Math.max(0, Math.min(MAX, Math.round(Number(a.points) || 0))) : 0;\n  const unsupported = known && !evidence.length;\n  const u = item.json.usage || {};\n  out.push({ json: { lead_key: p.lead_key,\n    capital_need: JSON.stringify({ points, max: MAX, known, why: String(a.why || ''), evidence, ...(unsupported ? { unsupported: true } : {}), hash: p.hash, model: 'gpt-5-mini', checked_at: new Date().toISOString() }),\n    _usage: { input: u.input_tokens || 0, output: u.output_tokens || 0 } } });\n});\nreturn out;\n" },
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
      dataTableId: { __rl: true, mode: 'id', value: 'CmDqydXaXEK5mg6F', cachedResultName: 'Leads' },
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
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Tokens and cost of this run -> one row in the Run costs table (funnel stats). gpt-5-mini: $0.25 per million input, $2 per million output.\nlet input = 0, output = 0, calls = 0;\nfor (const it of $input.all()) { const u = it.json._usage || {}; if (u.input || u.output) { calls++; input += u.input || 0; output += u.output || 0; } }\nreturn [{ json: { run_at: new Date().toISOString(), flow: '33 Capital need', step: 'capital need', model: 'gpt-5-mini', calls, input_tokens: input, output_tokens: output, web_searches: 0,\n  usd: Math.round((input * 0.25e-6 + output * 2e-6) * 10000) / 10000, seconds: null, execution_id: String($execution.id) } }];\n" },
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
      dataTableId: { __rl: true, mode: 'id', value: 'XEd20PPsoX0z9G5V', cachedResultName: 'Run costs' },
      columns: { mappingMode: 'defineBelow', matchingColumns: [], value: { run_at: expr('{{ $json.run_at }}'), flow: expr('{{ $json.flow }}'), step: expr('{{ $json.step }}'), model: expr('{{ $json.model }}'), calls: expr('{{ $json.calls }}'), input_tokens: expr('{{ $json.input_tokens }}'), output_tokens: expr('{{ $json.output_tokens }}'), web_searches: expr('{{ $json.web_searches }}'), usd: expr('{{ $json.usd }}'), seconds: expr('{{ $json.seconds }}'), execution_id: expr('{{ $json.execution_id }}') },
        schema: [{ id: 'run_at', displayName: 'run_at', required: false, defaultMatch: false, display: true, type: 'dateTime', canBeUsedToMatch: true }, { id: 'flow', displayName: 'flow', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'step', displayName: 'step', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'model', displayName: 'model', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'calls', displayName: 'calls', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }, { id: 'input_tokens', displayName: 'input_tokens', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }, { id: 'output_tokens', displayName: 'output_tokens', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }, { id: 'web_searches', displayName: 'web_searches', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }, { id: 'usd', displayName: 'usd', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }, { id: 'seconds', displayName: 'seconds', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }, { id: 'execution_id', displayName: 'execution_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }] },
      options: {}
    },
    output: [{ id: 99 }]
  }
});

const howItWorks = sticky('## 33 Capital need (Person 1, scoring v3)\nHTGF\'s first ticket in pre-seed and seed is **EUR 800k+** (htgf.de). This rates, for every lead that passed the gates, how much money it needs before it can earn at scale: **capital_need 0-15** (hardware, lab, clinical or regulatory work = high; small apps, agencies, AI wrappers = low), with a cited trace.\n- Only leads whose reading is missing or whose evidence changed; gpt-5-mini, 10 at a time (~$0.003 per lead).\n- Writes only the Leads column **capital_need** (JSON), then runs **13 Classify leads**, which puts it into fit (15 of 100 points).\n- Called by **00 Run all** after 10 Make leads. Plan: n8n/scoring-v3-plan.md', [getLeads, getTraces, pickLeads, askModel, readAnswers, saveCapital, runClassify, cost, saveCost], { color: 7 });

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
