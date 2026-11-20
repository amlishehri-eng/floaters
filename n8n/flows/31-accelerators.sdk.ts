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
  config: { name: 'Run from demo', parameters: { httpMethod: 'GET', path: 'accelerators', responseMode: 'onReceived', options: {} } }
});

const startupPages = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Startup pages',
    executeOnce: true,
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Public pages where German accelerators, incubator programmes and founder competitions name the\n// startups they picked (cohort, batch, winners, finalists, portfolio). To add a page: one more line\n// here (page_url, program, city). Every page was checked against its robots.txt.\n// \"city\" is where the programme sits; for statewide or national awards it is the state or \"Deutschland\".\n// At most 30 pages per run, fetched one every 2 seconds.\nconst PAGES = [\n  { page_url: 'https://accelerator.unternehmertum.de/', program: 'UnternehmerTUM Accelerator (XPRENEURS) Batch #19', city: 'Munich' },\n  { page_url: 'https://www.baystartup.de/startupdate/das-sind-die-sieger-im-muenchner-businessplan-wettbewerb-2026', program: 'Münchener Businessplan Wettbewerb 2026 (BayStartUP)', city: 'Munich' },\n  { page_url: 'https://www.baystartup.de/startupdate/sieger-startups-aus-phase-2-im-muenchener-businessplan-wettbewerb-2026', program: 'Münchener Businessplan Wettbewerb 2026, Phase 2 (BayStartUP)', city: 'Munich' },\n  { page_url: 'https://www.baystartup.de/startupdate/female-founders-contest-2026-das-sind-die-siegerinnen-des-bayerischen-finales', program: 'Female Founders Contest 2026, Bavarian final (BayStartUP)', city: 'Munich' },\n  { page_url: 'https://www.gruenderland.bayern/neuigkeiten/artikel/zukunftsweisende-innovationen-aus-franken-die-sieger-des-businessplan-wettbewerbs-nordbayern-2025/', program: 'Businessplan Wettbewerb Nordbayern 2025 (BayStartUP)', city: 'Nuremberg' },\n  { page_url: 'https://www.l-bank.info/presse/presseinformationen/2026/pi2026_wm_start-up-bw-elevator-pitch_landesfinale.html', program: 'Start-up BW Elevator Pitch 2026', city: 'Baden-Württemberg' },\n  { page_url: 'https://www.cyberlab-karlsruhe.de/unsere-startups', program: 'CyberLab Accelerator (Start-up BW)', city: 'Karlsruhe' },\n  { page_url: 'https://hessen-ideen.de/wettbewerb/siegerinnen', program: 'Hessen Ideen Wettbewerb', city: 'Hessen' },\n  { page_url: 'https://techquartier.com/news/techquartier-s-digital-finance-accelerator-kicks-off-in-frankfurt-with-game-changing-fintech-startups', program: 'TechQuartier TQ Accelerator: Digital Finance 2025', city: 'Frankfurt am Main' },\n  { page_url: 'https://isb.rlp.de/home/detailansicht/fuenf-unternehmen-als-pioniergeister-2026-ausgezeichnet.html', program: 'Pioniergeist 2026 (ISB Rheinland-Pfalz)', city: 'Rheinland-Pfalz' },\n  { page_url: 'https://isb.rlp.de/home/detailansicht/fuenf-unternehmen-als-pioniergeister-2025-ausgezeichnet.html', program: 'Pioniergeist 2025 (ISB Rheinland-Pfalz)', city: 'Rheinland-Pfalz' },\n  { page_url: 'https://www.uni-saarland.de/en/page/nachhaltigkeit/news/vom-ki-assistenten-bis-zur-medizintechnik-acht-startups-50865.html', program: 'Startup Launchpad Saarland 2026 (Triathlon / Southwest X)', city: 'Saarbrücken' },\n  { page_url: 'https://www.efa.nrw/aktuell/details/kuernrw-businessplan-wettbewerb', program: 'KUER.NRW Businessplan-Wettbewerb 2026', city: 'Nordrhein-Westfalen' },\n  { page_url: 'https://www.nrwbank.de/de/mut-der-gruendungspreis-nrw/', program: 'MUT – Der Gründungspreis NRW 2026 (Nominierte)', city: 'Nordrhein-Westfalen' },\n  { page_url: 'https://www.wirtschaft.nrw/mut-der-gruendungspreis-nrw-2025-drei-gruendungsteams-aus-muenster-solingen-und-huerth', program: 'MUT – Der Gründungspreis NRW 2025', city: 'Nordrhein-Westfalen' },\n  { page_url: 'https://www.gruenden.nrw/gruendungswettbewerbe/out-of-the-box-nrw', program: 'OUT OF THE BOX.NRW Award 2025', city: 'Nordrhein-Westfalen' },\n  { page_url: 'https://www.nbank.de/Service/Presse/Niedersachsen-zeichnet-seine-besten-Start-ups-aus/', program: 'DurchSTARTer-Preis Niedersachsen 2025', city: 'Niedersachsen' },\n  { page_url: 'https://www.starthaus-bremen.de/de/page/news/99830', program: 'Bremer Gründungspreis 2025', city: 'Bremen' },\n  { page_url: 'https://www.aistartuphub.com/en/startups/', program: 'AI.STARTUP.HUB AI Accelerator', city: 'Hamburg' },\n  { page_url: 'https://www.smartcountry.berlin/de/konzept/presse/presseinformationen/news_12096.html', program: 'Smart Country Startup Award 2025', city: 'Berlin' },\n  { page_url: 'https://germanstartupawards.de/gewinner/', program: 'German Startup Awards 2026', city: 'Deutschland' },\n  { page_url: 'https://www.deutscher-gruenderpreis.de/preistraeger/2025/', program: 'Deutscher Gründerpreis 2025', city: 'Deutschland' },\n  { page_url: 'https://www.kfw.de/%C3%9Cber-die-KfW/F%C3%B6rderauftrag-und-Geschichte/KfW-Awards/KfW-Award-Gr%C3%BCnden/2025/', program: 'KfW Award Gründen 2025', city: 'Deutschland' },\n  { page_url: 'https://www.kfw.de/%C3%9Cber-die-KfW/Newsroom/Aktuelles/News-Details_910208.html', program: 'KfW Award Gründen 2026 (Landessieger)', city: 'Deutschland' },\n  { page_url: 'https://www.futuresax.de/gruenden/saechsischer-staatspreis-fuer-gruenden-2027/saechsischer-gruenderpreis-2025/', program: 'Sächsischer Gründerpreis 2025 (futureSAX)', city: 'Sachsen' },\n  { page_url: 'https://www.excitelab.co/startups', program: 'ExciteLab Accelerator', city: 'Dresden' },\n  { page_url: 'https://www.saxeed.net/whz-zeichnet-gruendungsvorhaben-mit-dem-mutmacher-2026-aus/', program: 'SAXEED MUTMACHER 2026 (WHZ)', city: 'Zwickau' },\n  { page_url: 'https://wirtschaftsspiegel-thueringen.com/2025/11/19/thex-award-2025-verliehen-thueringen-wuerdigt-seine-aktive-und-innovative-gruenderszene/', program: 'ThEx AWARD 2025, Thüringer Gründungspreis', city: 'Thüringen' },\n];\nreturn PAGES.slice(0, 30).map(p => ({ json: p }));\n" },
    output: [{ page_url: 'https://www.efa.nrw/aktuell/details/kuernrw-businessplan-wettbewerb', program: 'KUER.NRW Businessplan-Wettbewerb 2026', city: 'Nordrhein-Westfalen' }]
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
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Each fetched page -> plain text for OpenAI. Links to other websites are kept as numbered markers\n// ([L1], [L2] ...) right where they stood, plus a list \"L1: link text -> address\", so the model can\n// only take a startup's website from a real link on the page. Pages that failed or show (almost) no text are dropped here.\nconst pages = $('Startup pages').all();\nconst MAX_PROMPT = 12000;\nconst ENT = { auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', ndash: '–', mdash: '—', amp: '&', quot: '\"', apos: \"'\", nbsp: ' ', hellip: '…', euro: '€', bdquo: '„', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', eacute: 'é', egrave: 'è', agrave: 'à', aacute: 'á', oacute: 'ó', ccedil: 'ç', shy: '', zwnj: '', reg: '®', trade: '™', copy: '©', middot: '·', bull: '•', rarr: '→', larr: '←', laquo: '«', raquo: '»', gt: '>', lt: '<' };\nconst decode = s => (s || '').replace(/&#(\\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, e) => (e in ENT ? ENT[e] : m));\nconst NOT_A_WEBSITE = /(^|\\.)(linkedin\\.com|facebook\\.com|fb\\.com|instagram\\.com|twitter\\.com|x\\.com|youtube\\.com|youtu\\.be|xing\\.com|tiktok\\.com|bsky\\.app|threads\\.net|wisskomm\\.social|mastodon\\.social|xn--baw-joa\\.social|spotify\\.com|apple\\.com|google\\.[a-z.]+|goo\\.gl|calendly\\.com|northdata\\.(de|com)|firmenwissen\\.de|cylex\\.de|founderio\\.com|crunchbase\\.com|dealroom\\.co|openstreetmap\\.org|wa\\.me|t\\.me|whatsapp\\.com|github\\.com|eventbrite\\.[a-z.]+|meetup\\.com|wikipedia\\.org|vimeo\\.com|issuu\\.com|proliance\\.ai)$/i;\nconst baseOf = host => host.split('.').slice(-2).join('.');\n// (No URL class in n8n's Code sandbox, so addresses are read with a regular expression.)\nconst hostOf = u => { const m = String(u || '').match(/^https?:\\/\\/([^\\/?#:]+)/i); const h = m ? m[1].toLowerCase().replace(/^www\\./, '') : ''; return /^[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z]{2,}$/.test(h) ? h : ''; };\nconst tidyUrl = u => u.replace(/#.*$/, '').replace(/([?&])(utm_[^=&]*|fbclid|gclid|hs[a-z_]*)=[^&]*/gi, '$1').replace(/[?&]+$/, '').replace(/\\?&+/, '?').replace(/&{2,}/g, '&');\nconst plain = s => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\\s+/g, ' ').trim();\nconst out = [];\n$input.all().forEach((item, i) => {\n  const page = (pages[i] || {}).json;\n  if (!page) return;\n  const html = typeof item.json.data === 'string' ? item.json.data : '';\n  if (item.json.error || html.length < 500) return; // the page could not be fetched\n  const pageHost = hostOf(page.page_url);\n  const pageBase = baseOf(pageHost);\n  // The page's own content: <main> when there is one, else the whole body without header and footer.\n  let h = html;\n  const ms = h.search(/<main[\\s>]/i);\n  const me = h.lastIndexOf('</main>');\n  if (ms >= 0 && me > ms) h = h.slice(ms, me);\n  else {\n    const b = h.search(/<body[\\s>]/i);\n    if (b >= 0) h = h.slice(b);\n    h = h.replace(/<(header|footer)\\b[\\s\\S]*?<\\/\\1>/gi, ' ');\n  }\n  h = h.replace(/<!--[\\s\\S]*?-->/g, ' ').replace(/<(script|style|noscript|svg|template|iframe|select|nav)\\b[\\s\\S]*?<\\/\\1>/gi, ' ');\n  // Logos often carry the startup's name only in their alt text.\n  h = h.replace(/<img\\b[^>]*>/gi, m => { const a = m.match(/\\balt\\s*=\\s*\"([^\"]*)\"/i); return a && a[1].trim() ? ' ' + a[1] + ' ' : ' '; });\n  const links = [];\n  const refOf = {};\n  h = h.replace(/<a\\b([^>]*)>([\\s\\S]*?)<\\/a>/gi, (m, attrs, inner) => {\n    const hm = attrs.match(/href\\s*=\\s*[\"']([^\"']+)[\"']/i);\n    if (!hm) return ' ' + inner + ' ';\n    const raw = decode(hm[1]).trim();\n    if (!/^https?:\\/\\//i.test(raw)) return ' ' + inner + ' ';\n    const url = tidyUrl(raw);\n    const host = hostOf(url);\n    if (!host || baseOf(host) === pageBase || NOT_A_WEBSITE.test(host)) return ' ' + inner + ' ';\n    let ref = refOf[url];\n    if (!ref) {\n      ref = 'L' + (links.length + 1);\n      refOf[url] = ref;\n      const t = attrs.match(/\\b(?:title|aria-label)\\s*=\\s*\"([^\"]*)\"/i);\n      links.push({ ref, url, label: (plain(inner) || (t ? decode(t[1]) : '')).slice(0, 60) });\n    }\n    return ' ' + inner + ' [' + ref + '] ';\n  });\n  const text = decode(h.replace(/<br\\s*\\/?>/gi, '\\n').replace(/<\\/(p|li|h[1-6]|div|tr|td|th|dt|dd|article|section|figure|figcaption)>/gi, '\\n').replace(/<[^>]+>/g, ' '))\n    .replace(/\\r/g, '').replace(/[ \\t\\u00a0]+/g, ' ').replace(/ *\\n */g, '\\n').replace(/\\n{2,}/g, '\\n').trim();\n  if (text.replace(/\\[L\\d+\\]/g, '').length < 300) return; // nothing useful on the page\n  const head = 'Programme: ' + page.program + ' (' + page.city + ')\\nPage: ' + page.page_url + '\\n\\nPage text (links to other websites are marked [L1], [L2] ...):\\n';\n  // Fit text + the links that occur in the kept text into MAX_PROMPT characters (largest text that fits).\n  const build = n => {\n    const b = text.slice(0, n);\n    const seen = new Set(b.match(/\\[L\\d+\\]/g) || []);\n    const k = links.filter(l => seen.has('[' + l.ref + ']'));\n    const li = k.map(l => l.ref + ': ' + (l.label || '(logo or image)') + ' -> ' + l.url).join('\\n');\n    return { body: b, kept: k, list: li, total: head.length + b.length + 9 + li.length };\n  };\n  let lo = 0, hi = Math.min(text.length, MAX_PROMPT);\n  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (build(mid).total <= MAX_PROMPT) lo = mid; else hi = mid - 1; }\n  const fit = build(lo);\n  const body = fit.body, list = fit.list, kept = fit.kept;\n  out.push({ json: {\n    page_url: page.page_url,\n    program: page.program,\n    city: page.city,\n    page_host: pageHost,\n    prompt: head + body + '\\n\\nLinks:\\n' + (list || '(none)'),\n    link_urls: kept.map(l => l.url),\n    text_chars: text.length,\n    truncated: body.length < text.length,\n  }});\n});\nreturn out;\n" },
    output: [{ page_url: 'https://www.efa.nrw/aktuell/details/kuernrw-businessplan-wettbewerb', program: 'KUER.NRW Businessplan-Wettbewerb 2026', city: 'Nordrhein-Westfalen', page_host: 'efa.nrw', prompt: 'Programme: KUER.NRW Businessplan-Wettbewerb 2026 (Nordrhein-Westfalen)\nPage: https://www.efa.nrw/aktuell/details/kuernrw-businessplan-wettbewerb\n\nPage text (links to other websites are marked [L1], [L2] ...):\n1. Platz – Skellium (Aachen)\nSkellium entwickelt Lithium-Metall-Anoden für Batterien der nächsten Generation.\n\nLinks:\n(none)', link_urls: [], text_chars: 5699, truncated: false }]
  }
});

const getPageMemory = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Get page memory',
    executeOnce: true,
    alwaysOutputData: true,
    parameters: { resource: 'row', operation: 'get', dataTableId: { __rl: true, mode: 'id', value: 'HU8vkWsRJIGzz7Rv', cachedResultName: 'Page memory' }, matchType: 'allConditions', returnAll: true },
    output: [{ page_url: 'https://example.org/startups/', flow: '31', fingerprint: '1a2b3c-4000', startups: 20, checked_at: '2026-11-20T12:00:00.000Z' }]
  }
});

const keepChangedPages = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Keep changed pages',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Only pages whose content changed since the last run go to the AI (saves time and AI credits).\n// Changed = its fingerprint differs from the one in Page memory, or it was last read more than 7 days ago.\n// The fingerprint ignores link numbers, line order and lines that are only numbers or dates.\nconst FLOW = '31';\nconst memory = {};\nfor (const it of $input.all()) { const r = it.json; if (r && r.page_url && r.flow === FLOW) memory[r.page_url] = r; }\nconst fingerprint = s => {\n  const lines = [...new Set(String(s || '').split('\\n')\n    .map(l => l.replace(/\\[L\\d+\\]/g, '').replace(/^L\\d+:\\s*/, '').replace(/\\s+/g, ' ').trim())\n    .filter(l => l && !/^[\\d\\s.,:\\/-]+$/.test(l)))].sort();\n  const t = lines.join('\\n');\n  let h = 0x811c9dc5;\n  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }\n  return h.toString(16) + '-' + t.length;\n};\nconst WEEK = 7 * 864e5;\nconst out = [];\nfor (const p of $('Page to text').all()) {\n  const fp = fingerprint(p.json.prompt);\n  const m = memory[p.json.page_url];\n  const unchanged = m && m.fingerprint === fp && m.checked_at && (Date.now() - new Date(m.checked_at).getTime()) < WEEK;\n  if (!unchanged) out.push({ json: { ...p.json, fingerprint: fp } });\n}\nreturn out;\n" },
    output: [{ page_url: 'https://example.org/startups/', page_host: 'example.org', prompt: '...', link_urls: [], fingerprint: '1a2b3c-4000' }]
  }
});

const rememberPages = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Remember pages',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Pages the AI read successfully -> remembered in Page memory, so the next run skips them while they stay the same.\n// A page whose AI answer could not be read is not remembered, so it is tried again next run.\nconst FLOW = '31';\nconst pages = $('Keep changed pages').all();\nconst findJson = v => {\n  if (typeof v === 'string') { try { return findJson(JSON.parse(v)); } catch (e) { return null; } }\n  if (Array.isArray(v)) { for (const x of v) { const r = findJson(x); if (r) return r; } return null; }\n  if (v && typeof v === 'object') { if (Array.isArray(v.startups)) return v; for (const k of Object.keys(v)) { const r = findJson(v[k]); if (r) return r; } }\n  return null;\n};\nconst now = new Date().toISOString();\nconst out = [];\n$input.all().forEach((item, i) => {\n  const p = pages[i] && pages[i].json;\n  const a = findJson(item.json);\n  if (!p || !p.page_url || !a) return;\n  out.push({ json: { page_url: p.page_url, flow: FLOW, fingerprint: p.fingerprint, startups: a.startups.length, checked_at: now } });\n});\nreturn out;\n" },
    output: [{ page_url: 'https://example.org/startups/', flow: '31', fingerprint: '1a2b3c-4000', startups: 20, checked_at: '2026-11-20T12:00:00.000Z' }]
  }
});

const savePageMemory = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save page memory',
    parameters: {
      resource: 'row', operation: 'upsert', dataTableId: { __rl: true, mode: 'id', value: 'HU8vkWsRJIGzz7Rv', cachedResultName: 'Page memory' }, matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'page_url', condition: 'eq', keyValue: expr('{{ $json.page_url }}') }] },
      columns: { mappingMode: 'autoMapInputData', value: {}, matchingColumns: [], schema: [] },
      options: {}
    },
    output: [{ id: 1 }]
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
        instructions: "You read one public web page of a German accelerator, incubator programme, startup award or founder competition that names the startups it picked: a cohort or batch, winners, finalists, nominees or its portfolio. List those startups, and nothing else. Answer only with the JSON the schema asks for.\n\nRules:\n- Include only startups, young companies and founding teams that the page presents as selected, accelerated, awarded, nominated or in its portfolio. When the page has a current cohort or winners list, take those, and skip companies only mentioned in passing as examples of famous past alumni (for example \"alumni like X, Y and Z\").\n- If the page lists winners or cohorts by year, take only those from 2024 or later.\n- Skip partners, sponsors, supporters, investors, banks, jury members, speakers, ministries, large corporations, universities, institutes, programmes, competitions, events, mentors, coaches, staff, contact persons, award categories and any navigation or menu text. Skip every entry in a business-succession or life's-work category (Nachfolge, Nachfolgen, Unternehmensnachfolge, Lebenswerk) and school pupil teams (Schüler, Schülerinnen).\n- Never invent anything. Every value must come from this page. When the page does not say it, use null (or [] for founders).\n- name: the startup's name as written on the page (without \"Platz 1:\" and similar labels).\n- website: only an address from the Links list at the end (take the link whose marker such as [L3] stands next to that startup's name or entry) or a web address written in the text right next to that startup. Never a social media or LinkedIn profile, never a directory or news site, never a page of the programme itself, and never a domain guessed from the name. Otherwise null.\n- description: what the startup does, at most two short sentences and 250 characters, in the page's language, based only on the page. null if the page says nothing about it.\n- founders: the names of people the page names as founders, CEOs or team members of that startup. Names only, without titles, roles, emails or phone numbers. Never jury members, ministers, sponsors, mentors, professors, coaches, photographers or contact persons of the programme.\n- city: the startup's city or town if the page states it for that startup (for example \"aus Leipzig\", \"(Aachen)\", \"Braunschweig\"). null otherwise; do not derive it from a university's name.\n- year: the year of the cohort, batch, award or competition round the startup is listed under (for example \"Preisträger 2025\", \"Batch 2025\", \"Wettbewerbsrunde 2026\"); if the page gives none, the startup's founding year if stated; else null. Never guess a year that is not written on the page.\n- If the page shows no startups, return {\"startups\": []}.",
        maxTokens: 16000,
        reasoning: { reasoningOptions: { effort: 'low', summary: 'none' } },
        textFormat: { textOptions: { type: 'json_schema', name: 'startups_on_page', strict: true, schema: "{\"type\": \"object\", \"additionalProperties\": false, \"required\": [\"startups\"], \"properties\": {\"startups\": {\"type\": \"array\", \"items\": {\"type\": \"object\", \"additionalProperties\": false, \"required\": [\"name\", \"website\", \"description\", \"founders\", \"city\", \"year\"], \"properties\": {\"name\": {\"type\": \"string\"}, \"website\": {\"type\": [\"string\", \"null\"]}, \"description\": {\"type\": [\"string\", \"null\"]}, \"founders\": {\"type\": \"array\", \"items\": {\"type\": \"string\"}}, \"city\": {\"type\": [\"string\", \"null\"]}, \"year\": {\"type\": [\"integer\", \"null\"]}}}}}}" } }
      }
    },
    credentials: { openAiApi: newCredential('OpenAI') },
    output: [{ output: [{ type: 'message', content: [{ type: 'output_text', text: '{"startups":[{"name":"Skellium","website":null,"description":"Entwickelt Lithium-Metall-Anoden für Batterien der nächsten Generation.","founders":["Jonas Gorsch"],"city":"Aachen","year":2026}]}' }] }] }]
  }
});

const oneTracePerStartup = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'One trace per startup',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// OpenAI's list of startups per page -> one trace per startup.\n// Safety checks, so nothing invented gets saved: the startup's name, each founder's name and the city\n// must appear in the page text; the website must be a link on the page or an address written on it.\n// Email addresses and phone numbers are removed.\nconst pages = $('Keep changed pages').all();\nconst NOT_A_WEBSITE = /(^|\\.)(linkedin\\.com|facebook\\.com|fb\\.com|instagram\\.com|twitter\\.com|x\\.com|youtube\\.com|youtu\\.be|xing\\.com|tiktok\\.com|bsky\\.app|spotify\\.com|apple\\.com|google\\.[a-z.]+|calendly\\.com|northdata\\.(de|com)|firmenwissen\\.de|cylex\\.de|founderio\\.com|crunchbase\\.com|dealroom\\.co|github\\.com|wikipedia\\.org|hubspot\\.com|notion\\.site|notion\\.com|pitch\\.com|gamma\\.app|sting\\.co|wfb-bremen\\.de|tu-dresden\\.de|hzdr-innovation\\.de)$/i;\nconst findJson = v => {\n  if (typeof v === 'string') { try { return findJson(JSON.parse(v)); } catch (e) { return null; } }\n  if (Array.isArray(v)) { for (const x of v) { const r = findJson(x); if (r) return r; } return null; }\n  if (v && typeof v === 'object') {\n    if (Array.isArray(v.startups)) return v;\n    for (const k of Object.keys(v)) { const r = findJson(v[k]); if (r) return r; }\n  }\n  return null;\n};\nconst norm = s => (s || '').toLowerCase().normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, ' ').trim();\nconst slug = s => norm(s).replace(/\\b(gmbh|ug|haftungsbeschrankt|ag|se|kg|co|gbr|e v|ev|i g|ig|inc|ltd|llc|pvt|sl|sas|bv)\\b/g, ' ').trim().replace(/\\s+/g, '-').slice(0, 60);\nconst clean = s => (s || '').replace(/[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+/g, '[email removed]').replace(/(\\+\\d{1,3}|\\b0)[\\d \\/()-]{6,}\\d/g, '[phone removed]').trim();\n// (No URL class in n8n's Code sandbox, so addresses are read with a regular expression.)\nconst hostOf = u => { const m = String(u || '').trim().match(/^(?:https?:\\/\\/)?([^\\/?#:\\s]+)/i); const h = m ? m[1].toLowerCase().replace(/^www\\./, '') : ''; return /^[a-z0-9-]+(\\.[a-z0-9-]+)*\\.[a-z]{2,}$/.test(h) ? h : ''; };\n// Words from buttons, menus and award labels that are not startups.\nconst NOT_A_NAME = /^(teilen|share|mehr( informationen| erfahren)?|more|read more|learn more|weiter(lesen)?|zurück|back|kontakt|contact|start-?ups?|portfolio|alle|all|filter|impressum|datenschutz|newsletter|apply|bewerben|jetzt bewerben|jetzt ansehen|team|alumni|batch( #?\\d+)?|platz \\d|\\d\\. platz|gewinner(innen)?|sieger(innen)?|preisträger(innen)?|finalist(innen)?|sonderpreis|publikumspreis|newcomer|aufsteiger|nominierte)$/i;\nconst baseOf = h => h.split('.').slice(-2).join('.');\nconst now = new Date();\nconst out = [];\nconst seen = new Set();\n$input.all().forEach((item, i) => {\n  const page = (pages[i] || {}).json;\n  if (!page || !page.page_host) return;\n  const answer = findJson(item.json);\n  if (!answer) return;\n  const pageText = norm(page.prompt);\n  const pageTextLower = (page.prompt || '').toLowerCase();\n  const linkHosts = {};\n  (page.link_urls || []).forEach(u => { linkHosts[hostOf(u)] = u; });\n  answer.startups.forEach(s => {\n    const name = (s && typeof s.name === 'string' ? s.name : '').replace(/\\s+/g, ' ').trim();\n    if (!name || name.length > 120 || NOT_A_NAME.test(name) || !pageText.includes(norm(name))) return;\n    const key = slug(name);\n    if (!key) return;\n    const trace_id = 'cohort:' + page.page_host + ':' + key;\n    if (seen.has(trace_id)) return;\n    seen.add(trace_id);\n    // Website: only a link from the page, or an address written on it; never the programme's own site or a social profile.\n    let website = '';\n    const cand = typeof s.website === 'string' ? s.website.trim() : '';\n    const host = cand ? hostOf(cand) : '';\n    if (host && host.includes('.') && baseOf(host) !== baseOf(page.page_host) && !NOT_A_WEBSITE.test(host)) {\n      if (linkHosts[host]) website = linkHosts[host];\n      else if (pageTextLower.includes(host)) website = 'https://' + (/^www\\./i.test(cand.replace(/^https?:\\/\\//i, '')) ? 'www.' : '') + host + '/';\n    }\n    const founders = (Array.isArray(s.founders) ? s.founders : [])\n      .filter(f => typeof f === 'string')\n      .map(f => clean(f).replace(/\\s+/g, ' ').replace(/\\s*\\(.*?\\)\\s*/g, ' ').replace(/^((dr|prof)\\.?\\s+)+/i, '').trim())\n      .filter((f, k, a) => f && f.length < 80 && /\\s/.test(f) && !/removed/.test(f) && pageText.includes(norm(f)) && a.indexOf(f) === k);\n    const year = Number(s.year);\n    // The year must be written on the page; otherwise the date of finding is used.\n    const yearOk = Number.isInteger(year) && year >= 1990 && year <= now.getFullYear() && (page.prompt || '').includes(String(year));\n    const sCity = typeof s.city === 'string' ? s.city.replace(/\\s+/g, ' ').trim() : '';\n    const city = sCity && sCity.length < 60 && pageText.includes(norm(sCity)) ? sCity : page.city;\n    const description = clean(typeof s.description === 'string' ? s.description : '');\n    const text = [\n      description,\n      founders.length ? 'Founders: ' + founders.join(', ') : '',\n      'Programme: ' + page.program + (yearOk ? ' (' + year + ')' : ''),\n      city !== page.city ? 'City: ' + city : '',\n      website ? 'Website: ' + website : 'Website: not given on the page',\n      'Source page: ' + page.page_url,\n    ].filter(Boolean).join('\\n').slice(0, 5000);\n    out.push({ json: {\n      trace_id,\n      source: 'accelerator',\n      url: page.page_url,\n      website,\n      happened_at: yearOk ? year + '-01-01T00:00:00.000Z' : now.toISOString(),\n      found_at: now.toISOString(),\n      title: '[' + page.program + '] ' + name,\n      text,\n      people: founders.map(f => f + ' (founder)').join('; '),\n      org_name: name,\n      city,\n      status: 'new',\n    }});\n  });\n});\nreturn out;\n" },
    output: [{ trace_id: 'cohort:efa.nrw:skellium', source: 'accelerator', url: 'https://www.efa.nrw/aktuell/details/kuernrw-businessplan-wettbewerb', website: '', happened_at: '2026-01-01T00:00:00.000Z', found_at: '2026-11-20T12:00:00.000Z', title: '[KUER.NRW Businessplan-Wettbewerb 2026] Skellium', text: 'Entwickelt Lithium-Metall-Anoden für Batterien der nächsten Generation.\nFounders: Jonas Gorsch\nProgramme: KUER.NRW Businessplan-Wettbewerb 2026 (2026)\nCity: Aachen\nWebsite: not given on the page\nSource page: https://www.efa.nrw/aktuell/details/kuernrw-businessplan-wettbewerb', people: 'Jonas Gorsch (founder)', org_name: 'Skellium', city: 'Aachen', status: 'new' }]
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
    output: [{ trace_id: 'cohort:efa.nrw:skellium', source: 'accelerator', url: 'https://www.efa.nrw/aktuell/details/kuernrw-businessplan-wettbewerb', website: '', happened_at: '2026-01-01T00:00:00.000Z', found_at: '2026-11-20T12:00:00.000Z', title: '[KUER.NRW Businessplan-Wettbewerb 2026] Skellium', text: 'Entwickelt Lithium-Metall-Anoden für Batterien der nächsten Generation.', people: 'Jonas Gorsch (founder)', org_name: 'Skellium', city: 'Aachen', status: 'new' }]
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

const howItWorks = sticky('## Accelerators and competitions -> Traces\nTeams picked by German accelerators, incubator programmes and founder competitions are vetted early, usually before any funding round. This flow reads their public cohort, batch, winner, nominee and portfolio pages across Germany (UnternehmerTUM, BayStartUP, Start-up BW, CyberLab, Hessen Ideen, TechQuartier, Pioniergeist, KUER.NRW, MUT NRW, OUT OF THE BOX.NRW, DurchSTARTer, Bremer Gründungspreis, AI.STARTUP.HUB Hamburg, KfW Award, Deutscher Gründerpreis, German Startup Awards, futureSAX, ExciteLab, SAXEED, ThEx, Saarland Launchpad and more). The list is in **Startup pages**: add a line there to add a page (at most 30 per run). Each page is fetched once, one every 2 s, and only if its robots.txt allows it.\n\nOpenAI (n8n credits) reads each page once and lists the startups: name, website, what it does, founders, city, cohort or award year. It is told never to invent anything, and the flow checks it: a name, founder or city not on the page is dropped, and a website is kept only if it is a link or address on the page. Sponsors, jury and investors are skipped. **Email addresses and phone numbers are removed.**\n\nOne row per startup in **Traces** (source accelerator, trace_id cohort:<site>:<name>); startups already in Traces are skipped. **Run from demo**: webhook path accelerators.', [startupPages, fetchPages, pageToText, findStartups, oneTracePerStartup, onlyNewStartups, saveToTraces], { color: 7 });

export default workflow('accelerators-competitions', '31 Accelerators and competitions -> Traces')
  .add(runByHand)
  .to(startupPages)
  .to(fetchPages)
  .to(pageToText)
  .to(getPageMemory)
  .to(keepChangedPages)
  .to(findStartups)
  .to(oneTracePerStartup)
  .to(onlyNewStartups)
  .to(saveToTraces)
  .add(findStartups)
  .to(rememberPages)
  .to(savePageMemory)
  .add(calledByRunAll)
  .to(startupPages)
  .add(runFromDemo)
  .to(startupPages)
  .add(howItWorks)
  .group('Read the programme pages', [startupPages, fetchPages, pageToText], { description: 'List of cohort, winner and portfolio pages -> each fetched (one every 2 s) -> plain text with its links to other websites' })
  .group('Skip unchanged pages', [getPageMemory, keepChangedPages], { description: 'Pages whose text is the same as last time (and read within 7 days) are skipped' })
  .group('Remember pages', [rememberPages, savePageMemory], { description: 'Pages the AI read are remembered with their fingerprint' })
  .group('Save new startups', [oneTracePerStartup, onlyNewStartups, saveToTraces], { description: 'Startups already in Traces are skipped -> the new ones are saved' });
