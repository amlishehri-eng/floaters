// All tunables in one place. Secrets come from .env (see .env.example).
import path from 'node:path';
import { ENGINE_DIR } from './src/env.js';

const env = process.env;
const num = (v, d) => (v !== undefined && v !== '' && !Number.isNaN(+v) ? +v : d);

const dataDir = env.DATA_DIR ? path.resolve(env.DATA_DIR) : path.join(ENGINE_DIR, 'data');

export const config = {
  port: num(env.PORT, 8787),
  engineDir: ENGINE_DIR,
  dataDir,
  publicDir: path.join(ENGINE_DIR, 'public'),
  dbFile: env.DB_FILE ? path.resolve(env.DB_FILE) : path.join(dataDir, 'db.json'),
  ctFile: env.CT_FILE ? path.resolve(env.CT_FILE) : path.join(dataDir, 'ct_candidates.jsonl'),

  // How far back source searches look (GitHub created:>=)
  sinceDays: num(env.SINCE_DAYS, 120),
  enrichLimit: num(env.ENRICH_LIMIT, 25),
  enrichConcurrency: 4,
  userAgent: env.USER_AGENT || 'htgf-sourcing-engine/0.1 (hackathon prototype; company-level public data only)',

  llm: {
    anthropicKey: env.ANTHROPIC_API_KEY || '',
    anthropicModel: env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
    openaiKey: env.OPENAI_API_KEY || '',
    openaiModel: env.OPENAI_MODEL || 'gpt-5-mini',
    disabled: env.NO_LLM === '1' || env.NO_LLM === 'true',
  },

  elevenlabs: {
    key: env.ELEVENLABS_API_KEY || '',
    // "George" premade voice, works on every account; override with ELEVENLABS_VOICE_ID
    voiceId: env.ELEVENLABS_VOICE_ID || 'JBFqnCBsd6RMkjVDRZzb',
    model: 'eleven_multilingual_v2',
  },

  github: {
    token: env.GITHUB_TOKEN || '',
    cities: ['Germany', 'Deutschland', 'Berlin', 'Munich', 'München', 'Hamburg', 'Karlsruhe', 'Aachen', 'Dresden', 'Darmstadt'],
    topics: [
      'robotics', 'quantum-computing', 'bioinformatics', 'computational-biology', 'materials-science', 'battery',
      'energy', 'computer-vision', 'drug-discovery', 'medical-imaging', 'photonics', 'fpga', 'embedded',
      'digital-twin', 'manufacturing', 'climate', 'hydrogen', 'lidar', 'synthetic-biology',
    ],
    minStars: 10,
    reposPerOrg: 5,
  },

  ct: {
    url: env.CERTSTREAM_URL || 'wss://certstream.calidog.io/',
    tlds: ['de', 'ai', 'io', 'tech', 'bio', 'eu', 'app', 'dev', 'energy', 'health', 'science'],
  },

  incubatorPages: (env.INCUBATOR_URLS || [
    'https://www.tcf.tum.de/en/facit/venture-lab-fab/start-ups/',
    'https://www.venturelabs.tum.de/labs/robotics-ai/',
    'https://www.tum.de/en/innovation/entrepreneurship/for-alumni-corporates/tum-start-up-wall',
    // Other TUM Venture Labs with the same card layout
    ...['quantum', 'additive-manufacturing', 'chem-biosystems', 'food-agro-biotech', 'healthcare', 'climate-circular', 'aerospace-defense', 'mobility', 'software-ai']
      .map((l) => `https://www.tum-venture-labs.de/labs/${l}/`),
  ].join(',')).split(',').map((s) => s.trim()).filter(Boolean),
};

export default config;
