// Offline test of the brain: runs the full pipeline on data/traces.sample.json with a fake llm,
// checks convergence, then writes the result to data/leads.sample.json (the mock /api/brain/run serves).
// Run: node scripts/test-brain.mjs   (no API key needed, no network)
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { runBrain } from "../lib/ai/brain/run.js";

const TODAY = "2026-11-20";
const traces = JSON.parse(readFileSync(new URL("../data/traces.sample.json", import.meta.url), "utf8"));
const extractions = new Map(traces.map((t) => [t.id, JSON.parse(t.extraction)]));

const usage = (model, input_tokens, output_tokens, web_search_calls = 0) => ({
  model,
  input_tokens,
  cached_tokens: 0,
  output_tokens,
  web_search_calls,
});

// Scores per team for the fake scorer: [fit points by criterion, team points by criterion].
const FAKE_SCORES = {
  kelvio: {
    fit: [20, 25, 22, 15, 15],
    team: [28, 14, 20, 15, 0],
    fit_reason: "Munich industrial-heat storage with real hardware, pre-company, EXIST-funded only.",
    team_reason: "Two technical founders from the same TUM chair, PhD-level research, no business co-founder yet.",
  },
  synthera: {
    fit: [20, 25, 23, 15, 15],
    team: [20, 0, 15, 15, 0],
    fit_reason: "LMU protein-design spin-out in life sciences/chemistry, prototype with pilot labs, no funding.",
    team_reason: "Strong research team, but they are still looking for a technical co-founder.",
  },
  gripr: {
    fit: [20, 25, 18, 15, 10],
    team: [28, 20, 15, 8, 0],
    fit_reason: "Munich robotics for manufacturing, GmbH just founded, pre-seed raise planned.",
    team_reason: "Robotics PhD plus ex-Siemens product lead, built and won the makeathon together.",
  },
};
const POINT_KEYS = {
  fit: ["germany", "sector", "tech_depth", "stage", "no_funding"],
  team: ["technical_founder", "complementary_roles", "worked_together", "deep_research", "earlier_startup"],
};
const points = (kind, values) =>
  Object.fromEntries(POINT_KEYS[kind].map((k, i) => [k, { points: values[i], why: `fake ${k}` }]));

const calls = [];
async function fakeLlm(args) {
  calls.push(args.step);
  switch (args.step) {
    case "extract":
      return { data: extractions.get(args.trace.id), usage: usage(args.model, 1400, 520) };
    case "same":
      return {
        data: { same: false, why: "different surname and a different project (app agency vs. thermal storage)" },
        usage: usage(args.model, 380, 40),
      };
    case "filter": {
      const text = args.input;
      const result = /Praktikum|Lehrstuhl/.test(text)
        ? { label: "assignment", label_reason: "Praktikum supervised by an LMU chair, ends with the WS26 semester." }
        : /develop apps for you|Day rates/.test(text)
          ? { label: "agency", label_reason: "Builds apps for clients at day rates." }
          : /for fun/i.test(text)
            ? { label: "hobby", label_reason: "One person, a weekend project 'just for fun', no users." }
            : { label: "vc_backable", label_reason: "Technical team of two or more building a product for a market, with intent to found." };
      return { data: result, usage: usage(args.model, 1900, 60) };
    }
    case "score": {
      const s = FAKE_SCORES[args.lead.id.replace("lead:", "")];
      assert.ok(s, `no fake scores for ${args.lead.id}`);
      return {
        data: { fit: points("fit", s.fit), team: points("team", s.team), fit_reason: s.fit_reason, team_reason: s.team_reason },
        usage: usage(args.model, 2600, 900),
      };
    }
    case "days_ahead": {
      const found =
        args.lead.id === "lead:gripr"
          ? {
              first_public_at: "2026-10-15",
              first_public_url: "https://news.example.com/2026/10/gripr-robotics-munich",
              on_crunchbase: true,
              funding_announced: false,
              note: "Startup news article on Gripr's makeathon win and GmbH founding.",
            }
          : { first_public_at: null, first_public_url: null, on_crunchbase: false, funding_announced: false, note: "No press, Crunchbase or funding mention found." };
      return { data: found, usage: usage(args.model, 9500, 350, 3) };
    }
    default:
      throw new Error(`unexpected step ${args.step}`);
  }
}

// Run 1: all 10 sample traces. One trace has no extraction yet, so step 1 runs once.
const NEEDS_EXTRACTION = "campus:tum-news-exist-2026-10";
const input = traces.map((t) => (t.id === NEEDS_EXTRACTION ? { ...t, extraction: "" } : t));
const out = await runBrain({ traces: input }, { llm: fakeLlm, today: TODAY });

const lead = (id) => out.leads.find((l) => l.id === id);
assert.deepEqual(out.errors, []);
assert.equal(out.funnel.traces, 10);
assert.equal(out.funnel.teams, 6, `expected 6 teams, got ${out.leads.map((l) => l.id).join(", ")}`);
assert.equal(lead("lead:kelvio").source_count, 3);
assert.deepEqual(
  lead("lead:kelvio").signals.filter((s) => s.trace_id).map((s) => s.trace_id).filter((v, i, a) => a.indexOf(v) === i).sort(),
  ["campus:tum-news-exist-2026-10", "github:org-kelvio", "luma:evt-mdt-autumn26"],
);
assert.ok(lead("lead:synthera").signals.some((s) => s.trace_id === "huggingface:synthera-bio/enzymediff-v1"));
assert.ok(lead("lead:synthera").signals.some((s) => s.timestamp === "12:04" && s.kind === "looking_for_cofounder"));
assert.ok(lead("lead:gripr").signals.some((s) => s.trace_id === "github:org-gripr"));
assert.equal(lead("lead:gripr").name, "Gripr");
assert.equal(calls.filter((c) => c === "extract").length, 1, "only the trace without extraction is extracted");
assert.equal(calls.filter((c) => c === "same").length, 1, "Jonas Weber vs Jonas Weger is checked once and rejected");
assert.equal(out.trace_updates.length, 10);
assert.deepEqual(
  Object.fromEntries(out.leads.map((l) => [l.id, l.label])),
  {
    "lead:kelvio": "vc_backable",
    "lead:gripr": "vc_backable",
    "lead:synthera": "vc_backable",
    "lead:appwerkstudio": "agency",
    "lead:medimate": "assignment",
    "lead:plantbot": "hobby",
  },
);
assert.equal(lead("lead:gripr").days_ahead, daysBetween("2026-06-14", "2026-10-15"));
assert.equal(lead("lead:kelvio").still_invisible, true);
assert.equal(lead("lead:kelvio").days_ahead, daysBetween("2026-08-02", TODAY));
assert.equal(out.funnel.worth_a_call, 2);
assert.ok(lead("lead:kelvio").people.find((p) => p.handle === "lmueller")?.links.includes("https://github.com/lmueller"));
assert.equal(typeof out.rows[0].signals, "string", "rows are flattened for n8n");

// Run 2, the way n8n calls it: only one new trace (status=new) + the Leads table as flat rows.
calls.length = 0;
const newTrace = {
  id: "luma:evt-pitch-night-nov26",
  source: "luma",
  url: "https://lu.ma/munich-pitch-night-nov26",
  happened_at: "2026-11-12",
  found_at: "2026-11-20T07:00:00Z",
  title: "Munich Pitch Night #31",
  text: "Synthera (Aylin Kaya, LMU): enzymes designed by AI that eat plastic.",
  people: "Aylin Kaya (@aylinkaya)",
  org_name: "Synthera",
  city: "Munich",
  status: "new",
  extraction: JSON.stringify({
    projects: [
      {
        name: "Synthera",
        what: "AI-designed enzymes that break down plastic.",
        sector: "life sciences",
        city: "Munich",
        country: "DE",
        stage: "prototype",
        people: [{ name: "Aylin Kaya", handle: "aylinkaya", role: "founder", affiliation: "LMU", links: [] }],
        quotes: [],
        funding_mentioned: { mentioned: false, what: null },
      },
    ],
  }),
};
const out2 = await runBrain({ traces: [newTrace], previous_leads: out.rows }, { llm: fakeLlm, today: TODAY });
assert.deepEqual(out2.errors, []);
assert.equal(out2.funnel.teams, 6, "the new trace joins Synthera, no new team");
assert.equal(out2.leads.find((l) => l.id === "lead:synthera").source_count, 3);
assert.equal(out2.leads.find((l) => l.id === "lead:kelvio").evidence_hash, lead("lead:kelvio").evidence_hash);
assert.deepEqual(calls.sort(), ["days_ahead", "filter", "score"], "only Synthera is re-judged");

writeFileSync(
  new URL("../data/leads.sample.json", import.meta.url),
  JSON.stringify({ note: "Made-up sample run (scripts/test-brain.mjs, fake LLM). Served by /api/brain/run when mocked.", ...out }, null, 2) + "\n",
);
console.log("brain test passed");
console.log("funnel", out.funnel);
console.log("cost", { total_usd: out.cost.total_usd, per_trace_usd: out.cost.per_trace_usd, per_lead_usd: out.cost.per_lead_usd });
console.log("wrote data/leads.sample.json");

function daysBetween(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
}
