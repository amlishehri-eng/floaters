// Certificate Transparency filter: from the firehose of new TLS certs keep only
// landing pages (apex / www. / app.) on startup TLDs whose label hints at a deep-tech sector.
import config from '../config.js';
import { rootDomain } from './normalize.js';

// Long keywords may appear anywhere in the label.
export const CT_KEYWORDS = [
  'robot', 'robotik', 'sensor', 'sensing', 'photon', 'optic', 'laser', 'lidar', 'quantum', 'qubit', 'battery',
  'batterie', 'hydrogen', 'wasserstoff', 'electrolys', 'fuelcell', 'bio', 'thera', 'diagnost', 'chem', 'materi',
  'semicon', 'chip', 'silicon', 'nano', 'fusion', 'plasma', 'cryo', 'magnet', 'aero', 'space', 'orbit',
  'satell', 'rocket', 'drone', 'autonom', 'genom', 'protein', 'enzym', 'microb', 'pharma', 'medtech', 'neuro',
  'cardio', 'onco', 'immun', 'vaccin', 'cell', 'molecul', 'catal', 'polymer', 'carbon', 'climate', 'energy',
  'energie', 'solar', 'thermal', 'geotherm', 'grid', 'fab', 'additive', 'machin', 'automat', 'cyber', 'secur',
  'deeptech', 'mobility', 'radar', 'acoustic', 'spectr', 'imaging', 'surgic', 'implant', 'dental',
];
// Short keywords only at label start or end, else they match everything ("ai" in "mail").
export const CT_SHORT = ['ai', 'ml', 'h2', 'ev', 'xr', 'iot'];

// Labels that look like the short keyword but are words or places.
const SHORT_FALSE = /(thai|dubai|shanghai|bonsai|mumbai|samurai|hawaii|bahai|html|xml|yaml|toml|level|travel|hotel)$|^(air|aid|aim|aisle|evil|ever|event|mlm)/;

export const CT_JUNK = [
  'mail', 'cpanel', 'webmail', 'autodiscover', 'shop', 'casino', 'betting', 'wetten', 'poker', 'slot', 'crypto', 'coin',
  'token', 'nft', 'immobilien', 'realestate', 'restaurant', 'pizza', 'sushi', 'hotel', 'ferienwohnung', 'porn',
  'sex', 'escort', 'dating', 'loan', 'kredit', 'versicherung', 'insurance', 'pharmacy', 'apotheke', 'viagra',
  'cbd', 'vape', 'fashion', 'beauty', 'kosmetik', 'friseur', 'tattoo', 'wedding', 'hochzeit', 'bio-laden',
  'bioladen', 'biohof', 'biomarkt', 'fahrschule', 'handwerk', 'umzug', 'reinigung', 'cleaning', 'steuerberat',
  'anwalt', 'kanzlei', 'praxis', 'zahnarzt', 'physio', 'yoga', 'fitness', 'gym', 'blog', 'test', 'staging',
  'dev-', 'localhost', 'cloudflare', 'amazonaws', 'azure', 'cdn', 'xn--', 'vpn', 'proxy', 'hosting',
];

const APP_PREFIXES = ['', 'www.', 'app.'];

/** Returns { domain, host, label, keyword } for an interesting landing-page host, else null. */
export function filterCtDomain(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const host = raw.trim().toLowerCase().replace(/^\*\./, '').replace(/\.$/, '');
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  const apex = rootDomain(host);
  const prefix = host.slice(0, host.length - apex.length);
  if (!APP_PREFIXES.includes(prefix)) return null;

  const [label, ...rest] = apex.split('.');
  const tld = rest.join('.');
  if (!config.ct.tlds.includes(tld)) return null;
  if (label.length < 3 || label.length > 30) return null;
  if ((label.match(/\d/g) || []).length >= 3) return null; // random/generated names
  if (CT_JUNK.some((j) => label.includes(j))) return null;

  let keyword = CT_KEYWORDS.find((k) => label.includes(k));
  if (!keyword) {
    const parts = label.split('-');
    keyword = CT_SHORT.find((k) =>
      parts.length > 1
        ? parts[0] === k || parts[parts.length - 1] === k
        : (label.startsWith(k) || label.endsWith(k)) && label.length > k.length + 2 && !SHORT_FALSE.test(label),
    );
  }
  // .ai is itself a sector hint, but only for compound-looking labels
  if (!keyword && tld === 'ai' && label.length >= 5) keyword = '.ai';
  if (!keyword) return null;
  return { domain: apex, host, label, keyword };
}

/** Handle both certstream formats: full certificate_update and domains-only dns_entries. */
export function extractCtDomains(msg) {
  if (!msg || typeof msg !== 'object') return null;
  const type = msg.message_type;
  if (type === 'heartbeat') return null;
  const d = msg.data;
  if (Array.isArray(d)) return { domains: d, seen: Date.now(), issuer: null, notBefore: null };
  if (d && d.leaf_cert) {
    const leaf = d.leaf_cert;
    return {
      domains: leaf.all_domains || [],
      seen: d.seen ? Math.round(d.seen * 1000) : Date.now(),
      issuer: leaf.issuer?.O || leaf.issuer?.CN || null,
      notBefore: leaf.not_before ? leaf.not_before * 1000 : null,
    };
  }
  if (d && Array.isArray(d.domains)) return { domains: d.domains, seen: Date.now(), issuer: null, notBefore: null };
  return null;
}
