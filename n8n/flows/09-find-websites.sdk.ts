import { workflow, node, trigger, sticky, expr, splitInBatches, nextBatch, ifElse } from '@n8n/workflow-sdk';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const TRACES = { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' };

const runByHand = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Run by hand' }, output: [{}] });

const calledByRunAll = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.3,
  config: { name: 'Called by Run all', parameters: { inputSource: 'passthrough' } },
  output: [{}]
});

const getTraces = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Get traces',
    executeOnce: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: TRACES,
      returnAll: true
    },
    output: [{ id: 12, trace_id: 'tumvl:planqc', source: 'campus', org_name: 'planqc', city: 'Munich', happened_at: '2024-05-08T00:00:00.000Z', found_at: '2026-11-20T14:48:00.000Z', website: null, status: 'new' }]
  }
});

const pickCandidates = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pick names to search',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Traces that name a startup (org_name) but have no website yet -> at most 15 names per run (Brave credits).\n// Same name on several traces = one search, written to all of them.\n// Order: TUM Venture Labs teams and podcast startups first, then other campus and Luma traces, then the rest; newest first.\n// Skipped: names that are clearly not a startup (events, investors, associations, university teams), names that are just the person in `people`,\n// and names of 3 letters or less once GmbH etc. is dropped (too many companies share them).\n// Query: the name in quotes plus the city, without munich-startup.de, LinkedIn and podcast pages (they fill the results otherwise).\n// When the trace itself already links the startup's own site (in `people` or the text), that link is used and no search is spent.\nconst MAX = 15;\nconst SKIP = /(\\be\\.\\s?v\\b|\\binvestor|\\bverein\\b|\\bassociation\\b|\\bcommunit(y|ies)\\b|\\bevents?\\b|\\bmeetups?\\b|\\bstammtisch\\b|\\bkonferenz\\b|\\bconference\\b|\\bsummit\\b|\\bfestival\\b|\\bhackathon\\b|\\bcourt\\b|\\bclub\\b|\\bnetwork\\b|\\bnetzwerk\\b|\\bwomen in business\\b|\\bstart munich\\b|\\bbits & pretzels\\b|\\bmanage and more\\b|\\bmotorsport\\b|\\bsimulation and deployment\\b|\\buniversit|\\bhochschule\\b|\\blehrstuhl\\b|\\bchair of\\b|\\binstitut|,)/i;\nconst STOP = new Set(['the', 'gmbh', 'ag', 'ug', 'se', 'inc', 'ltd', 'kg', 'technologies', 'technology', 'tech', 'labs', 'lab', 'systems', 'ai', 'io', 'biotech', 'robotics', 'hyperloop', 'solutions', 'software', 'group', 'company']);\nconst BAD = /(^|\\.)(linkedin|xing|crunchbase|dealroom|northdata|facebook|instagram|twitter|x|youtube|wikipedia|luma|lu|eventbrite|meetup|github|medium|munich-startup|tum-venture-labs|tum|lmu|calendly|linktr)\\.[a-z.]+$/;\nconst umlauts = s => String(s || '').replace(/\u00e4/gi, 'ae').replace(/\u00f6/gi, 'oe').replace(/\u00fc/gi, 'ue').replace(/\u00df/g, 'ss');\nconst norm = s => String(s || '').normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/\\(.*?\\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();\nconst cores = name => [norm(name), norm(umlauts(name))].map(n => { const w = n.split(' ').filter(Boolean); const c = w.filter(x => !STOP.has(x)); return { core: (c.length ? c : w).join(''), full: w.join('') }; });\nconst hostIsName = (label, name) => cores(name).some(({ core, full }) => {\n  const l = label.replace(/-/g, '');\n  if (core.length <= 4) return l === core || l === full;\n  return l.includes(core) || l === full || (core.includes(l) && l.length >= 5 && l.length >= core.length * 0.6);\n});\nconst ownLink = (j, name) => {\n  const links = (String(j.people || '') + ' ' + String(j.text || '')).match(/https?:\\/\\/[^\\s)<>\"',;]+|\\bwww\\.[a-z0-9.-]+\\.[a-z]{2,}/gi) || [];\n  for (const raw of links) {\n    const m = raw.match(/^(?:https?:\\/\\/)?([^\\/?#:]+)/i);\n    if (!m) continue;\n    const host = m[1].toLowerCase().replace(/\\.$/, '');\n    if (BAD.test(host)) continue;\n    const parts = host.replace(/^www\\d?\\./, '').split('.');\n    if (parts.length < 2) continue;\n    const label = parts.length >= 3 && ['co', 'com', 'org', 'net'].includes(parts[parts.length - 2]) ? parts[parts.length - 3] : parts[parts.length - 2];\n    if (hostIsName(label, name)) return 'https://' + host + '/';\n  }\n  return '';\n};\nconst groups = {};\nfor (const r of $input.all()) {\n  const j = r.json || {};\n  const name = String(j.org_name || '').trim();\n  if (!j.trace_id || !name) continue;\n  if (String(j.website || '').trim()) continue;\n  if (SKIP.test(name) || name.length > 40 || name.split(/\\s+/).length > 5) continue;\n  const key = norm(name);\n  if (cores(name)[0].core.length <= 3) continue; // SM, DQC ...: too many companies share such names\n  const persons = String(j.people || '').split(';').filter(p => !/\\/company\\//.test(p)).map(p => norm(p.split('(')[0]));\n  if (persons.includes(key)) continue;\n  const rank = (j.source === 'recording' || String(j.trace_id).startsWith('tumvl:')) ? 2 : (j.source === 'campus' || j.source === 'luma') ? 1 : 0;\n  const g = groups[key] || (groups[key] = { org_name: name, city: '', trace_ids: [], newest: '', rank: 0, known: '' });\n  g.trace_ids.push(j.trace_id);\n  if (!g.city && j.city) g.city = String(j.city);\n  if (rank > g.rank) g.rank = rank;\n  if (!g.known) g.known = ownLink(j, name);\n  const t = String(j.happened_at || j.found_at || '');\n  if (t > g.newest) g.newest = t;\n}\nconst all = Object.values(groups).sort((a, b) => (b.rank - a.rank) || b.newest.localeCompare(a.newest));\nreturn all.slice(0, MAX).map(g => {\n  const clean = g.org_name.replace(/\\s*\\(.*?\\)\\s*/g, ' ').replace(/\"/g, '').trim();\n  return { json: {\n    org_name: g.org_name,\n    city: g.city,\n    trace_ids: g.trace_ids,\n    known: g.known,\n    query: '\"' + clean + '\" ' + (g.city ? g.city + ' ' : '') + '-site:munich-startup.de -site:linkedin.com -site:podcast.de',\n    waiting: all.length,\n  } };\n});\n" },
    output: [{ org_name: 'planqc', city: 'Munich', trace_ids: ['tumvl:planqc'], known: '', query: '"planqc" Munich startup', waiting: 120 }]
  }
});

const oneAtATime = splitInBatches({
  version: 3,
  config: { name: 'One name at a time', parameters: { batchSize: 1, options: {} } }
});

const linkedInTrace = ifElse({
  version: 2.2,
  config: {
    name: 'Trace already links it?',
    parameters: {
      conditions: {
        options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
        conditions: [{ leftValue: expr('{{ $json.known }}'), operator: { type: 'string', operation: 'notEmpty', singleValue: true } }],
        combinator: 'and'
      }
    }
  }
});

const braveSearch = node({
  type: '@brave/n8n-nodes-brave-search.braveSearch',
  version: 1.1,
  config: {
    name: 'Brave web search',
    onError: 'continueRegularOutput',
    alwaysOutputData: true,
    parameters: {
      operation: 'web',
      query: expr('{{ $json.query }}'),
      count: 10,
      additionalParameters: { country: 'DE', text_decorations: false, spellcheck: false }
    },
    credentials: { braveSearchApi: { id: 'LQpmM0z0cHucxWpi', name: 'Brave Search account' } },
    output: [{ web: { results: [{ url: 'https://www.planqc.eu/', title: 'planqc - Quantum computing with atoms', description: 'planqc builds quantum computers ...' }] } }]
  }
});

const collectResults = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Keep the results',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// One name -> one item: the name plus its top search results (link, title, snippet).\n// A name whose trace already links its site skipped the search and has no results.\n// A failed search is marked, so that name is not written as 'none' and is tried again next run.\nconst c = $('One name at a time').first().json;\nconst results = [];\nlet failed = '';\nif (!c.known) {\n  for (const r of $input.all()) {\n    const j = r.json || {};\n    if (j.error) { failed = String((j.error && j.error.message) || j.error).slice(0, 200); continue; }\n    const list = (j.web && j.web.results) || j.results || (j.url ? [j] : []);\n    for (const x of list) {\n      if (x && x.url) results.push({ url: String(x.url), title: String(x.title || ''), description: String(x.description || '').slice(0, 300) });\n    }\n  }\n}\nreturn [{ json: { org_name: c.org_name, city: c.city, trace_ids: c.trace_ids, known: c.known || '', query: c.query, waiting: c.waiting, results: results.slice(0, 10), failed } }];\n" },
    output: [{ org_name: 'planqc', city: 'Munich', trace_ids: ['tumvl:planqc'], query: '"planqc" Munich startup', waiting: 120, known: '', results: [{ url: 'https://www.planqc.eu/', title: 'planqc - Quantum computing with atoms', description: '...' }], failed: '' }]
  }
});

const pause = node({
  type: 'n8n-nodes-base.wait',
  version: 1.1,
  config: {
    name: 'Pause 1.5 s',
    parameters: { resume: 'timeInterval', amount: 1.5, unit: 'seconds' },
    output: [{ org_name: 'planqc', trace_ids: ['tumvl:planqc'], results: [], failed: '' }]
  }
});

const pickWebsite = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pick the website',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Search results -> the startup's own website (origin only, https://host/) or nothing.\n// 1) Drop profiles, directories, social networks, news, event pages, universities, job boards and site builders.\n// 2) Best: a result whose domain is the startup's name (planqc.eu for planqc), its home page first.\n// 3) Otherwise: the first remaining result that is a home page and whose title has the name.\n// A link to the startup's own site found in the trace itself wins over the search.\nconst BAD = new Set(('linkedin xing crunchbase dealroom northdata north-data facebook instagram twitter x youtube youtu wikipedia wikimedia wikidata ' +\n  'eventbrite lu luma meetup github gitlab medium tiktok pinterest reddit quora spotify apple google bing amazon soundcloud vimeo threads bsky ' +\n  'pitchbook zoominfo rocketreach cbinsights tracxn owler theorg apollo startbase f6s wellfound angel ycombinator producthunt startupdetector ' +\n  'stepstone indeed glassdoor kununu join personio greenhouse lever ashbyhq workable softgarden jobs ' +\n  'bundesanzeiger handelsregister unternehmensregister firmenwissen implisense companyhouse moneyhouse dnb creditreform ' +\n  'bloomberg reuters handelsblatt faz sueddeutsche spiegel zeit welt tagesschau br merkur tz abendzeitung-muenchen techcrunch gruenderszene ' +\n  'businessinsider t3n deutsche-startups munich-startup eu-startups sifted golem heise wiwo manager-magazin focus stern n-tv bild ard zdf ' +\n  'forbes wired venturebeat prnewswire businesswire presseportal openpr finsmes trendingtopics startup-insider startupvalley vdi ihk ' +\n  'tum-venture-labs unternehmertum tum lmu hm fraunhofer mpg helmholtz dlr bayern-innovativ exist htgf high-tech-gruenderfonds ' +\n  'researchgate arxiv springer sciencedirect nature ieee espacenet epo dpma kickstarter substack wordpress blogspot wix wixsite ' +\n  'notion linktr calendly anchor podbean acast webflow framer vercel netlify herokuapp squarespace carrd jimdo muenchen munich').split(/\\s+/));\nconst SECOND = new Set(['co', 'com', 'org', 'net', 'ac', 'gov', 'edu']);\nconst STOP = new Set(['the', 'gmbh', 'ag', 'ug', 'se', 'inc', 'ltd', 'kg', 'technologies', 'technology', 'tech', 'labs', 'lab', 'systems', 'ai', 'io', 'biotech', 'robotics', 'hyperloop', 'solutions', 'software', 'group', 'company']);\nconst umlauts = s => String(s || '').replace(/\u00e4/gi, 'ae').replace(/\u00f6/gi, 'oe').replace(/\u00fc/gi, 'ue').replace(/\u00df/g, 'ss');\nconst norm = s => String(s || '').normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/\\(.*?\\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();\nconst out = [];\nfor (const it of $input.all()) {\n  const c = it.json;\n  // Two spellings of German names: Gr\u00fcndung -> grundung and gruendung.\n  const variants = [norm(c.org_name), norm(umlauts(c.org_name))].map(n => {\n    const words = n.split(' ').filter(Boolean);\n    const coreWords = words.filter(w => !STOP.has(w));\n    const phrase = (coreWords.length ? coreWords : words).join(' ');\n    return { phrase, core: phrase.replace(/ /g, ''), full: words.join('') };\n  });\n  const hostIsName = label => variants.some(({ core, full }) => {\n    const l = label.replace(/-/g, '');\n    if (core.length <= 4) return l === core || l === full;\n    return l.includes(core) || l === full || (core.includes(l) && l.length >= 5 && l.length >= core.length * 0.6);\n  });\n  let site = '', how = '';\n  const kept = [];\n  for (const r of c.results || []) {\n    const m = String(r.url).match(/^https?:\\/\\/([^\\/?#:]+)(?::\\d+)?([^?#]*)/i);\n    if (!m) continue;\n    const fullHost = m[1].toLowerCase();\n    const host = fullHost.replace(/^www\\d?\\./, '');\n    const parts = host.split('.');\n    if (parts.length < 2) continue;\n    const reg = parts.length >= 3 && SECOND.has(parts[parts.length - 2]) ? parts.slice(-3) : parts.slice(-2);\n    const label = reg[0];\n    if (BAD.has(label) || BAD.has(parts[0])) continue;\n    if (/(^|\\.)(uni|tu|th|hs|fh|lmu|tum)-[a-z-]+\\.de$/.test(host) || /\\.(edu|gov)$|\\.ac\\.[a-z]+$|\\.edu\\.[a-z]+$/.test(host)) continue;\n    if (/news|zeitung|magazin|presse|podcast|jobs?\\b|karriere|career/.test(label)) continue;\n    kept.push({ host: fullHost, label, path: m[2] || '/', title: r.title });\n  }\n  const homePage = path => /^\\/?((de|en|de-de|en-us|home|index\\.html?)\\/?)?$/i.test(path);\n  const byDomain = kept.find(k => hostIsName(k.label) && homePage(k.path)) || kept.find(k => hostIsName(k.label));\n  if (c.known) { site = c.known; how = 'trace'; }\n  else if (variants[0].core.length <= 3) { site = ''; }\n  else if (byDomain) { site = 'https://' + byDomain.host + '/'; how = 'domain'; }\n  else {\n    const inTitle = k => [norm(k.title), norm(umlauts(k.title))].some(t => variants.some(v => (' ' + t + ' ').includes(' ' + v.phrase + ' ')));\n    const byTitle = kept.find(k => homePage(k.path) && inTitle(k));\n    if (byTitle) { site = 'https://' + byTitle.host + '/'; how = 'title'; }\n  }\n  out.push({ json: {\n    org_name: c.org_name,\n    trace_ids: c.trace_ids,\n    phrases: variants.map(v => v.phrase),\n    cores: variants.map(v => v.core),\n    site,\n    how,\n    search_failed: !!c.failed,\n    results: (c.results || []).length,\n    waiting: c.waiting,\n  } });\n}\nreturn out;\n" },
    output: [{ org_name: 'planqc', trace_ids: ['tumvl:planqc'], phrases: ['planqc', 'planqc'], cores: ['planqc', 'planqc'], site: 'https://www.planqc.eu/', how: 'domain', search_failed: false, results: 5, waiting: 120 }]
  }
});

const fetchHomepage = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch home page',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.site }}'),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: UA }] },
      options: {
        timeout: 10000,
        batching: { batch: { batchSize: 1, batchInterval: 2000 } },
        response: { response: { responseFormat: 'text', outputPropertyName: 'html' } }
      }
    },
    output: [{ html: '<html><title>planqc</title>...</html>' }]
  }
});

const confirmSite = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Confirm on home page',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Check each picked site on its home page: the startup's name must appear there (title, text or logo text).\n// The page must also look German (.de address, Impressum, Datenschutz, GmbH, +49, a German city ...), so a namesake abroad\n// (PS Engineering Inc in Texas) is not taken. Exception: a tiny page (under 5 KB, built by script) with a long name.\n// Home page not reachable: keep it only when the domain itself is the name or the trace linked it. Nothing fits: 'none', so it is not searched again.\n// A failed search writes nothing, so that name is tried again next run.\nconst picks = $('Pick the website').all();\nconst norm = s => String(s || '').normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();\nconst decode = s => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#(\\d+);/g, (m, n) => String.fromCharCode(Number(n)));\nconst HERE = /\\b(impressum|imprint|datenschutz|datenschutzerklarung|gmbh|ug haftungsbeschrankt|deutschland|germany|munchen|muenchen|munich|garching|bayern|bavaria|berlin|hamburg|frankfurt|koln|cologne|stuttgart|dusseldorf|leipzig|dresden|karlsruhe|aachen|darmstadt|heidelberg|nurnberg|nuremberg)\\b/;\nconst out = [];\n$input.all().forEach((r, i) => {\n  const p = picks[i] && picks[i].json;\n  if (!p || p.search_failed) return;\n  let site = p.site || '';\n  if (site) {\n    const html = r.json && typeof r.json.html === 'string' ? r.json.html : '';\n    if (!html) {\n      if (p.how === 'title') site = '';\n    } else {\n      const attrs = (html.match(/\\b(?:alt|content|title|aria-label)=\"[^\"]*\"/gi) || []).join(' ');\n      const body = html.replace(/<script[\\s\\S]*?<\\/script>/gi, ' ').replace(/<style[\\s\\S]*?<\\/style>/gi, ' ').replace(/<[^>]+>/g, ' ');\n      const text = ' ' + norm(decode(attrs + ' ' + body).slice(0, 300000)) + ' ';\n      const compact = text.replace(/ /g, '');\n      const named = p.phrases.some(ph => text.includes(' ' + ph + ' ')) || p.cores.some(c => c.length >= 6 && compact.includes(c));\n      const german = /\\.de\\/$/.test(site) || HERE.test(text) || /\\+49/.test(html);\n      const needGerman = html.length >= 5000 || p.cores[0].length <= 5;\n      if (!named || (needGerman && !german)) site = '';\n    }\n  }\n  for (const id of p.trace_ids) out.push({ json: { trace_id: id, website: site || 'none' } });\n});\nreturn out;\n" },
    output: [{ trace_id: 'tumvl:planqc', website: 'https://www.planqc.eu/' }]
  }
});

const saveWebsite = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save website only',
    parameters: {
      resource: 'row',
      operation: 'update',
      dataTableId: TRACES,
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'trace_id', condition: 'eq', keyValue: expr('{{ $json.trace_id }}') }] },
      columns: {
        mappingMode: 'defineBelow',
        value: { website: expr('{{ $json.website }}') },
        matchingColumns: [],
        schema: [{ id: 'website', displayName: 'website', required: false, defaultMatch: false, display: true, type: 'string', canBeUsedToMatch: true, removed: false }]
      },
      options: {}
    },
    output: [{ id: 12, createdAt: '2026-11-20T14:48:00.000Z', updatedAt: '2026-11-20T16:00:00.000Z' }]
  }
});

const howItWorks = sticky('## 09 Find websites\nFor traces that name a startup but have no website yet, this finds the startup\'s own website so the screen and investors have a link.\n\n1. Picks up to **15 names per run**: TUM Venture Labs teams and podcast startups first, then other campus and Luma traces; newest first. Skips names that are clearly not a startup (events, investors, associations e.V., university teams), names that are just the contact person, and 3-letter names.\n2. If the trace already links the startup\'s own site, uses that. Otherwise searches `"name" city` with **Brave** (our own key, credential \"Brave Search account\"), without munich-startup.de / LinkedIn pages, one search every 1.5 s.\n3. Drops LinkedIn, Crunchbase, news, event, university and job sites. Prefers a domain that is the name itself. Checks the home page shows the name and looks German (Impressum, GmbH, .de ...).\n4. Writes **only the `website` column** (`https://host/`), or `none` when nothing fits so the name is not searched again. Never touches `status`.\n\nTo search a name again: clear its `website` cell.', [getTraces, pickCandidates, oneAtATime, linkedInTrace, braveSearch, collectResults, pause, pickWebsite, fetchHomepage, confirmSite, saveWebsite], { color: 7 });

export default workflow('find-websites', '09 Find websites')
  .add(runByHand)
  .to(getTraces)
  .to(pickCandidates)
  .to(oneAtATime
    .onDone(pickWebsite.to(fetchHomepage).to(confirmSite).to(saveWebsite))
    .onEachBatch(linkedInTrace
      .onTrue(collectResults.to(pause).to(nextBatch(oneAtATime)))
      .onFalse(braveSearch.to(collectResults)))
  )
  .add(calledByRunAll)
  .to(getTraces)
  .add(howItWorks)
  .group('Names to search', [getTraces, pickCandidates], { description: 'Traces with a startup name and no website -> up to 15 names, newest first' })
  .group('Search', [oneAtATime, linkedInTrace, braveSearch, collectResults, pause], { description: 'One Brave web search per name, 1.5 s apart, top 10 results (skipped when the trace already links the site)' })
  .group('Pick and save', [pickWebsite, fetchHomepage, confirmSite, saveWebsite], { description: 'Own website from the results, checked on its home page -> only the website column, or none' });
