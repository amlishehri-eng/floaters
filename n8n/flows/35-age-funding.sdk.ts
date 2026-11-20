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
    output: [{ lead_key: 'liquid-mirror', name: 'Liquid Mirror', verdict: 'call_now', trace_ids: 'uni:tu-ilmenau.de:liquid-mirror', what: 'Liquid mirror optics', priority: 590, age_check: null }]
  }
});

const pickLeads = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pick leads',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Which leads get a web check of their age and funding this run (flow 35). HTGF only invests in companies up to 3 years old\n// that have no institutional round yet, and our traces rarely say when a company was founded or who funded it.\n// Picks call_now, then watchlist, then needs_enrichment leads whose website was read by flow 34, that were not checked\n// in the last 14 days. One gpt-5-mini call with OpenAI web search per lead.\nconst MAX_PER_RUN = 60;\nconst RECHECK_DAYS = 14;\nconst MODEL = 'gpt-5-mini';\nconst INSTRUCTIONS = [\n  'You check one German startup for High-Tech Gruenderfonds (HTGF), which only invests in companies founded at most 3 years ago that have not yet raised an institutional round.',\n  'Search the web for this exact company (match the name, website, city and what it builds; ignore other companies with a similar name).',\n  'founded_year: the year the company was founded or registered as a company (GmbH, UG, AG, AB ...), not the year the research started. null if you find no source.',\n  'founded_url and founded_quote: the page that says it and the sentence, copied word for word (at most 200 characters). Empty strings if founded_year is null.',\n  'rounds: every investment round you find, each with type, lead_investor, amount_eur_m (millions of euros, null if not disclosed), date, url and quote (word for word, at most 200 characters):',\n  '- series_a_plus: Series A or later.',\n  '- seed_vc: a closed seed or other round led by a venture capital fund, a corporate VC or a public VC fund (for example TGFS, Bayern Kapital, EIF-backed funds).',\n  '- pre_seed: a pre-seed round (also with a VC). angels: business angels only. grant: EXIST, EU, BMBF or other public grants and prizes. other: anything else.',\n  'register: the German commercial register entry (Handelsregister) if you find one, for example on handelsregister.de, unternehmensregister.de, northdata.de or the Impressum: court (Amtsgericht), number (HRB/HRA ...), registered_date (YYYY-MM-DD, the first registration), url. Empty strings if not found.',\n  'hq_country: ISO country code of the headquarters, empty if unknown. Never invent facts: only what a page you found says.'\n].join('\\n');\nconst ROUND = { type: 'object', additionalProperties: false, required: ['type', 'lead_investor', 'amount_eur_m', 'date', 'url', 'quote'], properties: {\n  type: { type: 'string', enum: ['series_a_plus', 'seed_vc', 'pre_seed', 'angels', 'grant', 'other'] }, lead_investor: { type: 'string' },\n  amount_eur_m: { type: ['number', 'null'] }, date: { type: 'string' }, url: { type: 'string' }, quote: { type: 'string' } } };\nconst SCHEMA = { type: 'object', additionalProperties: false, required: ['founded_year', 'founded_url', 'founded_quote', 'rounds', 'hq_country', 'register'], properties: {\n  founded_year: { type: ['integer', 'null'] }, founded_url: { type: 'string' }, founded_quote: { type: 'string' },\n  rounds: { type: 'array', items: ROUND }, hq_country: { type: 'string' },\n  register: { type: 'object', additionalProperties: false, required: ['court', 'number', 'registered_date', 'url'], properties: {\n    court: { type: 'string' }, number: { type: 'string' }, registered_date: { type: 'string' }, url: { type: 'string' } } } } };\nconst obj = s => { try { const v = typeof s === 'object' && s ? s : JSON.parse(s || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };\n// v2 (21 Nov): a seed round 'led by undisclosed' no longer counts as institutional, so v1 answers with a round are read again.\nconst fresh = c => c.checked_at && (Date.now() - new Date(c.checked_at)) / 864e5 < RECHECK_DAYS && !((c.v || 1) < 2 && c.institutional);\nconst ORDER = { call_now: 0, watchlist: 1, needs_enrichment: 2, too_late: 3 };\nconst picked = [];\nfor (const item of $('Get all leads').all()) {\n  const l = item.json;\n  if (!l.lead_key || String(l.verdict || '').startsWith('merged_into:')) continue;\n  const c = obj(l.age_check);\n  const wanted = ['call_now', 'watchlist'].includes(l.verdict) || (l.verdict === 'needs_enrichment' && l.site_checked_at) || ((c.v || 1) < 2 && c.institutional);\n  if (!wanted || fresh(c)) continue;\n  picked.push(l);\n}\npicked.sort((a, b) => ((ORDER[a.verdict] ?? 4) - (ORDER[b.verdict] ?? 4)) || (Number(b.priority) || 0) - (Number(a.priority) || 0));\nreturn picked.slice(0, MAX_PER_RUN).map(l => {\n  const people = String(l.people || '').split(';').map(x => x.trim()).filter(Boolean).slice(0, 4).join('; ');\n  const input = 'COMPANY: ' + l.name + '\\nWebsite: ' + (l.website && l.website !== 'none' ? l.website : 'unknown') + '\\nCity: ' + (l.city || 'unknown') +\n    '\\nWhat it builds: ' + (l.what || '') + '\\nFounders or team: ' + (people || 'unknown');\n  return { json: { lead_key: l.lead_key, name: l.name,\n    body: { model: MODEL, instructions: INSTRUCTIONS, input, tools: [{ type: 'web_search' }], max_output_tokens: 6000, reasoning: { effort: 'low' },\n      text: { format: { type: 'json_schema', name: 'age_and_funding', strict: true, schema: SCHEMA } } } } };\n});\n" },
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
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Model answer -> the Leads column age_check (JSON). Only facts with a source URL are kept. 13 Classify leads reads it:\n// register.registered_date (exact) and founded_year count for the 3-year age check, an institutional round (seed_vc or series_a_plus with a named lead\n// investor, or EUR 3M or more) means too late. No readable answer: nothing is written, the lead is tried next run.\nconst THIS_YEAR = new Date().getFullYear();\nconst out = [];\n$input.all().forEach((item, i) => {\n  let p; try { p = $('Pick leads').itemMatching(i).json; } catch (e) { p = $('Pick leads').all()[i].json; }\n  let a = null, searches = 0;\n  for (const o of (item.json && item.json.output) || []) {\n    if (o.type === 'web_search_call') searches++;\n    for (const x of o.content || []) if (x.type === 'output_text') { try { a = JSON.parse(x.text); } catch (e) {} }\n  }\n  if (!a) return;\n  const url = s => /^https?:\\/\\//.test(String(s || '')) ? String(s) : '';\n  const y = Number(a.founded_year);\n  const founded_year = Number.isInteger(y) && y >= 1980 && y <= THIS_YEAR && url(a.founded_url) ? y : null;\n  const rounds = (Array.isArray(a.rounds) ? a.rounds : []).filter(r => r && url(r.url)).slice(0, 8).map(r => ({\n    type: r.type, lead_investor: String(r.lead_investor || '').slice(0, 120), amount_eur_m: typeof r.amount_eur_m === 'number' ? r.amount_eur_m : null,\n    date: String(r.date || '').slice(0, 20), url: url(r.url), quote: String(r.quote || '').slice(0, 200) }));\n  // a seed without a named lead investor is 'unknown', not institutional (same rule as 13: a bare seed is not too late)\n  const named = r => r.lead_investor && !/^(undisclosed|unknown|not disclosed|n\\/?a|none|-|unnamed|various)$/i.test(r.lead_investor.trim());\n  const inst = rounds.find(r => r.type === 'series_a_plus' || (r.type === 'seed_vc' && named(r)) || (r.type !== 'grant' && (r.amount_eur_m || 0) >= 3));\n  const institutional = inst ? { claim: `${inst.type}${inst.lead_investor ? ' led by ' + inst.lead_investor : ''}${inst.amount_eur_m ? ', EUR ' + inst.amount_eur_m + 'M' : ''}${inst.date ? ' (' + inst.date + ')' : ''}`, url: inst.url, quote: inst.quote } : null;\n  const rg = a.register || {};\n  const regDate = /^\\d{4}-\\d{2}-\\d{2}$/.test(String(rg.registered_date || '')) && url(rg.url) && new Date(rg.registered_date) <= new Date() ? rg.registered_date : '';\n  const register = regDate || String(rg.number || '').trim() ? { court: String(rg.court || '').slice(0, 80), number: String(rg.number || '').slice(0, 40), registered_date: regDate, url: url(rg.url) } : null;\n  const u = item.json.usage || {};\n  out.push({ json: { lead_key: p.lead_key,\n    age_check: JSON.stringify({ founded_year, founded_url: founded_year ? url(a.founded_url) : '', founded_quote: founded_year ? String(a.founded_quote || '').slice(0, 200) : '',\n      rounds, institutional, register, hq_country: String(a.hq_country || '').toUpperCase().slice(0, 2), v: 2, model: 'gpt-5-mini', checked_at: new Date().toISOString() }),\n    _usage: { input: u.input_tokens || 0, output: u.output_tokens || 0, searches } } });\n});\nreturn out;\n" },
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
      dataTableId: { __rl: true, mode: 'id', value: 'CmDqydXaXEK5mg6F', cachedResultName: 'Leads' },
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
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Tokens, web searches and cost of this run -> one row in the Run costs table. gpt-5-mini: $0.25 per million input,\n// $2 per million output; OpenAI web search $10 per 1,000 calls.\nlet input = 0, output = 0, calls = 0, searches = 0;\nfor (const it of $input.all()) { const u = it.json._usage || {}; if (u.input || u.output) { calls++; input += u.input || 0; output += u.output || 0; searches += u.searches || 0; } }\nreturn [{ json: { run_at: new Date().toISOString(), flow: '35 Age and funding check', step: 'web check', model: 'gpt-5-mini', calls, input_tokens: input, output_tokens: output, web_searches: searches,\n  usd: Math.round((input * 0.25e-6 + output * 2e-6 + searches * 0.01) * 10000) / 10000, seconds: null, execution_id: String($execution.id) } }];\n" },
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
      dataTableId: { __rl: true, mode: 'id', value: 'XEd20PPsoX0z9G5V', cachedResultName: 'Run costs' },
      columns: { mappingMode: 'defineBelow', matchingColumns: [], value: { run_at: expr('{{ $json.run_at }}'), flow: expr('{{ $json.flow }}'), step: expr('{{ $json.step }}'), model: expr('{{ $json.model }}'), calls: expr('{{ $json.calls }}'), input_tokens: expr('{{ $json.input_tokens }}'), output_tokens: expr('{{ $json.output_tokens }}'), web_searches: expr('{{ $json.web_searches }}'), usd: expr('{{ $json.usd }}'), seconds: expr('{{ $json.seconds }}'), execution_id: expr('{{ $json.execution_id }}') },
        schema: [{ id: 'run_at', displayName: 'run_at', required: false, defaultMatch: false, display: true, type: 'dateTime', canBeUsedToMatch: true }, { id: 'flow', displayName: 'flow', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'step', displayName: 'step', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'model', displayName: 'model', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'calls', displayName: 'calls', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }, { id: 'input_tokens', displayName: 'input_tokens', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }, { id: 'output_tokens', displayName: 'output_tokens', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }, { id: 'web_searches', displayName: 'web_searches', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }, { id: 'usd', displayName: 'usd', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }, { id: 'seconds', displayName: 'seconds', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }, { id: 'execution_id', displayName: 'execution_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }] },
      options: {}
    },
    output: [{ id: 99 }]
  }
});

const howItWorks = sticky('## 35 Age and funding check (Person 1, scoring v3)\nHTGF only invests in companies **at most 3 years old** without an institutional round. Our traces rarely say when a company was founded or who funded it, so on 20 Nov Vyoma (2020), AlixLabs (2019), SaxonQ (2021) and Devanthro (2018) reached call now.\n- Picks call_now and watchlist leads, plus needs_enrichment leads whose website flow 34 read; skips leads checked in the last 14 days; max 60 per run, best first.\n- gpt-5-mini with **OpenAI web search** finds the founding year and every round, each with a source URL (~$0.02 per lead). Facts without a URL are dropped.\n- Writes only the Leads column **age_check** (JSON), then runs **13 Classify leads**: founded more than 3 years ago = too_late, seed led by a VC or Series A+ = too_late, age still unknown = not call now.\n- Called by **00 Run all** after 33.', [getLeads, pickLeads, askModel, readAnswers, saveCapital, runClassify, cost, saveCost], { color: 7 });

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
