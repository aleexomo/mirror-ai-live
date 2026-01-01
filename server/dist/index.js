import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { generateHairLook, generateInitialGreeting, generateMakeupLook, generateOutfitLook, generateShoppingItems, generateTutorialSteps, getProgressFeedback, askCoachQuestion, tts, } from './gemini.js';
import { makeId, updateDB, readDB } from './storage.js';
const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.get('/api/health', (_req, res) => {
    res.json({ ok: true, ts: Date.now() });
});
const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;
const adminToken = process.env.ADMIN_TOKEN || '';
function requireAdmin(req, res, next) {
    if (!adminToken)
        return res.status(500).json({ error: 'ADMIN_TOKEN not set on server' });
    const got = req.headers['x-admin-token'] || req.query.token || '';
    if (got !== adminToken)
        return res.status(401).json({ error: 'Unauthorized' });
    return next();
}
app.get('/health', (_req, res) => res.json({ ok: true }));
// Public config (for client toggles)
app.get('/api/config', (_req, res) => {
    const db = readDB();
    res.json(db.config);
});
// Tracking endpoints (used by client)
app.post('/api/users/track', (req, res) => {
    const body = z
        .object({ timestamp: z.number().optional(), userAgent: z.string().optional(), initialMode: z.string().optional() })
        .safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ error: 'Invalid payload' });
    updateDB((db) => {
        db.sessions.unshift({
            id: makeId('sess'),
            timestamp: body.data.timestamp || Date.now(),
            userAgent: body.data.userAgent,
            initialMode: body.data.initialMode,
        });
        db.sessions = db.sessions.slice(0, 2000);
    });
    res.json({ ok: true });
});
app.post('/api/looks/save', (req, res) => {
    const body = z
        .object({ id: z.string().optional(), timestamp: z.number().optional(), mode: z.string(), mood: z.string(), image: z.string() })
        .safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ error: 'Invalid payload' });
    updateDB((db) => {
        db.looks.unshift({
            id: body.data.id || makeId('look'),
            timestamp: body.data.timestamp || Date.now(),
            mode: body.data.mode,
            mood: body.data.mood,
            image: body.data.image,
        });
        db.looks = db.looks.slice(0, 500);
    });
    res.json({ ok: true });
});
app.post('/api/events/click', (req, res) => {
    const body = z
        .object({ event: z.string(), timestamp: z.number().optional() })
        .passthrough()
        .safeParse(req.body);
    if (!body.success)
        return res.status(400).json({ error: 'Invalid payload' });
    updateDB((db) => {
        db.events.unshift({
            id: makeId('evt'),
            timestamp: body.data.timestamp || Date.now(),
            event: body.data.event,
            payload: body.data,
        });
        db.events = db.events.slice(0, 5000);
    });
    res.json({ ok: true });
});
// ===== Gemini endpoints =====
const baseReq = z.object({ lang: z.string().default('en') });
app.post('/api/generate/greeting', async (req, res) => {
    const parsed = baseReq
        .extend({ image: z.string(), mode: z.enum(['MAKEUP', 'CLOTHES', 'HAIR']).default('MAKEUP') })
        .safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    try {
        const text = await generateInitialGreeting(parsed.data.image, parsed.data.mode, parsed.data.lang);
        res.json({ text });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || 'Generation failed' });
    }
});
app.post('/api/generate/makeup', async (req, res) => {
    const parsed = baseReq.extend({ image: z.string(), style: z.string() }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    try {
        const image = await generateMakeupLook(parsed.data.image, parsed.data.style, parsed.data.lang);
        res.json({ image });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || 'Generation failed' });
    }
});
app.post('/api/generate/outfit', async (req, res) => {
    const parsed = baseReq.extend({ image: z.string(), vibe: z.string() }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    try {
        const image = await generateOutfitLook(parsed.data.image, parsed.data.vibe, parsed.data.lang);
        res.json({ image });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || 'Generation failed' });
    }
});
app.post('/api/generate/hair', async (req, res) => {
    const parsed = baseReq.extend({ image: z.string(), look: z.string() }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    try {
        const image = await generateHairLook(parsed.data.image, parsed.data.look, parsed.data.lang);
        res.json({ image });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || 'Generation failed' });
    }
});
app.post('/api/generate/tutorial', async (req, res) => {
    const parsed = baseReq
        .extend({ originalImage: z.string(), targetImage: z.string(), mode: z.enum(['MAKEUP', 'CLOTHES', 'HAIR']) })
        .safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    try {
        const data = await generateTutorialSteps(parsed.data.originalImage, parsed.data.targetImage, parsed.data.mode, parsed.data.lang);
        res.json(data);
    }
    catch (e) {
        res.status(500).json({ error: e?.message || 'Generation failed' });
    }
});
app.post('/api/generate/shopping', async (req, res) => {
    const parsed = baseReq
        .extend({ targetImage: z.string(), mode: z.enum(['MAKEUP', 'CLOTHES', 'HAIR']) })
        .safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    try {
        const items = await generateShoppingItems(parsed.data.targetImage, parsed.data.mode, parsed.data.lang);
        res.json(items);
    }
    catch (e) {
        res.status(500).json({ error: e?.message || 'Shopping generation failed' });
    }
});
app.post('/api/generate/feedback', async (req, res) => {
    const parsed = baseReq
        .extend({ targetImage: z.string(), currentProgressImage: z.string(), currentStep: z.any(), mode: z.enum(['MAKEUP', 'CLOTHES', 'HAIR']) })
        .safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    try {
        const text = await getProgressFeedback(parsed.data.targetImage, parsed.data.currentProgressImage, parsed.data.currentStep, parsed.data.mode, parsed.data.lang);
        res.json({ text });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || 'Feedback failed' });
    }
});
app.post('/api/generate/coach', async (req, res) => {
    const parsed = baseReq
        .extend({ question: z.string(), targetImage: z.string(), currentStep: z.any().optional(), mode: z.enum(['MAKEUP', 'CLOTHES', 'HAIR']) })
        .safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    try {
        const text = await askCoachQuestion(parsed.data.question, parsed.data.targetImage, parsed.data.mode, parsed.data.currentStep, parsed.data.lang);
        res.json({ text });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || 'Coach failed' });
    }
});
app.post('/api/tts', async (req, res) => {
    const parsed = z.object({ text: z.string().min(1), voice: z.string().optional() }).safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    try {
        const audio = await tts(parsed.data.text, parsed.data.voice || 'Kore');
        res.json({ audio });
    }
    catch (e) {
        res.status(500).json({ error: e?.message || 'TTS failed' });
    }
});
// ===== Admin endpoints =====
app.get('/api/admin/overview', requireAdmin, (_req, res) => {
    const db = readDB();
    res.json({
        config: db.config,
        counts: { sessions: db.sessions.length, looks: db.looks.length, events: db.events.length },
        recentSessions: db.sessions.slice(0, 50),
        recentLooks: db.looks.slice(0, 50),
        recentEvents: db.events.slice(0, 100),
    });
});
app.put('/api/admin/config', requireAdmin, (req, res) => {
    const parsed = z
        .object({
        maintenanceMode: z.boolean().optional(),
        maintenanceMessage: z.string().optional(),
        enabledModes: z
            .object({ MAKEUP: z.boolean(), CLOTHES: z.boolean(), HAIR: z.boolean() })
            .partial()
            .optional(),
        features: z
            .object({ audioGuidance: z.boolean(), shopping: z.boolean(), vault: z.boolean(), coach: z.boolean() })
            .partial()
            .optional(),
        limits: z.object({ maxLooksPerDay: z.number().int().min(0).max(50) }).partial().optional(),
        branding: z.object({ watermarkText: z.string() }).partial().optional(),
    })
        .safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid config payload' });
    const next = updateDB((db) => {
        db.config = {
            ...db.config,
            ...parsed.data,
            enabledModes: { ...db.config.enabledModes, ...(parsed.data.enabledModes || {}) },
            features: { ...db.config.features, ...(parsed.data.features || {}) },
            limits: { ...db.config.limits, ...(parsed.data.limits || {}) },
            branding: { ...db.config.branding, ...(parsed.data.branding || {}) },
        };
    });
    res.json(next.config);
});
app.delete('/api/admin/clear', requireAdmin, (req, res) => {
    const parsed = z
        .object({ what: z.enum(['sessions', 'looks', 'events', 'all']) })
        .safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ error: 'Invalid payload' });
    updateDB((db) => {
        if (parsed.data.what === 'sessions' || parsed.data.what === 'all')
            db.sessions = [];
        if (parsed.data.what === 'looks' || parsed.data.what === 'all')
            db.looks = [];
        if (parsed.data.what === 'events' || parsed.data.what === 'all')
            db.events = [];
    });
    res.json({ ok: true });
});
app.listen(PORT, () => {
    console.log(`Mirror backend running on :${PORT}`);
});
