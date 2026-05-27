# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What This Is

**DJ Ops** is a mobile-first PWA for working DJs to manage events, scan physical paperwork (contracts, run-of-show sheets) with AI, and track pay. It is deployed on Replit and uses Replit's identity system for auth.

---

## Commands

```bash
# Development (runs both servers concurrently)
pnpm dev

# Frontend only (Vite, port 5000)
pnpm dev:client

# Backend only (Express, port 3000, hot-reload via tsx)
pnpm dev:server

# Type-check
npx tsc --noEmit

# Lint
pnpm lint

# Production build
pnpm build

# Database migrations (generate then push)
npx drizzle-kit generate
npx drizzle-kit push
```

There are no automated tests. TypeScript (`npx tsc --noEmit`) is the primary correctness check.

---

## Architecture

### Two-process model

In development, two servers run in parallel:
- **Vite** on port 5000 (frontend dev server with HMR). Vite proxies all `/api/*` requests to the Express server.
- **Express** on port 3000 (`server/index.ts`) — all API routes, AI parsing, database access.

In production, Express serves the Vite-built static output directly from `dist/` and handles all routes.

### Auth

There is no traditional auth system. Replit injects `x-replit-user-id` and `x-replit-user-name` HTTP headers on every request. The Express middleware reads these and attaches `req.userId` / `req.userName`. In dev mode (no Replit headers), the server falls back to `dev-user`.

The frontend fetches `/api/auth/user` on startup and stores the result in a Zustand store (`src/store/authStore.ts`) persisted to localStorage. All event queries are automatically scoped to the authenticated user's ID — the server enforces this via `eq(events.user_id, req.userId)`.

### Database

Neon PostgreSQL accessed via **Drizzle ORM**. The entire schema is in `src/db/schema.ts`. Connection string comes from `NEONDB` or `DATABASE_URL` env vars. The server computes `total_pay` server-side (sum of all pay components) on every create/update — the client never sends `total_pay`.

Migrations live in `drizzle/` and are managed with `drizzle-kit`.

### AI Paperwork Parsing

`POST /api/parse-paperwork` accepts base64-encoded images (HEIC converted server-side via `heic-convert`), sends them to Claude with a detailed extraction prompt, and returns a `ParsedEvent` JSON object. The API key (`ANTHROPIC_API_KEY`) is server-side only — never in the browser bundle.

The parsed result flows through `src/lib/eventMapper.ts::applyParsedData()` which maps it to `EventFormData` for pre-filling the form. The user reviews and edits before saving.

### Data Model

`EventFormData` = everything in the `Event` type except system fields (`id`, `user_id`, `total_pay`, `created_at`, `updated_at`, `paperwork_images`). The server whitelist (`ALLOWED_EVENT_FIELDS` in `server/index.ts`) controls what fields are accepted on create/update.

**Structured fields** (arrays/objects stored as JSONB): `timeline`, `music_selections`, `bridesmaids`, `groomsmen`, `activities`, `music_variety`. These are fully editable in the form via state managed outside of react-hook-form, then merged in `processSubmit`.

### Frontend State

- **Server state**: TanStack Query (`useEvents` hook) — 30s stale time, single cache key per user.
- **Auth state**: Zustand store with localStorage persistence.
- **Form state**: react-hook-form for scalar fields; local `useState` for array/object fields (music selections, timeline, bridesmaids, etc.) merged in `processSubmit`.

### Routing

Five routes, all behind auth: `/` (Dashboard), `/events` (list), `/events/:id` (detail), `/add` (manual entry), `/scan` (AI scan). All page components are lazy-loaded. Layout provides a sticky header and a fixed bottom nav bar. Max content width is `max-w-lg` (mobile-first).

### Styling

Tailwind CSS v4 with custom design tokens defined in `src/index.css` via `@theme`. Dark-only UI. Key token names: `bg-base`, `bg-surface-1/2/3`, `text-primary/secondary/tertiary/quaternary`, `accent` (amber), `success` (green), `danger` (red). Reusable CSS component classes (`.card-elevated`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.badge-*`, `.nav-link`) are defined in `src/index.css` using `@layer components`.

---

## Key Files

| File | Purpose |
|------|---------|
| `server/index.ts` | Entire Express backend — all API routes, auth middleware, AI parsing, DB access |
| `src/db/schema.ts` | Single source of truth for the DB schema (Drizzle) |
| `src/types/event.ts` | `Event`, `EventFormData`, `ParsedEvent`, `MusicSelections`, `PayBreakdown` types |
| `src/lib/eventMapper.ts` | `applyParsedData()` — maps AI-parsed data into form defaults |
| `src/lib/payCalc.ts` | `calculatePay()` — pure function, sums all pay components |
| `src/hooks/useEvents.ts` | All event CRUD via TanStack Query mutations |
| `src/store/authStore.ts` | Zustand auth store (Replit identity) |
| `src/components/EventForm.tsx` | Shared form used by both Add and Scan flows |

---

## Environment Variables

```
NEONDB or DATABASE_URL   # PostgreSQL connection string (required)
ANTHROPIC_API_KEY        # Claude API key for paperwork parsing (server-side only)
API_PORT                 # Express port (default: 3000)
NODE_ENV                 # Set to "production" in deployment
```

On Replit, `AI_INTEGRATIONS_ANTHROPIC_API_KEY` and `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` are used as fallbacks when `ANTHROPIC_API_KEY` is not set directly.
