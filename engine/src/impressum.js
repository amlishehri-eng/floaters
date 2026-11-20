// Regex parser for German Impressum pages (company, legal form, register, court, address, directors, VAT).
// Input is plain text with line breaks (util.htmlToText). Only reads what the company itself publishes.

const LEGAL_FORM_PATTERNS = [
  ['UG (haftungsbeschränkt)', /\bUG\s*\(\s*haftungsbeschr[äa]nkt\s*\)/i],
  ['GmbH & Co. KG', /\bGmbH\s*&\s*Co\.?\s*KG\b/],
  ['gGmbH', /\bgGmbH\b/],
  ['GmbH', /\bGmbH\b/],
  ['UG', /\bUG\b/],
  ['AG', /\bAG\b/],
  ['SE', /\bSE\b/],
  ['KG', /\bKG\b/],
  ['GbR', /\bGbR\b/],
  ['e.V.', /\be\.\s?V\./],
];

const IG_RE = /\bi\.\s?G\.|\bin\s+Gr[üu]ndung\b/i;
const CAP = '[A-ZÄÖÜ][a-zäöüß.]+';
const CONNECT = '(?:bei|am|an der|im|in der|ob der|vor der|a\\.\\s?M\\.|a\\.d\\.)';
const CITY = `${CAP}(?:-${CAP})*(?:[ \\t]+${CONNECT}[ \\t]+${CAP}(?:-${CAP})*)?(?:[ \\t]+\\(${CAP}\\))?`;

const EN_CITY = { Munich: 'München', Cologne: 'Köln', Nuremberg: 'Nürnberg', Brunswick: 'Braunschweig', Hanover: 'Hannover', Frankfurt: 'Frankfurt am Main' };

function legalFormOf(s) {
  for (const [form, re] of LEGAL_FORM_PATTERNS) if (re.test(s)) return form;
  return null;
}

function splitNames(s) {
  return s
    .split(/,|;|\/|\s+und\s+|\s+and\s+|\s+&\s+|\s+sowie\s+/i)
    .map((n) => n.replace(/\(.*?\)/g, '').replace(/^(Herr|Frau|Mr\.?|Ms\.?|Mrs\.?)\s+/i, '').trim())
    .filter((n) => {
      const words = n.split(/\s+/);
      return (
        words.length >= 2 && words.length <= 5 && n.length <= 60 && !/\d|@|http|www\./.test(n) &&
        words.every((w) => /^(Dr\.|Prof\.|Dipl\.-\w+\.?|von|van|de|der|zu|[A-ZÄÖÜ][\p{L}'-]+\.?)$/u.test(w)) &&
        !/(GmbH|UG|AG|Straße|Strasse|Str\.|Telefon|Phone|E-Mail|Registergericht|Amtsgericht|Handelsregister|Sitz)/i.test(n)
      );
    });
}

export function parseImpressum(text) {
  const out = {
    company: null, legalForm: null, inFounding: false, register: null, court: null,
    zip: null, city: null, directors: [], vatId: null, germany: false,
  };
  if (!text) return out;
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  // Company line: first short line that carries a legal form.
  const companyLines = lines.filter((l) => l.length <= 120 && legalFormOf(l) && !/^(Registergericht|Amtsgericht|Handelsregister|Sitz|Rechtsform|Copyright|©)/i.test(l) && !/haftet|Haftung f|verantwortlich|[|–]|\s-\s/i.test(l));
  // Prefer a line that ends with the legal form ("QuantumFab UG (haftungsbeschränkt) i.G.") over prose.
  const companyLine = companyLines.find((l) => /(GmbH|UG \(haftungsbeschränkt\)|UG|AG|SE|KG|GbR|e\.\s?V\.)\s*(i\.\s?G\.|in Gründung)?\.?$/i.test(l)) || companyLines[0];
  if (companyLine) {
    out.company = companyLine.replace(/^(Anbieter|Betreiber|Herausgeber|Angaben gemäß § ?5 TMG|Diensteanbieter)\s*:?\s*/i, '').trim();
    out.legalForm = legalFormOf(companyLine);
  } else {
    out.legalForm = legalFormOf(text);
  }
  out.inFounding = IG_RE.test(companyLine || '') || IG_RE.test(text);

  const reg = text.match(/\b(HRB|HRA|GnR|VR|PR)\s*[:.]?\s*(?:Nr\.?\s*)?(\d{1,6}(?:\s?[A-Z]{1,2}\b)?)/);
  if (reg) out.register = `${reg[1]} ${reg[2].trim()}`;

  // Court: "Amtsgericht München" preferred; "Registergericht: München" -> "Amtsgericht München".
  const ag = text.match(new RegExp(`Amtsgericht[ \\t]+(${CITY})`));
  if (ag) out.court = `Amtsgericht ${ag[1].trim()}`;
  else {
    const rg = text.match(new RegExp(`Registergericht\\s*:?[ \\t]*(${CITY})`))
      || text.match(new RegExp(`(?:District|Local|Registry|Register|Registration)[ \\t]+[Cc]ourt(?:[ \\t]+of)?\\s*:?[ \\t]*(${CITY})`))
      || text.match(new RegExp(`(${CITY})[ \\t]+(?:District|Local|Registry|Register)[ \\t]+[Cc]ourt`));
    if (rg) out.court = `Amtsgericht ${EN_CITY[rg[1].trim()] || rg[1].trim()}`;
  }

  // PLZ + city, but not a register number ("HRB 12345 München").
  const plz = new RegExp(`(?<!(?:HR[AB]|GnR|VR|PR|Nr\\.?)[\\s:.]*)(?<![\\d+])\\b(\\d{5})[ \\t]+(${CITY})`);
  const pm = text.match(plz);
  if (pm) {
    out.zip = pm[1];
    out.city = pm[2].trim();
  }

  // Managing directors (name may be on the same line after ":" or on the next line).
  const dirRe = /(Gesch[äa]ftsf[üu]hrer(?:in|innen)?|Gesch[äa]ftsf[üu]hrung|Vertretungsberechtigte[rn]?\s+Gesch[äa]ftsf[üu]hrer(?:in)?|Vertreten durch(?:\s+(?:die|den)\s+Gesch[äa]ftsf[üu]hrer(?:in)?)?|Managing Directors?|Represented by|Vorstand)\s*[:：]?\s*(.*)/i;
  for (let i = 0; i < lines.length && !out.directors.length; i++) {
    const m = lines[i].match(dirRe);
    if (!m) continue;
    let rest = m[2].trim();
    if (!rest || rest.length < 3) rest = lines[i + 1] || '';
    let names = splitNames(rest);
    if (!names.length && lines[i + 1]) names = splitNames(lines[i + 1]);
    out.directors = [...new Set(names)].slice(0, 6);
  }

  const vat = text.match(/\b(DE)\s?(\d{3})\s?(\d{3})\s?(\d{3})\b/);
  if (vat) out.vatId = vat.slice(1).join('');

  out.germany = Boolean(
    /\b(Deutschland|Germany)\b/.test(text) || out.vatId || (out.zip && (out.court || out.register)),
  );
  return out;
}

export const IMPRESSUM_LINK_RE = /impressum|imprint|legal[-_ ]?notice|legal[-_ ]?info|rechtliche[s]?|^legal$/i;
