import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const runByHand = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Run by hand' } });

const calledByRunAll = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.3,
  config: { name: 'Called by Run all', parameters: { inputSource: 'passthrough' } }
});

const runFromDemo = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.2,
  config: { name: 'Run from demo', parameters: { httpMethod: 'GET', path: 'eventbrite-munich', responseMode: 'onReceived', options: {} } }
});

const keywordPages = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Keyword pages',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// The Eventbrite Munich keyword search pages to read each run (one item per page).\n// Checked Nov 2026: these slugs return an event list; 'startup', 'hackathon', 'demo-day', 'entrepreneur' and 'gruenden' come back empty.\nconst BASE = 'https://www.eventbrite.de/d/germany--m%C3%BCnchen/';\nreturn ['startups', 'founder', 'gr%C3%BCnder', 'pitch', 'hackathons', 'accelerator', 'venture', 'investor']\n  .map(slug => ({ json: { keyword: decodeURIComponent(slug), url: BASE + slug + '/' } }));\n" },
    output: [{ keyword: 'startups', url: 'https://www.eventbrite.de/d/germany--m%C3%BCnchen/startups/' }]
  }
});

const fetchSearchPages = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch search pages',
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

const keepStartupEvents = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Keep startup events',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Search pages -> one item per startup-related Munich event (deduped across pages, keyword filter on name + summary).\nconst KEYWORDS = /pitch|demo[ -]?day|founder|gr[üu]nder|gr[üu]ndung|start-?ups?\\b|accelerator|incubator|inkubator|investor|\\bvc\\b|venture|award|hackathon|spin-?off|ausgr[üu]ndung|entrepreneur|business angel|cohort|erfinder|inventor/i;\nconst AREA = /m[üu]nchen|munich|garching|unterf[öo]hring|freising|ismaning|martinsried|planegg|unterschlei|aschheim|unterhaching|ottobrunn|taufkirchen|oberhaching|neubiberg|gr[äa]felfing|feldkirchen|haar|pullach|gr[üu]nwald|garching|germering|dornach|kirchheim/i;\nconst pages = $('Keyword pages').all();\nconst seen = new Set();\nconst out = [];\nlet lists = 0;\n$input.all().forEach((page, i) => {\n  const html = page.json.data || '';\n  const blocks = [...html.matchAll(/<script type=\"application\\/ld\\+json\"[^>]*>([\\s\\S]*?)<\\/script>/g)];\n  for (const b of blocks) {\n    let d;\n    try { d = JSON.parse(b[1]); } catch (e) { continue; }\n    if (!d || d['@type'] !== 'ItemList') continue;\n    lists++;\n    for (const el of d.itemListElement || []) {\n      const ev = el.item || {};\n      const id = ((ev.url || '').match(/(\\d{9,})(?:[\\/?#]|$)/) || [])[1];\n      if (!id || seen.has(id)) continue;\n      seen.add(id);\n      const place = ev.location || {};\n      const addr = place.address || {};\n      const name = ev.name || '';\n      if (/cancel|abgesagt/i.test(name)) continue;\n      if (!AREA.test(addr.addressLocality || '')) continue;\n      if (!KEYWORDS.test(name + ' ' + (ev.description || ''))) continue;\n      out.push({ json: {\n        trace_id: 'eventbrite:' + id,\n        event_id: id,\n        url: ev.url.split('?')[0],\n        keyword: pages[i] ? pages[i].json.keyword : '',\n        title: name,\n        summary: ev.description || '',\n        happened_at: ev.startDate || '',\n        venue: [place.name, addr.streetAddress, addr.addressLocality].filter(Boolean).filter((v, k, a) => a.indexOf(v) === k).join(', '),\n      }});\n    }\n  }\n});\nif (!lists) throw new Error('No Eventbrite search page had an event list (ld+json ItemList): the page layout changed or the requests were blocked');\nreturn out;\n" },
    output: [{ trace_id: 'eventbrite:2001162282256', event_id: '2001162282256', url: 'https://www.eventbrite.de/e/tum-ideaward-2026-tickets-2001162282256', keyword: 'pitch', title: 'TUM IDEAward 2026', summary: 'Come and join us for the TUM IDEAward 2026!', happened_at: '2026-11-26', venue: 'Foyer Audimax, Arcisstra\u00dfe 21, M\u00fcnchen' }]
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
      filters: { conditions: [{ keyName: 'trace_id', keyValue: expr('{{ $json.trace_id }}') }] }
    },
    output: [{ trace_id: 'eventbrite:2001162282256', event_id: '2001162282256', url: 'https://www.eventbrite.de/e/tum-ideaward-2026-tickets-2001162282256', keyword: 'pitch', title: 'TUM IDEAward 2026', summary: 'Come and join us for the TUM IDEAward 2026!', happened_at: '2026-11-26', venue: 'Foyer Audimax, Arcisstra\u00dfe 21, M\u00fcnchen' }]
  }
});

const max25Events = node({
  type: 'n8n-nodes-base.limit',
  version: 1,
  config: {
    name: 'Max 25 events',
    parameters: { maxItems: 25 },
    output: [{ trace_id: 'eventbrite:2001162282256', event_id: '2001162282256', url: 'https://www.eventbrite.de/e/tum-ideaward-2026-tickets-2001162282256', keyword: 'pitch', title: 'TUM IDEAward 2026', summary: 'Come and join us for the TUM IDEAward 2026!', happened_at: '2026-11-26', venue: 'Foyer Audimax, Arcisstra\u00dfe 21, M\u00fcnchen' }]
  }
});

const fetchEventPages = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch event pages',
    onError: 'continueRegularOutput',
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
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Each event page -> the finished trace row. Email addresses and phone numbers are removed from the text.\nconst events = $('Max 25 events').all();\nconst ENT = { auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', ndash: '–', mdash: '—', amp: '&', quot: '\"', apos: \"'\", nbsp: ' ', hellip: '…', euro: '€', bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', eacute: 'é', egrave: 'è', agrave: 'à', lt: '<', gt: '>', shy: '' };\nconst decode = s => (s || '').replace(/&#(\\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, e) => (e in ENT ? ENT[e] : m));\nconst toText = html => decode((html || '').replace(/\\r/g, '')\n    .replace(/<br\\s*\\/?>/gi, '\\n').replace(/<\\/(p|div|h\\d|li|ul|ol)>/gi, '\\n').replace(/<li[^>]*>/gi, '- ').replace(/<[^>]+>/g, ' '))\n  .replace(/\\u00ad/g, '').replace(/[ \\t\\u00a0]+/g, ' ').replace(/ *\\n */g, '\\n').replace(/\\n{3,}/g, '\\n\\n').trim();\nconst scrub = s => s.replace(/[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+/g, '[email removed]').replace(/(\\+|\\(?\\b0)\\d[\\d ()\\/.-]{6,}\\d/g, '[phone removed]');\nconst clean = s => scrub(toText(s)).replace(/\\s+/g, ' ').trim();\nreturn $input.all().map((page, i) => {\n  const ev = events[i].json;\n  let ctx = null;\n  const m = (page.json.data || '').match(/<script id=\"__NEXT_DATA__\"[^>]*>([\\s\\S]*?)<\\/script>/);\n  if (m) { try { ctx = JSON.parse(m[1]).props.pageProps.context; } catch (e) { ctx = null; } }\n  const info = (ctx && ctx.basicInfo) || {};\n  const org = clean((info.organizer || {}).name);\n  const sc = (ctx && ctx.structuredContent) || {};\n  const body = (sc.modules || []).filter(x => x && x.type === 'text').map(x => toText(x.text)).join('\\n\\n');\n  const perf = (ctx && ctx.performers) || {};\n  const speakers = [...(perf.headliners || []), ...(perf.supporters || [])].map(p => clean(p && p.name));\n  const hosts = [];\n  (((sc.widgets || {}).agenda || {}).tabs || []).forEach(t => (t.slots || []).forEach(s => (s.hosts || []).forEach(h => hosts.push(clean(typeof h === 'string' ? h : h && h.name)))));\n  const people = [];\n  const add = (n, role) => { if (n && !/removed\\]/.test(n) && !people.some(p => p.startsWith(n + ' ('))) people.push(n + ' (' + role + ')'); };\n  add(org, 'organiser');\n  speakers.forEach(n => add(n, 'speaker'));\n  hosts.forEach(n => add(n, 'host'));\n  const start = (info.startDate && info.startDate.utc) || ev.happened_at;\n  const text = scrub([\n    org ? 'Organiser: ' + org : '',\n    ev.venue ? 'Venue: ' + ev.venue : '',\n    info.isOnline ? 'Online event' : '',\n    '',\n    body || toText(info.summary || ev.summary),\n  ].filter((l, k) => l || k === 3).join('\\n').trim());\n  return { json: {\n    trace_id: ev.trace_id,\n    source: 'eventbrite',\n    url: (info.url || ev.url).split('?')[0],\n    happened_at: start ? new Date(start).toISOString() : null,\n    found_at: new Date().toISOString(),\n    title: decode(info.name || ev.title).trim(),\n    text: text.slice(0, 5000),\n    people: people.join('; '),\n    org_name: org,\n    city: 'Munich',\n    status: 'new',\n  }};\n});\n" },
    output: [{ trace_id: 'eventbrite:2001162282256', source: 'eventbrite', url: 'https://www.eventbrite.de/e/tum-ideaward-2026-tickets-2001162282256', happened_at: '2026-11-26T17:00:00.000Z', found_at: '2026-11-20T12:00:00.000Z', title: 'TUM IDEAward 2026', text: 'Organiser: Technische Universit\u00e4t M\u00fcnchen ...', people: 'Technische Universit\u00e4t M\u00fcnchen (organiser)', org_name: 'Technische Universit\u00e4t M\u00fcnchen', city: 'Munich', status: 'new' }]
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

const howItWorks = sticky('## Eventbrite Munich -> Traces\nReads Eventbrite\'s public Munich search pages for startups, founder, Gr\u00fcnder, pitch, hackathons, accelerator, venture and investor (one page every 2 s, no API key, no login). Merges the lists, drops duplicates and cancelled events, keeps startup events in and around Munich, skips events already in **Traces**, opens at most 25 new event pages (one every 2 s) and saves one row per event: description, organiser and named speakers. **Email addresses and phone numbers are removed.**\n\n**Run from demo**: call this workflow\'s webhook to run it live.', [keywordPages, fetchSearchPages, keepStartupEvents, onlyNewEvents, max25Events, fetchEventPages, buildTraces, saveToTraces], { color: 7 });

export default workflow('eventbrite-munich', '04 Eventbrite Munich -> Traces')
  .add(runByHand)
  .to(keywordPages)
  .to(fetchSearchPages)
  .to(keepStartupEvents)
  .to(onlyNewEvents)
  .to(max25Events)
  .to(fetchEventPages)
  .to(buildTraces)
  .to(saveToTraces)
  .add(calledByRunAll)
  .to(keywordPages)
  .add(runFromDemo)
  .to(keywordPages)
  .add(howItWorks)
  .group('Find startup events', [keywordPages, fetchSearchPages, keepStartupEvents, onlyNewEvents, max25Events, fetchEventPages, buildTraces, saveToTraces], { description: 'Eventbrite Munich search pages -> startup events -> new ones only (max 25) -> each event page -> one row per event in Traces, without email or phone' });
