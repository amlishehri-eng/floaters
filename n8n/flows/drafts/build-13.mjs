// Builds the flow 13 v8 Code node from the template: fills the HTGF portfolio lists and FIT_BAR.
// Usage: node n8n/flows/drafts/build-13.mjs [FIT_BAR]  -> writes n8n/flows/drafts/13-classify-v8.js
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const fitBar = Number(process.argv[2] || 60);
// The portfolio lists are the exact ones from Nils's live 13 v7.1 (copied to htgf-portfolio-lists.json): he left out generic
// names ("today", "cycle", ...) and linkedin.com, so a lead is never marked portfolio by a common word.
const { names, hosts } = JSON.parse(fs.readFileSync(path.join(here, "htgf-portfolio-lists.json"), "utf8"));

const template = fs.readFileSync(path.join(here, "13-classify-v8.template.js"), "utf8");
const code = template
  .replace("__FIT_BAR__", String(fitBar))
  .replace("__PORTFOLIO_NAMES__", JSON.stringify(names))
  .replace("__PORTFOLIO_HOSTS__", JSON.stringify(hosts));
fs.writeFileSync(path.join(here, "13-classify-v8.js"), code);
console.log(`13-classify-v8.js: FIT_BAR ${fitBar}, ${names.length} portfolio names, ${hosts.length} hosts, ${code.length} chars`);
