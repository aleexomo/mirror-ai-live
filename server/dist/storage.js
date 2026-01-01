import fs from 'fs';
import path from 'path';
const DEFAULT_DB = {
    config: {
        maintenanceMode: false,
        maintenanceMessage: 'We are polishing the mirror. Please check back soon.',
        enabledModes: { MAKEUP: true, CLOTHES: true, HAIR: true },
        features: { audioGuidance: true, shopping: true, vault: true, coach: true },
        limits: { maxLooksPerDay: 3 },
        branding: { watermarkText: 'Everyday Mirror' },
    },
    sessions: [],
    looks: [],
    events: [],
};
const dataDir = path.join(process.cwd(), 'server', 'data');
const dbPath = path.join(dataDir, 'db.json');
function ensureDir() {
    if (!fs.existsSync(dataDir))
        fs.mkdirSync(dataDir, { recursive: true });
}
export function readDB() {
    ensureDir();
    if (!fs.existsSync(dbPath)) {
        fs.writeFileSync(dbPath, JSON.stringify(DEFAULT_DB, null, 2), 'utf8');
        return structuredClone(DEFAULT_DB);
    }
    try {
        const raw = fs.readFileSync(dbPath, 'utf8');
        const parsed = JSON.parse(raw);
        return {
            ...DEFAULT_DB,
            ...parsed,
            config: { ...DEFAULT_DB.config, ...(parsed.config || {}) },
            sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
            looks: Array.isArray(parsed.looks) ? parsed.looks : [],
            events: Array.isArray(parsed.events) ? parsed.events : [],
        };
    }
    catch {
        return structuredClone(DEFAULT_DB);
    }
}
export function writeDB(next) {
    ensureDir();
    fs.writeFileSync(dbPath, JSON.stringify(next, null, 2), 'utf8');
}
export function updateDB(mutator) {
    const db = readDB();
    const maybe = mutator(db);
    const out = (maybe || db);
    writeDB(out);
    return out;
}
export function makeId(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}
