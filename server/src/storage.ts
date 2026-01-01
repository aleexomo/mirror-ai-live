import fs from 'fs';
import path from 'path';

export type AppConfig = {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  enabledModes: { MAKEUP: boolean; CLOTHES: boolean; HAIR: boolean };
  features: {
    audioGuidance: boolean;
    shopping: boolean;
    vault: boolean;
    coach: boolean;
  };
  limits: {
    maxLooksPerDay: number; // per device (localStorage-based on client)
  };
  branding: {
    watermarkText: string;
  };
  billing?: {
    enabled: boolean;
    premiumLooksPerDay: number;
    gateCoachSecondStep: boolean;
    freeCoachQuestionsPerSession: number;
    productName: string;
    priceMonthlyBRL: number;
    priceMonthlyUSD: number;
  };
};

export type StoredLook = {
  id: string;
  timestamp: number;
  mode: string;
  mood: string;
  image: string; // base64 data url
};

export type StoredEvent = {
  id: string;
  timestamp: number;
  event: string;
  payload: any;
};

export type StoredSession = {
  id: string;
  timestamp: number;
  userAgent?: string;
  initialMode?: string;
};

export type DB = {
  config: AppConfig;
  sessions: StoredSession[];
  looks: StoredLook[];
  events: StoredEvent[];
};

const DEFAULT_DB: DB = {
  config: {
    maintenanceMode: false,
    maintenanceMessage: 'We are polishing the mirror. Please check back soon.',
    enabledModes: { MAKEUP: true, CLOTHES: true, HAIR: true },
    features: { audioGuidance: true, shopping: true, vault: true, coach: true },
    limits: { maxLooksPerDay: 3 },
    branding: { watermarkText: 'Everyday Mirror' },
    billing: {
      enabled: true,
      premiumLooksPerDay: 25,
      gateCoachSecondStep: true,
      freeCoachQuestionsPerSession: 1,
      productName: 'Everyday Mirror Premium',
      priceMonthlyBRL: 19.9,
      priceMonthlyUSD: 4.99,
    },
  },
  sessions: [],
  looks: [],
  events: [],
};

const dataDir = path.join(process.cwd(), 'server', 'data');
const dbPath = path.join(dataDir, 'db.json');

function ensureDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
}

export function readDB(): DB {
  ensureDir();
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
    return structuredClone(DEFAULT_DB);
  }
  try {
    const raw = fs.readFileSync(dbPath, 'utf8');
    const parsed = JSON.parse(raw) as DB;
    return {
      ...DEFAULT_DB,
      ...parsed,
      config: { ...DEFAULT_DB.config, ...(parsed.config || {}) },
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      looks: Array.isArray(parsed.looks) ? parsed.looks : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return structuredClone(DEFAULT_DB);
  }
}

export function writeDB(next: DB) {
  ensureDir();
  fs.writeFileSync(dbPath, JSON.stringify(next, null, 2), 'utf8');
}

export function updateDB(mutator: (db: DB) => DB | void): DB {
  const db = readDB();
  const maybe = mutator(db);
  const out = (maybe || db) as DB;
  writeDB(out);
  return out;
}

export function makeId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}
