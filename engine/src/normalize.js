// Domain and company-name normalisation used by lead merge.

// Hosts where every customer gets a subdomain: keep the full host.
const SHARED_HOSTS = [
  'github.io', 'gitlab.io', 'vercel.app', 'netlify.app', 'pages.dev', 'herokuapp.com', 'webflow.io',
  'wixsite.com', 'framer.website', 'framer.app', 'carrd.co', 'onrender.com', 'fly.dev', 'notion.site',
  'super.site', 'squarespace.com', 'wordpress.com', 'blogspot.com', 'web.app', 'firebaseapp.com',
  'azurewebsites.net', 'replit.app', 'streamlit.app', 'hf.space', 'huggingface.co',
];

// Never a company's own domain.
const NON_COMPANY = [
  'linkedin.com', 'github.com', 'gitlab.com', 'medium.com', 'twitter.com', 'x.com', 'facebook.com',
  'instagram.com', 'youtube.com', 'youtu.be', 'tiktok.com', 'xing.com', 'crunchbase.com', 'google.com',
  'goo.gl', 'bit.ly', 't.co', 'wikipedia.org', 'angel.co', 'wellfound.com', 'eventbrite.com',
  'eventbrite.de', 'meetup.com', 'apple.com', 'microsoft.com', 'amazon.com', 'mailchimp.com',
  'typeform.com', 'calendly.com', 'docs.google.com', 'forms.gle', 'vimeo.com', 'spotify.com',
  'apps.apple.com', 'play.google.com', 'dealroom.co', 'northdata.de', 'northdata.com', 'bund.de',
  'handelsregister.de', 'unternehmensregister.de', 'creativecommons.org', 'w3.org', 'linktr.ee',
  'discord.gg', 'discord.com', 'slack.com', 't.me', 'wa.me', 'whatsapp.com', 'threads.net', 'bsky.app',
  'mastodon.social', 'producthunt.com', 'ycombinator.com', 'substack.com', 'arxiv.org', 'doi.org',
  'researchgate.net', 'zenodo.org', 'npmjs.com', 'pypi.org', 'readthedocs.io', 'gstatic.com',
  'googleapis.com', 'cloudflare.com', 'jsdelivr.net', 'shields.io', 'gravatar.com', 'example.com',
];

// Multi-label public suffixes we are likely to meet.
const MULTI_SUFFIX = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.au', 'co.at', 'or.at', 'ac.at', 'gv.at', 'co.jp', 'com.br',
  'com.tr', 'co.in', 'com.cn', 'co.nz', 'co.za', 'com.mx', 'com.sg', 'co.il', 'com.es', 'com.pl',
]);

export function hostOf(input) {
  if (!input) return null;
  let s = String(input).trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith('mailto:')) s = s.slice(7).split('@')[1] || '';
  if (s.includes('@') && !s.includes('/')) s = s.split('@')[1];
  if (!/^[a-z]+:\/\//.test(s)) s = 'http://' + s;
  try {
    const h = new URL(s).hostname.replace(/\.$/, '').replace(/^\*\./, '');
    return /^[a-z0-9.-]+\.[a-z0-9-]{2,}$/.test(h) && !/^\d+\.\d+\.\d+\.\d+$/.test(h) ? h : null;
  } catch {
    return null;
  }
}

export function rootDomain(host) {
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const last2 = parts.slice(-2).join('.');
  return MULTI_SUFFIX.has(last2) ? parts.slice(-3).join('.') : last2;
}

const endsWithHost = (h, d) => h === d || h.endsWith('.' + d);

/** "https://www.Foo.de/x" -> "foo.de"; "x.github.io" stays; linkedin etc. -> null */
export function normDomain(input) {
  const host = hostOf(input);
  if (!host) return null;
  const shared = SHARED_HOSTS.find((d) => endsWithHost(host, d));
  if (shared) {
    if (host === shared) return null;
    return host.replace(/^www\./, '');
  }
  if (NON_COMPANY.some((d) => endsWithHost(host, d))) return null;
  // University domains are institutions, not companies (tum.de, kit.edu, *.uni-*.de, fraunhofer.de)
  if (/(^|\.)(tum\.de|kit\.edu|rwth-aachen\.de|tu-[a-z]+\.de|uni-[a-z-]+\.de|fraunhofer\.de|mpg\.de|helmholtz\.de|lmu\.de|fu-berlin\.de|hu-berlin\.de|tu-berlin\.de|idw-online\.de)$/.test(host)) return null;
  return rootDomain(host);
}

/** "quantumfab.de" -> "quantumfab"; "foo.github.io" -> "foo" */
export function domainLabel(domain) {
  if (!domain) return null;
  const shared = SHARED_HOSTS.find((d) => endsWithHost(domain, d));
  const label = shared ? domain.slice(0, -shared.length - 1).split('.').pop() : domain.split('.')[0];
  return normName(label);
}

const LEGAL_FORMS = [
  /\bgmbh\s*&\s*co\.?\s*kg(aa)?\b/gi,
  /\bug\s*\(\s*haftungsbeschr[aä]nkt\s*\)/gi,
  /\(\s*haftungsbeschr[aä]nkt\s*\)/gi,
  /\bi\.\s?g\.?(?=\s|$|,|\))/gi,
  /\bin\s+gr[uü]ndung\b/gi,
  /\b(g?gmbh|ug|ag|se|kgaa|kg|ohg|gbr|mbh|e\.\s?v\.?|inc\.?|ltd\.?|llc|bv|b\.v\.|sas|sarl|s\.a\.r\.l\.|oy|ab|aps|corp\.?|co\.?)(?=\s|$|,|\)|\.)/gi,
];

/** Display name without legal form ("QuantumFab UG (haftungsbeschränkt) i.G." -> "QuantumFab"). */
export function cleanName(name) {
  if (!name) return '';
  let s = String(name).replace(/\s+/g, ' ').trim();
  for (const re of LEGAL_FORMS) s = s.replace(re, ' ');
  return s.replace(/[\s,;:()-]+$/g, '').replace(/^[\s,;:()-]+/g, '').replace(/\s+/g, ' ').trim();
}

/** Slug used to match names: lowercase alnum, umlauts transliterated, legal forms stripped. */
export function normName(name) {
  if (!name) return null;
  const s = cleanName(name)
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
  return s.length >= 2 ? s : null;
}

// Names too generic to search the press for or to merge on.
const GENERIC = new Set([
  'app', 'apps', 'labs', 'lab', 'robotics', 'energy', 'home', 'studio', 'tech', 'technologies', 'solutions',
  'systems', 'digital', 'software', 'data', 'cloud', 'ai', 'bio', 'group', 'team', 'project', 'startup',
  'quantum', 'health', 'medical', 'green', 'smart', 'future', 'next', 'one', 'core', 'hub', 'io', 'online',
  'service', 'services', 'consulting', 'germany', 'deutschland', 'berlin', 'munich', 'muenchen', 'hamburg',
  'vision', 'sense', 'motion', 'flow', 'nova', 'atlas', 'orbit', 'pulse', 'spark', 'helix', 'apex',
]);

export function isGenericName(name) {
  const slug = normName(name);
  return !slug || slug.length < 4 || GENERIC.has(slug);
}
