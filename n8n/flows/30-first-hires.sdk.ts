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
  config: { name: 'Run from demo', parameters: { httpMethod: 'GET', path: 'first-hires', responseMode: 'onReceived', options: {} } }
});

const searchTerms = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Search terms',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Job ads of the Bundesagentur für Arbeit (official public API, public client id, no login).\n// The search is full text (title + description). 'strong' terms are precise enough on their own;\n// for the broad term 'Startup' the title or employer must also say so (see 'List ads').\nconst TERMS = [\n  ['Founding', true],\n  ['Founders Associate', true],\n  ['Co-Founder', true],\n  ['Mitgründer', true],\n  ['Gründerteam', true],\n  ['Pre-Seed', true],\n  ['Seed-Finanzierung', true],\n  ['Spin-off', true],\n  ['Ausgründung', true],\n  ['Startup', false],\n];\nconst base = 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs';\nreturn TERMS.map(([term, strong]) => ({ json: {\n  term,\n  strong,\n  url: base + '?was=' + encodeURIComponent(term) + '&angebotsart=1&zeitarbeit=false&size=100&page=1',\n}}));\n" },
    output: [{ term: 'Founding', strong: true, url: 'https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v6/jobs?was=Founding&angebotsart=1&zeitarbeit=false&size=100&page=1' }]
  }
});

const searchJobs = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Search job ads',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.url }}'),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'X-API-Key', value: 'jobboerse-jobsuche' }, { name: 'User-Agent', value: 'htgf-founder-traces (n8n; public data only)' }, { name: 'Accept', value: 'application/json' }] },
      options: {
        batching: { batch: { batchSize: 1, batchInterval: 1500 } },
        response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }
      }
    },
    output: [{ data: '{"ergebnisliste":[{"stellenangebotsTitel":"Software Engineer (Founding Team)","firma":"Junini GmbH","referenznummer":"10000-1208091153-S","datumErsteVeroeffentlichung":"2026-09-30","stellenlokationen":[{"adresse":{"ort":"Berlin","land":"DEUTSCHLAND"}}]}],"maxErgebnisse":44}' }]
  }
});

const listAds = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'List ads',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// All search answers -> one item per job ad (merged, no doubles by refnr), only ads that look like an early startup.\n// Drops: ads older than 120 days, ads outside Germany, big employers, agencies, recruiters, public bodies.\n// Keeps at most 3 ads per employer (newest first), so one hiring company does not flood Traces.\nconst terms = $('Search terms').all();\nconst DAY = 86400000;\nconst now = Date.now();\nconst DROP_EMPLOYER = /\\b(AG|SE|KGaA|e\\.\\s?V\\.?|eG|gGmbH|gUG|KdöR|AöR|oHG)(?![\\wäöü])|universit|hochschule|stiftung|institut|fraunhofer|max-planck|helmholtz|forschungszentrum|klinik|krankenhaus|landratsamt|landkreis|gemeinde|stadt |bundes|ministerium|kanzlei|steuerber|rechtsanw|personal|recruit|zeitarbeit|staffing|vermittlung|headhunt|executive search|human resources|talent|\\bjobs?\\b|hr consulting|arbeitslotse|\\bihk\\b|handwerkskammer|zalando|hellofresh|jetbrains|airbus|google|bosch|siemens|\\bsap\\b|roche|merck|deloitte|check24|delivery hero|nintendo|fresenius|apleona|thermo fisher|eppendorf|enercon|amazon|microsoft|allianz|deutsche bahn|telekom|\\bbmw\\b|mercedes|volkswagen|porsche|audi|continental|infineon|lidl|aldi|rewe|edeka|bertelsmann|arvato|pwc|kpmg|ernst & young|accenture|mckinsey|capgemini|\\bibm\\b|oracle|salesforce|median|vitronic|phorms/i;\nconst KEEP = /start-?up|gründer|gründungsteam|in gründung|\\bi\\.\\s?g\\.|founding|founder|mitgründer|pre-?seed|\\bseed\\b|spin-?off|ausgründung|early[- ]stage|first hire|erste[rn]? mitarbeiter/i;\nconst b64 = s => {\n  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';\n  let out = '';\n  for (let i = 0; i < s.length; i += 3) {\n    const a = s.charCodeAt(i), b = s.charCodeAt(i + 1), c = s.charCodeAt(i + 2);\n    out += A[a >> 2] + A[((a & 3) << 4) | (isNaN(b) ? 0 : b >> 4)] + (isNaN(b) ? '=' : A[((b & 15) << 2) | (isNaN(c) ? 0 : c >> 6)]) + (isNaN(c) ? '=' : A[c & 63]);\n  }\n  return out;\n};\nconst seen = {};\nconst ads = [];\n$input.all().forEach((page, i) => {\n  if (!page.json || page.json.error) return;\n  let d = page.json.data;\n  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }\n  const t = terms[i] ? terms[i].json : { term: '', strong: false };\n  ((d && d.ergebnisliste) || []).forEach(j => {\n    const refnr = j && j.referenznummer;\n    if (!refnr || seen[refnr]) return;\n    seen[refnr] = true;\n    const title = String(j.stellenangebotsTitel || '').trim();\n    const firma = String(j.firma || '').trim();\n    if (!title || !firma) return;\n    const published = String(j.datumErsteVeroeffentlichung || (j.veroeffentlichungszeitraum && j.veroeffentlichungszeitraum.von) || '').slice(0, 10);\n    if (!published || now - Date.parse(published) > 120 * DAY) return;\n    const locs = (j.stellenlokationen || []).map(l => (l && l.adresse) || {});\n    if (locs.length && !locs.some(a => String(a.land || '').toUpperCase() === 'DEUTSCHLAND')) return;\n    if (DROP_EMPLOYER.test(firma)) return;\n    if (!t.strong && !KEEP.test(title + ' ' + firma)) return;\n    const de = locs.filter(a => String(a.land || '').toUpperCase() === 'DEUTSCHLAND');\n    ads.push({\n      trace_id: 'jobs:' + refnr,\n      refnr,\n      code: b64(refnr),\n      term: t.term,\n      title,\n      firma,\n      city: (de[0] && de[0].ort) || '',\n      published,\n    });\n  });\n});\nads.sort((a, b) => b.published.localeCompare(a.published));\nconst perEmployer = {};\nreturn ads.filter(a => {\n  const k = a.firma.toLowerCase();\n  perEmployer[k] = (perEmployer[k] || 0) + 1;\n  return perEmployer[k] <= 3;\n}).map(a => ({ json: a }));\n" },
    output: [{ trace_id: 'jobs:10000-1208091153-S', refnr: '10000-1208091153-S', code: 'MTAwMDAtMTIwODA5MTE1My1T', term: 'Founding', title: 'Software Engineer (Founding Team)', firma: 'Junini GmbH', city: 'Berlin', published: '2026-09-30' }]
  }
});

const onlyNewAds = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Only new ads',
    parameters: {
      resource: 'row',
      operation: 'rowNotExists',
      dataTableId: { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'trace_id', keyValue: expr('{{ $json.trace_id }}') }] }
    },
    output: [{ trace_id: 'jobs:10000-1208091153-S', refnr: '10000-1208091153-S', code: 'MTAwMDAtMTIwODA5MTE1My1T', term: 'Founding', title: 'Software Engineer (Founding Team)', firma: 'Junini GmbH', city: 'Berlin', published: '2026-09-30' }]
  }
});

const capAds = node({
  type: 'n8n-nodes-base.limit',
  version: 1,
  config: {
    name: 'Cap at 40 ads',
    parameters: { maxItems: 40, keep: 'firstItems' },
    output: [{ trace_id: 'jobs:10000-1208091153-S', refnr: '10000-1208091153-S', code: 'MTAwMDAtMTIwODA5MTE1My1T', term: 'Founding', title: 'Software Engineer (Founding Team)', firma: 'Junini GmbH', city: 'Berlin', published: '2026-09-30' }]
  }
});

const fetchDetails = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch ad details',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4/jobdetails/{{ $json.code }}'),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'X-API-Key', value: 'jobboerse-jobsuche' }, { name: 'User-Agent', value: 'htgf-founder-traces (n8n; public data only)' }, { name: 'Accept', value: 'application/json' }] },
      options: {
        batching: { batch: { batchSize: 1, batchInterval: 1500 } },
        response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }
      }
    },
    output: [{ data: '{"stellenangebotsTitel":"Software Engineer (Founding Team)","firma":"Junini GmbH","referenznummer":"10000-1208091153-S","stellenangebotsBeschreibung":"Du bist der erste Engineer neben unserem CTO.","datumErsteVeroeffentlichung":"2026-09-30","eintrittszeitraum":{"von":"2026-11-19"},"stellenlokationen":[{"adresse":{"ort":"Berlin","land":"DEUTSCHLAND"}}],"istPrivateArbeitsvermittlung":false,"istArbeitnehmerUeberlassung":false}' }]
  }
});

const buildTraces = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build traces',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Each new job ad + its details -> the finished trace row. Only public, professional facts:\n// contact persons, emails and phone numbers are removed; 'people' stays empty.\n// Dropped here: temp-work or private-recruiter ads, ads whose text does not say startup/founder/seed/spin-off,\n// and companies whose text says they were founded more than 6 years ago.\nconst ads = $('Cap at 40 ads').all();\nconst details = $('Fetch ad details').all();\nconst thisYear = new Date().getFullYear();\nconst parse = it => {\n  if (!it || !it.json || it.json.error) return null;\n  const d = it.json.data;\n  if (typeof d !== 'string') return d || null;\n  try { return JSON.parse(d); } catch (e) { return null; }\n};\nconst KEEP = /start-?up|gründer|gründungsteam|in gründung|founding|founder|mitgründer|pre-?seed|\\bseed\\b|spin-?off|ausgründung|early[- ]stage|first hire|erste[rn]? mitarbeiter/i;\nconst FOUNDED = /(?:gegründet|founded|gründung)\\D{0,15}((?:19|20)\\d\\d)|((?:19|20)\\d\\d)[^.\\n]{0,60}?gegründet/gi;\nconst EMAIL = /(?:mailto:)?[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi;\nconst CONTACT_LINE = /ansprechpartner|ansprechperson|kontaktperson|ihr kontakt|dein kontakt|contact person|your contact|zu händen|\\bz\\.\\s?h\\.|\\btel\\.|\\btelefon|\\bphone\\b|\\bmobil\\b|\\bmobile\\s*:|e-?mail\\s*:|whatsapp/i;\n// Title and employer: only emails and phone numbers are removed.\nconst clean = s => String(s || '').replace(EMAIL, '[email removed]').replace(/(?:\\+|\\b00)\\d[\\d \\/().-]{6,}\\d/g, '[phone removed]').replace(/\\s+/g, ' ').trim();\n// A short line with a 'Dr. Name' or 'Firstname X. Lastname' is a signature or contact block: dropped.\nconst SIGNATURE = /\\bDr\\.\\s+[A-ZÄÖÜ]|\\b[A-ZÄÖÜ][a-zäöüß]+\\s+[A-Z]\\.\\s+[A-ZÄÖÜ][a-zäöüß]+/;\nconst cleanText = s => String(s || '')\n  .replace(EMAIL, '[email removed]')\n  .replace(/https?:\\/\\/\\[email removed\\]/gi, '[email removed]')\n  .replace(/(?:\\+|\\b00)\\d[\\d \\/().-]{6,}\\d/g, '[phone removed]')\n  .replace(/\\b0\\d{2,5}[ \\/-]?\\d{3,}(?:[ \\/-]?\\d+)*/g, '[phone removed]')\n  .replace(/\\b(Frau|Herr|Herrn|Mr\\.?|Mrs\\.?|Ms\\.?)\\s+(Dr\\.\\s+)?[A-ZÄÖÜ][\\wäöüß-]+(\\s+[A-ZÄÖÜ][\\wäöüß-]+)?/g, '[contact removed]')\n  .split('\\n')\n  .filter(line => !CONTACT_LINE.test(line))\n  .filter(line => !(line.length < 90 && SIGNATURE.test(line)))\n  .join('\\n')\n  .replace(/[ \\t]+/g, ' ')\n  .replace(/\\n\\s*\\n\\s*\\n+/g, '\\n\\n')\n  .trim();\n// The employer's own website: a web address or email domain in the ad whose name matches the employer. Never a job board.\nconst NOT_OWN = /arbeitsagentur|jobexport|finest-jobs|jobs\\.ams|\\bams\\.at|linkedin|xing|stepstone|indeed|personio|join\\.com|greenhouse|lever\\.co|softgarden|recruitee|workday|smartrecruiters|karriere|jobware|monster|glassdoor|kununu|gmail|googlemail|gmx|web\\.de|t-online|outlook|hotmail|yahoo|icloud|freenet|posteo/i;\nconst GENERIC = { gmbh: 1, mbh: 1, ug: 1, haftungsbeschränkt: 1, haftungsbeschrankt: 1, kg: 1, co: 1, ag: 1, se: 1, ohg: 1, gbr: 1, the: 1, und: 1, and: 1, germany: 1, deutschland: 1, gruppe: 1, group: 1, holding: 1, inh: 1 };\nconst squash = s => String(s || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '');\nconst findWebsite = (desc, firma) => {\n  const hosts = [];\n  (String(desc || '').match(/(?:https?:\\/\\/|www\\.)[^\\s)\\]>\"'<,;*]+/gi) || []).forEach(u => {\n    if (/mailto:/i.test(u)) return;\n    const m = u.replace(/^https?:\\/\\//i, '').match(/^([a-z0-9.-]+\\.[a-z]{2,})/i);\n    if (m) hosts.push(m[1].toLowerCase());\n  });\n  (String(desc || '').match(/[A-Z0-9._%+-]+@([A-Z0-9.-]+\\.[A-Z]{2,})/gi) || []).forEach(e => hosts.push(e.split('@')[1].toLowerCase()));\n  const tokens = String(firma || '').toLowerCase().split(/[^a-z0-9äöüß]+/).filter(t => t.length >= 3 && !GENERIC[t]);\n  const whole = squash(firma);\n  for (const h of hosts) {\n    const host = h.replace(/^www\\./, '');\n    if (NOT_OWN.test(host)) continue;\n    const label = squash(host.split('.').slice(0, -1).join(''));\n    if (!label) continue;\n    if (tokens.some(t => label.includes(squash(t))) || (label.length >= 4 && whole.includes(label))) return 'https://' + host;\n  }\n  return '';\n};\nconst out = [];\nads.forEach((a, i) => {\n  const d = parse(details[i]);\n  if (!d || !d.referenznummer) return; // details missing: skip, it is tried again next run\n  if (d.istArbeitnehmerUeberlassung === true || d.istPrivateArbeitsvermittlung === true) return;\n  const ad = a.json;\n  const desc = String(d.stellenangebotsBeschreibung || '');\n  const firma = String(d.firma || ad.firma).trim();\n  const title = String(d.stellenangebotsTitel || ad.title).trim();\n  if (!KEEP.test(title + ' ' + firma + ' ' + desc)) return;\n  let tooOld = false;\n  let m;\n  FOUNDED.lastIndex = 0;\n  while ((m = FOUNDED.exec(desc))) {\n    const y = parseInt(m[1] || m[2], 10);\n    if (y && y <= thisYear && y < thisYear - 6) tooOld = true;\n  }\n  if (tooOld) return;\n  const locs = (d.stellenlokationen || []).map(l => (l && l.adresse) || {}).filter(x => x.ort);\n  const cities = locs.map(x => x.ort).filter((c, k, arr) => arr.indexOf(c) === k);\n  const city = cities[0] || ad.city || '';\n  const start = (d.eintrittszeitraum && d.eintrittszeitraum.von) || '';\n  const published = String(d.datumErsteVeroeffentlichung || ad.published || '').slice(0, 10);\n  const text = [\n    'Job: ' + clean(title),\n    'Employer: ' + clean(firma),\n    'Location: ' + (cities.length ? cities.slice(0, 5).join(', ') : 'not given'),\n    start ? 'Start: ' + start : '',\n    'First published: ' + published + (d.hauptberuf ? ' · Occupation: ' + d.hauptberuf : ''),\n    'Found by search term: ' + ad.term,\n    '',\n    cleanText(desc).slice(0, 4000),\n  ].filter(x => x !== '').join('\\n');\n  out.push({ json: {\n    trace_id: ad.trace_id,\n    source: 'jobs',\n    url: 'https://www.arbeitsagentur.de/jobsuche/jobdetail/' + ad.refnr,\n    happened_at: published,\n    found_at: new Date().toISOString(),\n    title: '[First hire] ' + clean(title) + ' at ' + clean(firma),\n    text,\n    people: '',\n    org_name: clean(firma),\n    city,\n    website: findWebsite(desc, firma),\n    status: 'new',\n  }});\n});\nreturn out;\n" },
    output: [{ trace_id: 'jobs:10000-1208091153-S', source: 'jobs', url: 'https://www.arbeitsagentur.de/jobsuche/jobdetail/10000-1208091153-S', happened_at: '2026-09-30', found_at: '2026-11-20T12:00:00.000Z', title: '[First hire] Software Engineer (Founding Team) at Junini GmbH', text: 'Job: Software Engineer (Founding Team)\nEmployer: Junini GmbH\nLocation: Berlin', people: '', org_name: 'Junini GmbH', city: 'Berlin', website: '', status: 'new' }]
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

const howItWorks = sticky('## First hires (job ads) -> Traces\nA brand-new startup hiring its first people (Founding Engineer, Founders Associate, "Gründerteam", seed money just raised, a fresh spin-off) is a very early signal. This flow asks the **official, free job search of the Bundesagentur für Arbeit** (rest.arbeitsagentur.de, its public client id, no login) for 10 search terms across **all of Germany**, one search every 1.5 s.\n\nIt merges the answers (no doubles), drops ads older than 120 days, ads outside Germany, big employers, agencies, recruiters and public bodies, and keeps at most 3 ads per employer. Ads already in **Traces** are skipped, at most 40 new ads per run. For each one it reads the full ad (one call every 1.5 s) and keeps it only if the text says startup / founder / seed / spin-off and the company is not older than 6 years.\n\n**One trace per job ad**, source `jobs`, trace_id `jobs:<refnr>`, link to the public ad on arbeitsagentur.de. **Contact persons, emails and phone numbers are removed**; `people` stays empty. `website` only when the ad itself names the employer\'s own site or email domain.\n\n**Run from demo**: call this workflow\'s webhook (path first-hires) to run it live.', [searchTerms, searchJobs, listAds, onlyNewAds, capAds, fetchDetails, buildTraces, saveToTraces], { color: 7 });

export default workflow('first-hires', '30 First hires (job ads) -> Traces')
  .add(runByHand)
  .to(searchTerms)
  .to(searchJobs)
  .to(listAds)
  .to(onlyNewAds)
  .to(capAds)
  .to(fetchDetails)
  .to(buildTraces)
  .to(saveToTraces)
  .add(calledByRunAll)
  .to(searchTerms)
  .add(runFromDemo)
  .to(searchTerms)
  .add(howItWorks)
  .group('Find first-hire job ads', [searchTerms, searchJobs, listAds, onlyNewAds, capAds, fetchDetails, buildTraces, saveToTraces], { description: 'Job search Germany-wide -> early-startup ads, only new ones, max 40 -> full ad -> one row per ad in Traces' });
