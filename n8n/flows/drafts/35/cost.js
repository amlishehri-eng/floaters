// Tokens, web searches and cost of this run -> one row in the Run costs table. gpt-5-mini: $0.25 per million input,
// $2 per million output; OpenAI web search $10 per 1,000 calls.
let input = 0, output = 0, calls = 0, searches = 0;
for (const it of $input.all()) { const u = it.json._usage || {}; if (u.input || u.output) { calls++; input += u.input || 0; output += u.output || 0; searches += u.searches || 0; } }
return [{ json: { run_at: new Date().toISOString(), flow: '35 Age and funding check', step: 'web check', model: 'gpt-5-mini', calls, input_tokens: input, output_tokens: output, web_searches: searches,
  usd: Math.round((input * 0.25e-6 + output * 2e-6 + searches * 0.01) * 10000) / 10000, seconds: null, execution_id: String($execution.id) } }];
