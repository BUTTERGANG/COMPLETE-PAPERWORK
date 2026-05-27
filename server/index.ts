import express from 'express';
import cors from 'cors';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import pg from 'pg';
import Anthropic from '@anthropic-ai/sdk';
import * as schema from '../src/db/schema';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const { Pool } = pg;

const app = express();

// CORS: restrict to known origins
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:5173',
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Replit proxy)
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    // In Replit production, the proxy strips origin — allow it
    if (process.env.REPLIT_ENVIRONMENT) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Extend Express Request type to include user identity
declare global {
  namespace Express {
    interface Request {
      userId: string;
      userName: string;
    }
  }
}

const pool = new Pool({
  connectionString: process.env.NEONDB ?? process.env.DATABASE_URL,
  max: 5,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
});
const db = drizzle(pool, { schema });

const { events } = schema;

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down...');
  await pool.end();
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
  'event_date', 'event_type', 'venue_name', 'venue_address',
  'client_name', 'client_phone', 'client_email', 'start_time', 'end_time',
  'base_pay', 'compliance_bonus', 'mileage_miles', 'mileage_rate',
  'notes', 'raw_ai_summary', 'paperwork_image_data', 'status',
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

// Parse paperwork with AI (server-side, keeps API key secret)
app.post('/api/parse-paperwork', async (req, res) => {
  try {
    const { base64Image } = req.body as { base64Image?: string };
    if (!base64Image) {
      return res.status(400).json({ error: 'base64Image is required' });
    }

    // Detect media type from magic bytes
    let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg';
    if (base64Image.startsWith('iVBOR')) mediaType = 'image/png';
    else if (base64Image.startsWith('UklGR')) mediaType = 'image/webp';

    const PROMPT = `You are parsing a DJ event worksheet or run-of-show document. Extract ALL available information and return ONLY a JSON object with these fields:

{
  "event_date": "YYYY-MM-DD or null",
  "event_type": "wedding|corporate|birthday|club|prom|school|holiday|anniversary|other or null",
  "venue_name": "string or null",
  "venue_address": "string or null",
  "venue_phone": "venue phone or null",
  "venue_contact": "venue coordinator name or null",
  "venue_notes": "parking/load-in/noise restrictions or null",
  "bride_name": "bride full name or null",
  "groom_name": "groom full name or null",
  "client_name": "primary contact or null",
  "client_phone": "string or null",
  "client_email": "string or null",
  "secondary_contact": "planner/coordinator or null",
  "guest_count": number or null,
  "load_in_time": "HH:MM or null",
  "start_time": "HH:MM or null",
  "end_time": "HH:MM or null",
  "base_pay": number or null,
  "pay_type": "flat|hourly|negotiable or null",
  "compliance_bonus": 40 if mentioned otherwise null,
  "mileage_miles": number or null,
  "timeline": [{"time": "HH:MM", "activity": "description"}],
  "music_selections": {
    "first_dance": "song – artist or null",
    "father_daughter_dance": "song – artist or null",
    "mother_son_dance": "song – artist or null",
    "cake_cutting": "song – artist or null",
    "bouquet_toss": "song – artist or null",
    "garter_toss": "song – artist or null",
    "grand_entrance": "song – artist or null",
    "last_dance": "song – artist or null",
    "send_off_exit": "song – artist or null",
    "ceremony_processional": "song – artist or null",
    "ceremony_recessional": "song – artist or null",
    "ceremony_interlude": "song – artist or null",
    "must_play": ["song 1"],
    "do_not_play": ["song 1"],
    "music_preferences": "genre/vibe notes or null"
  },
  "special_instructions": "equipment/dress code/announcements or null",
  "notes": "any other details or null"
}

Return ONLY the JSON object, no markdown.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
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
      columns: { paperwork_image_data: false },
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
    const basePay = Number(body.base_pay ?? 0);
    const complianceBonus = Number(body.compliance_bonus ?? 0);
    const mileageMiles = Number(body.mileage_miles ?? 0);
    const mileageRate = Number(body.mileage_rate ?? 0);
    const totalPay = basePay + complianceBonus + (mileageMiles * mileageRate);

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
    const hasPayFields = 'base_pay' in body || 'compliance_bonus' in body ||
      'mileage_miles' in body || 'mileage_rate' in body;

    let updateData: Record<string, unknown> = { ...body, updated_at: new Date() };

    if (hasPayFields) {
      // Fetch current values for any fields not being updated
      const current = await db.query.events.findFirst({
        where: and(eq(events.id, req.params.id), eq(events.user_id, req.userId)),
        columns: { base_pay: true, compliance_bonus: true, mileage_miles: true, mileage_rate: true },
      });
      if (!current) return res.status(404).json({ error: 'Not found' });

      const basePay = Number(body.base_pay ?? current.base_pay ?? 0);
      const complianceBonus = Number(body.compliance_bonus ?? current.compliance_bonus ?? 0);
      const mileageMiles = Number(body.mileage_miles ?? current.mileage_miles ?? 0);
      const mileageRate = Number(body.mileage_rate ?? current.mileage_rate ?? 0);
      updateData.total_pay = basePay + complianceBonus + (mileageMiles * mileageRate);
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
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, '../dist');

app.use(express.static(distPath));
app.get('/{*path}', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.API_PORT || 3000;
app.listen(PORT, () => console.log(`API server running on :${PORT}`));
