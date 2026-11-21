#!/usr/bin/env node
// Contrast check for every text/background pair the site uses (design/DESIGN.md, section 2).
//   node scripts/contrast.mjs        -> prints each pair with its ratio, exits 1 when a pair is under its minimum
const L = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
export const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const T = { white: "#ffffff", stone: "#8fa6b4", stoneDeep: "#4f6573", stoneLight: "#a9bcc7", mist: "#f5f0e8", adriatic: "#1a5276", adriaticTint: "#c5d7e5", ink: "#0d2b3d", red: "#b4363b" };
// [text, background, minimum, where]
const PAIRS = [
  ["ink", "white", 4.5, "all text on the page surface"],
  ["ink", "mist", 4.5, "text on cards and bands"],
  ["stoneDeep", "white", 4.5, "captions, secondary text"],
  ["stoneDeep", "mist", 4.5, "captions on cards"],
  ["adriatic", "white", 4.5, "links, data numbers"],
  ["adriatic", "mist", 4.5, "links on cards"],
  ["white", "adriatic", 4.5, "primary button text"],
  ["red", "white", 4.5, "call-now chip text"],
  ["red", "mist", 4.5, "call-now chip on a card"],
  ["mist", "ink", 4.5, "text on the one Harbour Ink band"],
  ["stone", "ink", 4.5, "secondary text on the Ink band"],
  ["white", "ink", 4.5, "primary button on the Ink band (white text on ink)"],
  ["ink", "stone", 4.5, "beam numbers on a Stone beam"],
  ["white", "red", 4.5, "beam number on the call-now beam"],
  ["stoneLight", "ink", 4.5, "captions on the Harbour Ink funnel page (Stone light)"],
  ["ink", "mist", 4.5, "report button and the deep-checked beam on the funnel page"],
  ["adriaticTint", "ink", 4.5, "cost figure per deep check on the funnel page"],
  ["ink", "adriaticTint", 4.5, "beam numbers on the light Adriatic tints"],
  ["stone", "white", 0, "Stone as decoration only (rules, tracks, rings), never text: no minimum"],
];
let bad = 0;
for (const [fg, bg, min, where] of PAIRS) {
  const r = ratio(T[fg], T[bg]);
  if (r < min) bad += 1;
  console.log(`${r.toFixed(2).padStart(6)}  ${r >= min ? "ok  " : "FAIL"}  ${fg} ${T[fg]} on ${bg} ${T[bg]} (min ${min}): ${where}`);
}
process.exit(bad ? 1 : 0);
