// Founder Radar dashboard. Vanilla JS; every value from the API goes through esc() / safeUrl().
const API = new URLSearchParams(location.search).get('api') || '';
const $ = (id) => document.getElementById(id);

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const safeUrl = (u) => { try { const x = new URL(u, location.href); return /^https?:$/.test(x.protocol) ? x.href : '#'; } catch { return '#'; } };
const link = (u, text) => `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer">${esc(text ?? u)}</a>`;
const day = (d) => (d ? String(d).slice(0, 10) : '');
const daysAgo = (d) => (d ? Math.round((Date.now() - new Date(d)) / 86400000) : null);

const SRC = { github: 'GitHub', ct: 'Cert log', incubator: 'Incubator', press_release: 'Uni press', idw: 'idw', text: 'Text', podcast: 'Podcast', competition: 'Competition', manual: 'Manual', demo: 'Demo' };
const STATUSES = ['new', 'watch', 'contact', 'rejected'];

const state = { leads: [], selected: null, filters: { q: '', minScore: 0, status: 'all' } };

async function api(path, opts = {}) {
  const res = await fetch(API + path, { headers: { 'content-type': 'application/json' }, ...opts });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function toast(msg, isError = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, isError ? 7000 : 3500);
}

// ---------- KPIs ----------
async function loadStats() {
  try {
    const s = await api('/api/stats');
    const tiles = [
      ['Startups tracked', s.startups, `${s.leads} leads, ${s.hiddenNotStartup} filtered as not-a-startup`],
      ['Score ≥ 60', s.scoreAbove60, 'worth a call', true],
      ['No press yet', s.noPressYet, 'zero Google News hits'],
      ['Multi-source', s.multiSource, '≥ 2 independent source families'],
      ['Median lead time', s.medianLeadTimeDays != null ? `${s.medianLeadTimeDays}d` : '–', 'first trace → first press (or today)', true],
      ['Enriched', s.enriched, s.lastRun ? `last run ${day(s.lastRun.startedAt)} · ${esc(s.lastRun.status)}` : 'no run yet'],
    ];
    $('kpis').innerHTML = tiles.map(([l, v, hint, acc]) => `<div class="kpi${acc ? ' accent' : ''}" title="${esc(hint)}"><div class="v">${esc(v)}</div><div class="l">${esc(l)}</div></div>`).join('');
    const b = $('llmBadge');
    b.textContent = `Scoring: ${s.llm}${s.demoLeads ? ` · ${s.demoLeads} demo leads` : ''}`;
    b.className = 'badge' + (s.llmActive ? ' on' : '');
    if (s.running) pollRun();
  } catch (e) {
    $('kpis').innerHTML = `<div class="kpi"><div class="l err">API not reachable: ${esc(e.message)}</div></div>`;
  }
}

// ---------- Table ----------
function pressChip(l) {
  const e = l.earliness;
  if (!e || !e.pressChecked) return '<span class="chip dim">not checked</span>';
  if (e.noPressYet) return '<span class="chip good">no press yet</span>';
  if (e.leadTimeDays != null && e.leadTimeDays > 0) return `<span class="chip good">${esc(e.leadTimeDays)}d before press</span>`;
  return '<span class="chip warn">already in press</span>';
}

function scoreCell(l) {
  if (!l.score) return '<div class="score"><span class="n muted">–</span></div>';
  const s = l.score.signal || 0;
  const t = l.score.thesis || 0;
  return `<div class="score"><span class="n">${esc(l.score.total)}</span>
    <div class="bar" title="signal ${s}/60 · thesis ${t}/40${l.score.method === 'keywords' ? ' (keyword fallback)' : ''}"><span class="s" style="width:${(s / 100) * 100}%"></span><span class="t" style="width:${(t / 100) * 100}%"></span></div></div>`;
}

function row(l) {
  const ago = daysAgo(l.earliness?.firstSeen);
  return `<tr data-id="${esc(l.id)}" class="${state.selected === l.id ? 'active' : ''}">
    <td class="c-score">${scoreCell(l)}</td>
    <td>
      <div class="name">${esc(l.name)}${l.demo ? '<span class="demo">DEMO DATA</span>' : ''}</div>
      <div class="sub">${esc(l.domain || 'no domain yet')}${l.city ? ` · ${esc(l.city)}` : ''}</div>
      ${l.oneLiner ? `<div class="one">${esc(l.oneLiner)}</div>` : ''}
    </td>
    <td class="c-sector">${l.sector ? `<div>${esc(l.sector)}</div><div class="sub">${esc(l.subsector || '')}</div>` : '<span class="muted">–</span>'}</td>
    <td class="c-src">${l.sources.map((s) => `<span class="chip src-${esc(s)}">${esc(SRC[s] || s)}</span>`).join('')}</td>
    <td class="c-first">${l.earliness?.firstSeen ? `<div>${esc(day(l.earliness.firstSeen))}</div><div class="sub">${esc(ago)} days ago</div>` : '<span class="muted">–</span>'}</td>
    <td class="c-press">${pressChip(l)}</td>
    <td class="c-status"><span class="status ${esc(l.status)}">${esc(l.status)}</span></td>
  </tr>`;
}

async function loadLeads() {
  const f = state.filters;
  const qs = new URLSearchParams({ q: f.q, minScore: f.minScore, status: f.status, limit: 500 });
  try {
    const r = await api('/api/leads?' + qs);
    state.leads = r.leads;
    $('rows').innerHTML = r.leads.map(row).join('');
    const empty = $('empty');
    empty.hidden = r.leads.length > 0;
    empty.textContent = f.q || f.minScore || f.status !== 'all' ? 'No leads match these filters.' : 'No leads yet. Click “Run sourcing”, or run `npm run demo` for three fictional demo leads.';
  } catch (e) {
    $('rows').innerHTML = '';
    $('empty').hidden = false;
    $('empty').textContent = `Could not load leads: ${e.message}`;
  }
}

// ---------- Side panel ----------
function scoreBreakdown(lead) {
  const sc = lead.score;
  if (!sc) return '<p class="muted">Not scored yet.</p>';
  const parts = sc.signal.parts.map((p) => `<li><span class="pts ${p.pts >= 0 ? 'pos' : 'neg'}">${p.pts > 0 ? '+' : ''}${esc(p.pts)}</span><span>${esc(p.why)}</span></li>`).join('');
  const t = sc.thesis || {};
  const subs = Object.entries(t.scores || {}).map(([k, v]) => {
    const max = t.method === 'keywords' ? ({ sectorFit: 6, techDepth: 6, teamSignals: 4, stageFit: 4 })[k] || 10 : 10;
    return `<span>${esc(k)}</span><div class="track"><div class="fill" style="width:${Math.min(100, (v / max) * 100)}%"></div></div><span>${esc(v)}/${max}</span>`;
  }).join('');
  const mult = (t.multipliers || []).map((m) => `<li><span class="pts neg">×${esc(m.x)}</span><span>${esc(m.why)}</span></li>`).join('');
  return `<div class="box">
      <strong>Signal score ${esc(sc.signal.pts)}/60</strong> <span class="muted">(rules, capped at 60)</span>
      <ul class="parts">${parts || '<li class="muted">no rule fired</li>'}</ul>
    </div>
    <div class="box" style="margin-top:8px">
      <strong>Thesis score ${esc(t.pts)}/${t.method === 'keywords' ? 20 : 40}</strong> <span class="muted">${esc(t.method === 'keywords' ? 'keyword fallback (no LLM key)' : t.model)}</span>
      <div class="subs">${subs}</div>
      ${mult ? `<ul class="parts" style="margin-top:8px">${mult}</ul>` : ''}
      ${t.error ? `<p class="err">${esc(t.error)}</p>` : ''}
    </div>`;
}

function timeline(lead) {
  const e = lead.earliness;
  if (!e) return '<p class="muted">No dated traces yet.</p>';
  let head = '';
  if (e.firstPress && e.leadTimeDays > 0) head = `<div class="lead-time">Seen <b>${esc(e.leadTimeDays)}</b> days before the first press article</div>`;
  else if (e.noPressYet && e.leadTimeDays != null) head = `<div class="lead-time">First public trace <b>${esc(e.leadTimeDays)}</b> days ago, still no press</div>`;
  else if (e.firstPress) head = `<div class="lead-time muted">Press found before our first trace</div>`;
  return head + `<ul class="timeline">${e.timeline.map((t) => `<li class="${esc(t.kind)}"><span class="d">${esc(day(t.date))}</span>${esc(t.label)}</li>`).join('')}</ul>`;
}

function impressumBox(imp) {
  if (!imp) return '<p class="muted">No Impressum found (or not checked yet).</p>';
  const rows = [
    ['Company', imp.company], ['Legal form', imp.legalForm && `${imp.legalForm}${imp.inFounding ? ' · in Gründung (i.G.)' : ''}`],
    ['Register', imp.register && `${imp.register}${imp.court ? `, ${imp.court}` : ''}`], ['Address', [imp.zip, imp.city].filter(Boolean).join(' ')],
    ['Managing directors', (imp.directors || []).join(', ')], ['VAT ID', imp.vatId],
  ].filter(([, v]) => v);
  return `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <p class="sub" style="margin:8px 0 0">${link(imp.url, 'Source: Impressum')} · Register entries: check manually at handelsregister.de (no bulk scraping).</p>`;
}

function domainBox(lead) {
  const e = lead.enrichment || {};
  const rows = [
    ['Domain', lead.domain ? link(`https://${lead.domain}`, lead.domain) : '–'],
    ['Found via', esc(lead.domainSource || (lead.domain ? 'source signal' : '–'))],
    ['First TLS cert', e.cert?.firstCert ? `${esc(day(e.cert.firstCert))} (${esc(daysAgo(e.cert.firstCert))} days ago, ${esc(e.cert.certCount)} certs) · ${link(e.cert.crtshUrl, 'crt.sh')}${e.cert.source && e.cert.source !== 'crt.sh' ? ` <span class="sub">via ${esc(e.cert.source)}</span>` : ''}` : esc(e.errors?.cert ? `error: ${e.errors.cert}` : '–')],
    ['Registered', e.rdap?.registered ? `${esc(day(e.rdap.registered))}${e.rdap.registrar ? ` · ${esc(e.rdap.registrar)}` : ''}` : esc(e.rdap?.reason || e.errors?.rdap || '–')],
    ['Website', e.website ? (e.website.ok ? `${esc(e.website.title || '(no title)')}${e.website.parked ? ' · <span class="chip bad">parked</span>' : ''}${e.website.placeholder ? ' · <span class="chip warn">placeholder / stealth</span>' : ''}${e.website.redirectTo ? ` · redirects to ${esc(e.website.redirectTo)}` : ''}` : `<span class="err">${esc(e.website.error || 'unreachable')}</span>`) : '–'],
  ];
  return `<dl class="kv">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
}

function signalsList(lead) {
  return lead.signals.map((s) => {
    const d = s.data || {};
    const bits = [d.description, d.location && `📍 ${d.location}`, d.stars ? `★ ${d.stars}` : '', d.topics?.length && d.topics.slice(0, 6).join(', '),
      d.keyword && `cert keyword “${d.keyword}”`, d.pageTitle, d.newOnPage && 'NEW on page', d.institution, d.evidence && `“${d.evidence}”`, d.foundingYear && `founded ${d.foundingYear}`]
      .filter(Boolean);
    const repos = (d.topRepos || []).slice(0, 3).map((r) => `${link(r.url, r.name)} ★${esc(r.stars)}`).join(' · ');
    return `<div class="sig"><span class="chip src-${esc(s.source)}">${esc(SRC[s.source] || s.source)}</span>
      <strong>${esc(s.name || s.domain || '')}</strong> <span class="muted">${esc(day(s.date))}</span>
      ${s.url ? ` · ${link(s.url, 'open')}` : ''}
      ${bits.length ? `<div class="sub">${bits.map(esc).join(' · ')}</div>` : ''}
      ${repos ? `<div class="sub">${repos}</div>` : ''}</div>`;
  }).join('');
}

function pressList(p) {
  if (!p) return '<p class="muted">Not checked yet.</p>';
  if (p.skipped) return `<p class="muted">${esc(p.reason)}</p>`;
  if (p.error) return `<p class="err">${esc(p.error)}</p>`;
  const funding = new Set((p.fundingHeadlines || []).map((h) => h.url));
  return `<p class="sub">${esc(p.count)} Google News results for ${esc(p.query)} · ${link(p.searchUrl, 'open search')}</p>` +
    (p.items || []).map((i) => `<div class="press-item">${funding.has(i.url) ? '<span class="chip bad">funding</span>' : ''}<span class="muted">${esc(day(i.date))}</span> ${link(i.url, i.title)} <span class="sub">${esc(i.source)}</span></div>`).join('');
}

function renderPanel(lead) {
  const t = lead.score?.thesis || {};
  const e = lead.enrichment || {};
  const errs = Object.entries(e.errors || {});
  $('panelBody').innerHTML = `
    <div class="p-head">
      <div>
        <h2>${esc(lead.name)}${lead.demo ? '<span class="demo">DEMO DATA</span>' : ''}</h2>
        <div class="sub">${lead.domain ? link(`https://${lead.domain}`, lead.domain) : 'no domain yet'}${e.impressum?.city ? ` · ${esc(e.impressum.city)}` : ''}${t.sector ? ` · ${esc(t.sector)}${t.subsector ? ` / ${esc(t.subsector)}` : ''}` : ''}${t.stage ? ` · ${esc(t.stage)}` : ''}</div>
      </div>
      <button class="icon-btn" id="closePanel" aria-label="Close">×</button>
    </div>
    ${lead.demo ? '<p class="err">Fictional lead on an .example domain, for building the UI only.</p>' : ''}
    <div class="p-score"><span class="big">${esc(lead.score?.total ?? '–')}</span>
      <span class="split">signal <b>${esc(lead.score?.signal.pts ?? '–')}</b>/60 · thesis <b class="t">${esc(t.pts ?? '–')}</b>/${t.method === 'keywords' ? 20 : 40}<br>${esc(t.oneLiner || '')}</span></div>
    ${t.whyHTGF ? `<div class="callout"><h4>Why HTGF</h4>${esc(t.whyHTGF)}</div>` : ''}
    ${t.nextStep ? `<div class="callout next"><h4>Next step</h4>${esc(t.nextStep)}</div>` : ''}
    <div class="row-btns">
      ${STATUSES.map((s) => `<button class="btn small${lead.status === s ? ' on' : ''}" data-status="${s}">${s}</button>`).join('')}
      <button class="btn small" id="refreshBtn" ${lead.demo ? 'disabled' : ''}>↻ Re-check</button>
    </div>
    <div class="sec"><h3>Earliness</h3>${timeline(lead)}</div>
    <div class="sec"><h3>Score breakdown</h3>${scoreBreakdown(lead)}</div>
    <div class="sec"><h3>Team</h3><div class="box">${esc(t.team || 'unknown')}</div></div>
    ${t.redFlags?.length ? `<div class="sec"><h3>Red flags</h3><ul class="flags">${t.redFlags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></div>` : ''}
    <div class="sec"><h3>Impressum</h3><div class="box">${impressumBox(e.impressum)}</div></div>
    <div class="sec"><h3>Domain</h3><div class="box">${domainBox(lead)}</div></div>
    <div class="sec"><h3>Signals (${lead.signals.length})</h3><div class="box">${signalsList(lead)}</div></div>
    <div class="sec"><h3>Press</h3><div class="box">${pressList(e.press)}</div></div>
    ${errs.length ? `<div class="sec"><h3>Enrichment errors</h3><div class="box">${errs.map(([k, v]) => `<div class="err">${esc(k)}: ${esc(v)}</div>`).join('')}</div></div>` : ''}
    <div class="sec"><h3>Notes</h3><textarea id="notes" placeholder="Notes for the team (saved on blur)">${esc(lead.notes || '')}</textarea></div>
    <p class="sub">Enriched ${esc(day(lead.enrichedAt) || 'never')} · id ${esc(lead.id)}</p>`;

  $('closePanel').onclick = closePanel;
  $('panelBody').querySelectorAll('[data-status]').forEach((b) => {
    b.onclick = async () => {
      try {
        const upd = await api(`/api/leads/${encodeURIComponent(lead.id)}`, { method: 'PATCH', body: JSON.stringify({ status: b.dataset.status }) });
        renderPanel(upd);
        loadLeads();
      } catch (err) { toast(err.message, true); }
    };
  });
  $('notes').onblur = async (ev) => {
    if (ev.target.value === (lead.notes || '')) return;
    try {
      lead.notes = ev.target.value;
      await api(`/api/leads/${encodeURIComponent(lead.id)}`, { method: 'PATCH', body: JSON.stringify({ notes: ev.target.value }) });
      toast('Notes saved');
    } catch (err) { toast(err.message, true); }
  };
  const rb = $('refreshBtn');
  rb.onclick = async () => {
    rb.disabled = true;
    rb.textContent = 'Checking…';
    try {
      const upd = await api(`/api/leads/${encodeURIComponent(lead.id)}?action=refresh`, { method: 'POST' });
      renderPanel(upd);
      loadLeads();
      loadStats();
      toast('Re-checked website, certificates, registration and press');
    } catch (err) {
      toast(err.message, true);
      rb.disabled = false;
      rb.textContent = '↻ Re-check';
    }
  };
}

async function openLead(id) {
  state.selected = id;
  document.querySelectorAll('#rows tr').forEach((tr) => tr.classList.toggle('active', tr.dataset.id === id));
  $('panelBody').innerHTML = '<p class="muted">Loading…</p>';
  $('panel').classList.add('open');
  $('panel').setAttribute('aria-hidden', 'false');
  $('scrim').hidden = false;
  try {
    renderPanel(await api(`/api/leads/${encodeURIComponent(id)}`));
  } catch (e) {
    $('panelBody').innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

function closePanel() {
  state.selected = null;
  $('panel').classList.remove('open');
  $('panel').setAttribute('aria-hidden', 'true');
  $('scrim').hidden = true;
  document.querySelectorAll('#rows tr.active').forEach((tr) => tr.classList.remove('active'));
}

// ---------- Runs ----------
let polling = false;
async function pollRun() {
  if (polling) return;
  polling = true;
  const btn = $('runBtn');
  btn.disabled = true;
  btn.textContent = 'Running…';
  const box = $('runStatus');
  box.hidden = false;
  try {
    for (;;) {
      const r = await api('/api/runs');
      const run = r.runs[0];
      if (run) box.textContent = `${run.status} · ${run.counts.signals} signals · ${run.counts.newLeads} new · ${run.counts.enriched} enriched · ${run.log[run.log.length - 1] || ''}`;
      if (!r.running) {
        if (run?.errors?.length) box.textContent += `  ·  ${run.errors.length} source warnings (see GET /api/runs)`;
        break;
      }
      if (run?.counts.enriched) loadLeads();
      await new Promise((res) => setTimeout(res, 2000));
    }
  } catch (e) {
    box.textContent = `Run status unavailable: ${e.message}`;
  }
  polling = false;
  btn.disabled = false;
  btn.textContent = 'Run sourcing';
  loadLeads();
  loadStats();
  setTimeout(() => { box.hidden = true; }, 15000);
}

$('runBtn').onclick = async () => {
  try {
    await api('/api/run', { method: 'POST', body: '{}' });
    toast('Sourcing run started');
    pollRun();
  } catch (e) {
    toast(e.message, true);
    if (/in progress/.test(e.message)) pollRun();
  }
};

// ---------- Briefing ----------
function showBriefing(b) {
  $('briefing').hidden = false;
  $('briefingMeta').textContent = `${b.date} · ${b.words || ''} words · script by ${b.scriptBy}`;
  const audio = b.audioUrl ? `<audio controls src="${esc(safeUrl(API + b.audioUrl))}"></audio>` : `<button class="btn small" id="speakBtn">▶ Read aloud (browser voice)</button>`;
  const notes = (b.errors || []).map((x) => `<div class="err">${esc(x)}</div>`).join('');
  $('briefingBody').innerHTML = `${audio}<div class="script">${esc(b.script)}</div>${notes}`;
  const sp = $('speakBtn');
  if (sp) {
    sp.onclick = () => {
      if (speechSynthesis.speaking) { speechSynthesis.cancel(); sp.textContent = '▶ Read aloud (browser voice)'; return; }
      const u = new SpeechSynthesisUtterance(b.script);
      u.lang = 'de-DE';
      u.onend = () => { sp.textContent = '▶ Read aloud (browser voice)'; };
      speechSynthesis.speak(u);
      sp.textContent = '■ Stop';
    };
  }
}

$('briefingBtn').onclick = async () => {
  const btn = $('briefingBtn');
  btn.disabled = true;
  btn.textContent = 'Writing briefing…';
  try {
    showBriefing(await api('/api/briefing', { method: 'POST' }));
  } catch (e) {
    toast(e.message, true);
  }
  btn.disabled = false;
  btn.textContent = 'Morning briefing';
};
$('briefingClose').onclick = () => { $('briefing').hidden = true; speechSynthesis.cancel?.(); };

// ---------- Filters & manual check ----------
let debounce;
$('q').oninput = (e) => { clearTimeout(debounce); debounce = setTimeout(() => { state.filters.q = e.target.value; loadLeads(); }, 200); };
$('minScore').oninput = (e) => { $('minScoreOut').textContent = e.target.value; clearTimeout(debounce); debounce = setTimeout(() => { state.filters.minScore = +e.target.value; loadLeads(); }, 150); };
$('status').onchange = (e) => { state.filters.status = e.target.value; loadLeads(); };
$('addForm').onsubmit = async (ev) => {
  ev.preventDefault();
  const v = $('addInput').value.trim();
  if (!v) return;
  const btn = ev.target.querySelector('button');
  btn.disabled = true;
  btn.textContent = 'Checking…';
  try {
    const isDomain = /^[^\s]+\.[a-z]{2,}(\/.*)?$/i.test(v);
    const r = await api('/api/candidates', { method: 'POST', body: JSON.stringify(isDomain ? { domain: v, source: 'manual' } : { name: v, source: 'manual' }) });
    $('addInput').value = '';
    await loadLeads();
    loadStats();
    const id = r.processed[0]?.id || r.created[0] || r.updated[0];
    if (id) openLead(id);
    else toast('Nothing to add: not a company domain or name', true);
  } catch (e) {
    toast(e.message, true);
  }
  btn.disabled = false;
  btn.textContent = 'Check';
};

$('rows').onclick = (e) => {
  const tr = e.target.closest('tr[data-id]');
  if (tr && !e.target.closest('a')) openLead(tr.dataset.id);
};
$('scrim').onclick = closePanel;
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });

loadStats();
loadLeads();
api('/api/briefing').then((b) => { if (b && !b.none && b.date === new Date().toISOString().slice(0, 10)) showBriefing(b); }).catch(() => {});
