// Signal vocabulary shared by sources, merge, scoring and the UI.
// A signal: { source, type, name?, domain?, url, date, data }
// Only sig.domain identifies a company; sig.url is where we saw it.

// Independent source families. Signals from the same family count once in scoring.
const FAMILY = {
  github: 'Code',
  ct: 'Web infra',
  incubator: 'Incubator',
  press_release: 'University news',
  idw: 'University news',
  university: 'University news',
  podcast: 'Podcast',
  competition: 'Competition',
  text: 'Web text',
  manual: null, // a human typed it in: not independent evidence
  demo: null,
};

export function familyOf(source) {
  if (!source) return null;
  return source in FAMILY ? FAMILY[source] : String(source);
}

// How "official" a name from this signal is (higher wins).
const NAME_RANK = {
  incubator_listing: 5,
  manual: 5,
  impressum: 6,
  github_org: 4,
  text_mention: 4,
  press_release: 4,
  github_repo: 2,
  certificate: 1,
};

export function nameRank(sig) {
  if (!sig.name) return 0;
  return NAME_RANK[sig.type] ?? (sig.source === 'incubator' || sig.source === 'manual' ? 5 : 3);
}

export const SOURCE_LABEL = {
  github: 'GitHub',
  ct: 'Cert log',
  incubator: 'Incubator',
  press_release: 'Uni press',
  idw: 'idw',
  podcast: 'Podcast',
  competition: 'Competition',
  text: 'Text',
  manual: 'Manual',
  demo: 'Demo',
};

export function makeSignal({ source, type, name, domain, url, date, data }) {
  return {
    source,
    type: type || source,
    name: name ? String(name).trim().slice(0, 120) : undefined,
    domain: domain || undefined,
    url: url || undefined,
    date: date ? new Date(date).toISOString() : new Date().toISOString(),
    data: data || {},
  };
}
