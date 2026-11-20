// Morning briefing: top 5 leads -> 150-200 word spoken German script (LLM or template) -> ElevenLabs TTS -> public/briefing-YYYY-MM-DD.mp3
// CLI: `npm run briefing`
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config.js';
import store from './store.js';
import { complete, llmProvider, llmLabel } from './llm.js';
import { truncate } from './util.js';

function topLeads(leads, n = 5) {
  const real = leads.filter((l) => !l.hidden && l.score && !l.demo && l.status !== 'rejected');
  const pool = real.length >= 3 ? real : leads.filter((l) => !l.hidden && l.score && l.status !== 'rejected');
  return pool.sort((a, b) => b.score.total - a.score.total).slice(0, n);
}

function leadFacts(l, i) {
  const e = l.enrichment || {};
  const t = l.score.thesis || {};
  return `${i + 1}. ${l.name}${l.domain ? ` (${l.domain})` : ''}${l.demo ? ' [FIKTIVE DEMO-DATEN]' : ''}
   Score ${l.score.total}/100 (Signale ${l.score.signal.pts}, These ${t.pts}); Sektor: ${t.sector || '?'} ${t.subsector || ''}
   Was: ${truncate(t.oneLiner || e.website?.description || '', 200)}
   Ort: ${e.impressum?.city || '?'}; Rechtsform: ${e.impressum?.legalForm || '?'}${e.impressum?.inFounding ? ' i.G.' : ''}
   Quellen: ${[...new Set(l.signals.map((s) => s.source))].join(', ')}
   Früheste Spur: ${l.earliness?.firstSeen?.slice(0, 10) || '?'} (${l.earliness?.firstSeenLabel || ''}); ${l.earliness?.summary || ''}
   Warum HTGF: ${truncate(t.whyHTGF || '', 300)}
   Nächster Schritt: ${truncate(t.nextStep || '', 200)}`;
}

const SYSTEM = `Du schreibst ein gesprochenes Morgen-Briefing (Audio) für ein Investment-Team des High-Tech Gründerfonds.
Deutsch, 150 bis 200 Wörter, natürliche gesprochene Sprache, keine Aufzählungszeichen, keine Markdown-Formatierung, keine URLs vorlesen.
Nur Fakten aus den gelieferten Daten. Zahlen ausschreiben, wo es beim Vorlesen hilft.`;

const PROMPT = (facts, date) => `Datum: ${date}. Die Top-Leads aus der Sourcing-Engine:

${facts}

Aufbau: kurzer Überblick (wie viele Leads, was auffällt), dann pro Lead in ein bis zwei Sätzen was sie bauen, warum HTGF, wie früh wir dran sind und den nächsten Schritt, zum Schluss: welchen Lead das Team heute zuerst anrufen soll und warum.
Wenn Leads als fiktive Demo-Daten markiert sind, sag das am Anfang.`;

function templateScript(leads, date) {
  if (!leads.length) return `Guten Morgen. Am ${date} gibt es noch keine bewerteten Leads. Startet einen Sourcing-Lauf, dann melde ich mich mit den besten Kandidaten.`;
  const demo = leads.some((l) => l.demo) ? ' Hinweis: einige Einträge sind fiktive Demo-Daten.' : '';
  const parts = leads.map((l, i) => {
    const t = l.score.thesis || {};
    const early = l.earliness?.noPressYet ? 'noch ohne Presse' : l.earliness?.leadTimeDays != null ? `${l.earliness.leadTimeDays} Tage vor der ersten Presse entdeckt` : 'Presse ungeprüft';
    return `Platz ${i + 1}: ${l.name}, Score ${l.score.total}. ${truncate(t.oneLiner || 'Ein junges Tech-Team', 140)}. Sektor ${t.sector || 'unklar'}, ${early}.`;
  });
  return `Guten Morgen, hier ist das Sourcing-Briefing vom ${date}.${demo} Heute stehen ${leads.length} Leads oben auf der Liste. ${parts.join(' ')} Mein Vorschlag: ruft zuerst ${leads[0].name} an. ${truncate(leads[0].score.thesis?.nextStep || '', 160)}`;
}

async function tts(text, file) {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.elevenlabs.voiceId}`, {
    method: 'POST',
    headers: { 'xi-api-key': config.elevenlabs.key, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: config.elevenlabs.model, voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 200)}`);
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

export async function createBriefing() {
  const date = new Date().toISOString().slice(0, 10);
  const leads = topLeads(await store.listLeads());
  const out = { date, createdAt: new Date().toISOString(), leadIds: leads.map((l) => l.id), leadNames: leads.map((l) => l.name), script: '', scriptBy: '', audioUrl: null, errors: [] };

  if (leads.length && llmProvider() !== 'none') {
    try {
      out.script = (await complete({ system: SYSTEM, prompt: PROMPT(leads.map(leadFacts).join('\n\n'), date), maxTokens: 4000, effort: 'medium' })).trim();
      out.scriptBy = llmLabel();
    } catch (e) {
      out.errors.push(`LLM: ${e.message}`);
    }
  }
  if (!out.script) {
    out.script = templateScript(leads, date);
    out.scriptBy = 'template';
  }
  out.words = out.script.split(/\s+/).length;

  if (config.elevenlabs.key) {
    const name = `briefing-${date}.mp3`;
    try {
      await tts(out.script, path.join(config.publicDir, name));
      out.audioUrl = `/${name}?t=${Date.now()}`;
    } catch (e) {
      out.errors.push(`TTS: ${e.message}`);
    }
  } else {
    out.errors.push('TTS: no ELEVENLABS_API_KEY set, script only (the dashboard can read it with the browser voice)');
  }
  await store.setMeta('lastBriefing', out);
  return out;
}

export async function latestBriefing() {
  return store.getMeta('lastBriefing', null);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const b = await createBriefing();
  console.log(`\n${b.script}\n\n(${b.words} words, script by ${b.scriptBy}${b.audioUrl ? `, audio: public${b.audioUrl.split('?')[0]}` : ''})`);
  if (b.errors.length) console.log('Notes:', b.errors.join(' | '));
}
