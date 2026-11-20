// Which leads get a web check of their age and funding this run (flow 35). HTGF only invests in companies up to 3 years old
// that have no institutional round yet, and our traces rarely say when a company was founded or who funded it.
// Picks call_now, then watchlist, then needs_enrichment leads whose website was read by flow 34, that were not checked
// in the last 14 days. One gpt-5-mini call with OpenAI web search per lead.
const MAX_PER_RUN = 60;
const RECHECK_DAYS = 14;
const MODEL = 'gpt-5-mini';
const INSTRUCTIONS = [
  'You check one German startup for High-Tech Gruenderfonds (HTGF), which only invests in companies founded at most 3 years ago that have not yet raised an institutional round.',
  'Search the web for this exact company (match the name, website, city and what it builds; ignore other companies with a similar name).',
  'founded_year: the year the company was founded or registered as a company (GmbH, UG, AG, AB ...), not the year the research started. null if you find no source.',
  'founded_url and founded_quote: the page that says it and the sentence, copied word for word (at most 200 characters). Empty strings if founded_year is null.',
  'rounds: every investment round you find, each with type, lead_investor, amount_eur_m (millions of euros, null if not disclosed), date, url and quote (word for word, at most 200 characters):',
  '- series_a_plus: Series A or later.',
  '- seed_vc: a closed seed or other round led by a venture capital fund, a corporate VC or a public VC fund (for example TGFS, Bayern Kapital, EIF-backed funds).',
  '- pre_seed: a pre-seed round (also with a VC). angels: business angels only. grant: EXIST, EU, BMBF or other public grants and prizes. other: anything else.',
  'register: the German commercial register entry (Handelsregister) if you find one, for example on handelsregister.de, unternehmensregister.de, northdata.de or the Impressum: court (Amtsgericht), number (HRB/HRA ...), registered_date (YYYY-MM-DD, the first registration), url. Empty strings if not found.',
  'hq_country: ISO country code of the headquarters, empty if unknown. Never invent facts: only what a page you found says.'
].join('\n');
const ROUND = { type: 'object', additionalProperties: false, required: ['type', 'lead_investor', 'amount_eur_m', 'date', 'url', 'quote'], properties: {
  type: { type: 'string', enum: ['series_a_plus', 'seed_vc', 'pre_seed', 'angels', 'grant', 'other'] }, lead_investor: { type: 'string' },
  amount_eur_m: { type: ['number', 'null'] }, date: { type: 'string' }, url: { type: 'string' }, quote: { type: 'string' } } };
const SCHEMA = { type: 'object', additionalProperties: false, required: ['founded_year', 'founded_url', 'founded_quote', 'rounds', 'hq_country', 'register'], properties: {
  founded_year: { type: ['integer', 'null'] }, founded_url: { type: 'string' }, founded_quote: { type: 'string' },
  rounds: { type: 'array', items: ROUND }, hq_country: { type: 'string' },
  register: { type: 'object', additionalProperties: false, required: ['court', 'number', 'registered_date', 'url'], properties: {
    court: { type: 'string' }, number: { type: 'string' }, registered_date: { type: 'string' }, url: { type: 'string' } } } } };
const obj = s => { try { const v = typeof s === 'object' && s ? s : JSON.parse(s || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } };
// v2 (21 Nov): a seed round 'led by undisclosed' no longer counts as institutional, so v1 answers with a round are read again.
const fresh = c => c.checked_at && (Date.now() - new Date(c.checked_at)) / 864e5 < RECHECK_DAYS && !((c.v || 1) < 2 && c.institutional);
const ORDER = { call_now: 0, watchlist: 1, needs_enrichment: 2, too_late: 3 };
const picked = [];
for (const item of $('Get all leads').all()) {
  const l = item.json;
  if (!l.lead_key || String(l.verdict || '').startsWith('merged_into:')) continue;
  const c = obj(l.age_check);
  const wanted = ['call_now', 'watchlist'].includes(l.verdict) || (l.verdict === 'needs_enrichment' && l.site_checked_at) || ((c.v || 1) < 2 && c.institutional);
  if (!wanted || fresh(c)) continue;
  picked.push(l);
}
picked.sort((a, b) => ((ORDER[a.verdict] ?? 4) - (ORDER[b.verdict] ?? 4)) || (Number(b.priority) || 0) - (Number(a.priority) || 0));
return picked.slice(0, MAX_PER_RUN).map(l => {
  const people = String(l.people || '').split(';').map(x => x.trim()).filter(Boolean).slice(0, 4).join('; ');
  const input = 'COMPANY: ' + l.name + '\nWebsite: ' + (l.website && l.website !== 'none' ? l.website : 'unknown') + '\nCity: ' + (l.city || 'unknown') +
    '\nWhat it builds: ' + (l.what || '') + '\nFounders or team: ' + (people || 'unknown');
  return { json: { lead_key: l.lead_key, name: l.name,
    body: { model: MODEL, instructions: INSTRUCTIONS, input, tools: [{ type: 'web_search' }], max_output_tokens: 6000, reasoning: { effort: 'low' },
      text: { format: { type: 'json_schema', name: 'age_and_funding', strict: true, schema: SCHEMA } } } } };
});
