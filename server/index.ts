import express from 'express';
import cors from 'cors';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq, and } from 'drizzle-orm';
import pg from 'pg';
import * as schema from '../src/db/schema';

const { Pool } = pg;

const app = express();
app.use(cors());
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

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema });

const { events } = schema;

// Auth middleware - extract user from Replit identity headers
app.use((req, _res, next) => {
  req.userId = (req.headers['x-replit-user-id'] as string) || 'dev-user';
  req.userName = (req.headers['x-replit-user-name'] as string) || 'Dev User';
  next();
});

// Get all events for the current user
app.get('/api/events', async (req, res) => {
  try {
    const result = await db.query.events.findMany({
      where: eq(events.user_id, req.userId),
      orderBy: (events, { desc }) => [desc(events.event_date)],
    });
    res.json(result);
  } catch (e) {
    console.error('Failed to fetch events:', e);
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
    console.error('Failed to fetch event:', e);
    res.status(500).json({ error: 'Failed to fetch event' });
  }
});

// Create a new event
app.post('/api/events', async (req, res) => {
  try {
    const id = crypto.randomUUID();
    const now = new Date();
    const newEvent = { ...req.body, id, user_id: req.userId, created_at: now, updated_at: now };
    const [created] = await db.insert(events).values(newEvent).returning();
    res.status(201).json(created);
  } catch (e) {
    console.error('Failed to create event:', e);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update an existing event
app.put('/api/events/:id', async (req, res) => {
  try {
    const [updated] = await db.update(events)
      .set({ ...req.body, updated_at: new Date() })
      .where(and(eq(events.id, req.params.id), eq(events.user_id, req.userId)))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (e) {
    console.error('Failed to update event:', e);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete an event
app.delete('/api/events/:id', async (req, res) => {
  try {
    await db.delete(events)
      .where(and(eq(events.id, req.params.id), eq(events.user_id, req.userId)));
    res.status(204).send();
  } catch (e) {
    console.error('Failed to delete event:', e);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

const PORT = process.env.API_PORT || 3000;
app.listen(PORT, () => console.log(`API server running on :${PORT}`));
