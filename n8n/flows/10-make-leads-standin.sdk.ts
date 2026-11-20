import { workflow, node, trigger, sticky, expr, newCredential } from '@n8n/workflow-sdk';

const runByHand = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Run by hand' } });

const calledByRunAll = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.3,
  config: { name: 'Called by Run all', parameters: { inputSource: 'passthrough' } }
});

const getNewTraces = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Get new traces',
    executeOnce: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'status', condition: 'eq', keyValue: 'new' }] },
      returnAll: false,
      limit: 10,
      orderBy: true,
      orderByColumn: 'createdAt',
      orderByDirection: 'ASC'
    },
    output: [{ trace_id: 'pinboard:5033', source: 'pinboard', url: 'https://lmu-pinboard.munich-startup.de/anzeige/5033', happened_at: '2026-11-13T14:03:37.070Z', title: '[co-founder wanted] CTO fuer Klarvus', text: 'Klarvus ist ein KI-Agent fuer Arztpraxen...', people: 'Maximilian Schuetz (contact person)', org_name: 'Klarvus', city: 'Munich', status: 'new' }]
  }
});

const readTraceWithOpenAI = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Read trace with OpenAI',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5-mini' },
      responses: { values: [{ type: 'text', role: 'user', content: expr("Source: {{ $json.source }}\nDate: {{ $json.happened_at }}\nURL: {{ $json.url }}\nTitle: {{ $json.title }}\nOrganisation: {{ $json.org_name }}\nPeople: {{ $json.people }}\n\n{{ $json.text }}") }] },
      simplify: true,
      options: {
        instructions: "You screen early traces of possible startups for High-Tech Gruenderfonds (HTGF), a German seed investor in tech startups (about 70% of its investments are in Germany). A trace is one thing found online: an event page, a pinboard post, a talk transcript, a repo. Read it and answer only with the JSON the schema asks for.\n\nRules:\n- project_name: the startup or project the trace is about. For an event page that is not about one startup, use the event name and label it event_only.\n- people: only people named in the trace, with their role (founder, co-founder, researcher, host, speaker, contact). Never invent names.\n- quotes: copy short sentences from the trace that show a founding moment, with a kind: cofounder_search, pilot_customer, raising, grant_or_award, first_hire, other. Keep them in the original language.\n- label:\n  - assignment: a course, seminar or thesis project that ends with the semester\n  - agency: sells services or projects to clients (web design, consulting, marketing)\n  - hobby: one person, no users, no plan to build a company\n  - event_only: an event listing, not a team\n  - vc_backable: a product for a market, technical depth, intent to build a company that could raise venture money\n- fit_score (0-100): how well it fits HTGF: based in Germany (Munich first), a tech product with depth, seed stage or earlier, no funding announced yet. Agencies, hobbies, assignments and events score below 20.\n- team_score (0-100): technical founder present, complementary roles, worked together before, research or PhD depth, earlier startup. A solo non-technical founder looking for a CTO scores lower than a technical team with pilots.\n- score_reason: one sentence explaining both scores.",
        maxTokens: 4000,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'trace_reading', strict: true, schema: "{\"type\": \"object\", \"additionalProperties\": false, \"required\": [\"project_name\", \"what\", \"sector\", \"city\", \"stage\", \"people\", \"quotes\", \"label\", \"label_reason\", \"fit_score\", \"team_score\", \"score_reason\"], \"properties\": {\"project_name\": {\"type\": \"string\"}, \"what\": {\"type\": \"string\"}, \"sector\": {\"type\": \"string\", \"enum\": [\"digital tech\", \"industrial tech\", \"life sciences\", \"chemistry\", \"climate and energy\", \"other\"]}, \"city\": {\"type\": \"string\"}, \"stage\": {\"type\": \"string\", \"enum\": [\"idea\", \"prototype\", \"pilot customers\", \"revenue\", \"unknown\"]}, \"people\": {\"type\": \"array\", \"items\": {\"type\": \"object\", \"additionalProperties\": false, \"required\": [\"name\", \"role\"], \"properties\": {\"name\": {\"type\": \"string\"}, \"role\": {\"type\": \"string\"}}}}, \"quotes\": {\"type\": \"array\", \"items\": {\"type\": \"object\", \"additionalProperties\": false, \"required\": [\"text\", \"kind\"], \"properties\": {\"text\": {\"type\": \"string\"}, \"kind\": {\"type\": \"string\", \"enum\": [\"cofounder_search\", \"pilot_customer\", \"raising\", \"grant_or_award\", \"first_hire\", \"other\"]}}}}, \"label\": {\"type\": \"string\", \"enum\": [\"assignment\", \"agency\", \"hobby\", \"event_only\", \"vc_backable\"]}, \"label_reason\": {\"type\": \"string\"}, \"fit_score\": {\"type\": \"integer\"}, \"team_score\": {\"type\": \"integer\"}, \"score_reason\": {\"type\": \"string\"}}}" } }
      }
    },
    credentials: { openAiApi: newCredential('OpenAI') },
    output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: '{}' }] }] }]
  }
});

const shapeLead = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Shape lead',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// OpenAI answer + the trace it read -> one row for the Leads table (and the trace id to mark as processed).\nconst traces = $('Get new traces').all();\nconst findJson = v => {\n  if (typeof v === 'string') { try { const o = JSON.parse(v); if (o && typeof o === 'object' && 'label' in o) return o; } catch (e) {} return null; }\n  if (v && typeof v === 'object') { if ('label' in v && 'project_name' in v) return v; for (const k of Object.keys(v)) { const r = findJson(v[k]); if (r) return r; } }\n  return null;\n};\nconst slug = s => (s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\\b(gmbh|ug|haftungsbeschrankt|ag|e\\.?v\\.?|inc|ltd)\\b/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');\nreturn $input.all().map((item, i) => {\n  const t = traces[i].json;\n  const a = findJson(item.json) || { project_name: t.org_name || t.title, label: 'unreadable', label_reason: 'The model answer could not be read', people: [], quotes: [], fit_score: 0, team_score: 0 };\n  return { json: {\n    trace_id: t.trace_id,\n    lead_key: slug(a.project_name) || slug(t.title),\n    name: a.project_name || '',\n    what: a.what || '',\n    sector: a.sector || '',\n    city: a.city || t.city || '',\n    stage: a.stage || '',\n    people: (a.people || []).map(p => p.name + (p.role ? ' (' + p.role + ')' : '')).join('; '),\n    quotes: (a.quotes || []).map(q => '[' + q.kind + '] ' + q.text).join('\\n'),\n    label: a.label,\n    label_reason: a.label_reason || '',\n    fit_score: Number(a.fit_score) || 0,\n    team_score: Number(a.team_score) || 0,\n    score_reason: a.score_reason || '',\n    trace_ids: t.trace_id,\n    sources: t.source,\n    source_count: 1,\n    first_trace_at: t.happened_at,\n    status: 'new',\n    mark_status: a.label === 'unreadable' ? 'failed' : 'processed',\n  }};\n});\n" },
    output: [{ trace_id: 'pinboard:5033', lead_key: 'klarvus', name: 'Klarvus', what: 'AI agent for doctors practices', sector: 'digital tech', city: 'Munich', stage: 'pilot customers', people: 'Maximilian Schuetz (founder)', quotes: '[pilot_customer] laeuft in Pilotpraxen', label: 'vc_backable', label_reason: 'Product with pilots', fit_score: 78, team_score: 45, score_reason: 'Solo technical founder with pilots.', trace_ids: 'pinboard:5033', sources: 'pinboard', source_count: 1, first_trace_at: '2026-11-13T14:03:37.070Z', status: 'new', mark_status: 'processed' }]
  }
});

const saveLead = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save lead',
    parameters: {
      resource: 'row',
      operation: 'upsert',
      dataTableId: { __rl: true, mode: 'id', value: 'CmDqydXaXEK5mg6F', cachedResultName: 'Leads' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'lead_key', condition: 'eq', keyValue: expr('{{ $json.lead_key }}') }] },
      columns: { mappingMode: 'defineBelow', value: { lead_key: expr('{{ $json.lead_key }}'), name: expr('{{ $json.name }}'), what: expr('{{ $json.what }}'), sector: expr('{{ $json.sector }}'), city: expr('{{ $json.city }}'), stage: expr('{{ $json.stage }}'), people: expr('{{ $json.people }}'), quotes: expr('{{ $json.quotes }}'), label: expr('{{ $json.label }}'), label_reason: expr('{{ $json.label_reason }}'), fit_score: expr('{{ $json.fit_score }}'), team_score: expr('{{ $json.team_score }}'), score_reason: expr('{{ $json.score_reason }}'), trace_ids: expr('{{ $json.trace_ids }}'), sources: expr('{{ $json.sources }}'), source_count: expr('{{ $json.source_count }}'), first_trace_at: expr('{{ $json.first_trace_at }}'), status: expr('{{ $json.status }}') }, matchingColumns: [], schema: [{ id: 'lead_key', displayName: 'lead_key', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'name', displayName: 'name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'what', displayName: 'what', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'sector', displayName: 'sector', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'city', displayName: 'city', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'stage', displayName: 'stage', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'people', displayName: 'people', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'quotes', displayName: 'quotes', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'label', displayName: 'label', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'label_reason', displayName: 'label_reason', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'fit_score', displayName: 'fit_score', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }, { id: 'team_score', displayName: 'team_score', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }, { id: 'score_reason', displayName: 'score_reason', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'trace_ids', displayName: 'trace_ids', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'sources', displayName: 'sources', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'source_count', displayName: 'source_count', required: false, defaultMatch: false, display: true, type: 'number', canBeUsedToMatch: true }, { id: 'first_trace_at', displayName: 'first_trace_at', required: false, defaultMatch: false, display: true, type: 'dateTime', canBeUsedToMatch: true }, { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }] },
      options: {}
    },
    output: [{ id: 1, createdAt: '2026-11-20T12:00:00.000Z', updatedAt: '2026-11-20T12:00:00.000Z' }]
  }
});

const markTraceDone = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Mark trace done',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'trace_id', condition: 'eq', keyValue: expr("{{ $('Shape lead').item.json.trace_id }}") }] },
      columns: { mappingMode: 'defineBelow', value: { status: expr("{{ $('Shape lead').item.json.mark_status }}") }, matchingColumns: [], schema: [{ id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }] },
      options: {}
    },
    output: [{ id: 1, createdAt: '2026-11-20T12:00:00.000Z', updatedAt: '2026-11-20T12:00:00.000Z' }]
  }
});

const todo = sticky('## Person 2: what to improve next\n1. **Convergence**: a lead seen again overwrites trace_ids. Merge trace_ids and sources, and count source_count.\n2. **Days ahead**: Brave Search news (n8n credits) for the name -> first_public_at, days_ahead.\n3. **Calibrate** the filter on 20 hand-labelled traces; tune the prompt in Read trace with OpenAI.\n4. Raise the 10-trace limit in Get new traces once costs look fine.', [], { color: 4 });

const howItWorks = sticky('## 10 Make leads (person 2)\nTakes up to 10 traces with status **new**, asks OpenAI (n8n credits) to read each one: who, what, stage, founder quotes, noise label (hobby / agency / assignment / event_only / vc_backable) and two scores. Saves one row per project in **Leads**, then marks the trace **processed** (or **failed** if the answer could not be read).', [getNewTraces, readTraceWithOpenAI, shapeLead, saveLead, markTraceDone], { color: 7 });

export default workflow('make-leads', '10 Make leads')
  .add(runByHand)
  .to(getNewTraces)
  .to(readTraceWithOpenAI)
  .to(shapeLead)
  .to(saveLead)
  .to(markTraceDone)
  .add(calledByRunAll)
  .to(getNewTraces)
  .add(howItWorks)
  .add(todo)
  .group('Traces to leads', [getNewTraces, readTraceWithOpenAI, shapeLead, saveLead, markTraceDone], { description: 'New traces -> OpenAI reads, filters and scores each -> one row per project in Leads -> trace marked done' });
