// Model answer -> the Leads column age_check (JSON). Only facts with a source URL are kept. 13 Classify leads reads it:
// register.registered_date (exact) and founded_year count for the 3-year age check, an institutional round (seed_vc or series_a_plus with a named lead
// investor, or EUR 3M or more) means too late. No readable answer: nothing is written, the lead is tried next run.
const THIS_YEAR = new Date().getFullYear();
const out = [];
$input.all().forEach((item, i) => {
  let p; try { p = $('Pick leads').itemMatching(i).json; } catch (e) { p = $('Pick leads').all()[i].json; }
  let a = null, searches = 0;
  for (const o of (item.json && item.json.output) || []) {
    if (o.type === 'web_search_call') searches++;
    for (const x of o.content || []) if (x.type === 'output_text') { try { a = JSON.parse(x.text); } catch (e) {} }
  }
  if (!a) return;
  const url = s => /^https?:\/\//.test(String(s || '')) ? String(s) : '';
  const y = Number(a.founded_year);
  const founded_year = Number.isInteger(y) && y >= 1980 && y <= THIS_YEAR && url(a.founded_url) ? y : null;
  const rounds = (Array.isArray(a.rounds) ? a.rounds : []).filter(r => r && url(r.url)).slice(0, 8).map(r => ({
    type: r.type, lead_investor: String(r.lead_investor || '').slice(0, 120), amount_eur_m: typeof r.amount_eur_m === 'number' ? r.amount_eur_m : null,
    date: String(r.date || '').slice(0, 20), url: url(r.url), quote: String(r.quote || '').slice(0, 200) }));
  // a seed without a named lead investor is 'unknown', not institutional (same rule as 13: a bare seed is not too late)
  const named = r => r.lead_investor && !/^(undisclosed|unknown|not disclosed|n\/?a|none|-|unnamed|various)$/i.test(r.lead_investor.trim());
  const inst = rounds.find(r => r.type === 'series_a_plus' || (r.type === 'seed_vc' && named(r)) || (r.type !== 'grant' && (r.amount_eur_m || 0) >= 3));
  const institutional = inst ? { claim: `${inst.type}${inst.lead_investor ? ' led by ' + inst.lead_investor : ''}${inst.amount_eur_m ? ', EUR ' + inst.amount_eur_m + 'M' : ''}${inst.date ? ' (' + inst.date + ')' : ''}`, url: inst.url, quote: inst.quote } : null;
  const rg = a.register || {};
  const regDate = /^\d{4}-\d{2}-\d{2}$/.test(String(rg.registered_date || '')) && url(rg.url) && new Date(rg.registered_date) <= new Date() ? rg.registered_date : '';
  const register = regDate || String(rg.number || '').trim() ? { court: String(rg.court || '').slice(0, 80), number: String(rg.number || '').slice(0, 40), registered_date: regDate, url: url(rg.url) } : null;
  const u = item.json.usage || {};
  out.push({ json: { lead_key: p.lead_key,
    age_check: JSON.stringify({ founded_year, founded_url: founded_year ? url(a.founded_url) : '', founded_quote: founded_year ? String(a.founded_quote || '').slice(0, 200) : '',
      rounds, institutional, register, hq_country: String(a.hq_country || '').toUpperCase().slice(0, 2), v: 2, model: 'gpt-5-mini', checked_at: new Date().toISOString() }),
    _usage: { input: u.input_tokens || 0, output: u.output_tokens || 0, searches } } });
});
return out;
