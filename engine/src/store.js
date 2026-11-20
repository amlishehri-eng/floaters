// JSON-file store behind a small async interface, so it can be swapped for Supabase later.
// Re-reads the file when another process (CLI vs. server) changed it.
import fs from 'node:fs';
import path from 'node:path';
import config from '../config.js';

const EMPTY = () => ({ leads: [], runs: [], meta: {} });

let db = null;
let loadedMtime = 0;

function file() {
  return config.dbFile;
}

function load() {
  let mtime = 0;
  try { mtime = fs.statSync(file()).mtimeMs; } catch { /* no file yet */ }
  if (db && mtime <= loadedMtime) return db;
  if (!mtime) {
    db = db || EMPTY();
    return db;
  }
  try {
    db = { ...EMPTY(), ...JSON.parse(fs.readFileSync(file(), 'utf8')) };
    loadedMtime = mtime;
  } catch (e) {
    console.error(`[store] could not read ${file()}: ${e.message}. Starting empty (old file kept as .broken).`);
    try { fs.copyFileSync(file(), file() + '.broken'); } catch { /* ignore */ }
    db = EMPTY();
  }
  return db;
}

function save() {
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  const tmp = `${file()}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, file());
  loadedMtime = fs.statSync(file()).mtimeMs;
}

export const store = {
  async listLeads() {
    return load().leads;
  },
  async getLead(id) {
    return load().leads.find((l) => l.id === id) || null;
  },
  /** Insert or replace by id. */
  async upsertLead(lead) {
    const d = load();
    const i = d.leads.findIndex((l) => l.id === lead.id);
    lead.updatedAt = new Date().toISOString();
    if (i >= 0) d.leads[i] = lead;
    else d.leads.push(lead);
    save();
    return lead;
  },
  /** Replace the whole lead list (used after a merge pass). */
  async saveLeads(leads) {
    load().leads = leads;
    save();
  },
  async deleteLeads(ids) {
    const set = new Set(ids);
    const d = load();
    d.leads = d.leads.filter((l) => !set.has(l.id));
    save();
  },
  async addRun(run) {
    const d = load();
    d.runs.unshift(run);
    d.runs = d.runs.slice(0, 50);
    save();
    return run;
  },
  async updateRun(id, patch) {
    const d = load();
    const r = d.runs.find((x) => x.id === id);
    if (r) Object.assign(r, patch);
    save();
    return r;
  },
  async listRuns() {
    return load().runs;
  },
  async getMeta(key, fallback = null) {
    const v = load().meta[key];
    return v === undefined ? fallback : v;
  },
  async setMeta(key, value) {
    load().meta[key] = value;
    save();
  },
  /** For tests: drop the in-memory cache. */
  _reset() {
    db = null;
    loadedMtime = 0;
  },
};

export default store;
