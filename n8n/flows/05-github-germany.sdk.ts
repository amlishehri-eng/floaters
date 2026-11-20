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
  config: { name: 'Run from demo', parameters: { httpMethod: 'GET', path: 'github-munich', responseMode: 'onReceived', options: {} } }
});

const searchTerms = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Search terms',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// GitHub searches: organisations created in the last 120 days with a German location.\n// Search allows 10 calls a minute without a token, so 'Search new orgs' waits 7 s between calls.\nconst since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);\nconst PLACES = [\n  ['munich', 'Munich'], ['münchen', 'Munich'], ['berlin', 'Berlin'], ['hamburg', 'Hamburg'],\n  ['frankfurt', 'Frankfurt'], ['cologne', 'Cologne'], ['köln', 'Cologne'], ['stuttgart', 'Stuttgart'],\n  ['karlsruhe', 'Karlsruhe'], ['aachen', 'Aachen'], ['dresden', 'Dresden'], ['leipzig', 'Leipzig'],\n  ['darmstadt', 'Darmstadt'], ['heidelberg', 'Heidelberg'], ['düsseldorf', 'Dusseldorf'], ['germany', ''],\n];\nreturn PLACES.map(([place, city]) => ({ json: {\n  place,\n  city,\n  url: 'https://api.github.com/search/users?q=' + encodeURIComponent('type:org location:' + place + ' created:>=' + since) + '&sort=joined&order=desc&per_page=30',\n}}));\n" },
    output: [{ place: 'munich', url: 'https://api.github.com/search/users?q=type%3Aorg%20location%3Amunich%20created%3A%3E%3D2026-07-23&sort=joined&order=desc&per_page=30' }]
  }
});

const searchNewOrgs = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Search new orgs',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr("{{ $json.url }}"),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'htgf-founder-traces (n8n; public data only)' }, { name: 'Accept', value: 'application/vnd.github+json' }] },
      options: {
        batching: { batch: { batchSize: 1, batchInterval: 7000 } },
        response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }
      }
    },
    output: [{ data: '{"total_count":1,"items":[{"login":"bandpey-hq","type":"Organization","html_url":"https://github.com/bandpey-hq"}]}' }]
  }
});

const listNewOrgs = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'List orgs',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// All search answers -> one item per organisation (merged, no doubles), with the city of the search that found it. A rate-limited search (403) is skipped.\nconst terms = $('Search terms').all();\nconst seen = {};\nconst out = [];\n$input.all().forEach((page, i) => {\n  if (!page.json || page.json.error) return;\n  let d = page.json.data;\n  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }\n  const city = terms[i] ? terms[i].json.city : '';\n  ((d && d.items) || []).forEach(u => {\n    if (!u || u.type !== 'Organization' || !u.login) return;\n    const key = u.login.toLowerCase();\n    if (seen[key]) return;\n    seen[key] = true;\n    out.push({ json: { trace_id: 'github:' + key, login: u.login, html_url: u.html_url || 'https://github.com/' + u.login, city } });\n  });\n});\nreturn out;\n" },
    output: [{ trace_id: 'github:bandpey-hq', login: 'bandpey-hq', html_url: 'https://github.com/bandpey-hq' }]
  }
});

const onlyNewOrgs = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Only new orgs',
    parameters: {
      resource: 'row',
      operation: 'rowNotExists',
      dataTableId: { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'trace_id', keyValue: expr('{{ $json.trace_id }}') }] }
    },
    output: [{ trace_id: 'github:bandpey-hq', login: 'bandpey-hq', html_url: 'https://github.com/bandpey-hq' }]
  }
});

const capOrgs = node({
  type: 'n8n-nodes-base.limit',
  version: 1,
  config: {
    name: 'Cap at 15 orgs',
    parameters: { maxItems: 15, keep: 'firstItems' },
    output: [{ trace_id: 'github:bandpey-hq', login: 'bandpey-hq', html_url: 'https://github.com/bandpey-hq' }]
  }
});

const fetchOrg = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch org',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr("https://api.github.com/orgs/{{ $('Cap at 15 orgs').all()[$itemIndex].json.login }}"),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'htgf-founder-traces (n8n; public data only)' }, { name: 'Accept', value: 'application/vnd.github+json' }] },
      options: {
        batching: { batch: { batchSize: 1, batchInterval: 2000 } },
        response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }
      }
    },
    output: [{ data: '{"login":"bandpey-hq","name":"Bandpey","description":"Agentic AI engineering from Munich","blog":"https://bandpey.com","created_at":"2026-10-21T09:58:02Z","public_repos":1,"html_url":"https://github.com/bandpey-hq"}' }]
  }
});

const fetchRepos = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch repos',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr("https://api.github.com/orgs/{{ $('Cap at 15 orgs').all()[$itemIndex].json.login }}/repos?sort=created&per_page=5"),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'htgf-founder-traces (n8n; public data only)' }, { name: 'Accept', value: 'application/vnd.github+json' }] },
      options: {
        batching: { batch: { batchSize: 1, batchInterval: 2000 } },
        response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }
      }
    },
    output: [{ data: '[{"name":".github","description":"Public profile","stargazers_count":0,"language":null,"topics":[],"created_at":"2026-10-21T12:21:08Z"}]' }]
  }
});

const fetchMembers = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch members',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr("https://api.github.com/orgs/{{ $('Cap at 15 orgs').all()[$itemIndex].json.login }}/public_members?per_page=10"),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'htgf-founder-traces (n8n; public data only)' }, { name: 'Accept', value: 'application/vnd.github+json' }] },
      options: {
        batching: { batch: { batchSize: 1, batchInterval: 2000 } },
        response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }
      }
    },
    output: [{ data: '[{"login":"octocat"}]' }]
  }
});

const fetchHfModels = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch HF models',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr("https://huggingface.co/api/models?author={{ $('Cap at 15 orgs').all()[$itemIndex].json.login }}&limit=5"),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'htgf-founder-traces (n8n; public data only)' }, { name: 'Accept', value: 'application/json' }] },
      options: {
        batching: { batch: { batchSize: 1, batchInterval: 1000 } },
        response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }
      }
    },
    output: [{ data: '[]' }]
  }
});

const fetchHfDatasets = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch HF datasets',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'GET',
      url: expr("https://huggingface.co/api/datasets?author={{ $('Cap at 15 orgs').all()[$itemIndex].json.login }}&limit=5"),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: 'htgf-founder-traces (n8n; public data only)' }, { name: 'Accept', value: 'application/json' }] },
      options: {
        batching: { batch: { batchSize: 1, batchInterval: 1000 } },
        response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }
      }
    },
    output: [{ data: '[]' }]
  }
});

const buildTraces = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build traces',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Each org -> the finished trace row. Only public, professional facts: emails are never kept, phone numbers are removed.\n// website = the org's own site from its GitHub profile (the 'blog' field), if it gives one.\nconst orgs = $('Cap at 15 orgs').all();\nconst pick = name => $(name).all();\nconst fetched = { org: pick('Fetch org'), repos: pick('Fetch repos'), members: pick('Fetch members'), hfModels: pick('Fetch HF models'), hfDatasets: pick('Fetch HF datasets') };\nconst parse = it => {\n  if (!it || !it.json || it.json.error) return null;\n  const d = it.json.data;\n  if (typeof d !== 'string') return d || null;\n  try { return JSON.parse(d); } catch (e) { return null; }\n};\nconst clean = s => String(s || '')\n  .replace(/mailto:\\S*/gi, '')\n  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}/gi, '[email removed]')\n  .replace(/(?:\\+|\\b00)\\d[\\d \\/().-]{6,}\\d/g, '[phone removed]')\n  .replace(/\\b0\\d{2,5}[ \\/-]\\d{3,}(?:[ \\/-]?\\d+)*/g, '[phone removed]')\n  .replace(/\\s+/g, ' ').trim();\nconst day = s => (s || '').slice(0, 10);\nconst site = s => { const b = clean(s); if (!b || /\\s|@/.test(b)) return ''; const u = /^https?:\\/\\//i.test(b) ? b : 'https://' + b; return /github\\.com|linkedin\\.|twitter\\.|x\\.com/i.test(u) ? '' : u; };\nconst out = [];\norgs.forEach((o, i) => {\n  const org = parse(fetched.org[i]);\n  if (!org || !org.login) return; // org details missing (rate limit): skip, it is tried again next run\n  const repoList = Array.isArray(parse(fetched.repos[i])) ? parse(fetched.repos[i]) : [];\n  const memberList = Array.isArray(parse(fetched.members[i])) ? parse(fetched.members[i]) : [];\n  const models = Array.isArray(parse(fetched.hfModels[i])) ? parse(fetched.hfModels[i]) : [];\n  const datasets = Array.isArray(parse(fetched.hfDatasets[i])) ? parse(fetched.hfDatasets[i]) : [];\n  const name = clean(org.name) || org.login;\n  const repoLines = repoList.map(r => '- ' + clean(r.name) + ' — ' + (clean(r.description) || 'no description') + ' (★' + (r.stargazers_count || 0) + ', ' + (r.language || 'no language') + ', created ' + day(r.created_at) + (r.fork ? ', fork' : '') + ')' + (r.topics && r.topics.length ? ' [' + r.topics.map(clean).join(', ') + ']' : ''));\n  const hfLines = models.map(m => '- Hugging Face: model ' + clean(m.id) + ' (downloads ' + (m.downloads || 0) + ', likes ' + (m.likes || 0) + (m.createdAt ? ', created ' + day(m.createdAt) : '') + ')')\n    .concat(datasets.map(d => '- Hugging Face: dataset ' + clean(d.id) + ' (downloads ' + (d.downloads || 0) + ', likes ' + (d.likes || 0) + (d.createdAt ? ', created ' + day(d.createdAt) : '') + ')'));\n  const website = site(org.blog);\n  const text = [\n    clean(org.description),\n    website ? 'Website: ' + website : '',\n    'GitHub org created ' + day(org.created_at) + ', ' + (org.public_repos || 0) + ' public repos' + (org.location ? ', location: ' + clean(org.location) : ''),\n    repoLines.length ? 'Newest repos:\\n' + repoLines.join('\\n') : '',\n    hfLines.length ? 'Also on Hugging Face (' + hfLines.length + '):\\n' + hfLines.join('\\n') : '',\n  ].filter(Boolean).join('\\n').slice(0, 5000);\n  out.push({ json: {\n    trace_id: o.json.trace_id,\n    source: 'github',\n    url: org.html_url || o.json.html_url,\n    happened_at: org.created_at,\n    found_at: new Date().toISOString(),\n    title: '[GitHub org] ' + name,\n    text,\n    people: memberList.filter(m => m && m.login).map(m => m.login + ' (GitHub member)').join('; '),\n    org_name: name,\n    city: o.json.city || clean(org.location) || 'Germany',\n    website,\n    status: 'new',\n  }});\n});\nreturn out;\n" },
    output: [{ trace_id: 'github:bandpey-hq', source: 'github', url: 'https://github.com/bandpey-hq', happened_at: '2026-10-21T09:58:02Z', found_at: '2026-11-20T12:00:00.000Z', title: '[GitHub org] Bandpey', text: 'Agentic AI engineering from Munich', people: '', org_name: 'Bandpey', city: 'Munich', status: 'new' }]
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

const howItWorks = sticky('## GitHub Munich -> Traces\nAsks GitHub\'s public search for **organisations in Munich / München created in the last 120 days** (new tech teams often show up here before anyone writes about them). Skips orgs already in **Traces**, takes at most 15 per run, and for each one reads (one call every 2 s) the org profile, its 5 newest repos and its public members. It also asks **Hugging Face** whether the same name has models or datasets: a team on both is a stronger signal.\n\nNo GitHub token, no login, public facts only. **Emails are never kept**, phone numbers are removed. If GitHub says "too many requests" (403), that call is skipped and the flow saves what it got; an org whose profile could not be read is tried again next run.\n\n**Run from demo**: call this workflow\'s webhook (path github-munich) to run it live.', [searchTerms, searchNewOrgs, listNewOrgs, onlyNewOrgs, capOrgs, fetchOrg, fetchRepos, fetchMembers, fetchHfModels, fetchHfDatasets, buildTraces, saveToTraces], { color: 7 });

export default workflow('github-munich', '05 GitHub Germany -> Traces')
  .add(runByHand)
  .to(searchTerms)
  .to(searchNewOrgs)
  .to(listNewOrgs)
  .to(onlyNewOrgs)
  .to(capOrgs)
  .to(fetchOrg)
  .to(fetchRepos)
  .to(fetchMembers)
  .to(fetchHfModels)
  .to(fetchHfDatasets)
  .to(buildTraces)
  .to(saveToTraces)
  .add(calledByRunAll)
  .to(searchTerms)
  .add(runFromDemo)
  .to(searchTerms)
  .add(howItWorks)
  .group('Find new GitHub orgs', [searchTerms, searchNewOrgs, listNewOrgs, onlyNewOrgs, capOrgs, fetchOrg, fetchRepos, fetchMembers, fetchHfModels, fetchHfDatasets, buildTraces, saveToTraces], { description: 'New Munich orgs on GitHub -> only new ones, max 15 -> profile, repos, members, Hugging Face -> one row per org in Traces' });
