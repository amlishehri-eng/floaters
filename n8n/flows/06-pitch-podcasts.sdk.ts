import { workflow, node, trigger, sticky, expr, newCredential } from '@n8n/workflow-sdk';

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
  config: { name: 'Run from demo', parameters: { httpMethod: 'GET', path: 'pitch-podcasts', responseMode: 'onReceived', options: {} } }
});

const podcastFeeds = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Podcast feeds',
    executeOnce: true,
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Munich startup podcasts: founders tell their story here, often before any press.\nreturn [\n  { json: { show: 'PITCH & PEOPLE (Munich Startup)', feed_url: 'https://anchor.fm/s/1ed02b7c/podcast/rss' } },\n  { json: { show: 'Lenas Start-ups (Stadtsparkasse Muenchen)', feed_url: 'https://feeds.acast.com/public/shows/648ae6adc6f9af0011f2f63c' } },\n];\n" },
    output: [{ show: 'PITCH & PEOPLE (Munich Startup)', feed_url: 'https://anchor.fm/s/1ed02b7c/podcast/rss' }]
  }
});

const fetchFeeds = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Fetch feeds',
    parameters: {
      method: 'GET',
      url: expr('{{ $json.feed_url }}'),
      sendHeaders: true,
      specifyHeaders: 'keypair',
      headerParameters: { parameters: [{ name: 'User-Agent', value: UA }] },
      options: {
        batching: { batch: { batchSize: 1, batchInterval: 2000 } },
        response: { response: { responseFormat: 'text', outputPropertyName: 'data' } }
      }
    },
    output: [{ data: '<rss>...</rss>' }]
  }
});

const listEpisodes = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'List episodes',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// RSS -> one item per episode of the last two years, newest first. Show notes come with the feed, so no page per episode is fetched.\nconst feeds = $('Podcast feeds').all();\nconst decode = s => (s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '\"').replace(/&#39;|&apos;/g, \"'\").replace(/&nbsp;/g, ' ').replace(/&#(\\d+);/g, (m, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (m, n) => String.fromCharCode(parseInt(n, 16))).replace(/&amp;/g, '&');\nconst clean = s => decode(decode((s || '').replace(/<!\\[CDATA\\[|\\]\\]>/g, '')).replace(/<br\\s*\\/?>/gi, '\\n').replace(/<\\/(p|li|h\\d)>/gi, '\\n').replace(/<[^>]+>/g, ' '))\n  .replace(/[ \\t]+/g, ' ').replace(/ *\\n */g, '\\n').replace(/\\n{3,}/g, '\\n\\n').trim();\nconst scrub = s => s.replace(/\\S+@\\S+\\.\\S+/g, '[email removed]').replace(/\\+?\\d[\\d \\/-]{7,}\\d/g, '[phone removed]');\nconst cutoff = Date.now() - 730 * 864e5;\nconst out = [];\n$input.all().forEach((page, i) => {\n  const show = feeds[i].json.show;\n  const items = (page.json.data || '').match(/<item>[\\s\\S]*?<\\/item>/g) || [];\n  for (const it of items) {\n    const get = re => { const m = it.match(re); return m ? m[1] : ''; };\n    const title = clean(get(/<title>([\\s\\S]*?)<\\/title>/));\n    const guid = clean(get(/<guid[^>]*>([\\s\\S]*?)<\\/guid>/)) || title;\n    const pub = new Date(clean(get(/<pubDate>([\\s\\S]*?)<\\/pubDate>/)));\n    if (isNaN(pub.getTime()) || pub.getTime() < cutoff) continue;\n    let audio = decode((it.match(/<enclosure[^>]*url=\"([^\"]+)\"/) || [])[1] || '');\n    const direct = audio.match(/\\/play\\/\\d+\\/(https%3A%2F%2F.+)$/);\n    if (direct) audio = decodeURIComponent(direct[1]);\n    const notes = scrub(clean(get(/<content:encoded>([\\s\\S]*?)<\\/content:encoded>/)) || clean(get(/<description>([\\s\\S]*?)<\\/description>/)));\n    const parts = title.split(/:\\s+|\\s+-\\s+/);\n    out.push({ json: {\n      trace_id: 'podcast:' + guid.slice(0, 120),\n      show,\n      title,\n      happened_at: pub.toISOString(),\n      url: clean(get(/<link>([\\s\\S]*?)<\\/link>/)) || audio,\n      audio_url: audio,\n      duration: clean(get(/<itunes:duration>([\\s\\S]*?)<\\/itunes:duration>/)),\n      notes,\n      org_name: parts.length > 1 ? parts.slice(1).join(' - ').trim() : '',\n    }});\n  }\n});\nout.sort((a, b) => b.json.happened_at.localeCompare(a.json.happened_at));\nreturn out;\n" },
    output: [{ trace_id: 'podcast:cfd05e9e-0bd2-4cd0-8e0c-e09aa211debf', show: 'PITCH & PEOPLE (Munich Startup)', title: 'PITCH & PEOPLE #56: Women in Business', happened_at: '2026-11-11T08:00:00.000Z', url: 'https://podcasters.spotify.com/pod/show/pitchandpeople/episodes/abc', audio_url: 'https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-10-10/abc.mp3', duration: '00:24:46', notes: 'In der aktuellen Folge spricht Laura Mueller, Mitgruenderin von Women in Business e.V. ...', org_name: 'Women in Business' }]
  }
});

const onlyNewEpisodes = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Only new episodes',
    parameters: {
      resource: 'row',
      operation: 'rowNotExists',
      dataTableId: { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'trace_id', condition: 'eq', keyValue: expr('{{ $json.trace_id }}') }] }
    },
    output: [{ trace_id: 'podcast:cfd05e9e-0bd2-4cd0-8e0c-e09aa211debf', show: 'PITCH & PEOPLE (Munich Startup)', title: 'PITCH & PEOPLE #56: Women in Business', happened_at: '2026-11-11T08:00:00.000Z', url: 'https://podcasters.spotify.com/pod/show/pitchandpeople/episodes/abc', audio_url: 'https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-10-10/abc.mp3', duration: '00:24:46', notes: 'In der aktuellen Folge ...', org_name: 'Women in Business' }]
  }
});

const buildTraces = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Build traces',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Each new episode -> a trace from its show notes. The brain reads the founders and the startup out of the text.\nconst now = new Date().toISOString();\nreturn $input.all().map(e => ({ json: {\n  trace_id: e.json.trace_id,\n  source: 'recording',\n  url: e.json.url,\n  happened_at: e.json.happened_at,\n  found_at: now,\n  title: '[' + e.json.show + '] ' + e.json.title,\n  text: ('Podcast episode' + (e.json.duration ? ' (' + e.json.duration + ')' : '') + ' of ' + e.json.show + '\\n\\n' + e.json.notes).slice(0, 5000),\n  people: '',\n  org_name: e.json.org_name,\n  city: 'Munich',\n  status: 'new',\n}}));\n" },
    output: [{ trace_id: 'podcast:cfd05e9e-0bd2-4cd0-8e0c-e09aa211debf', source: 'recording', url: 'https://podcasters.spotify.com/pod/show/pitchandpeople/episodes/abc', happened_at: '2026-11-11T08:00:00.000Z', found_at: '2026-11-20T12:00:00.000Z', title: '[PITCH & PEOPLE (Munich Startup)] PITCH & PEOPLE #56: Women in Business', text: 'Podcast episode (00:24:46) ...', people: '', org_name: 'Women in Business', city: 'Munich', status: 'new' }]
  }
});

const saveShowNotes = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save show notes',
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

const getPodcastTraces = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Get podcast traces',
    executeOnce: true,
    parameters: {
      resource: 'row',
      operation: 'get',
      dataTableId: { __rl: true, mode: 'id', value: 'crxSUMWXcPfMrXt4', cachedResultName: 'Traces' },
      matchType: 'allConditions',
      filters: { conditions: [{ keyName: 'source', condition: 'eq', keyValue: 'recording' }] },
      returnAll: true
    },
    output: [{ trace_id: 'podcast:cfd05e9e-0bd2-4cd0-8e0c-e09aa211debf', source: 'recording', text: 'Podcast episode ...' }]
  }
});

const pickNewest = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Pick 3 without transcript',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Transcription costs ElevenLabs credits, so per run only the 3 newest saved episodes that have no transcript yet (under 60 minutes each).\n// A failed transcription leaves the trace without one, so it is tried again next run.\nconst mins = d => { const p = String(d || '').split(':').map(Number); return p.length === 3 ? p[0] * 60 + p[1] : p.length === 2 ? p[0] : Math.round((p[0] || 0) / 60); };\nconst rows = {};\nfor (const r of $input.all()) if (r.json && r.json.trace_id) rows[r.json.trace_id] = r.json;\nconst picks = [];\nfor (const e of $('List episodes').all()) {\n  const row = rows[e.json.trace_id];\n  if (!row || !e.json.audio_url || mins(e.json.duration) >= 60) continue;\n  if ((row.text || '').includes('Transcript (ElevenLabs')) continue;\n  picks.push({ json: { trace_id: row.trace_id, audio_url: e.json.audio_url, row: { trace_id: row.trace_id, source: row.source, url: row.url, happened_at: row.happened_at, title: row.title, text: row.text || '', people: row.people || '', org_name: row.org_name || '', city: row.city || 'Munich' } } });\n  if (picks.length === 3) break;\n}\nreturn picks;\n" },
    output: [{ trace_id: 'podcast:cfd05e9e-0bd2-4cd0-8e0c-e09aa211debf', audio_url: 'https://d3ctxlq1ktw2nl.cloudfront.net/staging/2026-10-10/abc.mp3', row: { trace_id: 'podcast:cfd05e9e-0bd2-4cd0-8e0c-e09aa211debf', text: 'Podcast episode ...' } }]
  }
});

const transcribe = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.5,
  config: {
    name: 'Transcribe with ElevenLabs',
    onError: 'continueRegularOutput',
    parameters: {
      method: 'POST',
      url: 'https://api.elevenlabs.io/v1/speech-to-text',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      contentType: 'multipart-form-data',
      bodyParameters: { parameters: [
        { parameterType: 'formData', name: 'model_id', value: 'scribe_v2' },
        { parameterType: 'formData', name: 'source_url', value: expr('{{ $json.audio_url }}') },
        { parameterType: 'formData', name: 'diarize', value: 'true' },
        { parameterType: 'formData', name: 'timestamps_granularity', value: 'word' },
        { parameterType: 'formData', name: 'tag_audio_events', value: 'false' }
      ] },
      options: {
        timeout: 600000,
        batching: { batch: { batchSize: 1, batchInterval: 2000 } }
      }
    },
    credentials: { httpHeaderAuth: newCredential('ElevenLabs') },
    output: [{ text: 'Hallo und willkommen ...', words: [{ text: 'Hallo', type: 'word', speaker_id: 'speaker_0' }] }]
  }
});

const addTranscript = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Add transcript',
    parameters: { mode: 'runOnceForAllItems', language: 'javaScript', jsCode: "// Transcript -> speaker turns, appended to the episode's trace. The trace goes back to status new (extraction cleared) so screening reads it again with the transcript.\n// A failed transcription (no key, no credits, audio not reachable) is skipped: the show notes stay and it is retried next run.\nconst picks = $('Pick 3 without transcript').all();\nconst scrub = s => s.replace(/\\S+@\\S+\\.\\S+/g, '[email removed]').replace(/\\+?\\d[\\d \\/-]{7,}\\d/g, '[phone removed]');\nconst out = [];\n$input.all().forEach((r, i) => {\n  if (!r.json || !r.json.text || r.json.error) return;\n  const turns = [];\n  let cur = null;\n  for (const w of r.json.words || []) {\n    const sp = w.speaker_id || 'speaker';\n    if (!cur || cur.sp !== sp) { cur = { sp, t: '' }; turns.push(cur); }\n    cur.t += w.text;\n  }\n  const transcript = turns.length ? turns.map(t => t.sp.replace('speaker_', 'Speaker ') + ': ' + t.t.trim()).filter(l => !/:\\s*$/.test(l)).join('\\n') : r.json.text;\n  const base = picks[i] && picks[i].json.row;\n  if (!base) return;\n  out.push({ json: { ...base, found_at: new Date().toISOString(), status: 'new', extraction: null, text: (base.text + '\\n\\nTranscript (ElevenLabs, speakers told apart):\\n' + scrub(transcript)).slice(0, 12000) } });\n});\nreturn out;\n" },
    output: [{ trace_id: 'podcast:cfd05e9e-0bd2-4cd0-8e0c-e09aa211debf', source: 'recording', url: 'https://podcasters.spotify.com/pod/show/pitchandpeople/episodes/abc', happened_at: '2026-11-11T08:00:00.000Z', found_at: '2026-11-20T12:00:00.000Z', title: '[PITCH & PEOPLE (Munich Startup)] PITCH & PEOPLE #56: Women in Business', text: 'Podcast episode ... Transcript ...', people: '', org_name: 'Women in Business', city: 'Munich', status: 'new' }]
  }
});

const saveTranscripts = node({
  type: 'n8n-nodes-base.dataTable',
  version: 1.1,
  config: {
    name: 'Save transcripts',
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

const howItWorks = sticky('## Pitch podcasts -> Traces\nReads two Munich startup podcasts (PITCH & PEOPLE, Lenas Start-ups). Every new episode of the last two years becomes a trace from its show notes. Each run, the **3 newest episodes without a transcript** are transcribed by **ElevenLabs** (speakers told apart) and the transcript is added to the trace.\n\nNeeds an n8n credential **ElevenLabs** (Header Auth, name `xi-api-key`). Without it the show notes are still saved.', [podcastFeeds, fetchFeeds, listEpisodes, onlyNewEpisodes, buildTraces, saveShowNotes, getPodcastTraces, pickNewest, transcribe, addTranscript, saveTranscripts], { color: 7 });

export default workflow('pitch-podcasts', '06 Pitch podcasts -> Traces')
  .add(runByHand)
  .to(podcastFeeds)
  .to(fetchFeeds)
  .to(listEpisodes)
  .to(onlyNewEpisodes)
  .to(buildTraces)
  .to(saveShowNotes)
  .add(listEpisodes)
  .to(getPodcastTraces)
  .to(pickNewest)
  .to(transcribe)
  .to(addTranscript)
  .to(saveTranscripts)
  .add(calledByRunAll)
  .to(podcastFeeds)
  .add(runFromDemo)
  .to(podcastFeeds)
  .add(howItWorks)
  .group('Read feeds', [podcastFeeds, fetchFeeds, listEpisodes], { description: 'Podcast RSS feeds -> episodes of the last two years, newest first' })
  .group('New episodes to traces', [onlyNewEpisodes, buildTraces, saveShowNotes], { description: 'Episodes not yet in Traces -> one trace each from the show notes' })
  .group('Transcripts', [getPodcastTraces, pickNewest, transcribe, addTranscript, saveTranscripts], { description: 'Saved podcast traces -> 3 newest without a transcript -> ElevenLabs speech-to-text -> transcript added' });
