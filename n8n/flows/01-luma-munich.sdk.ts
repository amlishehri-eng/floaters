import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const runByHand = trigger({
  type: 'n8n-nodes-base.manualTrigger',
  version: 1,
  config: { name: 'Run by hand' }
});

const calledByRunAll = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.3,
  config: { name: 'Called by Run all', parameters: { inputSource: 'passthrough' } }
});

const runFromDemo = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.2,
  config: { name: 'Run from demo', parameters: { httpMethod: 'GET', path: 'luma-munich', responseMode: 'onReceived', options: {} } }
});

const fetchLumaMunich = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch Luma Munich',
    parameters: {
      method: 'GET',
      url: 'https://luma.com/munich',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' }] },
      options: { response: { response: { responseFormat: 'text', outputPropertyName: 'data' } } }
    },
    output: [{ data: '<html>...</html>' }]
  }
});

const keepStartupEvents = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Keep startup events',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Luma Munich page -> one item per startup-related event (keyword filter on the name).\nconst KEYWORDS = /pitch|demo[ -]?day|founder|gr[\u00fcu]nd|start-?up|accelerator|incubator|investor|\\bvc\\b|venture|award|hackathon|gmbh|spin-?off|ausgr[\u00fcu]ndung|batch|cohort/i;\nconst html = $input.first().json.data;\nconst m = html.match(/<script id=\"__NEXT_DATA__\"[^>]*>([\\s\\S]*?)<\\/script>/);\nif (!m) throw new Error('Luma page has no __NEXT_DATA__: the page layout changed');\nconst events = JSON.parse(m[1]).props.pageProps.initialData.data.events || [];\nreturn events\n  .filter(e => KEYWORDS.test(e.event.name))\n  .map(e => ({ json: {\n    trace_id: 'luma:' + e.api_id,\n    source: 'luma',\n    url: 'https://luma.com/' + e.event.url,\n    happened_at: e.start_at,\n    title: e.event.name,\n    hosts: (e.hosts || []).filter(h => h && h.name).map(h => h.name + (h.linkedin_handle ? ' (LinkedIn ' + h.linkedin_handle + ')' : '') + (h.website ? ' (' + h.website + ')' : '')),\n    org_name: e.calendar && e.calendar.name !== 'Personal' ? e.calendar.name : '',\n  }}));\n" },
    output: [{ trace_id: 'luma:evt-abc', source: 'luma', url: 'https://luma.com/abc', happened_at: '2026-11-23', title: 'Pitch with Pretzels #2', hosts: ['Bits & Pretzels Communities'], org_name: 'Bits & Pretzels Communities' }]
  }
});

const onlyNewEvents = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Only new events',
    parameters: {
      resource: 'row',
      operation: 'rowNotExists',
      dataTableId: { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'trace_id', condition: 'eq', keyValue: expr('{{ $json.trace_id }}') }] }
    },
    output: [{ trace_id: 'luma:evt-abc', source: 'luma', url: 'https://luma.com/abc', happened_at: '2026-11-23T15:00:00.000Z', title: 'Pitch with Pretzels #2', hosts: ['Bits & Pretzels Communities'], org_name: 'Bits & Pretzels Communities' }]
  }
});

const fetchEventPages = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch event pages',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.url }}'),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' }] },
      options: {
        batching: { batch: { batchSize: 1, batchInterval: 2000 } },
        response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }
      }
    },
    output: [{ data: '<html>...</html>' }]
  }
});

const buildTraces = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build traces',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Each event page -> the finished trace row, matching the Traces table. Only events not yet in Traces get here, so a processed trace is never reset to new.\nconst events = $('Only new events').all();\nconst flatten = n => {\n  if (Array.isArray(n)) return n.map(flatten).join('');\n  if (!n || typeof n !== 'object') return '';\n  const inner = (n.text || '') + flatten(n.content || []);\n  return n.type === 'paragraph' || n.type === 'heading' || n.type === 'list_item' ? inner + '\\n' : inner;\n};\nreturn $input.all().map((page, i) => {\n  const ev = events[i].json;\n  let text = '', guests = [];\n  const m = (page.json.data || '').match(/<script id=\"__NEXT_DATA__\"[^>]*>([\\s\\S]*?)<\\/script>/);\n  if (m) {\n    const d = JSON.parse(m[1]).props.pageProps.initialData.data || {};\n    text = flatten(d.description_mirror).replace(/\\n{3,}/g, '\\n\\n').trim();\n    guests = (d.featured_guests || []).map(g => g.name || (g.user && g.user.name)).filter(Boolean);\n  }\n  return { json: {\n    trace_id: ev.trace_id,\n    source: ev.source,\n    url: ev.url,\n    happened_at: ev.happened_at,\n    found_at: new Date().toISOString(),\n    title: ev.title,\n    text: text.slice(0, 5000),\n    people: [...ev.hosts, ...guests.map(g => g + ' (guest)')].join('; '),\n    org_name: ev.org_name,\n    city: 'Munich',\n    status: 'new',\n  }};\n});\n" },
    output: [{ trace_id: 'luma:evt-abc', source: 'luma', url: 'https://luma.com/abc', happened_at: '2026-11-23', found_at: '2026-11-20T12:00:00.000Z', title: 'Pitch with Pretzels #2', text: 'Startups of any stage...', people: 'Bits & Pretzels Communities', org_name: 'Bits & Pretzels Communities', city: 'Munich', status: 'new' }]
  }
});

const saveToTraces = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save to Traces',
    parameters: {
      resource: 'row',
      operation: 'upsert',
      dataTableId: { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'trace_id', condition: 'eq', keyValue: expr('{{ $json.trace_id }}') }] },
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] },
      options: {}
    },
    output: [{ id: 1, createdAt: '2026-11-20T12:00:00.000Z', updatedAt: '2026-11-20T12:00:00.000Z' }]
  }
});

const howItWorks = sticky('## Luma Munich -> Traces\nReads Luma\'s public Munich page, keeps startup events (pitch, demo day, founder, GmbH...), opens each event page (one every 2 s) and saves one row per event in the **Traces** table. Events already in Traces are skipped, so nothing is fetched twice and a processed trace keeps its status.\n\n**Run from demo**: call this workflow\'s webhook to run it live.', [fetchLumaMunich, keepStartupEvents, onlyNewEvents, fetchEventPages, buildTraces, saveToTraces], { color: 7 });

export default workflow('luma-munich', '01 Luma Munich -> Traces')
  .add(runByHand)
  .to(fetchLumaMunich)
  .to(keepStartupEvents)
  .to(onlyNewEvents)
  .to(fetchEventPages)
  .to(buildTraces)
  .to(saveToTraces)
  .add(calledByRunAll)
  .to(fetchLumaMunich)
  .add(runFromDemo)
  .to(fetchLumaMunich)
  .add(howItWorks)
  .group('Find startup events', [fetchLumaMunich, keepStartupEvents, onlyNewEvents, fetchEventPages, buildTraces, saveToTraces], { description: 'Luma Munich page -> startup events -> each event page -> one row per event in Traces' });
