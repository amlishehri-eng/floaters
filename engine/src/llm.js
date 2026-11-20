// LLM access: Anthropic if ANTHROPIC_API_KEY, else OpenAI if OPENAI_API_KEY, else none (callers use keyword fallbacks).
// Plain fetch, no SDK, to keep the engine dependency-free.
import config from '../config.js';

let runtimeDisabled = false;

export function setLlmDisabled(v) {
  runtimeDisabled = Boolean(v);
}

export function llmProvider() {
  if (runtimeDisabled || config.llm.disabled) return 'none';
  if (config.llm.anthropicKey) return 'anthropic';
  if (config.llm.openaiKey) return 'openai';
  return 'none';
}

export function llmLabel() {
  const p = llmProvider();
  if (p === 'anthropic') return `Claude (${config.llm.anthropicModel})`;
  if (p === 'openai') return `OpenAI (${config.llm.openaiModel})`;
  return 'keyword fallback (no LLM key)';
}

async function anthropic({ system, prompt, maxTokens, effort }) {
  const body = {
    model: config.llm.anthropicModel,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
    output_config: { effort },
    // Server-side refusal fallback (routes a declined request to another model in the same call).
    fallbacks: 'default',
  };
  const headers = {
    'x-api-key': config.llm.anthropicKey,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'server-side-fallback-2026-07-01',
    'content-type': 'application/json',
  };
  let res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(120000),
  });
  if (res.status === 400) {
    // Older models / accounts may reject the beta fallback or effort fields: retry plain.
    const err = await res.text();
    if (/fallback|output_config|effort|beta/i.test(err)) {
      delete body.fallbacks;
      delete body.output_config;
      delete headers['anthropic-beta'];
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST', headers, body: JSON.stringify(body), signal: AbortSignal.timeout(120000),
      });
    } else {
      throw new Error(`Anthropic 400: ${err.slice(0, 300)}`);
    }
  }
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  if (json.stop_reason === 'refusal') throw new Error(`Anthropic refused (${json.stop_details?.category || 'no category'})`);
  return (json.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function openai({ system, prompt, maxTokens, json: wantJson }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${config.llm.openaiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: config.llm.openaiModel,
      max_completion_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }],
      ...(wantJson ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return json.choices?.[0]?.message?.content || '';
}

/** Returns the model's text. Throws if no provider or the call fails (callers fall back). */
export async function complete({ system, prompt, maxTokens = 16000, effort = 'low', json = false }) {
  const p = llmProvider();
  if (p === 'anthropic') return anthropic({ system, prompt, maxTokens, effort });
  // OpenAI json_object mode needs an object at the top level; callers that want arrays wrap them.
  if (p === 'openai') return openai({ system, prompt, maxTokens, json });
  throw new Error('no LLM configured');
}

/** Tolerant JSON parsing: strips ``` fences and prose around the first {...} or [...]. */
export function parseJsonLoose(text) {
  if (text == null) return null;
  let s = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  try { return JSON.parse(s); } catch { /* keep going */ }
  const starts = [s.indexOf('{'), s.indexOf('[')].filter((i) => i >= 0);
  if (!starts.length) return null;
  const start = Math.min(...starts);
  const end = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
  if (end <= start) return null;
  s = s.slice(start, end + 1);
  try { return JSON.parse(s); } catch { /* trailing commas? */ }
  try { return JSON.parse(s.replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
}

export async function completeJson(opts) {
  const text = await complete({ ...opts, json: true });
  const parsed = parseJsonLoose(text);
  if (parsed == null) throw new Error(`LLM returned no parseable JSON: ${text.slice(0, 160)}`);
  return parsed;
}
