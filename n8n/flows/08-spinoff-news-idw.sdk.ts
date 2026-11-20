import { workflow, node, trigger, sticky, expr } from '@n8n/workflow-sdk';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

const runByHand = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Run by hand' } });

const calledByRunAll = trigger({
  type: 'n8n-nodes-base.executeWorkflowTrigger',
  version: 1.3,
  config: { name: 'Called by Run all', parameters: { inputSource: 'passthrough' } }
});

const runFromDemo = trigger({
  type: 'n8n-nodes-base.webhook',
  version: 2.2,
  config: { name: 'Run from demo', parameters: { httpMethod: 'GET', path: 'spinoff-news', responseMode: 'onReceived', options: {} } }
});

const listingPages = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Listing pages',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// The newest idw listing pages to read each run (about 20 releases each, 8 pages = roughly two days).\n// Only the plain listing pages: idw's robots.txt rules out search, RSS and PDF addresses.\nconst PAGES = 8;\nconst out = [];\nfor (let p = 1; p <= PAGES; p++) {\n  out.push({ json: { page: p, url: 'https://idw-online.de/de/pressreleases?path_area=&path_lang=de&page=' + p } });\n}\nreturn out;\n" },
    output: [{ page: 1, url: 'https://idw-online.de/de/pressreleases?path_area=&path_lang=de&page=1' }]
  }
});
const fetchListingPages = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch listing pages',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.url }}'),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: UA }] },
      options: {
        batching: { batch: { batchSize: 1, batchInterval: 2000 } },
        response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }
      }
    },
    output: [{ data: '<html>...</html>' }]
  }
});
const pickStartupReleases = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pick startup releases',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Each listing page -> one item per press release whose headline sounds like a spin-off or start-up.\n// idw listings show only headline, institution and date (no teaser), so the match is on the headline.\nconst ENT = { auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', ndash: '\u2013', mdash: '\u2014', amp: '&', quot: '\"', apos: \"'\", nbsp: ' ', bdquo: '\u201e', ldquo: '\u201c', rdquo: '\u201d', lsquo: '\u2018', rsquo: '\u2019' };\nconst decode = s => (s || '').replace(/&#(\\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, e) => ENT[e] || m);\nconst clean = s => decode((s || '').replace(/<[^>]+>/g, ' ')).replace(/\\s+/g, ' ').trim();\n\n// Words that point to a new company coming out of research (German and English).\nconst KEEP = /ausgr(ü|ue)nd|ausgegr(ü|ue)ndet|spin[\\s-]?offs?\\b|spin[\\s-]?outs?\\b|start[\\s-]?ups?\\b|gr(ü|ue)nder|gr(ü|ue)ndungs(team|preis|nacht|idee|vorhaben|projekt|stipend|f(ö|oe)rder|wettbewerb|zentrum|beratung|tag)|unternehmensgr(ü|ue)nd|existenzgr(ü|ue)nd|\\bexist\\b|forschungstransfer|inkubator|incubat|accelerat|founders?\\b|founding team|entrepreneur|\\bventures?\\b|deep[\\s-]?tech|neugr(ü|ue)ndung|firmengr(ü|ue)nd|gegr(ü|ue)ndet/i;\n// Founding of institutes, anniversaries and the like are not start-ups.\nconst DROP = /jubil|jahrestag|\\d+\\s*jahre|years of|anniversary|gr(ü|ue)ndung (des|der|eines|einer) (institut|zentr|netzwerk|verein|verband|fakult|forschungs|graduiert|sonderforschung|cluster|stiftung|allianz|akademie|hochschule|universit)|neu gegr(ü|ue)ndet(e|es|er|en)? (institut|zentrum|forschungs|graduiert|netzwerk|verbund)|founding (of|director)/i;\n\nconst out = [];\nconst seen = new Set();\n$input.all().forEach(page => {\n  const html = page.json.data || '';\n  const re = /<h5 class=\"graybox add-padding\">(\\d\\d)\\.(\\d\\d)\\.(\\d{4})<\\/h5>|<li><h6><a href=\"\\/de\\/news(\\d+)\">([\\s\\S]*?)<\\/a><\\/h6><p><em>([\\s\\S]*?)<\\/em><\\/p><\\/li>/g;\n  let m;\n  let day = '';\n  while ((m = re.exec(html))) {\n    if (m[1]) { day = m[3] + '-' + m[2] + '-' + m[1]; continue; }\n    const id = m[4];\n    if (seen.has(id)) continue;\n    seen.add(id);\n    const headline = clean(m[5]);\n    out.push({ id, headline, institution: clean(m[6]), day });\n  }\n});\nconst matched = out.filter(r => KEEP.test(r.headline) && !DROP.test(r.headline));\n// Many institutions post the same news in German and in English on the same day: keep the German one.\nconst ENGLISH = /\\b(the|of|and|for|takes|wins|with|honours|honors|place|from|new|its)\\b/i;\nconst GERMAN = /[äöüß]|\\b(der|die|das|und|f(ü|ue)r|mit|gewinnt|beim)\\b/i;\nconst isEnglish = r => ENGLISH.test(r.headline) && !GERMAN.test(r.headline);\nconst kept = matched.filter(r => !(isEnglish(r) && matched.some(o => o !== r && o.institution === r.institution && o.day === r.day && !isEnglish(o))));\nreturn kept.map(r => ({ json: {\n  trace_id: 'idw:' + r.id,\n  url: 'https://idw-online.de/de/news' + r.id,\n  headline: r.headline,\n  institution: r.institution,\n  listed_on: r.day,\n  releases_read: out.length,\n  releases_kept: kept.length,\n}}));\n" },
    output: [{ trace_id: 'idw:881283', url: 'https://idw-online.de/de/news881283', headline: 'Liquid Mirror - Start-up der TU Ilmenau gewinnt ThEx AWARD', institution: 'Technische Universität Ilmenau', listed_on: '2026-11-20', releases_read: 160, releases_kept: 2 }]
  }
});
const onlyNewReleases = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Only new releases',
    parameters: {
      resource: 'row',
      operation: 'rowNotExists',
      dataTableId: { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'trace_id', keyValue: expr('{{ $json.trace_id }}') }] }
    },
    output: [{ trace_id: 'idw:881283', url: 'https://idw-online.de/de/news881283', headline: 'Liquid Mirror - Start-up der TU Ilmenau gewinnt ThEx AWARD', institution: 'Technische Universität Ilmenau', listed_on: '2026-11-20', releases_read: 160, releases_kept: 2 }]
  }
});
const fetchReleasePages = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch release pages',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.url }}'),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: UA }] },
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
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Each release page -> the finished trace row. Contact blocks, email addresses and phone numbers are removed.\nconst releases = $('Only new releases').all();\nconst ENT = { auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß', ndash: '\u2013', mdash: '\u2014', amp: '&', quot: '\"', apos: \"'\", nbsp: ' ', hellip: '\u2026', euro: '€', bdquo: '\u201e', ldquo: '\u201c', rdquo: '\u201d', lsquo: '\u2018', rsquo: '\u2019', sbquo: '\u201a', laquo: '«', raquo: '»', eacute: 'é', egrave: 'è', agrave: 'à', shy: '' };\nconst decode = s => (s || '').replace(/&#(\\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16))).replace(/&([a-z]+);/gi, (m, e) => (e in ENT ? ENT[e] : m));\nconst strip = s => decode((s || '').replace(/\\r/g, '').replace(/<br\\s*\\/?>/gi, '\\n').replace(/<\\/p>/gi, '\\n').replace(/<[^>]+>/g, ' '))\n  .replace(/[ \\t\u00a0]+/g, ' ').replace(/ *\\n */g, '\\n').replace(/\\n{3,}/g, '\\n\\n').trim();\nconst one = s => strip(s).replace(/\\s+/g, ' ').trim();\nconst grab = (html, re) => { const m = html.match(re); return m ? m[1] : ''; };\n\n// German local time -> ISO (CET in winter, CEST between the last Sundays of March and October).\nconst lastSunday = (y, mo) => { const d = new Date(Date.UTC(y, mo + 1, 0)); return d.getUTCDate() - d.getUTCDay(); };\nconst berlinIso = (d, mo, y, h, mi) => {\n  const md = (mo - 1) * 100 + d;\n  const summer = md > 2 * 100 + lastSunday(y, 2) - 1 && md < 9 * 100 + lastSunday(y, 9);\n  const off = summer ? 2 : 1;\n  return new Date(Date.UTC(y, mo - 1, d, h - off, mi)).toISOString();\n};\n\nconst NOISE_LINE = /^(kontakt|pressekontakt|medienkontakt|ansprechpartner(in)?|contact|press contact|media contact|tel\\.?|telefon|phone|fax|e-?mail|mail)\\b/i;\nconst EMAIL = /[\\w.+-]+(@|\\s?\\(at\\)\\s?|\\s?\\[at\\]\\s?)[\\w-]+(\\.[\\w-]+)+/gi;\nconst PHONE = /(\\+\\d|\\(0\\d|\\b0\\d)[\\d \\/()-]{6,}\\d/g;\nconst cleanText = t => t.split('\\n').filter(l => !NOISE_LINE.test(l.trim())).join('\\n')\n  .replace(EMAIL, '').replace(PHONE, '').replace(/[ \\t]+/g, ' ').replace(/ *\\n */g, '\\n').replace(/\\n{3,}/g, '\\n\\n').trim();\n\nconst CITIES = ['Aachen','Augsburg','Bamberg','Bayreuth','Berlin','Bielefeld','Bingen','Bochum','Bonn','Braunschweig','Bremen','Bremerhaven','Chemnitz','Clausthal','Cottbus','Darmstadt','Dortmund','Dresden','Duisburg','Düsseldorf','Eichstätt','Erfurt','Erlangen','Essen','Flensburg','Frankfurt','Freiberg','Freiburg','Fulda','Gießen','Göttingen','Greifswald','Hagen','Halle','Hamburg','Hannover','Heidelberg','Heilbronn','Hildesheim','Hohenheim','Ilmenau','Ingolstadt','Jena','Kaiserslautern','Karlsruhe','Kassel','Kiel','Koblenz','Köln','Konstanz','Landshut','Leipzig','Lübeck','Ludwigsburg','Lüneburg','Magdeburg','Mainz','Mannheim','Marburg','Merseburg','Mittweida','Mönchengladbach','München','Münster','Neubrandenburg','Nürnberg','Oldenburg','Osnabrück','Paderborn','Passau','Potsdam','Regensburg','Reutlingen','Rostock','Saarbrücken','Siegen','Stralsund','Stuttgart','Trier','Tübingen','Ulm','Vechta','Weimar','Wiesbaden','Wildau','Wismar','Witten','Wuppertal','Würzburg','Zittau','Zwickau'];\nconst CITY_ALIASES = { 'Munich': 'München', 'Cologne': 'Köln', 'LMU': 'München', 'TUM': 'München', 'RWTH': 'Aachen', 'KIT': 'Karlsruhe', 'Charité': 'Berlin', 'OTH Regensburg': 'Regensburg', 'Bonn-Rhein-Sieg': 'Sankt Augustin', 'Hochschule Fresenius': '' };\nconst cityOf = inst => {\n  for (const c of CITIES) { if (new RegExp('(^|[^A-Za-zÄÖÜäöüß])' + c + '($|[^A-Za-zÄÖÜäöüß])').test(inst)) return c; }\n  for (const k of Object.keys(CITY_ALIASES)) { if (inst.includes(k)) return CITY_ALIASES[k]; }\n  return '';\n};\n\n// The start-up name, only when the headline names it.\nconst STOP = /^(der|die|das|des|dem|den|ein|eine|einer|eines|aus|von|vom|an|am|im|in|mit|und|of|the|from|at|wins?|gewinnt|erhält|startet|holt|sichert|zeigt|bei|f(ü|ue)r|als|auf|zur|zum|wird|ist|geht|setzt|bringt|entwickelt|award|preis|programm|program|förderung|team|teams|gründung|unternehmen|company|companies|founders?|gründer\\w*|night|nacht|day|tag|aus\\w*|uni\\w*|hochschul\\w*|tu|th|fh|hs|lmu|rwth|kit)$/i;\nconst orgFromHeadline = h => {\n  const after = h.match(/(?:start[\\s-]?up|spin[\\s-]?off|spin[\\s-]?out|ausgr(?:ü|ue)ndung|gr(?:ü|ue)ndungsteam|startup-unternehmen)\\s+[\u201e\u201c\"»\u201a']?([A-ZÄÖÜ0-9][\\wÀ-\u017f.&+-]*(?:\\s+[A-ZÄÖÜ0-9][\\wÀ-\u017f.&+-]*){0,2})/i);\n  if (after) {\n    const words = after[1].split(/\\s+/);\n    const keep = [];\n    for (const w of words) { if (!/^[A-ZÄÖÜ0-9]/.test(w) || STOP.test(w.replace(/[.,:;!?]+$/, ''))) break; keep.push(w.replace(/[.,:;!?\u201c\u201d\"]+$/, '')); }\n    if (keep.length && /^[A-ZÄÖÜ0-9]/.test(keep[0])) return keep.join(' ');\n  }\n  const SW = '(?:start[\\\\s-]?up|spin[\\\\s-]?off|spin[\\\\s-]?out|ausgr(?:ü|ue)ndung|gr(?:ü|ue)ndungsteam|gr(?:ü|ue)nder\\\\w*)';\n  const q = h.match(new RegExp('[\u201e\u201c\"»\u201a]([^\u201c\u201d\"«\u2018]{2,40})[\u201c\u201d\"«\u2018]\\\\s*[\u2013\u2014:,-]?\\\\s*(?:\\\\S+\\\\s+)?' + SW, 'i')) || h.match(new RegExp(SW + '\\\\s+(?:\\\\S+\\\\s+)?[\u201e\u201c\"»\u201a]([^\u201c\u201d\"«\u2018]{2,40})[\u201c\u201d\"«\u2018]', 'i'));\n  if (q && q[1].trim().split(/\\s+/).length <= 4) return q[1].trim();\n  return '';\n};\n\n// Founders or team members, only where the text says so in plain words.\nconst L = 'a-z\\u00df\\u00e0-\\u00ff\\u0100-\\u017f';\nconst NAME = new RegExp('(?:(?:Prof\\\\.|Dr\\\\.|Dr\\\\.-Ing\\\\.|PD)\\\\s+)*[A-Z\\u00c4\\u00d6\\u00dc][' + L + ']+(?:-[A-Z\\u00c4\\u00d6\\u00dc][' + L + ']+)?(?:\\\\s+(?:von\\\\s+|van\\\\s+|de\\\\s+)?[A-Z\\u00c4\\u00d6\\u00dc][' + L + ']+(?:-[A-Z\\u00c4\\u00d6\\u00dc][' + L + ']+)?){1,3}', 'g');\nconst ROLE = /^(\\w*(leiter|leiterin|forscher|forscherin|wissenschaftler|wissenschaftlerin|chemiker|chemikerin|ingenieur|ingenieurin|professor|professorin|direktor|direktorin|mediziner|medizinerin|informatiker|informatikerin|physiker|physikerin)|Wissenschaftler|Forscher|Doktorand|Student|Studierend|Absolvent|Ingenieur|Physiker|Chemiker|Informatiker|Biolog|Mediziner|Kolleg|Gr(ü|ue)nder|Mitgr(ü|ue)nder|Masterstudent|Alumn|Mitarbeiter|Br(ü|ue)der|Schwester|Ehepaar|Professor|Gesch(ä|ae)ftsf(ü|ue)hrer|Doktor|Postdoc|Team|Teams|CEO|CTO|COO|CFO|Co-Founder|Founder|Dear)\\w*$/;\nconst NOT_NAME = /(Universit|Hochschule|Institut|Zentrum|Center|Centre|Fakult|Lehrstuhl|Fachgebiet|Technische|Bundes|Ministerium|Stiftung|Gesellschaft|Projekt|Start|Gr(ü|ue)nd|Forsch|Wissenschaft|Preis|Award|Programm|Fraunhofer|Helmholtz|Leibniz|Max Planck|Deutsch|Europ|Th(ü|ue)ring|Bayer|S(ä|ae)chs|Hessen|Berlin|M(ü|ue)nchen|GmbH|\\bAG\\b|Labs?\\b|Lab\\b|Technolog|Solutions|Systems|Therapeutics|Health|Energy|Robotics|Intelligence|Defence|Defense|Medical|Bio\\b|Quantum|Seit|Mit\\b|Der\\b|Die\\b|Das\\b|Den\\b|Dem\\b|Des\\b|Ein\\b|Eine\\b|Sie\\b|Er\\b|Im\\b|In\\b|Am\\b|An\\b|Als\\b|Auch\\b|Nach\\b|Vor\\b|Bei\\b|F(ü|ue)r\\b|Zum\\b|Zur\\b|Und\\b|Oder\\b|Mehr\\b|Neue|Wirtschaft|Informatik|Physik|Chemie|Medizin|Maschinenbau|Elektro|Marketing|Vertrieb|Leitung)/;\nconst NOT_NAME_I = /(hochschul|universit|institut|zentrum|kunst|abteilung|sektion|klinik|leiter|direktor|sprecher|referent|koordinat)/i;\nconst TRIGGER = /(gr(?:ü|ue)ndungsteam|gr(?:ü|ue)nderteam|gr(?:ü|ue)nder(?:innen)?|gr(?:ü|ue)nderin|mitgr(?:ü|ue)nder(?:in)?|co-?founders?|founders?|founded by|gegr(?:ü|ue)ndet (?:von|haben)|gr(?:ü|ue)ndeten|team um|teams um|team led by|team around)\\b([^.\\n]{0,160})/gi;\nconst peopleOf = text => {\n  const found = [];\n  let m;\n  TRIGGER.lastIndex = 0;\n  while ((m = TRIGGER.exec(text))) {\n    const seg = m[2];\n    let n;\n    NAME.lastIndex = 0;\n    while ((n = NAME.exec(seg))) {\n      if (/\\b(von|vom|of|bei|at|f(ü|ue)r|for|mit|with)\\s*$/i.test(seg.slice(0, n.index))) continue; // \"Gründer von X\" names a company\n      const toks = n[0].trim().split(/\\s+/);\n      while (toks.length && ROLE.test(toks[0])) toks.shift();\n      const name = toks.join(' ');\n      const bare = name.replace(/^((Prof\\.|Dr\\.|Dr\\.-Ing\\.|PD)\\s+)+/, '');\n      if (bare.split(' ').length < 2 || NOT_NAME.test(bare) || NOT_NAME_I.test(bare) || /^(Prof|Dr|PD)\\.?$/.test(toks[toks.length - 1] || '') || !/^[A-ZÄÖÜ]/.test(bare)) continue;\n      if (!found.includes(name)) found.push(name);\n    }\n  }\n  // \"Fabian Jung, TERNAfil-Gründer und ...\" / \"Anna Muster, co-founder of ...\"\n  NAME.lastIndex = 0;\n  while ((m = NAME.exec(text))) {\n    const tail = text.slice(m.index + m[0].length, m.index + m[0].length + 60);\n    if (!/^,?\\s*(?:\\S+\\s+){0,3}?\\S*?(?:mitgr(?:ü|ue)nder|gr(?:ü|ue)nder|co-?founder|founder)(?:in)?\\b/i.test(tail)) continue;\n    const toks = m[0].trim().split(/\\s+/);\n    while (toks.length && ROLE.test(toks[0])) toks.shift();\n    const name = toks.join(' ');\n    const bare = name.replace(/^((Prof\\.|Dr\\.|Dr\\.-Ing\\.|PD)\\s+)+/, '');\n    if (bare.split(' ').length < 2 || NOT_NAME.test(bare) || NOT_NAME_I.test(bare) || !/^[A-ZÄÖÜ]/.test(bare)) continue;\n    if (!found.includes(name)) found.push(name);\n  }\n  return found.slice(0, 6).join('; ');\n};\n\n// A link that looks like the start-up's own site.\nconst NOT_SITE = /idw-online|idwf\\.de|linkedin|twitter|x\\.com|facebook|instagram|youtube|youtu\\.be|bsky|mastodon|tiktok|xing|doi\\.org|nature\\.com|science\\.org|sciencedirect|springer|wiley|elsevier|mdpi|frontiersin|plos|arxiv|biorxiv|pubmed|ncbi|acs\\.org|rsc\\.org|ieee|cell\\.com|uni-|tu-|\\.tu\\.|th-|fh-|hs-|haw-|hochschule|universit|\\.edu|\\.ac\\.|kit\\.edu|rwth|lmu\\.de|tum\\.de|charite|fraunhofer|helmholtz|leibniz|mpg\\.de|dfg\\.de|bmbf|bmftr|bmwk|bmwe|exist\\.de|bund\\.de|europa\\.eu|cordis|wikipedia|google|bit\\.ly|eventbrite|zoom\\.us|\\.gov|thueringen|bayern\\.de|nrw\\.de|sachsen\\.de|berlin\\.de|hamburg\\.de|hessen\\.de|niedersachsen\\.de|ihk|kfw|htgf|dlr\\.de|desy|gsi\\.de|xfel|klinik|unimedizin|uniklinik|tu\\.berlin|hrk\\.de|clarivate|stifterverband|daad|wissenschaftsjahr|campus|ugreif/i;\nconst hostOf = u => { try { return new URL(u).hostname.replace(/^www\\./, ''); } catch (e) { return ''; } };\nconst STARTUP_CTX = /start[\\s-]?up|spin[\\s-]?off|spin[\\s-]?out|ausgr(ü|ue)nd|gr(ü|ue)nd|unternehmen|firma|company|founder|website|webseite|homepage/i;\nconst homeLike = u => { try { const x = new URL(u); return x.pathname.split('/').filter(Boolean).length <= 1 && !/\\.(pdf|docx?|jpe?g|png)$/i.test(x.pathname) && !/news|presse|press|aktuell|artikel|article/i.test(x.pathname); } catch (e) { return false; } };\n// links: [{ url, context }] where context is the text just before and around the link.\nconst siteOf = (links, org, ownHosts) => {\n  const ok = links.filter(l => { const h = hostOf(l.url); return h && !NOT_SITE.test(h) && !ownHosts.includes(h.split('.').slice(-2).join('.')) && homeLike(l.url); });\n  const key = (org || '').toLowerCase().replace(/[^a-z0-9]/g, '');\n  if (key.length >= 3) {\n    const hit = ok.find(l => hostOf(l.url).replace(/[^a-z0-9]/g, '').includes(key.slice(0, 8)));\n    if (hit) return hit.url;\n  }\n  const ctx = ok.find(l => STARTUP_CTX.test(l.context) || (org && l.context.toLowerCase().includes(org.toLowerCase())));\n  return ctx ? ctx.url : '';\n};\n\nconst out = [];\n$input.all().forEach((page, i) => {\n  const rel = releases[i] && releases[i].json;\n  const html = page.json.data || '';\n  if (!rel || html.indexOf('<h4>') < 0) return;\n  const top = html.split('<h4>')[0];\n  const dt = top.match(/<em>\\s*(\\d\\d)\\.(\\d\\d)\\.(\\d{4})\\s+(\\d\\d):(\\d\\d)\\s*<\\/em>\\s*<\\/p>\\s*$/) || top.match(/(\\d\\d)\\.(\\d\\d)\\.(\\d{4})\\s+(\\d\\d):(\\d\\d)\\s*<\\/em>(?![\\s\\S]*<em>)/);\n  const happened = dt ? berlinIso(+dt[1], +dt[2], +dt[3], +dt[4], +dt[5]) : (rel.listed_on ? rel.listed_on + 'T12:00:00.000Z' : new Date().toISOString());\n  const headline = one(grab(html, /<h4>([\\s\\S]*?)<\\/h4>/)) || rel.headline;\n  const institution = one(grab(html, /<h5 class=\"subheader\">[\\s\\S]*?<a href=\"\\/de\\/institution\\d+\">([\\s\\S]*?)<\\/a>/)) || rel.institution;\n  // The release itself: from after the author line to the first section rule (contacts, publication, links follow it).\n  const afterHead = html.split(/<h5 class=\"subheader\">[\\s\\S]*?<\\/h5>/)[1] || '';\n  const bodyHtml = afterHead.split(/<hr/)[0];\n  const sections = afterHead.split('Merkmale dieser Pressemitteilung')[0];\n  const moreInfo = grab(sections, /<h5>(?:Weitere Informationen|Further information):<\\/h5>([\\s\\S]*?)(?:<hr|$)/);\n  const contactHtml = grab(sections, /<h5>(?:Wissenschaftliche Ansprechpartner|Contact for scientific information):<\\/h5>([\\s\\S]*?)(?:<hr|$)/);\n  const ownHosts = [...(contactHtml + bodyHtml).matchAll(/@([\\w.-]+\\.[a-z]{2,})/gi)].map(m => m[1].toLowerCase().split('.').slice(-2).join('.'));\n  let body = cleanText(strip(bodyHtml));\n  const linkSrc = bodyHtml + '\\n' + moreInfo;\n  const links = [...linkSrc.matchAll(/href=\"(https?:\\/\\/[^\"]+)\"[^>]*>([\\s\\S]*?)<\\/a>([^<]{0,80})/gi)].map(m => ({ url: decode(m[1]), context: one(linkSrc.slice(Math.max(0, m.index - 200), m.index)) + ' ' + one(m[2]) + ' ' + one(m[3]) }));\n  const plain = strip(bodyHtml);\n  const bare = [...plain.matchAll(/\\bhttps?:\\/\\/[^\\s<>\")]+|\\bwww\\.[a-z0-9-]+\\.[a-z.]{2,}[^\\s<>\")]*/gi)].map(m => ({ url: (m[0].startsWith('http') ? m[0] : 'https://' + m[0]).replace(/[.,;:]+$/, ''), context: plain.slice(Math.max(0, m.index - 200), m.index + m[0].length + 80) }));\n  const org = orgFromHeadline(headline);\n  const website = siteOf(links.concat(bare), org, ownHosts);\n  const moreText = cleanText(strip(moreInfo));\n  const text = [\n    'Institution: ' + institution,\n    'Headline: ' + headline,\n    '',\n    body,\n    moreText ? '\\nFurther information: ' + moreText.replace(/\\n+/g, ' ') : '',\n  ].join('\\n').replace(/\\n{3,}/g, '\\n\\n').trim().slice(0, 5000);\n  out.push({ json: {\n    trace_id: rel.trace_id,\n    source: 'campus',\n    url: rel.url,\n    happened_at: happened,\n    found_at: new Date().toISOString(),\n    title: '[' + institution + '] ' + headline,\n    text,\n    people: peopleOf(body),\n    org_name: org,\n    city: cityOf(institution),\n    website,\n    status: 'new',\n  }});\n});\nreturn out;\n" },
    output: [{ trace_id: 'idw:881283', source: 'campus', url: 'https://idw-online.de/de/news881283', happened_at: '2026-11-20T12:24:00.000Z', found_at: '2026-11-20T15:00:00.000Z', title: '[Technische Universität Ilmenau] Liquid Mirror - Start-up der TU Ilmenau gewinnt ThEx AWARD', text: 'Institution: Technische Universität Ilmenau', people: 'Johannes Leineweber; Sebastian Fischer Calderón', org_name: 'Liquid Mirror', city: 'Ilmenau', website: '', status: 'new' }]
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

const howItWorks = sticky('## Spin-off news (idw) -> Traces\nReads the 8 newest pages of idw, the press-release service of German universities and research institutes (about 160 releases, roughly two days). Keeps releases whose headline talks about a spin-off, start-up, founders or EXIST, skips those already in **Traces**, opens each new one (one page every 2 s) and saves it with source **campus**.\nOnly plain listing and release pages: idw\'s robots.txt rules out search, RSS and PDF, and we respect that. **Contact blocks, email addresses and phone numbers are removed.**', [listingPages, fetchListingPages, pickStartupReleases, onlyNewReleases, fetchReleasePages, buildTraces, saveToTraces], { color: 7 });

export default workflow('spinoff-news-idw', '08 Spin-off news (idw) -> Traces')
  .add(runByHand)
  .to(listingPages)
  .to(fetchListingPages)
  .to(pickStartupReleases)
  .to(onlyNewReleases)
  .to(fetchReleasePages)
  .to(buildTraces)
  .to(saveToTraces)
  .add(calledByRunAll)
  .to(listingPages)
  .add(runFromDemo)
  .to(listingPages)
  .add(howItWorks)
  .group('Find spin-off news', [listingPages, fetchListingPages, pickStartupReleases], { description: '8 newest idw listing pages (about 160 releases) -> only headlines about spin-offs, start-ups, founders or EXIST' })
  .group('Read and save new releases', [onlyNewReleases, fetchReleasePages, buildTraces, saveToTraces], { description: 'Skip releases already in Traces -> open each new one -> one row per release, without contacts, email or phone' });
