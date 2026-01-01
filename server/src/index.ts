import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import Stripe from 'stripe';
import {
  generateHairLook,
  generateInitialGreeting,
  generateMakeupLook,
  generateOutfitLook,
  generateShoppingItems,
  generateTutorialSteps,
  getProgressFeedback,
  askCoachQuestion,
  tts,
  MirrorMode,
} from './gemini.js';
import { makeId, updateDB, readDB, AppConfig } from './storage.js';


const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  : null;

const adminToken = process.env.ADMIN_TOKEN || '';
function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!adminToken) return res.status(500).json({ error: 'ADMIN_TOKEN not set on server' });
  const got = (req.headers['x-admin-token'] as string) || (req.query.token as string) || '';
  if (got !== adminToken) return res.status(401).json({ error: 'Unauthorized' });
  return next();
}

app.get('/health', (_req, res) => res.json({ ok: true }));

// Public config (for client toggles)
app.get('/api/config', (_req, res) => {
  const db = readDB();
  res.json(db.config);
});

// ===== Billing (Stripe / Pix) =====
app.post('/api/billing/create-checkout', async (req, res) => {
  const parsed = z
    .object({
      method: z.enum(['card', 'pix']),
      country: z.string().optional(),
      lang: z.string().optional(),
      reason: z.string().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  if (!stripe) return res.status(500).json({ error: 'STRIPE_SECRET_KEY not set on server' });

  const db = readDB();
  const billing = db.config.billing || {
    enabled: true,
    premiumLooksPerDay: 25,
    gateCoachSecondStep: true,
    freeCoachQuestionsPerSession: 1,
    productName: 'Everyday Mirror Premium',
    priceMonthlyBRL: 19.9,
    priceMonthlyUSD: 4.99,
  };
  if (billing.enabled === false) return res.status(403).json({ error: 'Billing disabled' });

  const isBR = (parsed.data.country || '').toUpperCase() === 'BR';
  const currency = isBR ? 'brl' : 'usd';
  const unitAmount = Math.round((isBR ? billing.priceMonthlyBRL : billing.priceMonthlyUSD) * 100);

  if (parsed.data.method === 'pix' && !isBR) {
    return res.status(400).json({ error: 'Pix is only available in Brazil' });
  }

  const origin = (process.env.PUBLIC_URL || req.get('origin') || 'http://localhost:5173').replace(/\/$/, '');
  const successUrl = `${origin}/?premium=1&src=stripe&reason=${encodeURIComponent(parsed.data.reason || '')}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/?cancel=1`;

  try {
    const paymentMethodTypes = parsed.data.method === 'pix' ? (['pix'] as any) : (['card'] as any);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: paymentMethodTypes,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency,
            unit_amount: unitAmount,
            recurring: { interval: 'month' },
            product_data: {
              name: billing.productName,
              description: 'More daily looks + full coaching + personal shopper',
            },
          },
        },
      ],
      allow_promotion_codes: true,
      success_url: successUrl,
      cancel_url: cancelUrl,
      locale: (parsed.data.lang || 'en').slice(0, 2) as any,
      metadata: {
        country: parsed.data.country || '',
        reason: parsed.data.reason || '',
        lang: parsed.data.lang || '',
      },
    });
    return res.json({ url: session.url });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || 'Checkout failed' });
  }
});

// Tracking endpoints (used by client)
app.post('/api/users/track', (req, res) => {
  const body = z
    .object({ timestamp: z.number().optional(), userAgent: z.string().optional(), initialMode: z.string().optional() })
    .safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: 'Invalid payload' });
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
  if (!body.success) return res.status(400).json({ error: 'Invalid payload' });
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
  if (!body.success) return res.status(400).json({ error: 'Invalid payload' });
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
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  try {
    const text = await generateInitialGreeting(parsed.data.image, parsed.data.mode as MirrorMode, parsed.data.lang);
    res.json({ text });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Generation failed' });
  }
});

app.post('/api/generate/makeup', async (req, res) => {
  const parsed = baseReq.extend({ image: z.string(), style: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  try {
    const image = await generateMakeupLook(parsed.data.image, parsed.data.style, parsed.data.lang);
    res.json({ image });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Generation failed' });
  }
});

app.post('/api/generate/outfit', async (req, res) => {
  const parsed = baseReq.extend({ image: z.string(), vibe: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  try {
    const image = await generateOutfitLook(parsed.data.image, parsed.data.vibe, parsed.data.lang);
    res.json({ image });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Generation failed' });
  }
});

app.post('/api/generate/hair', async (req, res) => {
  const parsed = baseReq.extend({ image: z.string(), look: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  try {
    const image = await generateHairLook(parsed.data.image, parsed.data.look, parsed.data.lang);
    res.json({ image });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Generation failed' });
  }
});

app.post('/api/generate/tutorial', async (req, res) => {
  const parsed = baseReq
    .extend({ originalImage: z.string(), targetImage: z.string(), mode: z.enum(['MAKEUP', 'CLOTHES', 'HAIR']) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  try {
    const data = await generateTutorialSteps(
      parsed.data.originalImage,
      parsed.data.targetImage,
      parsed.data.mode as MirrorMode,
      parsed.data.lang
    );
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Generation failed' });
  }
});

app.post('/api/generate/shopping', async (req, res) => {
  const parsed = baseReq
    .extend({ targetImage: z.string(), mode: z.enum(['MAKEUP', 'CLOTHES', 'HAIR']) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  try {
    const items = await generateShoppingItems(parsed.data.targetImage, parsed.data.mode as MirrorMode, parsed.data.lang);
    res.json(items);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Shopping generation failed' });
  }
});

app.post('/api/generate/feedback', async (req, res) => {
  const parsed = baseReq
    .extend({ targetImage: z.string(), currentProgressImage: z.string(), currentStep: z.any(), mode: z.enum(['MAKEUP', 'CLOTHES', 'HAIR']) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  try {
    const text = await getProgressFeedback(
      parsed.data.targetImage,
      parsed.data.currentProgressImage,
      parsed.data.currentStep,
      parsed.data.mode as MirrorMode,
      parsed.data.lang
    );
    res.json({ text });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Feedback failed' });
  }
});

app.post('/api/generate/coach', async (req, res) => {
  const parsed = baseReq
    .extend({ question: z.string(), targetImage: z.string(), currentStep: z.any().optional(), mode: z.enum(['MAKEUP', 'CLOTHES', 'HAIR']) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  try {
    const text = await askCoachQuestion(
      parsed.data.question,
      parsed.data.targetImage,
      parsed.data.mode as MirrorMode,
      parsed.data.currentStep,
      parsed.data.lang
    );
    res.json({ text });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Coach failed' });
  }
});

app.post('/api/tts', async (req, res) => {
  const parsed = z.object({ text: z.string().min(1), voice: z.string().optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  try {
    const audio = await tts(parsed.data.text, parsed.data.voice || 'Kore');
    res.json({ audio });
  } catch (e: any) {
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
      billing: z
        .object({
          enabled: z.boolean().optional(),
          premiumLooksPerDay: z.number().int().min(0).max(200).optional(),
          gateCoachSecondStep: z.boolean().optional(),
          freeCoachQuestionsPerSession: z.number().int().min(0).max(50).optional(),
          productName: z.string().optional(),
          priceMonthlyBRL: z.number().min(0).optional(),
          priceMonthlyUSD: z.number().min(0).optional(),
        })
        .partial()
        .optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid config payload' });

  const next = updateDB((db) => {
    db.config = {
      ...db.config,
      ...parsed.data,
      enabledModes: { ...db.config.enabledModes, ...(parsed.data.enabledModes || {}) },
      features: { ...db.config.features, ...(parsed.data.features || {}) },
      limits: { ...db.config.limits, ...(parsed.data.limits || {}) },
      branding: { ...db.config.branding, ...(parsed.data.branding || {}) },
      billing: { ...(db.config.billing || {}), ...(parsed.data.billing || {}) },
    } as AppConfig;
  });

  res.json(next.config);
});

app.delete('/api/admin/clear', requireAdmin, (req, res) => {
  const parsed = z
    .object({ what: z.enum(['sessions', 'looks', 'events', 'all']) })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payload' });
  updateDB((db) => {
    if (parsed.data.what === 'sessions' || parsed.data.what === 'all') db.sessions = [];
    if (parsed.data.what === 'looks' || parsed.data.what === 'all') db.looks = [];
    if (parsed.data.what === 'events' || parsed.data.what === 'all') db.events = [];
  });
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Mirror backend running on :${PORT}`);
});
