// USE_MOCKS=true skips every external API and serves the files in /data (demo safety net).
export function mocksEnabled() {
  return process.env.USE_MOCKS === "true";
}

// What every helper returns when the real call fails: the mock, flagged so the UI can show "offline mode".
export function mockFallback(mock, service, err) {
  console.error(`[${service}] falling back to mock:`, err);
  return { ...mock, mocked: true, error: `${service} unavailable, showing mock data` };
}
