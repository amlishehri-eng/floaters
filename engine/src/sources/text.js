// Generic text source (POST /api/candidates with {text}): university press releases (idw RSS via n8n),
// podcast transcripts, competition finalist lists. The LLM extracts NEW ventures; regex fallback without a key.
import { makeSignal } from '../signals.js';
import { completeJson, llmProvider } from '../llm.js';
import { normDomain, cleanName, normName } from '../normalize.js';
import { truncate } from '../util.js';

const SYSTEM = `You read German or English texts (university press releases, podcast transcripts, competition finalist lists)
and extract NEW tech ventures mentioned in them: start-ups, spin-offs, founding teams (also pre-incorporation, e.g. EXIST teams).
Skip established companies, universities, institutes, investors and sponsors. Never invent websites. Respond with JSON only.`;

const PROMPT = (t) => `Source: ${t.source || 'text'}${t.url ? ` (${t.url})` : ''}${t.title ? `\nTitle: ${t.title}` : ''}
"""
${truncate(t.text, 16000)}
"""
Return {"ventures": [{"name": "...", "website": "only if in the text, else null", "description": "max 25 words", "institution": "university/institute if mentioned, else null", "evidence": "short verbatim quote (max 25 words) that shows it is a new venture"}]}. Return {"ventures": []} if none.`;

const VENTURE_CONTEXT = /(ausgr[üu]ndung|spin-?off|start-?up|gr[üu]nderteam|gr[üu]ndungsteam|exist|gegr[üu]ndet|founded|founding team|finalist)/i;

/** Regex fallback: "XYZ GmbH/UG", „XYZ“ near start-up words, and domains in the text. */
export function regexVentures(text) {
  const out = new Map();
  const add = (name, website, evidence) => {
    const key = normName(name) || normDomain(website);
    if (!key || out.has(key)) return;
    out.set(key, { name: name ? cleanName(name) : null, website: website || null, description: null, institution: null, evidence: truncate(evidence, 160) });
  };
  const sentences = String(text).split(/(?<=[.!?])\s+/);
  for (const s of sentences) {
    if (!VENTURE_CONTEXT.test(s)) continue;
    for (const m of s.matchAll(/([A-ZÄÖÜ][\w&.-]+(?:\s[A-ZÄÖÜ][\w&.-]+){0,2})\s+(GmbH|UG(?:\s*\(haftungsbeschränkt\))?|AG)\b/g)) add(m[1], null, s);
    for (const m of s.matchAll(/[„"“']([A-ZÄÖÜ][\w .&-]{2,30})[“"”']/g)) add(m[1], null, s);
    for (const m of s.matchAll(/\b((?:https?:\/\/)?(?:www\.)?[a-z0-9-]{3,40}\.(?:de|ai|io|tech|bio|eu|app|dev|energy|health|science|com))\b/gi)) {
      if (normDomain(m[1])) add(null, m[1], s);
    }
  }
  return [...out.values()];
}

/** @param {{text:string,url?:string,source?:string,date?:string,title?:string}} item */
export async function signalsFromText(item) {
  let ventures;
  let method = 'regex';
  let error = null;
  if (llmProvider() !== 'none') {
    try {
      const r = await completeJson({ system: SYSTEM, prompt: PROMPT(item), maxTokens: 6000 });
      ventures = Array.isArray(r) ? r : r.ventures || [];
      method = 'llm';
    } catch (e) {
      error = e.message;
    }
  }
  if (!ventures) ventures = regexVentures(`${item.title || ''}. ${item.text || ''}`);
  const source = item.source || 'text';
  const signals = ventures
    .filter((v) => v && (v.name || v.website))
    .map((v) => makeSignal({
      source, type: 'text_mention', name: v.name, domain: normDomain(v.website) || undefined, url: item.url, date: item.date,
      data: { title: item.title || null, description: v.description || null, institution: v.institution || null, evidence: v.evidence || null, extractedBy: method },
    }));
  return { signals, method, error };
}
