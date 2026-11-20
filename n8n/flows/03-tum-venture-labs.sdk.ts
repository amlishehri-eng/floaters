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
  config: { name: 'Run from demo', parameters: { httpMethod: 'GET', path: 'tum-venture-labs', responseMode: 'onReceived', options: {} } }
});

const fetchSitemap = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch sitemap',
    parameters: {
      method: 'GET',
      url: 'https://www.tum-venture-labs.de/sitemap.xml',
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' }] },
      options: { response: { response: { responseFormat: 'text', outputPropertyName: 'data' } } }
    },
    output: [{ data: '<?xml version="1.0" encoding="UTF-8"?><urlset>...</urlset>' }]
  }
});

const listTeams = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'List teams',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Sitemap -> one item per team page, with the sitemap's last-change date as happened_at.\nconst xml = $input.first().json.data || '';\nconst urls = xml.match(/<url>[\\s\\S]*?<\\/url>/g) || [];\nif (!urls.length) throw new Error('TUM Venture Labs sitemap has no <url> entries: the sitemap changed');\nconst seen = new Set();\nconst out = [];\nfor (const u of urls) {\n  const loc = (u.match(/<loc>\\s*(https:\\/\\/www\\.tum-venture-labs\\.de\\/teams\\/([a-z0-9-]+)\\/)\\s*<\\/loc>/i) || []);\n  if (!loc[1] || seen.has(loc[2])) continue;\n  seen.add(loc[2]);\n  const mod = (u.match(/<lastmod>\\s*([^<\\s]+)\\s*<\\/lastmod>/) || [])[1];\n  const d = mod ? new Date(mod) : null;\n  out.push({ json: {\n    trace_id: 'tumvl:' + loc[2],\n    url: loc[1],\n    slug: loc[2],\n    happened_at: d && !isNaN(d) ? d.toISOString() : new Date().toISOString(),\n  }});\n}\nreturn out;\n" },
    output: [{ trace_id: 'tumvl:karevo', url: 'https://www.tum-venture-labs.de/teams/karevo/', slug: 'karevo', happened_at: '2026-08-11T08:02:30.000Z' }]
  }
});

const onlyNewTeams = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Only new teams',
    parameters: {
      resource: 'row',
      operation: 'rowNotExists',
      dataTableId: { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'trace_id', keyValue: expr('{{ $json.trace_id }}') }] }
    },
    output: [{ trace_id: 'tumvl:karevo', url: 'https://www.tum-venture-labs.de/teams/karevo/', slug: 'karevo', happened_at: '2026-08-11T08:02:30.000Z' }]
  }
});

const fetchTeamPages = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch team pages',
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
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Each team page -> the finished trace row. Lab equipment, perks and service pages are skipped.\n// Email addresses and phone numbers are removed from the text.\nconst teams = $('Only new teams').all();\nconst LABS = { 'additive-manufacturing': 'Additive Manufacturing', 'built-environment': 'Built Environment', chemspace: 'Chem / Biosystems', 'food-agro-biotech': 'Food / Agro / Biotech', healthcare: 'Healthcare', quantum: 'Quantum / Semicon', 'robotics-ai': 'Robotics / AI' };\nconst ENT = { auml: '\u00e4', ouml: '\u00f6', uuml: '\u00fc', Auml: '\u00c4', Ouml: '\u00d6', Uuml: '\u00dc', szlig: '\u00df', ndash: '\u2013', mdash: '\u2014', amp: '&', quot: '\"', apos: \"'\", nbsp: ' ', hellip: '\u2026', euro: '\u20ac', bdquo: '\u201e', ldquo: '\u201c', rdquo: '\u201d', lsquo: '\u2018', rsquo: '\u2019', eacute: '\u00e9', egrave: '\u00e8', agrave: '\u00e0' };\nconst decode = s => s.replace(/&#(\\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, e) => ENT[e] || m);\nconst strip = s => decode((s || '').replace(/\\r/g, '').replace(/<br\\s*\\/?>/gi, '\\n').replace(/<\\/(p|li|h[1-6])>/gi, '\\n').replace(/<li[^>]*>/gi, '- ').replace(/<[^>]+>/g, ' '))\n  .replace(/[ \\t\u00a0]+/g, ' ').replace(/ *\\n */g, '\\n').replace(/\\n{3,}/g, '\\n\\n').trim();\nconst clean = s => s.replace(/[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+/g, '[email removed]').replace(/(\\+\\d{1,3}|\\b0)[\\d \\/()-]{6,}\\d/g, '[phone removed]');\nconst splitNames = s => {\n  const parts = []; let depth = 0, cur = '';\n  for (const ch of s) {\n    if (ch === '(') depth++;\n    if (ch === ')') depth = Math.max(0, depth - 1);\n    if ((ch === ',' || ch === ';' || ch === '\\n') && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;\n  }\n  parts.push(cur);\n  return parts.flatMap(p => p.split(/\\s+(?:and|und|&)\\s+/i)).map(p => p.trim()).filter(Boolean);\n};\nconst out = [];\n$input.all().forEach((page, i) => {\n  const team = teams[i].json;\n  const html = page.json.data || '';\n  const start = html.indexOf('id=\"main\"');\n  const main = start >= 0 ? html.slice(start, html.indexOf('<footer', start) > 0 ? html.indexOf('<footer', start) : undefined) : '';\n  if (!main) return;\n  const name = strip((main.match(/<h1[^>]*>([\\s\\S]*?)<\\/h1>/) || [])[1]);\n  const facts = {};\n  for (const m of main.matchAll(/facts-dl-term\">([\\s\\S]*?)<\\/dt>\\s*<dd class=\"facts-dl-definition\">([\\s\\S]*?)<\\/dd>/g)) facts[strip(m[1])] = { text: strip(m[2]), html: m[2] };\n  const keys = Object.keys(facts);\n  const founderKey = keys.find(k => /found|gr[\u00fcu]nder/i.test(k) && !/date|datum|year|jahr/i.test(k));\n  const offerKey = keys.find(k => /offer|angebot/i.test(k));\n  const body = strip((main.match(/<main class=\"content-blocks\">([\\s\\S]*?)<\\/main>/) || [])[1]);\n  // Equipment, perks and service pages also live under /teams/: they have no founders or offering and read like a how-to-access page.\n  if (!name || /could be your|your start-?up/i.test(name) || (!founderKey && !offerKey && /what is it good for|how (can i|to) (get )?access|become a member|credit quota|perks?\\b/i.test(body + ' ' + name))) return;\n  const crumb = main.match(/breadcrumb-item\"><a href=\"https:\\/\\/www\\.tum-venture-labs\\.de\\/labs\\/([a-z0-9-]+)\\/\">([\\s\\S]*?)<\\/a>/);\n  const folder = (html.match(/\\/images\\/Labs\\/([A-Za-z-]+)\\/Teams\\//) || [])[1] || '';\n  const lab = crumb ? strip(crumb[2]) : (LABS[folder.toLowerCase()] || folder.replace(/-/g, ' '));\n  const people = founderKey ? splitNames(facts[founderKey].text).map(p => {\n    const m = p.match(/^(.*?)\\s*\\(([^)]*)\\)\\s*$/);\n    return m && m[1] ? m[1].trim() + ' (' + m[2].trim() + ')' : p + ' (founder)';\n  }).filter((p, k, a) => a.indexOf(p) === k) : [];\n  const links = [...main.matchAll(/href=\"(https?:\\/\\/[^\"]+)\"/g)].map(m => m[1]).filter(u => !/tum-venture-labs\\.de|linkedin\\.com\\/in\\/|mailto:|tum\\.de|cookiebot|google/i.test(u));\n  const webKey = keys.find(k => /web|url|link/i.test(k));\n  const website = webKey ? ((facts[webKey].html.match(/href=\"([^\"]+)\"/) || [])[1] || facts[webKey].text) : (links[0] || '');\n  const factLines = keys.filter(k => k !== founderKey && k !== webKey).map(k => k + ': ' + facts[k].text);\n  const text = clean([\n    lab ? 'Lab: TUM Venture Lab ' + lab : 'Lab: not named on the page',\n    ...factLines,\n    website ? 'Website: ' + website : '',\n    '',\n    body,\n  ].filter((l, k, a) => l || (k > 0 && a[k - 1])).join('\\n').trim()).slice(0, 5000);\n  out.push({ json: {\n    trace_id: team.trace_id,\n    source: 'campus',\n    url: team.url,\n    happened_at: team.happened_at,\n    found_at: new Date().toISOString(),\n    title: '[TUM Venture Lab' + (lab ? ' ' + lab : 's') + '] ' + name,\n    text,\n    people: people.join('; '),\n    org_name: name,\n    city: 'Munich',\n    status: 'new',\n  }});\n});\nreturn out;\n" },
    output: [{ trace_id: 'tumvl:karevo', source: 'campus', url: 'https://www.tum-venture-labs.de/teams/karevo/', happened_at: '2026-08-11T08:02:30.000Z', found_at: '2026-11-20T12:00:00.000Z', title: '[TUM Venture Lab Food / Agro / Biotech] Karevo', text: 'Lab: TUM Venture Lab Food / Agro / Biotech\nFounding Date: 2024\nOffering: AI-powered optical sorting machines...', people: 'Benedikt Keßler (CEO); Johannes von Wittke (CTO); Felix Beck (COO)', org_name: 'Karevo', city: 'Munich', status: 'new' }]
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

const howItWorks = sticky('## TUM Venture Labs -> Traces\nReads the public sitemap of tum-venture-labs.de, which lists every team page and when it last changed. Skips teams already in **Traces**, opens each new team page (one every 2 s) and saves one row per startup: name, lab, founders with their roles, what they build. Pages that are lab equipment or perks, not teams, are skipped. **Email addresses and phone numbers are removed.**\n\n**Run from demo**: call this workflow\'s webhook (path tum-venture-labs) to run it live.', [fetchSitemap, listTeams, onlyNewTeams, fetchTeamPages, buildTraces, saveToTraces], { color: 7 });

export default workflow('tum-venture-labs', '03 TUM Venture Labs -> Traces')
  .add(runByHand)
  .to(fetchSitemap)
  .to(listTeams)
  .to(onlyNewTeams)
  .to(fetchTeamPages)
  .to(buildTraces)
  .to(saveToTraces)
  .add(calledByRunAll)
  .to(fetchSitemap)
  .add(runFromDemo)
  .to(fetchSitemap)
  .add(howItWorks)
  .group('Read TUM Venture Labs teams', [fetchSitemap, listTeams, onlyNewTeams, fetchTeamPages, buildTraces, saveToTraces], { description: 'Sitemap -> team pages not yet in Traces -> each team page -> one row per startup in Traces, without phone or email' });
