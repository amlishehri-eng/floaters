import { workflow, node, trigger, sticky, expr, ifElse } from '@n8n/workflow-sdk';

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
    output: [{ lead_key: 'acme', name: 'Acme Robotics', verdict: 'needs_enrichment', website: 'https://acme-robotics.de/', priority: 450, site_checked_at: null }]
  }
});

const pickLeads = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pick leads',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Team enrichment (scoring v3, Amli): leads that passed the gates with strong tech but thin team evidence, and a website.\n// Their own website's team / about / Impressum pages become one extra trace, so 15 can judge the team on real evidence.\n// Only leads never checked before (site_checked_at empty); best first (priority). Public pages only, robots.txt respected.\nconst MAX_PER_RUN = 100;\nconst TECH_SHARE_MIN = 0.72;   // tech_depth 18 of 25 or more, with evidence\nconst WANT = ['needs_enrichment', 'watchlist', 'call_now'];\nconst obj = s => { try { const v = typeof s === 'object' && s ? s : JSON.parse(s || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };\nconst share = c => (!c || c.known === false || c.unsupported || !(Number(c.max) > 0)) ? 0 : (Number(c.points) || 0) / Number(c.max);\nconst hostOf = s => { const m = String(s || '').trim().match(/^(?:https?:\\/\\/)?([^/?#:@\\s]+)/i); return m ? m[1].toLowerCase() : null; };\nconst BAD_HOST = /(^|\\.)(linkedin|xing|facebook|instagram|twitter|x|youtube|github|medium|notion|linktr|calendly|wixsite|webflow|tum|lmu|tum-venture-labs|munich-startup)\\.[a-z.]+$/;\nconst picked = [];\nfor (const item of $input.all()) {\n  const l = item.json;\n  if (!l.lead_key || !WANT.includes(l.verdict) || l.site_checked_at) continue;\n  const host = hostOf(l.website);\n  if (!host || l.website === 'none' || BAD_HOST.test(host)) continue;\n  if (share(obj(l.fit_breakdown).tech_depth) < TECH_SHARE_MIN) continue;\n  const teamB = obj(l.team_breakdown);\n  const unknownTeam = ['technical_founder', 'complementary_roles', 'worked_together', 'deep_research', 'earlier_startup'].filter(k => !teamB[k] || teamB[k].known === false).length;\n  if (l.verdict === 'call_now' && unknownTeam < 3) continue;   // call_now with a known team does not need it\n  picked.push({ l, host, unknownTeam });\n}\npicked.sort((a, b) => (Number(b.l.priority) || 0) - (Number(a.l.priority) || 0));\nreturn picked.slice(0, MAX_PER_RUN).map(({ l, host }) => ({ json: {\n  lead_key: l.lead_key, name: l.name, city: l.city || '', trace_ids: l.trace_ids || '', host,\n  origin: 'https://' + host, home: /^https?:\\/\\//i.test(l.website) ? l.website : 'https://' + host + '/', robots: 'https://' + host + '/robots.txt',\n} }));\n" },
    output: [{ lead_key: 'acme', name: 'Acme Robotics', city: 'Munich', trace_ids: 'uni:x:acme', host: 'acme-robotics.de', origin: 'https://acme-robotics.de', home: 'https://acme-robotics.de/', robots: 'https://acme-robotics.de/robots.txt' }]
  }
});

const fetchRobots = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Fetch robots.txt',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      method: 'GET',
      url: expr("{{ $json.robots }}"),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' }] },
      options: { timeout: 10000, redirect: { redirect: { maxRedirects: 3 } }, response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }, batching: { batch: { batchSize: 10, batchInterval: 1000 } } }
    },
    output: [{ data: '<html>...</html>' }]
  }
});

const fetchHome = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Fetch home',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      method: 'GET',
      url: expr("{{ $('Pick leads').item.json.home }}"),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' }] },
      options: { timeout: 10000, redirect: { redirect: { maxRedirects: 3 } }, response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }, batching: { batch: { batchSize: 10, batchInterval: 2000 } } }
    },
    output: [{ data: '<html>...</html>' }]
  }
});

const planPages = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Plan pages',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// robots.txt + home page -> up to 3 pages per lead: Impressum (managing directors), team / founders, about.\n// Only same-site links, never a path robots.txt disallows for all user agents. Pages are ordered round-robin across\n// leads, so one site never gets two requests in the same batch (the fetch step waits 2 s between batches).\nconst KINDS = [\n  ['team', /(team|founders?|gr(u|ü|ue)nder|people|wir-sind|who-we-are|management)/i],\n  ['impressum', /(impressum|imprint|legal-notice|legal|anbieterkennzeichnung)/i],\n  ['about', /(about|ueber-uns|uber-uns|über-uns|about-us|unternehmen|company|story|mission)/i],\n];\nconst leads = $('Pick leads').all().map(i => i.json);\nconst homes = $('Fetch home').all();\nconst robotsAll = $('Fetch robots.txt').all();\nconst disallowedFor = txt => {\n  const rules = []; let applies = false;\n  for (const raw of String(txt || '').split(/\\r?\\n/)) {\n    const line = raw.replace(/#.*/, '').trim(); if (!line) continue;\n    const [k, ...rest] = line.split(':'); const v = rest.join(':').trim();\n    if (/^user-agent$/i.test(k)) applies = v === '*';\n    else if (applies && /^disallow$/i.test(k) && v) rules.push(v);\n  }\n  return rules;\n};\nconst textOf = html => String(html || '').replace(/<script[\\s\\S]*?<\\/script>/gi, ' ').replace(/<style[\\s\\S]*?<\\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\\s+/g, ' ').trim();\nconst plans = [];\nleads.forEach((l, i) => {\n  const robotsTxt = robotsAll[i] && typeof robotsAll[i].json.data === 'string' ? robotsAll[i].json.data : '';\n  const rules = disallowedFor(/<html/i.test(robotsTxt) ? '' : robotsTxt);\n  const blocked = path => rules.some(r => r === '/' || path.startsWith(r));\n  const html = homes[i] && typeof homes[i].json.data === 'string' ? homes[i].json.data : '';\n  if (blocked('/') || !html) { plans.push([{ lead_key: l.lead_key, kind: 'skip', url: l.robots, why: blocked('/') ? 'robots.txt disallows the site' : 'home page not reachable', home_text: '' }]); return; }\n  const links = [];\n  const re = /<a\\b[^>]*href=[\"']([^\"'#]+)[\"'][^>]*>([\\s\\S]*?)<\\/a>/gi; let m;\n  while ((m = re.exec(html))) {\n    let href = m[1].trim(); const label = textOf(m[2]).slice(0, 60);\n    if (/^(mailto|tel|javascript):/i.test(href)) continue;\n    if (href.startsWith('//')) href = 'https:' + href;\n    if (href.startsWith('/')) href = l.origin + href;\n    if (!/^https?:\\/\\//i.test(href)) href = l.origin + '/' + href.replace(/^\\.\\//, '');\n    const hm = href.match(/^https?:\\/\\/([^/?#:]+)(\\/[^?#]*)?/i); if (!hm) continue;\n    const h = hm[1].toLowerCase().replace(/^www\\./, ''), path = hm[2] || '/';\n    if (h !== l.host.replace(/^www\\./, '') || blocked(path) || /\\.(pdf|jpg|png|zip)$/i.test(path)) continue;\n    links.push({ href: href.split('#')[0], path, label });\n  }\n  const pages = [];\n  for (const [kind, rx] of KINDS) {\n    const hit = links.find(x => rx.test(x.path) || rx.test(x.label));\n    if (hit && !pages.some(p => p.url === hit.href)) pages.push({ lead_key: l.lead_key, kind, url: hit.href });\n  }\n  const home_text = textOf(html).slice(0, 4000);\n  plans.push(pages.length ? pages.map(p => ({ ...p, home_text })) : [{ lead_key: l.lead_key, kind: 'home', url: l.home, home_text }]);\n});\nconst out = [];\nfor (let round = 0; round < 3; round++) for (const p of plans) if (p[round]) out.push({ json: p[round] });\nreturn out;\n" },
    output: [{ lead_key: 'acme', kind: 'team', url: 'https://acme-robotics.de/team', home_text: 'We build robot grippers' }]
  }
});

const fetchPages = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.2,
  config: {
    name: 'Fetch pages (2 s apart)',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      method: 'GET',
      url: expr("{{ $json.url }}"),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' }] },
      options: { timeout: 10000, redirect: { redirect: { maxRedirects: 3 } }, response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }, batching: { batch: { batchSize: 10, batchInterval: 2000 } } }
    },
    output: [{ data: '<html>...</html>' }]
  }
});

const buildTraces = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build site traces',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Fetched pages -> one trace per lead ('site:<host>', source 'website', status 'processed'), so 15 reads it as evidence.\n// Team and Impressum text first (15 reads the first 2,500 characters of a trace), emails and phone numbers removed.\n// Leads with less than 300 characters of useful text get no trace, only site_checked_at, so they are not fetched again.\nconst plans = $('Plan pages').all().map(i => i.json);\nconst leads = new Map($('Pick leads').all().map(i => [i.json.lead_key, i.json]));\nconst textOf = html => String(html || '').replace(/<script[\\s\\S]*?<\\/script>/gi, ' ').replace(/<style[\\s\\S]*?<\\/style>/gi, ' ').replace(/<(nav|footer|header)[\\s\\S]*?<\\/\\1>/gi, ' ')\n  .replace(/<br\\s*\\/?>|<\\/(p|div|li|h\\d|tr)>/gi, '\\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\\d+);/g, (x, n) => String.fromCharCode(Number(n)));\nconst scrub = s => s.replace(/[\\w.+-]+@[\\w-]+\\.[\\w.-]+/g, '[email]').replace(/(\\+|00)?\\d[\\d \\/().-]{7,}\\d/g, m => (m.replace(/\\D/g, '').length >= 8 ? '[phone]' : m));\nconst lines = s => [...new Set(scrub(s).split('\\n').map(x => x.replace(/\\s+/g, ' ').trim()).filter(x => x.length > 2))];\nconst IMPRESSUM_KEEP = /(gesch(ä|ae)ftsf(ü|ue)hr|vertretungsberechtigt|managing director|ceo|cto|founder|gr(ü|ue)nder|inhaber|registergericht|amtsgericht|hrb|handelsregister|gmbh|ug \\(|sitz)/i;\nconst by = new Map();\n$input.all().forEach((item, i) => {\n  const p = plans[i]; if (!p) return;\n  const g = by.get(p.lead_key) || { team: [], impressum: [], about: [], home: p.home_text || '', urls: [] };\n  const html = typeof item.json.data === 'string' ? item.json.data : '';\n  if (p.kind !== 'skip' && html) {\n    const ls = lines(textOf(html));\n    if (p.kind === 'impressum') g.impressum.push(...ls.filter(x => IMPRESSUM_KEEP.test(x)).slice(0, 15));\n    else if (p.kind === 'team') g.team.push(...ls.slice(0, 80));\n    else if (p.kind === 'about') g.about.push(...ls.slice(0, 60));\n    else g.about.push(...ls.slice(0, 60));\n    g.urls.push(p.url);\n  }\n  by.set(p.lead_key, g);\n});\nconst now = new Date().toISOString();\nconst out = [];\nfor (const [key, g] of by) {\n  const l = leads.get(key); if (!l) continue;\n  const parts = [];\n  if (g.team.length) parts.push('Team page: ' + g.team.join(' | '));\n  if (g.impressum.length) parts.push('Impressum: ' + g.impressum.join(' | '));\n  if (g.about.length) parts.push('About: ' + g.about.join(' | '));\n  if (g.home) parts.push('Home page: ' + scrub(g.home));\n  const body = parts.join('\\n').slice(0, 6000);\n  const ok = body.replace(/\\s+/g, '').length >= 300 && (g.team.length || g.impressum.length || g.about.length);\n  const trace_id = 'site:' + l.host.replace(/^www\\./, '');\n  const ids = String(l.trace_ids || '').split(',').map(x => x.trim()).filter(Boolean);\n  out.push({ json: { ok: !!ok, lead_key: key, trace_id, site_checked_at: now,\n    trace_ids: ok && !ids.includes(trace_id) ? [...ids, trace_id].join(', ') : ids.join(', '),\n    trace: { trace_id, source: 'website', url: g.urls[0] || l.home, happened_at: now, found_at: now,\n      title: l.name + ': own website (team, about, Impressum)', text: 'Website text (team, about and Impressum pages, ' + now.slice(0, 10) + '): ' + body,\n      people: '', org_name: l.name, city: l.city || '', status: 'processed', website: l.origin + '/' } } });\n}\nreturn out;\n" },
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
      dataTableId: { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'trace_id', condition: 'eq', keyValue: expr('{{ $json.trace.trace_id }}') }] },
      columns: { mappingMode: 'defineBelow', matchingColumns: [], value: { trace_id: expr('{{ $json.trace.trace_id }}'), source: expr('{{ $json.trace.source }}'), url: expr('{{ $json.trace.url }}'), happened_at: expr('{{ $json.trace.happened_at }}'), found_at: expr('{{ $json.trace.found_at }}'), title: expr('{{ $json.trace.title }}'), text: expr('{{ $json.trace.text }}'), people: expr('{{ $json.trace.people }}'), org_name: expr('{{ $json.trace.org_name }}'), city: expr('{{ $json.trace.city }}'), status: expr('{{ $json.trace.status }}'), website: expr('{{ $json.trace.website }}') },
        schema: [{ id: 'trace_id', displayName: 'trace_id', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'source', displayName: 'source', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'url', displayName: 'url', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'happened_at', displayName: 'happened_at', required: false, defaultMatch: false, display: true, type: 'dateTime', canBeUsedToMatch: true }, { id: 'found_at', displayName: 'found_at', required: false, defaultMatch: false, display: true, type: 'dateTime', canBeUsedToMatch: true }, { id: 'title', displayName: 'title', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'text', displayName: 'text', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'people', displayName: 'people', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'org_name', displayName: 'org_name', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'city', displayName: 'city', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'status', displayName: 'status', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'website', displayName: 'website', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }] },
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
      dataTableId: { __rl: true, mode: 'id', value: 'CmDqydXaXEK5mg6F', cachedResultName: 'Leads' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'lead_key', condition: 'eq', keyValue: expr("{{ $('Build site traces').item.json.lead_key }}") }] },
      columns: { mappingMode: 'defineBelow', matchingColumns: [], value: { trace_ids: expr("{{ $('Build site traces').item.json.trace_ids }}"), site_checked_at: expr("{{ $('Build site traces').item.json.site_checked_at }}") },
        schema: [{ id: 'trace_ids', displayName: 'trace_ids', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }, { id: 'site_checked_at', displayName: 'site_checked_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }] },
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
      dataTableId: { __rl: true, mode: 'id', value: 'CmDqydXaXEK5mg6F', cachedResultName: 'Leads' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'lead_key', condition: 'eq', keyValue: expr('{{ $json.lead_key }}') }] },
      columns: { mappingMode: 'defineBelow', matchingColumns: [], value: { site_checked_at: expr('{{ $json.site_checked_at }}') }, schema: [{ id: 'site_checked_at', displayName: 'site_checked_at', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true }] },
      options: {}
    },
    output: [{ id: 2, lead_key: 'thin' }]
  }
});

const howItWorks = sticky('## 34 Team enrichment (Person 1, scoring v3)\nMost leads that pass the gates are stuck on **needs enrichment**: strong tech, but the traces say nothing about the team. This reads the startup\'s **own website** (team, about and Impressum pages; robots.txt respected, 10 sites at a time, 2 s between batches, emails and phone numbers removed) and saves it as one extra trace **site:<host>** (source website, status processed) on the lead.\n- Only leads with tech_depth >= 18/25, a website and no earlier check (site_checked_at); best first, max 100 per run.\n- 15 Score leads then sees changed evidence and judges the team again (by hand: 50 per run, enriched leads first).\n- Called by **00 Run all** after 10 Make leads. Plan: n8n/scoring-v3-plan.md', [getLeads, pickLeads, fetchRobots, fetchHome, planPages, fetchPages, buildTraces, hasText, saveTrace, addToLead, markChecked], { color: 7 });

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
  .group('Save', [hasText, saveTrace, addToLead], { description: 'Useful text -> Traces (site:<host>) and the lead\'s trace_ids' });
