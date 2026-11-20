// Tokens and cost of this run -> one row in the Run costs table (funnel stats). gpt-5-mini: $0.25 per million input, $2 per million output.
let input = 0, output = 0, calls = 0;
for (const it of $input.all()) { const u = it.json._usage || {}; if (u.input || u.output) { calls++; input += u.input || 0; output += u.output || 0; } }
return [{ json: { run_at: new Date().toISOString(), flow: '33 Capital need', step: 'capital need', model: 'gpt-5-mini', calls, input_tokens: input, output_tokens: output, web_searches: 0,
  usd: Math.round((input * 0.25e-6 + output * 2e-6) * 10000) / 10000, seconds: null, execution_id: String($execution.id) } }];
