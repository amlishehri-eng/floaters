// Home (/): radar over Germany with the call-now teams on their cities, funnel numbers, the top lead and the backtest band.
// Map, projection and dots are the ones in design/reference/home.dc.html. Pure functions.
import { backtestView } from "./extras";
import { funnelNumbers, lastRun } from "./funnel";
import { int, isNum, usd, words } from "./format";

// Germany outline (lon, lat) from the reference.
const BORDER = [[8.66,54.91],[9.42,54.83],[9.95,54.78],[10.15,54.35],[11.1,54.45],[10.9,53.95],[11.45,53.9],[12.1,54.18],[12.5,54.47],[13.4,54.65],[14.2,53.95],[14.27,53.7],[14.4,53.28],[14.15,52.85],[14.6,52.6],[14.7,52.1],[14.75,51.6],[15.0,51.1],[14.82,50.87],[14.3,51.05],[13.55,50.71],[12.94,50.42],[12.1,50.32],[12.5,49.98],[12.4,49.75],[12.9,49.35],[13.6,48.95],[13.8,48.6],[13.0,48.3],[12.75,48.12],[13.0,47.47],[12.2,47.6],[11.1,47.4],[10.45,47.55],[10.1,47.4],[9.55,47.54],[8.6,47.65],[8.2,47.6],[7.6,47.58],[7.55,48.1],[7.8,48.6],[8.2,48.97],[7.4,49.17],[6.75,49.17],[6.36,49.46],[6.5,49.8],[6.13,50.13],[6.4,50.32],[6.0,50.75],[5.9,51.05],[6.2,51.36],[5.95,51.8],[6.8,51.97],[7.05,52.4],[6.7,52.5],[7.05,52.65],[7.2,53.25],[7.2,53.6],[8.0,53.7],[8.5,53.55],[8.9,53.85],[8.85,54.3],[8.6,54.5]];

export const project = ([lon, lat]) => [(lon - 5.6) * 63, (55.2 - lat) * 100];

const POLY = BORDER.map(project);
const OUTLINE = POLY.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
const CLIP = `polygon(${POLY.map(([x, y]) => `${(x / 6).toFixed(2)}% ${(y / 8).toFixed(2)}%`).join(", ")})`;

// ---- Radar geometry: the rings reach every corner of the outline (DESIGN.md, radar) -------------------------------
// Centre: the bounding-box middle or the area centroid, whichever needs the smaller radius. R = the farthest outline
// vertex from that centre plus a margin. Ten rings at R/10 steps, the crosshair and the sweep all use R, and every
// radar layer is clipped to the outline.
function polygonCentroid(poly) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1];
    a += f; cx += (poly[j][0] + poly[i][0]) * f; cy += (poly[j][1] + poly[i][1]) * f;
  }
  return [cx / (3 * a), cy / (3 * a)];
}
const farthest = ([cx, cy]) => Math.max(...POLY.map(([x, y]) => Math.hypot(x - cx, y - cy)));
const BBOX = [Math.min(...POLY.map((p) => p[0])), Math.min(...POLY.map((p) => p[1])), Math.max(...POLY.map((p) => p[0])), Math.max(...POLY.map((p) => p[1]))];
const CENTRES = [[(BBOX[0] + BBOX[2]) / 2, (BBOX[1] + BBOX[3]) / 2], polygonCentroid(POLY)];
const CENTRE = CENTRES.sort((a, b) => farthest(a) - farthest(b))[0];
const R = Math.ceil(farthest(CENTRE) + 6);
export const RADAR = {
  cx: CENTRE[0],
  cy: CENTRE[1],
  r: R,
  rings: Array.from({ length: 10 }, (_, i) => (R * (i + 1)) / 10),
  check: { ok: POLY.every(([x, y]) => Math.hypot(x - CENTRE[0], y - CENTRE[1]) <= R), farthest: Math.round(farthest(CENTRE)), vertices: POLY.length },
};
if (process.env.NODE_ENV !== "production" && !globalThis.__ffRadarLogged) {
  globalThis.__ffRadarLogged = true;
  console.info(`[radar] centre ${CENTRE.map((v) => v.toFixed(1)).join(", ")}, R ${R}: ${RADAR.check.ok ? "every" : "NOT every"} one of ${POLY.length} outline vertices is inside (farthest ${RADAR.check.farthest})`);
}

function inside(x, y) {
  let hit = false;
  for (let i = 0, j = POLY.length - 1; i < POLY.length; j = i++) {
    const [xi, yi] = POLY[i];
    const [xj, yj] = POLY[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// The same 320 faint dots as the reference (seeded, so server and client agree).
const DOTS = (() => {
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const dots = [];
  while (dots.length < 320) {
    const x = rnd() * 600;
    const y = rnd() * 800;
    if (!inside(x, y)) continue;
    const bright = rnd() > 0.88;
    dots.push({ x: (x / 6).toFixed(2), y: (y / 8).toFixed(2), s: bright ? 3 : 2, c: bright ? "#1a5276" : "#8fa6b4", o: (bright ? 0.7 : 0.35 + rnd() * 0.35).toFixed(2) });
  }
  return dots;
})();

const LINE = 20; // label line height in map units (the labels are 14px / 12px at the reference size)
const NEAR = 18; // points closer than this (map units ≈ px) fan out
const FAN = 14; // fan-out radius around the city point
const labelW = (name, city) => name.length * 7.7 + city.length * 6.4 + 14;

export function cityLookup(coords) {
  const cities = coords?.cities || {};
  const aliases = coords?.aliases || {};
  const norm = (s) => String(s || "").trim().toLowerCase();
  const byName = new Map(Object.entries(cities).map(([k, v]) => [norm(k), { name: k, lonlat: v }]));
  for (const [alias, target] of Object.entries(aliases)) if (cities[target]) byName.set(norm(alias), { name: target, lonlat: cities[target] });
  return (city) => byName.get(norm(city)) || byName.get(norm(String(city || "").split(/[,(/]/)[0])) || null;
}

// Does the segment (x1,y1)-(x2,y2) touch the rectangle?
function segmentHitsRect([x1, y1], [x2, y2], r) {
  const inR = (x, y) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  if (inR(x1, y1) || inR(x2, y2)) return true;
  const cross = (a, b, c, d) => {
    const det = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
    if (det === 0) return false;
    const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / det;
    const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / det;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  };
  const tl = [r.x, r.y], tr = [r.x + r.w, r.y], bl = [r.x, r.y + r.h], br = [r.x + r.w, r.y + r.h];
  return [[tl, tr], [tr, br], [br, bl], [bl, tl]].some(([c, d]) => cross([x1, y1], [x2, y2], c, d));
}
const hitsBorder = (r) => POLY.some((p, i) => segmentHitsRect(p, POLY[(i + 1) % POLY.length], r));
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/**
 * Call-now teams on their cities. Points closer than 18 units form one cluster and fan out on a 14-unit circle, each
 * with its own dot. Each cluster gets one label list beside it with a thin Stone leader line; a list is placed where it
 * overlaps no other list, no point and not the border (inside or outside the map, within the map box).
 */
export function radarStars(leads, coords) {
  const find = cityLookup(coords);
  const points = [];
  let skipped = 0;
  for (const l of leads) {
    const hit = find(l.city);
    if (!hit) { skipped += 1; continue; }
    const [x, y] = project(hit.lonlat);
    points.push({ key: l.id, name: l.name, city: hit.name, x, y });
  }
  // Cluster points that are near each other (same city, or neighbouring cities).
  const clusters = [];
  for (const p of points) {
    const c = clusters.find((k) => k.points.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < NEAR));
    if (c) c.points.push(p); else clusters.push({ points: [p] });
  }
  const stars = [];
  const obstacles = [];
  for (const c of clusters) {
    c.x = c.points.reduce((t, p) => t + p.x, 0) / c.points.length;
    c.y = c.points.reduce((t, p) => t + p.y, 0) / c.points.length;
    const n = c.points.length;
    const fan = Math.max(FAN, n * 2.9); // bigger groups get a wider circle so the dots do not touch
    c.points.forEach((p, i) => {
      const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
      p.dx = n > 1 ? c.x + fan * Math.cos(a) : c.x;
      p.dy = n > 1 ? c.y + fan * Math.sin(a) : c.y;
      stars.push({ key: p.key, name: p.name, city: p.city, x: (p.dx / 6).toFixed(2), y: (p.dy / 8).toFixed(2) });
    });
    const rad = n > 1 ? fan + 6 : 8;
    obstacles.push({ x: c.x - rad, y: c.y - rad, w: 2 * rad, h: 2 * rad });
    c.rad = rad;
  }
  // Labels: biggest clusters first, so the long lists get the free space.
  const placed = [];
  const labels = [];
  for (const c of [...clusters].sort((a, b) => b.points.length - a.points.length)) {
    const lines = c.points.map((p) => ({ name: p.name, city: p.city }));
    const w = Math.max(...lines.map((l) => labelW(l.name, l.city)));
    const h = lines.length * LINE;
    const gap = c.rad + 10;
    const candidates = [];
    for (const dy of [0, -1, 1, -2, 2, -3, 3, -4, 4, -6, 6].map((k) => k * LINE)) {
      candidates.push({ x: c.x + gap, y: c.y - h / 2 + dy, side: "right" });
      candidates.push({ x: c.x - gap - w, y: c.y - h / 2 + dy, side: "left" });
    }
    for (const dx of [0, 40, -40, 80, -80]) {
      candidates.push({ x: c.x - w / 2 + dx, y: c.y - gap - h, side: "above" });
      candidates.push({ x: c.x - w / 2 + dx, y: c.y + gap, side: "below" });
    }
    const fits = (r) => r.x >= 2 && r.y >= 2 && r.x + r.w <= 598 && r.y + r.h <= 798;
    let best = null;
    for (const strictBorder of [true, false]) {
      best = candidates.map((k) => ({ ...k, w, h })).find((r) => fits(r) && !placed.some((q) => overlap(q, r)) && !obstacles.some((o) => overlap(o, r)) && (!strictBorder || !hitsBorder(r)));
      if (best) break;
    }
    best ||= { x: c.x + gap, y: c.y - h / 2, w, h, side: "right" };
    placed.push(best);
    // Leader line from the cluster edge to the middle of the list's near side.
    const tx = best.side === "right" ? best.x : best.side === "left" ? best.x + w : best.x + w / 2;
    const ty = best.side === "above" ? best.y + h : best.side === "below" ? best.y : best.y + h / 2;
    const ang = Math.atan2(ty - c.y, tx - c.x);
    labels.push({
      key: c.points.map((p) => p.key).join("|"),
      x: (best.x / 6).toFixed(2), y: (best.y / 8).toFixed(2),
      lines,
      leader: { x1: c.x + Math.cos(ang) * (c.rad - 2), y1: c.y + Math.sin(ang) * (c.rad - 2), x2: tx, y2: ty },
      borderClash: hitsBorder(best),
    });
  }
  const labelOverlaps = placed.reduce((n, a, i) => n + placed.slice(i + 1).filter((b) => overlap(a, b)).length, 0);
  return { stars, labels, skipped, clusters: clusters.map((c) => c.points.length), labelOverlaps, borderClashes: labels.filter((l) => l.borderClash).length };
}

function topLead(lead) {
  if (!lead) return null;
  const tech = (lead.fit_breakdown && typeof lead.fit_breakdown === "object" ? lead.fit_breakdown : {}).tech_depth;
  const teamCrit = Array.isArray(lead.team_criteria) ? lead.team_criteria : [];
  const known = teamCrit.filter((c) => c.known !== false).length;
  const fundingStatus = String(lead.funding_status || "unknown");
  const fundingShort = { none: "None", angels: "Angels", grants: "Grants", seeking: "Seeking", pre_seed: "Pre-seed", seed_vc: "VC seed", series_a_plus: "Series A" }[fundingStatus] || "Not known";
  return {
    key: lead.id,
    name: lead.name,
    what: lead.what || "No description in the traces yet.",
    numbers: [
      { n: tech && isNum(tech.points) && isNum(tech.max) ? `${tech.points}/${tech.max}` : "Not known", label: "tech depth", color: "#f5f0e8" },
      {
        n: isNum(lead.team_score_known) ? String(Math.round(lead.team_score_known)) : "Not known",
        label: known === 8 ? "team, all 8 criteria known" : `team, ${known} of 8 criteria known`,
        color: "#f5f0e8",
      },
      { n: fundingShort, label: "funding so far", color: "#8fa6b4" },
    ],
  };
}

export function homePage({ funnel, leads, extras, coords }) {
  // Mismatch guard: the call-now count comes from the same leads the radar and the top lead show.
  const n = funnelNumbers(funnel);
  const callNow = (leads || []).filter((l) => l.verdict === "call_now");
  const callCount = callNow.length;
  const radar = radarStars(callNow, coords);
  const { stars, skipped } = radar;
  const top = [...callNow].sort((a, b) => (b.priority ?? -1) - (a.priority ?? -1))[0];
  // Step costs from the last run (lib/screen/funnel.js lastRun), the same numbers as the funnel page.
  const run = lastRun(funnel, leads || []);
  const perTrace = run?.perTrace ?? n.perTrace;
  const perStrong = run?.perStrong ?? n.perStrong;
  const perDeep = run?.perDeep ?? n.perDeep;
  const costStep3 = [perTrace !== null && `${usd(perTrace, 3)} a trace`, perStrong !== null && `about ${usd(perStrong)} a lead`].filter(Boolean).join(", ") + (run ? " in the last run" : "");
  return {
    title: [`${words(callCount, true)} ${callCount === 1 ? "call" : "calls"}.`, `Out of ${n.traces === null ? "every" : int(n.traces)} signals.`],
    radarLabel: `Radar over Germany: ${n.traces === null ? "" : `${int(n.traces)} `}faint signals, ${words(callCount)} ${callCount === 1 ? "team" : "teams"} to call`,
    outline: OUTLINE,
    clip: CLIP,
    dots: DOTS,
    stars,
    labels: radar.labels,
    radarCheck: { ...RADAR.check, clusters: radar.clusters, labelOverlaps: radar.labelOverlaps, borderClashes: radar.borderClashes },
    radar: RADAR,
    skipped,
    big: [
      { n: n.traces === null ? "–" : int(n.traces), label: "traces read across Germany", color: "#0d2b3d" },
      { n: n.survivors === null ? "–" : int(n.survivors), label: "past the HTGF gates", color: "#1a5276" },
      { n: int(callCount), label: "worth a call today", color: "#0d2b3d", callNow: true },
    ],
    steps: [
      { no: "1", title: "Find", text: "Ten sources: university spin-off lists, TUM Venture Labs, accelerator cohorts, spin-off news, GitHub, job ads and pitch podcasts.", cost: "Scrapers in n8n", color: "#0d2b3d" },
      { no: "2", title: "Cut the noise", text: "Code rules drop events, agencies, old companies and duplicates. Thin entries get their website and Impressum read.", cost: "Free", color: "#0d2b3d" },
      { no: "3", title: "Score", text: "A small model reads every trace. Survivors of the HTGF gates get a strong model, with evidence for every point.", cost: costStep3 || "Cost not known yet", color: "#1a5276" },
      { no: "4", title: "Deep check", text: "Only the top 30: flight risk, IP, competitors, Series A risk, grant bridges and a warm intro path.", cost: perDeep !== null ? `About ${usd(perDeep)} a lead${run ? " in the last run" : ""}` : "Cost not known yet", color: "#1a5276" },
    ],
    top: topLead(top),
    backtest: backtestView(extras?.backtest),
  };
}
