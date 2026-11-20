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
  config: { name: 'Run from demo', parameters: { httpMethod: 'GET', path: 'lmu-pinboard', responseMode: 'onReceived', options: {} } }
});

const pinboardPages = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pinboard pages',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// The pinboard pages to read each run: one item per category.\nconst BASE = 'https://lmu-pinboard.munich-startup.de';\nreturn [\n  { category: 'co-founder wanted', path: '/gesucht-und-gefunden/co-founder-gesucht' },\n  { category: 'job', path: '/stellenangebote' },\n  { category: 'cooperation', path: '/gesucht-und-gefunden/kooperationen' },\n  { category: 'other', path: '/gesucht-und-gefunden/sonstiges' },\n].map(p => ({ json: { category: p.category, url: BASE + p.path } }));\n" },
    output: [{ category: 'co-founder wanted', url: 'https://lmu-pinboard.munich-startup.de/gesucht-und-gefunden/co-founder-gesucht' }]
  }
});
const fetchCategoryPages = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch category pages',
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
const listPosts = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'List posts',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Each category page -> one item per post (card): id, title, poster, approximate post date.\nconst pages = $('Pinboard pages').all();\nconst strip = s => (s || '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#0?39;/g, \"'\").replace(/&quot;/g, '\"').replace(/\\s+/g, ' ').trim();\nconst ago = s => {\n  const now = new Date();\n  const m = (s || '').match(/vor\\s+(\\d+)\\s+(Minute|Stunde|Tag|Woche|Monat|Jahr)/i);\n  if (!m) return now.toISOString();\n  const n = Number(m[1]);\n  const days = { minute: 0, stunde: 0, tag: 1, woche: 7, monat: 30, jahr: 365 }[m[2].toLowerCase()];\n  return new Date(now.getTime() - n * days * 86400000).toISOString();\n};\nconst seen = new Set();\nconst out = [];\n$input.all().forEach((page, i) => {\n  const category = pages[i].json.category;\n  const cards = (page.json.data || '').split('ms-card').slice(1);\n  for (const card of cards) {\n    const link = card.match(/href=\"(https:\\/\\/lmu-pinboard\\.munich-startup\\.de\\/anzeige\\/(\\d+))\"\\s+title=\"([^\"]*)\"/);\n    if (!link || seen.has(link[2])) continue;\n    seen.add(link[2]);\n    const poster = card.match(/text-grey mb-2\">([\\s\\S]*?)<\\/p>/);\n    const age = card.match(/chevron-right text-grey\">([\\s\\S]*?)<\\/p>/);\n    out.push({ json: {\n      trace_id: 'pinboard:' + link[2],\n      url: link[1],\n      category,\n      title: strip(link[3]),\n      poster: strip(poster && poster[1]),\n      happened_at: ago(age && age[1]),\n    }});\n  }\n});\nreturn out;\n" },
    output: [{ trace_id: 'pinboard:5015', url: 'https://lmu-pinboard.munich-startup.de/anzeige/5015', category: 'co-founder wanted', title: 'Commercial Co-Founder / CSO gesucht', poster: 'Jorge Sanchez Rosado', happened_at: '2026-11-06T12:00:00.000Z' }]
  }
});
const onlyNewPosts = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Only new posts',
    parameters: {
      resource: 'row',
      operation: 'rowNotExists',
      dataTableId: { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'trace_id', keyValue: expr('{{ $json.trace_id }}') }] }
    },
    output: [{ trace_id: 'pinboard:5015', url: 'https://lmu-pinboard.munich-startup.de/anzeige/5015', category: 'co-founder wanted', title: 'Commercial Co-Founder / CSO gesucht', poster: 'Jorge Sanchez Rosado', happened_at: '2026-11-06T12:00:00.000Z' }]
  }
});
const fetchPostPages = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch post pages',
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
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Each post page -> the finished trace row. Phone numbers and email addresses are deliberately not kept.\nconst posts = $('Only new posts').all();\nconst ENT = { auml: '\\u00e4', ouml: '\\u00f6', uuml: '\\u00fc', Auml: '\\u00c4', Ouml: '\\u00d6', Uuml: '\\u00dc', szlig: '\\u00df', ndash: '\\u2013', mdash: '\\u2014', amp: '&', quot: '\"', apos: \"'\", nbsp: ' ', hellip: '\\u2026', euro: '\\u20ac', bdquo: '\\u201e', ldquo: '\\u201c', rdquo: '\\u201d', lsquo: '\\u2018', rsquo: '\\u2019', eacute: '\\u00e9', egrave: '\\u00e8', agrave: '\\u00e0' };\nconst decode = s => s.replace(/&#(\\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, e) => ENT[e] || m);\nconst strip = s => decode((s || '').replace(/\\r/g, '').replace(/<br\\s*\\/?>/gi, '\\n').replace(/<\\/p>/gi, '\\n').replace(/<[^>]+>/g, ' '))\n  .replace(/[ \\t]+/g, ' ').replace(/ *\\n */g, '\\n').replace(/\\n{3,}/g, '\\n\\n').trim();\nconst grab = (html, re) => { const m = html.match(re); return m ? strip(m[1]) : ''; };\nreturn $input.all().map((page, i) => {\n  const post = posts[i].json;\n  const html = page.json.data || '';\n  const title = grab(html, /<h1[^>]*>([\\s\\S]*?)<\\/h1>/) || post.title;\n  const body = grab(html, /<div class=\"ms-content\">([\\s\\S]*?)<\\/div>/).replace(/\\S+@\\S+\\.\\S+/g, '[email removed]').replace(/\\+?\\d[\\d \\/-]{7,}\\d/g, '[phone removed]');\n  const tags = [...html.matchAll(/<li class=\"inline-block mb-2\">\\s*<a [^>]*title=\"([^\"]*)\"/g)].map(m => strip(m[1]));\n  const company = grab(html, /text-sm font-semibold leading-normal mb-1\">([\\s\\S]*?)<\\/p>/);\n  const about = grab(html, /text-xs font-normal leading-normal mb-0\">([\\s\\S]*?)<\\/p>/);\n  const contact = grab(html, /text-sm font-semibold leading-normal mb-3\">([\\s\\S]*?)<\\/p>/);\n  const site = (html.match(/href=\"(https?:\\/\\/[^\"]+)\" title=\"Online bewerben\"/) || [])[1] || '';\n  const people = [contact && contact + ' (contact person)', post.poster && post.poster !== company && post.poster + ' (posted by)'].filter(Boolean);\n  return { json: {\n    trace_id: post.trace_id,\n    source: 'campus',\n    url: post.url,\n    happened_at: post.happened_at,\n    found_at: new Date().toISOString(),\n    title: '[' + post.category + '] ' + title,\n    text: [\n      'Category: ' + post.category,\n      tags.length ? 'Tags: ' + tags.join(', ') : '',\n      company ? 'Company: ' + company + (about ? ' \u2013 ' + about : '') : '',\n      site && !site.includes('munich-startup.de') ? 'Website: ' + site : '',\n      '',\n      body,\n    ].filter((l, k) => l || k === 4).join('\\n').slice(0, 5000),\n    people: people.join('; '),\n    org_name: company || post.poster,\n    city: 'Munich',\n    status: 'new',\n  }};\n});\n" },
    output: [{ trace_id: 'pinboard:5044', source: 'campus', url: 'https://lmu-pinboard.munich-startup.de/anzeige/5044', happened_at: '2026-11-17T12:00:00.000Z', found_at: '2026-11-20T12:00:00.000Z', title: '[job] Founder Associate', text: 'Category: job', people: 'Moritz Westerkamp (contact person)', org_name: 'nexpaper GmbH', city: 'Munich', status: 'new' }]
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

const howItWorks = sticky('## LMU pinboard -> Traces\nReads four categories of the LMU IEC pinboard (co-founder wanted, jobs, cooperations, other), skips posts already in **Traces**, opens each new post (one every 2 s) and saves it. **Phone numbers and email addresses are removed**: only the contact person name is kept.', [pinboardPages, fetchCategoryPages, listPosts, onlyNewPosts, fetchPostPages, buildTraces, saveToTraces], { color: 7 });

export default workflow('lmu-pinboard', '02 LMU pinboard -> Traces')
  .add(runByHand)
  .to(pinboardPages)
  .to(fetchCategoryPages)
  .to(listPosts)
  .to(onlyNewPosts)
  .to(fetchPostPages)
  .to(buildTraces)
  .to(saveToTraces)
  .add(calledByRunAll)
  .to(pinboardPages)
  .add(runFromDemo)
  .to(pinboardPages)
  .add(howItWorks)
  .group('Read the pinboard', [pinboardPages, fetchCategoryPages, listPosts, onlyNewPosts, fetchPostPages, buildTraces, saveToTraces], { description: 'Four pinboard categories -> new posts only -> each post page -> one row per post in Traces, without phone or email' });
