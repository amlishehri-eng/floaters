// `npm run demo`: adds 3 clearly FICTIONAL leads on .example domains (flagged demo:true, shown with a DEMO DATA badge)
// so the frontend can be built before real data exists. `npm run demo -- --clear` removes them again.
// These are invented companies. Never put real company names here.
import store from '../src/store.js';
import { makeSignal } from '../src/signals.js';
import { normName } from '../src/normalize.js';
import { signalScore, earliness, applyMultipliers } from '../src/score.js';

const ago = (d) => new Date(Date.now() - d * 86400000).toISOString();

const DEMOS = [
  {
    id: 'demo_lumora', name: 'Lumora Photonics (fictional)', domain: 'lumora-photonics.example',
    signals: [
      makeSignal({ source: 'incubator', type: 'incubator_listing', name: 'Lumora Photonics (fictional)', url: 'https://incubator.example/teams', date: ago(40), data: { pageTitle: 'Example Venture Lab', description: 'Fictional team: chip-scale lidar on silicon photonics.', newOnPage: true } }),
      makeSignal({ source: 'ct', type: 'certificate', domain: 'lumora-photonics.example', url: 'https://lumora-photonics.example', date: ago(75), data: { keyword: 'photon' } }),
      makeSignal({ source: 'github', type: 'github_org', name: 'lumora-photonics', domain: 'lumora-photonics.example', url: 'https://github.example/lumora', date: ago(60), data: { location: 'Garching, Germany', stars: 140, topics: ['photonics', 'lidar'], description: 'Fictional demo org' } }),
    ],
    enrichment: {
      website: { ok: true, title: 'Lumora Photonics (fictional demo)', description: 'Fictional: solid-state lidar on a chip for industrial robots.', text: 'Fictional demo company. Spin-off research prototype, patent pending.' },
      impressum: { url: 'https://lumora-photonics.example/impressum', company: 'Lumora Photonics UG (haftungsbeschränkt) i.G.', legalForm: 'UG (haftungsbeschränkt)', inFounding: true, register: null, court: null, zip: '00000', city: 'Demostadt', directors: ['Demo Founder A', 'Demo Founder B'], vatId: null, germany: true },
      cert: { firstCert: ago(75), certCount: 3, crtshUrl: 'https://crt.sh/', source: 'demo' },
      rdap: { skipped: true, reason: '.example is a reserved demo TLD' },
      press: { count: 0, items: [], fundingHeadlines: [], firstDate: null, query: '"Lumora Photonics"', searchUrl: 'https://news.google.com/' },
    },
    thesis: { sectorFit: 9, techDepth: 9, teamSignals: 7, stageFit: 9, sector: 'Industrial Tech', subsector: 'photonics / lidar', oneLiner: 'FICTIONAL: chip-scale solid-state lidar for industrial robots', stage: 'pre-founding', why: 'Fictional example of an ideal lead: university spin-off, deep photonics IP, no press, company still being founded.', next: 'Demo only: in real life, email the managing directors from the Impressum.' },
  },
  {
    id: 'demo_hydrofix', name: 'Hydrofix Catalysts (fictional)', domain: 'hydrofix.example',
    signals: [
      makeSignal({ source: 'press_release', type: 'text_mention', name: 'Hydrofix Catalysts (fictional)', url: 'https://press.example/release', date: ago(20), data: { institution: 'Example University', evidence: 'Fictional quote: the team founded Hydrofix as an EXIST spin-off.' } }),
      makeSignal({ source: 'ct', type: 'certificate', domain: 'hydrofix.example', url: 'https://hydrofix.example', date: ago(150), data: { keyword: 'hydro' } }),
    ],
    enrichment: {
      website: { ok: true, title: 'Hydrofix (fictional demo)', description: 'Fictional: iridium-free electrolyser catalysts.', text: 'Fictional demo. Research, catalyst, hydrogen, materials.' },
      impressum: { url: 'https://hydrofix.example/impressum', company: 'Hydrofix GmbH', legalForm: 'GmbH', inFounding: false, register: 'HRB 00000', court: 'Amtsgericht Demostadt', zip: '00000', city: 'Demostadt', directors: ['Demo Founder C'], vatId: null, germany: true },
      cert: { firstCert: ago(150), certCount: 2, crtshUrl: 'https://crt.sh/', source: 'demo' },
      rdap: { skipped: true, reason: '.example is a reserved demo TLD' },
      press: { count: 1, items: [{ title: 'Fictional: university team wins hydrogen prize', date: ago(5), url: 'https://news.example/1', source: 'Example News' }], fundingHeadlines: [], firstDate: ago(5), query: '"Hydrofix"', searchUrl: 'https://news.google.com/' },
    },
    thesis: { sectorFit: 9, techDepth: 8, teamSignals: 6, stageFit: 8, sector: 'Climate & Deep Tech', subsector: 'hydrogen / catalysts', oneLiner: 'FICTIONAL: iridium-free catalysts for PEM electrolysers', stage: 'pre-seed', why: 'Fictional example: materials IP with a clear cost lever, found 145 days before its first article.', next: 'Demo only.' },
  },
  {
    id: 'demo_pixelshop', name: 'Pixelshop Agency (fictional)', domain: 'pixelshop.example',
    signals: [
      makeSignal({ source: 'ct', type: 'certificate', domain: 'pixelshop.example', url: 'https://pixelshop.example', date: ago(10), data: { keyword: 'ai' } }),
    ],
    enrichment: {
      website: { ok: true, title: 'Pixelshop (fictional demo)', description: 'Fictional: web design and SEO agency.', text: 'Fictional demo agency. Webdesign, marketing, SEO.' },
      impressum: null,
      cert: { firstCert: ago(2000), certCount: 40, crtshUrl: 'https://crt.sh/', source: 'demo' },
      rdap: { skipped: true, reason: '.example is a reserved demo TLD' },
      press: { count: 0, items: [], fundingHeadlines: [], firstDate: null, query: '"pixelshop.example"', searchUrl: 'https://news.google.com/' },
    },
    thesis: { sectorFit: 1, techDepth: 1, teamSignals: 0, stageFit: 2, sector: 'Other', subsector: 'agency', oneLiner: 'FICTIONAL: a web agency, an example of what the engine filters out', stage: 'unknown', isStartup: false, why: 'Fictional negative example: service business, old domain (cert renewal, not a new company).', next: 'Demo only: reject.' },
  },
];

const clear = process.argv.includes('--clear');
const existing = (await store.listLeads()).filter((l) => !l.demo);
if (clear) {
  await store.saveLeads(existing);
  console.log('Removed demo leads.');
  process.exit(0);
}

const leads = DEMOS.map((d) => {
  const now = new Date().toISOString();
  const lead = {
    id: d.id, name: d.name, nameRank: 9, domain: d.domain, aliases: [normName(d.name)], signals: d.signals, status: 'new', notes: '',
    createdAt: ago(3), updatedAt: now, signalsUpdatedAt: now, enrichedAt: now, enrichment: d.enrichment, demo: true,
  };
  const t = d.thesis;
  const scores = { sectorFit: t.sectorFit, techDepth: t.techDepth, teamSignals: t.teamSignals, stageFit: t.stageFit };
  const base = Object.values(scores).reduce((a, b) => a + b, 0);
  const isStartup = t.isStartup !== false;
  const { pts, multipliers } = applyMultipliers(base, { isStartup, germanyBased: true, alreadyFunded: false });
  const thesis = {
    method: 'demo', model: 'hand-written demo values', pts, base, multipliers, isStartup, oneLiner: t.oneLiner, sector: t.sector, subsector: t.subsector,
    germanyBased: true, stage: t.stage, alreadyFunded: false, scores, team: d.enrichment.impressum?.directors?.length ? `Fictional founders: ${d.enrichment.impressum.directors.join(', ')}` : 'unknown',
    redFlags: isStartup ? [] : ['service business', 'old domain'], whyHTGF: t.why, nextStep: t.next,
  };
  const signal = signalScore(lead);
  lead.score = { total: signal.pts + thesis.pts, signal, thesis, computedAt: now };
  lead.earliness = earliness(lead);
  lead.hidden = !isStartup;
  return lead;
});

await store.saveLeads([...existing, ...leads]);
console.log(`Seeded ${leads.length} FICTIONAL demo leads (.example domains, DEMO DATA badge): ${leads.map((l) => `${l.name} ${l.score.total}`).join(', ')}`);
console.log('The agency one is hidden by default (isStartup=false); see it with GET /api/leads?all=1. Remove all with: npm run demo -- --clear');
