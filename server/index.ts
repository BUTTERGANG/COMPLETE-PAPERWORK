import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import heicConvert from 'heic-convert';
import * as schema from '../src/db/schema';

// Replit's Anthropic integration bills usage to the account via a local proxy,
// exposing AI_INTEGRATIONS_ANTHROPIC_* instead of a raw ANTHROPIC_API_KEY.
// Prefer a directly-set key, otherwise fall back to the Replit integration.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY;
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_API_KEY
  ? undefined
  : process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
  ...(ANTHROPIC_BASE_URL ? { baseURL: ANTHROPIC_BASE_URL } : {}),
});

const { Pool } = pg;

const app = express();

// CORS: restrict to known origins
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:5173',
];
// Replit injects the live domain(s) at runtime — trust them explicitly.
if (process.env.REPLIT_DEV_DOMAIN) ALLOWED_ORIGINS.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
for (const d of (process.env.REPLIT_DOMAINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
  ALLOWED_ORIGINS.push(`https://${d}`);
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Replit proxy)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // Trust any Replit-hosted domain (dev preview or deployment)
    try {
      const host = new URL(origin).hostname;
      if (host.endsWith('.replit.dev') || host.endsWith('.repl.co') || host.endsWith('.replit.app')) {
        return callback(null, true);
      }
    } catch { /* malformed origin — fall through to rejection */ }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '25mb' }));

// Return JSON (not HTML) when an upload exceeds the body-size limit
app.use((err: Error & { type?: string }, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Upload too large. Use fewer images or smaller photos.' });
  }
  next(err);
});

// Extend Express Request type to include user identity
declare global {
  namespace Express {
    interface Request {
      userId: string;
      userName: string;
    }
  }
}

const connectionString = process.env.NEONDB ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error('FATAL: NEONDB or DATABASE_URL environment variable must be set');
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});
const db = drizzle(pool, { schema });

const { events } = schema;

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down...');
  try {
    await pool.end();
  } catch (e) {
    console.error('Error closing pool:', e);
  }
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Auth middleware - extract user from Replit identity headers
app.use((req, res, next) => {
  const userId = req.headers['x-replit-user-id'] as string | undefined;
  const userName = req.headers['x-replit-user-name'] as string | undefined;

  if (!userId) {
    // In production on Replit, the proxy always sets these headers.
    // If they're missing, reject the request.
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    // Dev fallback
    req.userId = 'dev-user';
    req.userName = 'Dev User';
  } else {
    req.userId = userId;
    req.userName = userName || 'Unknown';
  }
  next();
});

// Whitelist of allowed fields for event creation/update
const ALLOWED_EVENT_FIELDS = [
  'event_date', 'event_type',
  'assigned_dj', 'second_assigned', 'system_number', 'dj_attire',
  'venue_name', 'venue_address', 'venue_phone', 'venue_contact', 'venue_notes', 'ceremony_separate_location',
  'client_name', 'client_phone', 'client_email', 'partner_phone', 'partner_email', 'secondary_contact',
  'bride_name', 'groom_name', 'bride_parents', 'groom_parents', 'guest_count',
  'maid_of_honor', 'best_man', 'flower_girl', 'ring_bearer', 'introduction_name', 'bridesmaids', 'groomsmen',
  'pickup_time', 'setup_time', 'guest_arrival_time', 'load_in_time',
  'ceremony_start_time', 'ceremony_end_time', 'start_time', 'end_time', 'booked_hours',
  'dinner_service', 'blessing_by', 'toasts_by', 'take_requests',
  'introduce_couple', 'introduce_wedding_party', 'activities', 'music_variety',
  'pay_type', 'base_pay', 'compliance_bonus', 'over_hours_pay', 'fuel_recovery', 'tip', 'overtime_pay', 'other_pay',
  'timeline', 'music_selections', 'special_instructions',
  'notes', 'raw_ai_summary', 'paperwork_images', 'status',
] as const;

// Pay components summed into total_pay.
const PAY_COMPONENTS = [
  'base_pay', 'compliance_bonus', 'over_hours_pay', 'fuel_recovery', 'tip', 'overtime_pay', 'other_pay',
] as const;

function pickFields(body: Record<string, unknown>, allowed: readonly string[]) {
  const result: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) result[key] = body[key];
  }
  return result;
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Get current user identity
app.get('/api/auth/user', (req, res) => {
  res.json({ userId: req.userId, userName: req.userName });
});

// Convert HEIC/HEIF (iPhone photos) to JPEG. Browser-side decoders rely on a
// libheif wasm that fails to load under our Vite bundle, so we decode on the
// server where libheif loads straight from disk.
app.post('/api/convert-heic', async (req, res) => {
  try {
    const { base64Image } = req.body as { base64Image?: string };
    if (!base64Image) {
      return res.status(400).json({ error: 'base64Image is required' });
    }
    const inputBuffer = Buffer.from(base64Image, 'base64');
    const outputBuffer = await heicConvert({
      buffer: inputBuffer,
      format: 'JPEG',
      quality: 0.9,
    });
    const base64Jpeg = Buffer.from(outputBuffer).toString('base64');
    res.json({ base64Jpeg });
  } catch (e) {
    console.error('Failed to convert HEIC:', e instanceof Error ? e.message : 'Unknown error');
    res.status(422).json({ error: 'Could not read this photo. Please try a different image.' });
  }
});

// Parse paperwork with AI (server-side, keeps API key secret)
app.post('/api/parse-paperwork', async (req, res) => {
  try {
    if (!ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI parsing is not configured — the Anthropic API key is not set.' });
    }

    const body = req.body as { base64Images?: string[]; base64Image?: string };
    // Accept an array of images (multi-page paperwork) or a single image.
    const images = body.base64Images ?? (body.base64Image ? [body.base64Image] : []);
    if (images.length === 0) {
      return res.status(400).json({ error: 'base64Images is required' });
    }

    const detectMediaType = (b64: string): 'image/jpeg' | 'image/png' | 'image/webp' => {
      if (b64.startsWith('iVBOR')) return 'image/png';
      if (b64.startsWith('UklGR')) return 'image/webp';
      return 'image/jpeg';
    };

    const PROMPT = `You are parsing a DJ event worksheet or run-of-show document. It may span MULTIPLE images/pages — treat all of them as ONE document and merge the information. Extract ALL available information and return ONLY a JSON object with these fields:

{
  "event_date": "YYYY-MM-DD or null",
  "event_type": "wedding|corporate|birthday|club|prom|school|holiday|anniversary|other or null",
  "assigned_dj": "assigned DJ / DRP name (and phone) or null",
  "second_assigned": "second assigned DJ/assistant or null",
  "system_number": "system number or null",
  "dj_attire": "requested DJ attire (e.g. semi-formal) or null",
  "venue_name": "string or null",
  "venue_address": "string or null",
  "venue_phone": "venue phone or null",
  "venue_contact": "venue coordinator name or null",
  "venue_notes": "parking/load-in/noise restrictions or null",
  "ceremony_separate_location": true if ceremony is in a different location/room than the reception, false if same, else null,
  "bride_name": "bride full name or null",
  "groom_name": "groom full name or null",
  "bride_parents": "bride's parents' names or null",
  "groom_parents": "groom's/fiancé's parents' names or null",
  "client_name": "primary contact or null",
  "client_phone": "primary contact phone or null",
  "client_email": "primary contact email or null",
  "partner_phone": "fiancé/partner phone or null",
  "partner_email": "fiancé/partner email or null",
  "secondary_contact": "planner/coordinator or null",
  "guest_count": number or null,
  "maid_of_honor": "maid/matron of honor name(s) or null",
  "best_man": "best man/person name(s) or null",
  "flower_girl": "flower girl name or null",
  "ring_bearer": "ring bearer name or null",
  "introduction_name": "how the couple wants to be introduced (e.g. Mr. and Mrs. Smith) or null",
  "bridesmaids": ["bridesmaid name"],
  "groomsmen": ["groomsman name"],
  "pickup_time": "HH:MM or null",
  "setup_time": "HH:MM (DJ setup time) or null",
  "guest_arrival_time": "HH:MM or null",
  "load_in_time": "HH:MM or null",
  "ceremony_start_time": "HH:MM (ceremony DJ start) or null",
  "ceremony_end_time": "HH:MM (ceremony DJ end) or null",
  "start_time": "HH:MM (reception start) or null",
  "end_time": "HH:MM (reception end) or null",
  "booked_hours": number of hours booked or null,
  "dinner_service": "seated|buffet or null",
  "blessing_by": "who gives the blessing or null",
  "toasts_by": "who is giving toasts or null",
  "take_requests": true/false if the take-requests question is answered, else null,
  "introduce_couple": true if the DJ should introduce the couple into the reception, false if explicitly not, else null,
  "introduce_wedding_party": true if the DJ should introduce the wedding party into the reception, false if explicitly not, else null,
  "activities": ["selected group dance / icebreaker activity (e.g. Cha-Cha Slide, Cupid Shuffle, YMCA, Wobble)"],
  "music_variety": ["selected music variety / genre (e.g. 80s, 90s, Top 40, Classic Country, Current Hip Hop)"],
  "base_pay": base wage number or null,
  "pay_type": "flat|hourly|negotiable or null",
  "compliance_bonus": 40 if mentioned otherwise null,
  "over_hours_pay": dollar amount for the "over X hours" line, or null,
  "fuel_recovery": dollar amount stated in the fuel recovery / fuel reimbursement section, or null,
  "tip": tip dollar amount or null,
  "overtime_pay": overtime dollar amount or null,
  "other_pay": other/misc pay dollar amount or null,
  "timeline": [{"time": "HH:MM", "activity": "description"}],
  "music_selections": {
    "background_music": "type of background music requested (e.g. Classical) or null",
    "escorting_mothers": "escorting mothers song – artist or null",
    "pre_processional": "pre-processional / wedding party song – artist or null",
    "ceremony_processional": "processional / ceremony grand entrance song – artist or null",
    "unity_ceremony": "unity candle / sand ceremony song – artist or null",
    "ceremony_recessional": "recessional song – artist or null",
    "ceremony_interlude": "any other ceremony interlude song – artist or null",
    "grand_entrance": "reception entrance song (bride & groom entrance) – artist or null",
    "first_dance": "first dance song – artist or null",
    "father_daughter_dance": "father/daughter dance song – artist or null",
    "mother_son_dance": "mother/son dance song – artist or null",
    "parents_dance": "parents dance song – artist or null",
    "wedding_party_dance": "wedding party dance song – artist or null",
    "other_dedication": "any other dedication dance song – artist or null",
    "cake_cutting": "song – artist or null",
    "bouquet_toss": "song – artist or null",
    "garter_toss": "song – artist or null",
    "last_dance": "song – artist or null",
    "send_off_exit": "song – artist or null",
    "must_play": ["additional song requests they want played"],
    "do_not_play": ["songs on the do-not-play list"],
    "music_preferences": "any other genre/vibe notes or null"
  },
  "special_instructions": "equipment/dress code/announcements or null",
  "notes": "any other details or null"
}

Use null (or [] for lists) for anything not present. Merge duplicate info across pages. Return ONLY the JSON object, no markdown.`;

    const imageBlocks = images.map((data) => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: detectMediaType(data), data },
    }));

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          ...imageBlocks,
          { type: 'text', text: PROMPT },
        ],
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from AI');
    }
    const text = content.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('AI could not extract event details. Try a clearer photo.');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (e) {
    console.error('Failed to parse paperwork:', e instanceof Error ? e.message : 'Unknown error');
    res.status(500).json({ error: e instanceof Error ? e.message : 'Failed to parse paperwork' });
  }
});

// Get all events for the current user (exclude heavy image column from list)
app.get('/api/events', async (req, res) => {
  try {
    const result = await db.query.events.findMany({
      where: eq(events.user_id, req.userId),
      orderBy: (events, { desc }) => [desc(events.event_date)],
      columns: { paperwork_images: false },
    });
    res.json(result);
  } catch (e) {
    console.error('Failed to fetch events:', e instanceof Error ? e.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Get a single event by ID
app.get('/api/events/:id', async (req, res) => {
  try {
    const event = await db.query.events.findFirst({
      where: and(eq(events.id, req.params.id), eq(events.user_id, req.userId)),
    });
    if (!event) return res.status(404).json({ error: 'Not found' });
    res.json(event);
  } catch (e) {
    console.error('Failed to fetch event:', e instanceof Error ? e.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Create a new event
app.post('/api/events', async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const now = new Date();
    const body = pickFields(req.body as Record<string, unknown>, ALLOWED_EVENT_FIELDS);

    // Validate required fields
    if (!body.event_date) {
      return res.status(400).json({ error: 'event_date is required' });
    }

    // Compute total_pay server-side
    const totalPay = PAY_COMPONENTS.reduce((sum, key) => sum + Number(body[key] ?? 0), 0);

    const newEvent = {
      ...body,
      id,
      user_id: req.userId,
      total_pay: totalPay,
      created_at: now,
      updated_at: now,
    };
    const [created] = await db.insert(events).values(newEvent).returning();
    res.status(201).json(created);
  } catch (e) {
    console.error('Failed to create event:', e instanceof Error ? e.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update an existing event
app.put('/api/events/:id', async (req, res) => {
  try {
    const body = pickFields(req.body as Record<string, unknown>, ALLOWED_EVENT_FIELDS);

    // If pay-related fields are being updated, recompute total_pay
    const hasPayFields = PAY_COMPONENTS.some((key) => key in body);

    const updateData: Record<string, unknown> = { ...body, updated_at: new Date() };

    if (hasPayFields) {
      // Fetch current values for any fields not being updated
      const current = await db.query.events.findFirst({
        where: and(eq(events.id, req.params.id), eq(events.user_id, req.userId)),
        columns: Object.fromEntries(PAY_COMPONENTS.map((k) => [k, true])),
      });
      if (!current) return res.status(404).json({ error: 'Not found' });

      const currentRow = current as Record<string, number | null>;
      updateData.total_pay = PAY_COMPONENTS.reduce(
        (sum, key) => sum + Number(body[key] ?? currentRow[key] ?? 0),
        0,
      );
    }

    const [updated] = await db.update(events)
      .set(updateData)
      .where(and(eq(events.id, req.params.id), eq(events.user_id, req.userId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) {
    console.error('Failed to update event:', e instanceof Error ? e.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete an event
app.delete('/api/events/:id', async (req, res) => {
  try {
    const result = await db.delete(events)
      .where(and(eq(events.id, req.params.id), eq(events.user_id, req.userId)))
      .returning({ id: events.id });
    if (result.length === 0) return res.status(404).json({ error: 'Not found' });
    res.status(204).send();
  } catch (e) {
    console.error('Failed to delete event:', e instanceof Error ? e.message : 'Unknown error');
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Serve built client in production
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '../dist');

app.use(express.static(distPath));
app.get('/*splat', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) res.status(404).send('Not found');
  });
});

const PORT = process.env.API_PORT || 3000;
app.listen(PORT, () => console.log(`API server running on :${PORT}`));
