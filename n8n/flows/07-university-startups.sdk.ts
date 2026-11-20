import { workflow, node, trigger, sticky, expr, newCredential } from '@n8n/workflow-sdk';

const runByHand = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Run by hand' } });

const calledByRunAll = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.3,
  config: { name: 'Called by Run all', parameters: { inputSource: 'passthrough' } }
});

const runFromDemo = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.2,
  config: { name: 'Run from demo', parameters: { httpMethod: 'GET', path: 'university-startups', responseMode: 'onReceived', options: {} } }
});

const startupPages = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Startup pages',
    executeOnce: true,
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// The public pages that list a university's or incubator's own startups.\n// To add a page: one more line here (page_url, institution, city). Every page was checked against its robots.txt.\n// At most 15 pages per run, fetched one every 2 seconds.\nconst PAGES = [\n  { page_url: 'https://uni-tuebingen.de/forschung/innovation/startup-center/unsere-startups/', institution: 'Startup Center Uni Tübingen', city: 'Tübingen' },\n  { page_url: 'https://gateway-unikoeln.de/en/startingup/unsere-startups', institution: 'Gateway Uni Köln', city: 'Cologne' },\n  { page_url: 'https://www.tu.berlin/entrepreneurship/startup-support/tu-startups', institution: 'TU Berlin Centre for Entrepreneurship', city: 'Berlin' },\n  { page_url: 'https://www.kit-forge.de/de/startups/portfolio/', institution: 'KIT Forge Karlsruhe', city: 'Karlsruhe' },\n  { page_url: 'https://highest-darmstadt.de/en/fuer-unternehmen/start-ups/', institution: 'HIGHEST TU Darmstadt', city: 'Darmstadt' },\n  { page_url: 'https://www.humboldt-innovation.de/de/startups', institution: 'Humboldt-Innovation HU Berlin', city: 'Berlin' },\n  { page_url: 'https://uol.de/giz/gruendungsportraits', institution: 'GIZ Uni Oldenburg', city: 'Oldenburg' },\n  { page_url: 'https://gruendungsbuero.info/gruendergalerie/', institution: 'Gründungsbüro RPTU & HS Kaiserslautern', city: 'Kaiserslautern' },\n  { page_url: 'https://starting-business.de/startups', institution: 'starting business Leibniz Uni Hannover', city: 'Hannover' },\n  { page_url: 'https://www.uni-heidelberg.de/de/forschung/technologietransfer/gruendungsbeispiele', institution: 'Uni Heidelberg', city: 'Heidelberg' },\n  { page_url: 'https://www.max-planck-innovation.de/ausgr%C3%BCndung/innovative-ausgr%C3%BCndungen.html', institution: 'Max Planck Innovation', city: 'Munich' },\n  { page_url: 'https://startupport.de/startups/', institution: 'Startup Port Hamburg', city: 'Hamburg' },\n  { page_url: 'https://www.spinlab.co/startups', institution: 'SpinLab HHL Leipzig', city: 'Leipzig' },\n  { page_url: 'https://www.uni-stuttgart.de/transfer/start-up-stories/', institution: 'Uni Stuttgart', city: 'Stuttgart' },\n  { page_url: 'https://fraunhoferinvestmenthub.de/start-ups/', institution: 'Fraunhofer Venture', city: 'Munich' },\n];\nreturn PAGES.slice(0, 15).map(p => ({ json: p }));\n" },
    output: [{ page_url: 'https://highest-darmstadt.de/en/fuer-unternehmen/start-ups/', institution: 'HIGHEST TU Darmstadt', city: 'Darmstadt' }]
  }
});

const fetchPages = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch pages',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.page_url }}'),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36' }] },
      options: {
        batching: { batch: { batchSize: 1, batchInterval: 2000 } },
        timeout: 30000,
        response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }
      }
    },
    output: [{ data: '<html><main>...</main></html>' }]
  }
});

const pageToText = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Page to text',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Each fetched page -> plain text for OpenAI. Links to other websites are kept as numbered markers\n// ([L1], [L2] ...) right where they stood, plus a list \"L1: link text -> address\", so the model can\n// only take a startup's website from a real link on the page. Pages that failed or show (almost) no text are dropped here.\nconst pages = $('Startup pages').all();\nconst MAX_PROMPT = 12000;\nconst ENT = { auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', ndash: '–', mdash: '—', amp: '&', quot: '\"', apos: \"'\", nbsp: ' ', hellip: '…', euro: '€', bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', eacute: 'é', egrave: 'è', agrave: 'à', aacute: 'á', oacute: 'ó', ccedil: 'ç', shy: '', zwnj: '', reg: '®', trade: '™', copy: '©', middot: '·', bull: '•', rarr: '→', larr: '←', laquo: '«', raquo: '»', gt: '>', lt: '<' };\nconst decode = s => (s || '').replace(/&#(\\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, e) => (e in ENT ? ENT[e] : m));\nconst NOT_A_WEBSITE = /(^|\\.)(linkedin\\.com|facebook\\.com|fb\\.com|instagram\\.com|twitter\\.com|x\\.com|youtube\\.com|youtu\\.be|xing\\.com|tiktok\\.com|bsky\\.app|threads\\.net|wisskomm\\.social|mastodon\\.social|xn--baw-joa\\.social|spotify\\.com|apple\\.com|google\\.[a-z.]+|goo\\.gl|calendly\\.com|northdata\\.(de|com)|firmenwissen\\.de|cylex\\.de|founderio\\.com|crunchbase\\.com|dealroom\\.co|openstreetmap\\.org|wa\\.me|t\\.me|whatsapp\\.com|github\\.com|eventbrite\\.[a-z.]+|meetup\\.com|wikipedia\\.org|vimeo\\.com|issuu\\.com|proliance\\.ai)$/i;\nconst baseOf = host => host.split('.').slice(-2).join('.');\n// (No URL class in n8n's Code sandbox, so addresses are read with a regular expression.)\nconst hostOf = u => { const m = String(u || '').match(/^https?:\\/\\/([^\\/?#:]+)/i); const h = m ? m[1].toLowerCase().replace(/^www\\./, '') : ''; return /^[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z]{2,}$/.test(h) ? h : ''; };\nconst tidyUrl = u => u.replace(/#.*$/, '').replace(/([?&])(utm_[^=&]*|fbclid|gclid|hs[a-z_]*)=[^&]*/gi, '$1').replace(/[?&]+$/, '').replace(/\\?&+/, '?').replace(/&{2,}/g, '&');\nconst plain = s => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\\s+/g, ' ').trim();\nconst out = [];\n$input.all().forEach((item, i) => {\n  const page = (pages[i] || {}).json;\n  if (!page) return;\n  const html = typeof item.json.data === 'string' ? item.json.data : '';\n  if (item.json.error || html.length < 500) return; // the page could not be fetched\n  const pageHost = hostOf(page.page_url);\n  const pageBase = baseOf(pageHost);\n  // The page's own content: <main> when there is one, else the whole body without header and footer.\n  let h = html;\n  const ms = h.search(/<main[\\s>]/i);\n  const me = h.lastIndexOf('</main>');\n  if (ms >= 0 && me > ms) h = h.slice(ms, me);\n  else {\n    const b = h.search(/<body[\\s>]/i);\n    if (b >= 0) h = h.slice(b);\n    h = h.replace(/<(header|footer)\\b[\\s\\S]*?<\\/\\1>/gi, ' ');\n  }\n  h = h.replace(/<!--[\\s\\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template|iframe|select|nav)\\b[\\s\\S]*?<\\/\\1>/gi, ' ');\n  // Logos often carry the startup's name only in their alt text.\n  h = h.replace(/<img\\b[^>]*>/gi, m => { const a = m.match(/\\balt\\s*=\\s*\"([^\"]*)\"/i); return a && a[1].trim() ? ' ' + a[1] + ' ' : ' '; });\n  const links = [];\n  const refOf = {};\n  h = h.replace(/<a\\b([^>]*)>([\\s\\S]*?)<\\/a>/gi, (m, attrs, inner) => {\n    const hm = attrs.match(/href\\s*=\\s*[\"']([^\"']+)[\"']/i);\n    if (!hm) return ' ' + inner + ' ';\n    const raw = decode(hm[1]).trim();\n    if (!/^https?:\\/\\//i.test(raw)) return ' ' + inner + ' ';\n    const url = tidyUrl(raw);\n    const host = hostOf(url);\n    if (!host || baseOf(host) === pageBase || NOT_A_WEBSITE.test(host)) return ' ' + inner + ' ';\n    let ref = refOf[url];\n    if (!ref) {\n      ref = 'L' + (links.length + 1);\n      refOf[url] = ref;\n      const t = attrs.match(/\\b(?:title|aria-label)\\s*=\\s*\"([^\"]*)\"/i);\n      links.push({ ref, url, label: (plain(inner) || (t ? decode(t[1]) : '')).slice(0, 60) });\n    }\n    return ' ' + inner + ' [' + ref + '] ';\n  });\n  const text = decode(h.replace(/<br\\s*\\/?>/gi, '\\n').replace(/<\\/(p|li|h[1-6]|div|tr|td|th|dt|dd|article|section|figure|figcaption)>/gi, '\\n').replace(/<[^>]+>/g, ' '))\n    .replace(/\\r/g, '').replace(/[ \\t\\u00a0]+/g, ' ').replace(/ *\\n */g, '\\n').replace(/\\n{2,}/g, '\\n').trim();\n  if (text.replace(/\\[L\\d+\\]/g, '').length < 300) return; // nothing useful on the page\n  const head = 'Institution: ' + page.institution + ' (' + page.city + ')\\nPage: ' + page.page_url + '\\n\\nPage text (links to other websites are marked [L1], [L2] ...):\\n';\n  // Fit text + the links that occur in the kept text into MAX_PROMPT characters.\n  let budget = MAX_PROMPT - head.length - 40;\n  let body = '', list = '', kept = [];\n  for (let k = 0; k < 6; k++) {\n    body = text.slice(0, budget);\n    const seen = new Set(body.match(/\\[L\\d+\\]/g) || []);\n    kept = links.filter(l => seen.has('[' + l.ref + ']'));\n    list = kept.map(l => l.ref + ': ' + (l.label || '(logo or image)') + ' -> ' + l.url).join('\\n');\n    const total = head.length + body.length + 9 + list.length;\n    if (total <= MAX_PROMPT) break;\n    budget -= total - MAX_PROMPT + 50;\n  }\n  out.push({ json: {\n    page_url: page.page_url,\n    institution: page.institution,\n    city: page.city,\n    page_host: pageHost,\n    prompt: head + body + '\\n\\nLinks:\\n' + (list || '(none)'),\n    link_urls: kept.map(l => l.url),\n    text_chars: text.length,\n    truncated: body.length < text.length,\n  }});\n});\nreturn out;\n" },
    output: [{ page_url: 'https://highest-darmstadt.de/en/fuer-unternehmen/start-ups/', institution: 'HIGHEST TU Darmstadt', city: 'Darmstadt', page_host: 'highest-darmstadt.de', prompt: 'Institution: HIGHEST TU Darmstadt (Darmstadt)\nPage: https://highest-darmstadt.de/en/fuer-unternehmen/start-ups/\n\nPage text (links to other websites are marked [L1], [L2] ...):\nFenexity [L1]\nFenexity develops software for intelligent energy and charging management of electric commercial vehicle fleets.\n\nLinks:\nL1: (logo or image) -> https://www.fenexity.com/', link_urls: ['https://www.fenexity.com/'], text_chars: 54607, truncated: true }]
  }
});

const findStartups = node({
  type: '@n8n/n8n-nodes-langchain.openAi',
  version: 2.3,
  config: {
    name: 'Find startups with OpenAI',
    onError: 'continueRegularOutput',
    parameters: {
      resource: 'text',
      operation: 'response',
      modelId: { __rl: true, mode: 'id', value: 'gpt-5-mini' },
      responses: { values: [{ type: 'text', role: 'user', content: expr('{{ $json.prompt }}') }] },
      simplify: true,
      options: {
        instructions: "You read one public web page of a German university, incubator or university accelerator that lists the startups it supports. List the startups this page actually shows, and nothing else. Answer only with the JSON the schema asks for.\n\nRules:\n- Include only startups, spin-offs or founding teams that the page presents as its own (supported, incubated, accelerated, founded there, portfolio or alumni).\n- Skip partners, sponsors, supporters, investors, banks, acquirers or buyers of a startup (for example a pharma group that bought a spin-off), large corporations, universities, institutes, programmes, competitions, events, mentors, professors, coaches, staff, contact persons and any navigation or menu text.\n- Never invent anything. Every value must come from this page. When the page does not say it, use null (or [] for founders).\n- name: the startup's name as written on the page.\n- website: only an address from the Links list at the end (take the link whose marker such as [L3] stands next to that startup's name or entry) or a web address written in the text right next to that startup. Never a social media or LinkedIn profile, never a directory or news site, never a page of the university or incubator, and never a domain guessed from the name. Otherwise null.\n- description: what the startup does, at most two short sentences and 250 characters, in the page's language, based only on the page. null if the page says nothing about it.\n- founders: the names of people the page names as founders or team members of that startup. Names only, without titles, roles, emails or phone numbers. Never mentors, professors, supervisors, coaches or contact persons of the incubator.\n- founded_year: the founding or start year if the page gives it for that startup (for example \"Gründungsjahr: 2023\", \"Startup: 2024\", \"2026 | Potsdam\", or the year of the section it is listed under). null otherwise.\n- If the page shows no startups, return {\"startups\": []}.",
        maxTokens: 16000,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'startups_on_page', strict: true, schema: "{\"type\": \"object\", \"additionalProperties\": false, \"required\": [\"startups\"], \"properties\": {\"startups\": {\"type\": \"array\", \"items\": {\"type\": \"object\", \"additionalProperties\": false, \"required\": [\"name\", \"website\", \"description\", \"founders\", \"founded_year\"], \"properties\": {\"name\": {\"type\": \"string\"}, \"website\": {\"type\": [\"string\", \"null\"]}, \"description\": {\"type\": [\"string\", \"null\"]}, \"founders\": {\"type\": \"array\", \"items\": {\"type\": \"string\"}}, \"founded_year\": {\"type\": [\"integer\", \"null\"]}}}}}}" } }
      }
    },
    credentials: { openAiApi: newCredential('OpenAI') },
    output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"startups":[{"name":"Fenexity","website":"https://www.fenexity.com/","description":"Software for charging management of electric commercial vehicle fleets.","founders":[],"founded_year":null}]}' }] }] }]
  }
});

const oneTracePerStartup = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'One trace per startup',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// OpenAI's list of startups per page -> one trace per startup.\n// Safety checks, so nothing invented gets saved: the startup's name and each founder's name must\n// appear in the page text; the website must be a link on the page or an address written on it.\n// Email addresses and phone numbers are removed.\nconst pages = $('Page to text').all();\nconst NOT_A_WEBSITE = /(^|\\.)(linkedin\\.com|facebook\\.com|fb\\.com|instagram\\.com|twitter\\.com|x\\.com|youtube\\.com|youtu\\.be|xing\\.com|tiktok\\.com|bsky\\.app|spotify\\.com|apple\\.com|google\\.[a-z.]+|calendly\\.com|northdata\\.(de|com)|firmenwissen\\.de|cylex\\.de|founderio\\.com|crunchbase\\.com|dealroom\\.co|github\\.com|wikipedia\\.org)$/i;\nconst findJson = v => {\n  if (typeof v === 'string') { try { return findJson(JSON.parse(v)); } catch (e) { return null; } }\n  if (Array.isArray(v)) { for (const x of v) { const r = findJson(x); if (r) return r; } return null; }\n  if (v && typeof v === 'object') {\n    if (Array.isArray(v.startups)) return v;\n    for (const k of Object.keys(v)) { const r = findJson(v[k]); if (r) return r; }\n  }\n  return null;\n};\nconst norm = s => (s || '').toLowerCase().normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();\nconst slug = s => norm(s).replace(/\\b(gmbh|ug|haftungsbeschrankt|ag|se|kg|co|gbr|e v|ev|i g|ig|inc|ltd|llc|pvt|sl|sas|bv)\\b/g, ' ').trim().replace(/\\s+/g, '-').slice(0, 60);\nconst clean = s => (s || '').replace(/[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+/g, '[email removed]').replace(/(\\+\\d{1,3}|\\b0)[\\d \\/()-]{6,}\\d/g, '[phone removed]').trim();\n// (No URL class in n8n's Code sandbox, so addresses are read with a regular expression.)\nconst hostOf = u => { const m = String(u || '').trim().match(/^(?:https?:\\/\\/)?([^\\/?#:\\s]+)/i); const h = m ? m[1].toLowerCase().replace(/^www\\./, '') : ''; return /^[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z]{2,}$/.test(h) ? h : ''; };\n// Words from buttons and menus that are not startups.\nconst NOT_A_NAME = /^(teilen|share|mehr( informationen| erfahren)?|more|read more|learn more|weiter(lesen)?|zurück|back|kontakt|contact|start-?ups?|portfolio|alle|all|filter|exist( women| gründerstipendium| forschungstransfer)?|impressum|datenschutz|newsletter|apply|bewerben|jetzt bewerben|team|alumni)$/i;\nconst baseOf = h => h.split('.').slice(-2).join('.');\nconst now = new Date();\nconst out = [];\nconst seen = new Set();\n$input.all().forEach((item, i) => {\n  const page = (pages[i] || {}).json;\n  if (!page || !page.page_host) return;\n  const answer = findJson(item.json);\n  if (!answer) return;\n  const pageText = norm(page.prompt);\n  const pageTextLower = (page.prompt || '').toLowerCase();\n  const linkHosts = {};\n  (page.link_urls || []).forEach(u => { linkHosts[hostOf(u)] = u; });\n  answer.startups.forEach(s => {\n    const name = (s && typeof s.name === 'string' ? s.name : '').replace(/\\s+/g, ' ').trim();\n    if (!name || name.length > 120 || NOT_A_NAME.test(name) || !pageText.includes(norm(name))) return;\n    const key = slug(name);\n    if (!key) return;\n    const trace_id = 'uni:' + page.page_host + ':' + key;\n    if (seen.has(trace_id)) return;\n    seen.add(trace_id);\n    // Website: only a link from the page, or an address written on it; never the institution's own site or a social profile.\n    let website = '';\n    const cand = typeof s.website === 'string' ? s.website.trim() : '';\n    const host = cand ? hostOf(cand) : '';\n    if (host && host.includes('.') && baseOf(host) !== baseOf(page.page_host) && !NOT_A_WEBSITE.test(host) && !/(^|\\.)uni-[a-z-]+\\.de$/.test(host)) {\n      if (linkHosts[host]) website = linkHosts[host];\n      else if (pageTextLower.includes(host)) website = 'https://' + (/^www\\./i.test(cand.replace(/^https?:\\/\\//i, '')) ? 'www.' : '') + host + '/';\n    }\n    const founders = (Array.isArray(s.founders) ? s.founders : [])\n      .filter(f => typeof f === 'string')\n      .map(f => clean(f).replace(/\\s+/g, ' ').replace(/\\s*\\(.*?\\)\\s*/g, ' ').trim())\n      .filter((f, k, a) => f && f.length < 80 && !/removed/.test(f) && pageText.includes(norm(f)) && a.indexOf(f) === k);\n    const year = Number(s.founded_year);\n    const yearOk = Number.isInteger(year) && year >= 1950 && year <= now.getFullYear();\n    const description = clean(typeof s.description === 'string' ? s.description : '');\n    const text = [\n      description,\n      founders.length ? 'Founders: ' + founders.join(', ') : '',\n      yearOk ? 'Founded: ' + year : '',\n      'Listed by: ' + page.institution + ' (' + page.city + ')',\n      website ? 'Website: ' + website : 'Website: not given on the page',\n      'Source page: ' + page.page_url,\n    ].filter(Boolean).join('\\n').slice(0, 5000);\n    out.push({ json: {\n      trace_id,\n      source: 'campus',\n      url: page.page_url,\n      website,\n      happened_at: yearOk ? year + '-01-01T00:00:00.000Z' : now.toISOString(),\n      found_at: now.toISOString(),\n      title: '[' + page.institution + '] ' + name,\n      text,\n      people: founders.map(f => f + ' (founder)').join('; '),\n      org_name: name,\n      city: page.city,\n      status: 'new',\n    }});\n  });\n});\nreturn out;\n" },
    output: [{ trace_id: 'uni:highest-darmstadt.de:fenexity', source: 'campus', url: 'https://highest-darmstadt.de/en/fuer-unternehmen/start-ups/', website: 'https://www.fenexity.com/', happened_at: '2026-11-20T12:00:00.000Z', found_at: '2026-11-20T12:00:00.000Z', title: '[HIGHEST TU Darmstadt] Fenexity', text: 'Software for charging management of electric commercial vehicle fleets.\nListed by: HIGHEST TU Darmstadt (Darmstadt)\nWebsite: https://www.fenexity.com/\nSource page: https://highest-darmstadt.de/en/fuer-unternehmen/start-ups/', people: '', org_name: 'Fenexity', city: 'Darmstadt', status: 'new' }]
  }
});

const onlyNewStartups = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Only new startups',
    parameters: {
      resource: 'row',
      operation: 'rowNotExists',
      dataTableId: { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'trace_id', keyValue: expr('{{ $json.trace_id }}') }] }
    },
    output: [{ trace_id: 'uni:highest-darmstadt.de:fenexity', source: 'campus', url: 'https://highest-darmstadt.de/en/fuer-unternehmen/start-ups/', website: 'https://www.fenexity.com/', happened_at: '2026-11-20T12:00:00.000Z', found_at: '2026-11-20T12:00:00.000Z', title: '[HIGHEST TU Darmstadt] Fenexity', text: 'Software for charging management of electric commercial vehicle fleets.', people: '', org_name: 'Fenexity', city: 'Darmstadt', status: 'new' }]
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

const howItWorks = sticky('## University startups Germany -> Traces\nReads public pages where German universities, incubators and university accelerators list their own startups (Tübingen, Cologne, Berlin, Karlsruhe, Darmstadt, Oldenburg, Kaiserslautern, Hannover, Heidelberg, Hamburg, Leipzig, Stuttgart, Max Planck, Fraunhofer). The list of pages is in **Startup pages**: add a line there to add a page (at most 15 per run). Each page is fetched once, one every 2 s, and only if its robots.txt allows it.\n\nOpenAI (n8n credits) reads each page once and lists the startups on it: name, website, what it does, founders, founding year. It is told never to invent anything, and the flow checks it: a name or founder that is not on the page is dropped, and a website is kept only if it is a link or address on the page. Partners, sponsors and investors are skipped. **Email addresses and phone numbers are removed.**\n\nOne row per startup in **Traces** (source campus, trace_id uni:<site>:<name>); startups already in Traces are skipped. **Run from demo**: webhook path university-startups.', [startupPages, fetchPages, pageToText, findStartups, oneTracePerStartup, onlyNewStartups, saveToTraces], { color: 7 });

export default workflow('university-startups', '07 University startups Germany -> Traces')
  .add(runByHand)
  .to(startupPages)
  .to(fetchPages)
  .to(pageToText)
  .to(findStartups)
  .to(oneTracePerStartup)
  .to(onlyNewStartups)
  .to(saveToTraces)
  .add(calledByRunAll)
  .to(startupPages)
  .add(runFromDemo)
  .to(startupPages)
  .add(howItWorks)
  .group('Read the startup pages', [startupPages, fetchPages, pageToText], { description: 'List of pages -> each page fetched (one every 2 s) -> plain text with its links to other websites' })
  .group('Find the startups', [findStartups, oneTracePerStartup], { description: 'OpenAI lists the startups on each page -> checked against the page -> one trace per startup, no email or phone' })
  .group('Save new startups', [onlyNewStartups, saveToTraces], { description: 'Startups already in Traces are skipped -> the new ones are saved' });
