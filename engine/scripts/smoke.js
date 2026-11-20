// Offline smoke test: no network, no keys. Run after every change: `npm run smoke`.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'htgf-smoke-'));
process.env.DB_FILE = path.join(tmp, 'db.json');
process.env.CT_FILE = path.join(tmp, 'ct.jsonl');
process.env.NO_LLM = '1';

const { filterCtDomain, extractCtDomains } = await import('../src/ct-filter.js');
const { normDomain, normName, domainLabel, cleanName, isGenericName } = await import('../src/normalize.js');
const { parseImpressum } = await import('../src/impressum.js');
const { mergeSignals } = await import('../src/merge.js');
const { makeSignal } = await import('../src/signals.js');
const { scoreLead, signalScore, earliness, applyMultipliers } = await import('../src/score.js');
const { parseJsonLoose } = await import('../src/llm.js');
const { isNoiseOrg } = await import('../src/sources/github.js');
const { store } = await import('../src/store.js');

let passed = 0;
function test(name, fn) {
  try {
    const r = fn();
    if (r instanceof Promise) return r.then(() => { passed++; console.log('  ok', name); }, (e) => { console.error('  FAIL', name, '\n', e); process.exitCode = 1; });
    passed++;
    console.log('  ok', name);
  } catch (e) {
    console.error('  FAIL', name, '\n', e);
    process.exitCode = 1;
  }
}

console.log('CT filter');
test('keeps sector landing pages', () => {
  assert.equal(filterCtDomain('quantumfab.de')?.domain, 'quantumfab.de');
  assert.equal(filterCtDomain('www.robotik-werk.io')?.keyword, 'robot');
  assert.equal(filterCtDomain('app.hydrogenix.energy')?.domain, 'hydrogenix.energy');
  assert.equal(filterCtDomain('*.photonlabs.tech')?.domain, 'photonlabs.tech');
  assert.equal(filterCtDomain('visionai.de')?.keyword, 'ai');
  assert.equal(filterCtDomain('ai-pathology.de')?.keyword, 'ai');
});
test('drops junk, deep subdomains, wrong TLDs, false short keywords', () => {
  assert.equal(filterCtDomain('mail.quantumfab.de'), null);
  assert.equal(filterCtDomain('api.quantumfab.de'), null);
  assert.equal(filterCtDomain('casino-robot.de'), null);
  assert.equal(filterCtDomain('bioladen-mueller.de'), null);
  assert.equal(filterCtDomain('robotics.com'), null);
  assert.equal(filterCtDomain('restaurant-thai.de'), null);
  assert.equal(filterCtDomain('thai.de'), null);
  assert.equal(filterCtDomain('dubai.de'), null);
  assert.equal(filterCtDomain('immobilien-sensor.de'), null);
  assert.equal(filterCtDomain('xk7f93hq-bio.de'), null);
});
test('parses both certstream formats', () => {
  const full = extractCtDomains({ message_type: 'certificate_update', data: { seen: 1763600000.5, leaf_cert: { all_domains: ['quantumfab.de', 'www.quantumfab.de'], issuer: { O: "Let's Encrypt" }, not_before: 1763500000 } } });
  assert.deepEqual(full.domains, ['quantumfab.de', 'www.quantumfab.de']);
  assert.equal(full.issuer, "Let's Encrypt");
  const lite = extractCtDomains({ message_type: 'dns_entries', data: ['a-robotics.de'] });
  assert.deepEqual(lite.domains, ['a-robotics.de']);
  assert.equal(extractCtDomains({ message_type: 'heartbeat' }), null);
});

console.log('Normalisation');
test('domains', () => {
  assert.equal(normDomain('https://www.QuantumFab.de/de/impressum'), 'quantumfab.de');
  assert.equal(normDomain('app.quantumfab.de'), 'quantumfab.de');
  assert.equal(normDomain('quantumfab.github.io'), 'quantumfab.github.io');
  assert.equal(normDomain('https://foo-bar.vercel.app/x'), 'foo-bar.vercel.app');
  assert.equal(normDomain('https://www.linkedin.com/company/quantumfab'), null);
  assert.equal(normDomain('github.com/quantumfab'), null);
  assert.equal(normDomain('https://www.tum.de/x'), null);
  assert.equal(normDomain('shop.example.co.uk'), 'example.co.uk');
  assert.equal(normDomain('info@quantumfab.de'), 'quantumfab.de');
  assert.equal(normDomain(''), null);
  assert.equal(domainLabel('quantumfab.de'), 'quantumfab');
  assert.equal(domainLabel('quantum-fab.github.io'), 'quantumfab');
});
test('names', () => {
  assert.equal(normName('QuantumFab UG (haftungsbeschränkt) i.G.'), 'quantumfab');
  assert.equal(normName('Quantum Fab GmbH'), 'quantumfab');
  assert.equal(normName('Müller Robotics GmbH & Co. KG'), 'muellerrobotics');
  assert.equal(normName('Acme Inc.'), 'acme');
  assert.equal(cleanName('QuantumFab UG (haftungsbeschränkt) i.G.'), 'QuantumFab');
  assert.equal(normName('EV Charging GmbH'), 'evcharging');
  assert.ok(isGenericName('Robotics'));
  assert.ok(!isGenericName('QuantumFab'));
});
test('GitHub noise filter uses word boundaries', () => {
  assert.ok(isNoiseOrg('tum-uni-course-ws24'));
  assert.ok(isNoiseOrg('hackathon-berlin-2026'));
  assert.ok(isNoiseOrg('team1-robotics'));
  assert.ok(isNoiseOrg('ml-seminar'));
  assert.ok(!isNoiseOrg('unicorn-robotics'));
  assert.ok(!isNoiseOrg('quantumfab'));
  assert.ok(!isNoiseOrg('testudo-sensors'));
});

console.log('Impressum');
const IMPRESSUM = `Impressum
Angaben gemäß § 5 TMG
QuantumFab UG (haftungsbeschränkt) i.G.
Lichtenbergstraße 6
85748 Garching bei München
Deutschland
Vertreten durch die Geschäftsführer: Dr. Anna Beispiel, Max Mustermann
Kontakt: Telefon: +49 89 12345 678
E-Mail: hello@quantumfab.de
Registereintrag:
Registergericht: Amtsgericht München
Registernummer: HRB 289123
Umsatzsteuer-ID: DE 123 456 789`;
test('parses UG i.G., HRB, Amtsgericht München, Garching bei München, two directors', () => {
  const p = parseImpressum(IMPRESSUM);
  assert.equal(p.legalForm, 'UG (haftungsbeschränkt)');
  assert.equal(p.inFounding, true);
  assert.equal(p.company, 'QuantumFab UG (haftungsbeschränkt) i.G.');
  assert.equal(p.register, 'HRB 289123');
  assert.equal(p.court, 'Amtsgericht München');
  assert.equal(p.zip, '85748');
  assert.equal(p.city, 'Garching bei München');
  assert.deepEqual(p.directors, ['Dr. Anna Beispiel', 'Max Mustermann']);
  assert.equal(p.vatId, 'DE123456789');
  assert.equal(p.germany, true);
});
test('register number is not mistaken for a PLZ; Amtsgericht with suffix', () => {
  const p = parseImpressum('Robo Werk GmbH\nHandelsregister: HRB 12345 Berlin\nAmtsgericht Charlottenburg (Berlin)\nFriedrichstr. 1, 10117 Berlin\nGeschäftsführer:\nJane Example');
  assert.equal(p.zip, '10117');
  assert.equal(p.city, 'Berlin');
  assert.equal(p.court, 'Amtsgericht Charlottenburg (Berlin)');
  assert.deepEqual(p.directors, ['Jane Example']);
  assert.equal(p.legalForm, 'GmbH');
  assert.equal(p.inFounding, false);
});

console.log('Merge + scoring');
const sigIncubator = makeSignal({ source: 'incubator', type: 'incubator_listing', name: 'QuantumFab', url: 'https://www.venturelabs.tum.de/labs/robotics-ai/', date: '2026-09-01', data: { description: 'Quantum sensor fabrication', pageTitle: 'TUM Venture Lab Robotics/AI', newOnPage: true } });
const sigGithub = makeSignal({ source: 'github', type: 'github_org', name: 'QuantumFab GmbH', domain: 'https://www.quantumfab.de', url: 'https://github.com/quantumfab', date: '2026-08-10', data: { login: 'quantumfab', location: 'Munich, Germany', stars: 120, topics: ['quantum-computing'] } });
const sigCt = makeSignal({ source: 'ct', type: 'certificate', domain: 'app.quantumfab.de', url: 'https://app.quantumfab.de', date: '2026-07-20', data: { keyword: 'quantum' } });
test('incubator name-only + GitHub org with domain + CT merge into ONE lead', () => {
  for (const order of [[sigIncubator, sigGithub, sigCt], [sigCt, sigIncubator, sigGithub], [sigIncubator, sigCt, sigGithub]]) {
    const leads = [];
    mergeSignals(leads, order.slice(0, 1));
    mergeSignals(leads, order.slice(1));
    assert.equal(leads.length, 1, `order ${order.map((s) => s.source)}`);
    assert.equal(leads[0].domain, 'quantumfab.de');
    assert.equal(leads[0].signals.length, 3);
    assert.equal(leads[0].name, 'QuantumFab'); // incubator name wins over GitHub/domain
  }
});
test('same name, different domains stay separate; re-merge is idempotent', () => {
  const leads = [];
  mergeSignals(leads, [makeSignal({ source: 'github', type: 'github_org', name: 'Nova', domain: 'nova-a.de', url: 'u1' }), makeSignal({ source: 'github', type: 'github_org', name: 'Nova', domain: 'nova-b.io', url: 'u2' })]);
  assert.equal(leads.length, 2);
  const r = mergeSignals(leads, [makeSignal({ source: 'github', type: 'github_org', name: 'Nova', domain: 'nova-a.de', url: 'u1' })]);
  assert.equal(leads.length, 2);
  assert.equal(r.created.size, 0);
  assert.equal(leads.find((l) => l.domain === 'nova-a.de').signals.length, 1);
});

await test('scoring is explainable and in range', async () => {
  const leads = [];
  mergeSignals(leads, [sigIncubator, sigGithub, sigCt]);
  const lead = leads[0];
  lead.enrichment = {
    website: { ok: true, title: 'QuantumFab - quantum sensors', description: 'Spin-off of TUM building quantum sensors for chip inspection.', text: 'We are a TUM spin-off. Research, patent pending, prototype.' },
    impressum: parseImpressum(IMPRESSUM),
    cert: { firstCert: new Date(Date.now() - 60 * 86400000).toISOString() },
    press: { count: 0, items: [], fundingHeadlines: [], firstDate: null },
  };
  const s = signalScore(lead);
  const keys = s.parts.map((p) => p.key);
  for (const k of ['sources', 'newDomain', 'german', 'inFounding', 'ug', 'github', 'newOnPage', 'noPress']) assert.ok(keys.includes(k), `missing ${k}`);
  assert.equal(s.parts.find((p) => p.key === 'sources').pts, 36);
  assert.equal(s.pts, 60); // capped
  for (const p of s.parts) assert.ok(typeof p.why === 'string' && p.why.length > 3);

  await scoreLead(lead, { useLlm: false });
  assert.ok(lead.score.total > 60 && lead.score.total <= 80, `total ${lead.score.total}`);
  assert.equal(lead.score.thesis.method, 'keywords');
  assert.ok(lead.score.thesis.pts <= 20);
  assert.equal(lead.score.thesis.sector, 'Climate & Deep Tech');
  assert.equal(lead.hidden, false);

  lead.enrichment.press = { count: 2, firstDate: '2026-11-01T00:00:00.000Z', items: [], fundingHeadlines: [{ title: 'QuantumFab raises €3M seed' }] };
  const s2 = signalScore(lead);
  assert.equal(s2.parts.find((p) => p.key === 'funded').pts, -15);
  const e = earliness(lead);
  const expected = [lead.enrichment.cert.firstCert, sigCt.date, sigGithub.date, sigIncubator.date].sort()[0];
  assert.equal(e.firstSeen, expected);
  assert.ok(e.leadTimeDays > 0);
  assert.match(e.summary, /days before first press/);
});
test('multipliers', () => {
  assert.equal(applyMultipliers(30, { isStartup: false }).pts, 6);
  assert.equal(applyMultipliers(30, { alreadyFunded: true, germanyBased: false }).pts, 9);
});
test('tolerant JSON parsing', () => {
  assert.deepEqual(parseJsonLoose('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(parseJsonLoose('Sure! Here you go: [{"name":"X",}] hope it helps'), [{ name: 'X' }]);
  assert.equal(parseJsonLoose('nothing here'), null);
});
await test('store round trip', async () => {
  await store.upsertLead({ id: 'ld_test', name: 'T', signals: [], aliases: [] });
  store._reset();
  assert.equal((await store.getLead('ld_test')).name, 'T');
  await store.setMeta('k', 5);
  store._reset();
  assert.equal(await store.getMeta('k'), 5);
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(process.exitCode ? '\nSMOKE FAILED' : `\nSMOKE OK (${passed} tests)`);
