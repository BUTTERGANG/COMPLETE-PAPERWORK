# Supabase → NeonDB Migration: Code Review Report

**Date:** 2026-05-26
**Commit:** `b8d33d9` — "Migrate from Supabase to NeonDB + Express backend"
**Scope:** 24 files, +383/-479 lines
**Reviewers:** 6 specialized agents (Security, Code Quality, Architecture, Performance, Dependencies, Auth)

---

## Executive Summary

The migration is architecturally sound but has **4 critical bugs** that will cause runtime crashes or data corruption, **5 high-severity items** including a critical security regression (API key exposed to browser), and numerous medium/low findings. The app should not be deployed until the critical items are resolved.

**Overall Rating:** ⚠️ Functional but needs fixes before production

---

## 🔴 CRITICAL — Fix Immediately (Will Break In Production)

### 1. `src/pages/Login.tsx:47` — `handleSubmit` is undefined → Runtime crash
**Severity:** CRITICAL | Found by: Auth Agent, Code Quality Agent

The form's `onSubmit` references `handleSubmit` but the function is defined as `handleLogin`. Pressing Enter on the login form throws `ReferenceError: handleSubmit is not defined`.

**Fix:** Change `onSubmit={handleSubmit}` to `onSubmit={handleLogin}`.

### 2. `/api/auth/user` endpoint missing → All users become `dev-user`
**Severity:** CRITICAL | Found by: Auth Agent, Architecture Agent, Code Quality Agent

`authStore.ts:20` calls `fetch('/api/auth/user')` but this route doesn't exist in `server/index.ts`. The 404 is silently caught, and every user — even on real Replit — falls back to `userId: 'dev-user'`. All users share the same data.

**Fix:** Add to `server/index.ts`:
```ts
app.get('/api/auth/user', (req, res) => {
  res.json({ userId: req.userId, userName: req.userName });
});
```

### 3. Raw `req.body` spread into DB insert → Mass assignment vulnerability
**Severity:** CRITICAL | Found by: Security Agent, Code Quality Agent

`server/index.ts:69` does `{ ...req.body, id, user_id: req.userId }` — a client can inject `total_pay`, `created_at`, or other fields. On PUT, a client could even inject `user_id` to take over another user's event.

**Fix:** Whitelist allowed fields:
```ts
const ALLOWED = ['event_date','event_type','venue_name','venue_address',
  'client_name','client_phone','client_email','start_time','end_time',
  'base_pay','compliance_bonus','mileage_miles','mileage_rate','notes',
  'raw_ai_summary','paperwork_image_data','status'];
const body: Record<string, unknown> = {};
for (const key of ALLOWED) if (key in req.body) body[key] = req.body[key];
```

### 4. `numeric` columns return strings, TypeScript types say `number` → Silent math corruption
**Severity:** CRITICAL | Found by: Code Quality Agent

Drizzle's `pg` driver returns all `numeric` columns as **JavaScript strings**. The `Event` interface types `base_pay`, `compliance_bonus`, `mileage_miles`, `mileage_rate`, and `total_pay` as `number`. Code like `sum + e.total_pay` will do string concatenation instead of addition.

**Fix:** Change `numeric('col', { precision: 10, scale: 2 })` to `numeric('col', { precision: 10, scale: 2, mode: 'number' })` in `schema.ts`.

---

## 🔴 HIGH — Fix Before Deployment

### 5. Anthropic API key exposed to browser via `VITE_` prefix 🔑
**Severity:** HIGH | Found by: Security Agent, Performance Agent

`src/lib/claude.ts` uses `import.meta.env.VITE_ANTHROPIC_API_KEY` with `dangerouslyAllowBrowser: true`. The key is inlined into the JS bundle — anyone can extract it from DevTools. The old Supabase version correctly kept this server-side in an edge function.

**Fix:** Move AI parsing to Express:
```ts
// server/index.ts
app.post('/api/parse-paperwork', async (req, res) => {
  // Use process.env.ANTHROPIC_API_KEY (server-side, not exposed)
  const result = await callAnthropic(req.body.base64Image);
  res.json(result);
});
```
Remove `VITE_ANTHROPIC_API_KEY` from `.env` and the client-side `claude.ts`.

### 6. Auth middleware trusts spoofable headers on public port 3000
**Severity:** HIGH | Found by: Security Agent, Auth Agent

`server/index.ts:30-34` reads `x-replit-user-id` directly from headers. Port 3000 is exposed externally in `.replit`. Any attacker can hit `:3000/api/events` with a forged header and access any user's data.

**Fixes (pick one):**
- Remove `externalPort: 3000` from `.replit` — only expose port 8080
- Add environment guard: reject requests without valid identity in production

### 7. Dead code: `src/db/index.ts` — unused neon-http client
**Severity:** HIGH | Found by: Architecture Agent, Performance Agent, Dependency Agent

`src/db/index.ts` creates a Drizzle client via `@neondatabase/serverless` reading `VITE_NEON_DATABASE_URL`. It is **never imported by any other file**. The `VITE_` prefix would expose the database URL to the browser if it were used. Bundles unnecessary code.

**Fix:** Delete `src/db/index.ts`, remove `@neondatabase/serverless` from `package.json`.

### 8. No rate limiting + CORS open to all origins
**Severity:** HIGH | Found by: Security Agent

`cors()` on `server/index.ts:11` allows any origin. No rate limiting anywhere. Combined with the public port, attackers can enumerate events, spam database records (up to 10MB each), and exhaust API credits.

**Fix:**
```ts
import rateLimit from 'express-rate-limit';
app.use(cors({ origin: 'https://your-repl-name.repl.co' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
```

### 9. No server-side input validation on POST/PUT
**Severity:** HIGH | Found by: Security Agent

Missing required field checks, no type validation, no format validation. A missing `event_date` (NOT NULL in schema) causes an unhelpful 500. Add Zod schema validation.

### 10. `dev-user` fallback has no production guard
**Severity:** HIGH | Found by: Security Agent, Auth Agent

If `x-replit-user-id` is absent, the server silently becomes `dev-user`. No `NODE_ENV` check — any misconfiguration in production silently authenticates everyone as the same user.

---

## 🟡 MEDIUM — Fix When Convenient

### 11. No database indexes on `user_id`
Every query filters by `user_id` but has no index → full table scan on every request.
```ts
// In schema.ts, add to table definition:
(table) => ({
  userIdIdx: index('events_user_id_idx').on(table.user_id),
  userDateIdx: index('events_user_date_idx').on(table.user_id, table.event_date),
})
```

### 12. `event_date` stored as `text` instead of `date`
No date validation at DB level, no date arithmetic possible. Works by luck (ISO format sorts lexicographically). Change to `date('event_date')`.

### 13. Base64 images returned in list query → blobby responses
`GET /api/events` returns ALL columns including `paperwork_image_data`. Every list load fetches all images. Exclude it from the list endpoint.

### 14. Optimistic update ignores sort order
`useEvents.ts` prepends new events regardless of date. An event for a past date appears at the top until refetch. Use `invalidateQueries` instead.

### 15. `total_pay` not computed server-side
Accepted from client input. A user can set any value. Compute server-side: `base_pay + compliance_bonus + (mileage_miles * mileage_rate)`.

### 16. No graceful shutdown for PG Pool
Connections leak on server restart. Add `pool.end()` on `SIGTERM`/`SIGINT`.

### 17. Pool has no timeouts configured for NeonDB serverless
Add `max: 5`, `connectionTimeoutMillis: 10000`, `idleTimeoutMillis: 30000`.

### 18. No Drizzle migration files generated
Schema exists in code but cannot be deployed to a new database. Run `npx drizzle-kit generate` and commit the migration SQL.

### 19. No `/api/health` endpoint
Needed for Replit deployment readiness checks and keeping NeonDB compute warm.

### 20. Express doesn't serve static files — production deployment broken
In production, there's no mechanism to serve the built Vite client. Add `express.static()` fallback to `index.html`.

### 21. Duplicate `defaultEvent` object in `eventMapper.ts` and `EventForm.tsx`
DRY violation. Extract to `src/lib/constants.ts`.

### 22. Incomplete NaN cleanup in `EventForm.tsx`
Only `base_pay` and `mileage_miles` are cleaned. `compliance_bonus` and `mileage_rate` can still be `NaN`.

### 23. No Zustand `persist` middleware
Auth state lost on every page refresh. Add `persist` with `localStorage`.

### 24. `src/lib/claude.ts:79` — Unsafe cast on Anthropic response
`response.content[0] as { type: 'text' }` assumes text block. Add a runtime check.

### 25. `DELETE` returns 204 regardless of whether event existed
Client can't distinguish "deleted" from "not found". Check `result.rowCount`.

### 26. `EventDetail.tsx` is 523 lines — too large
Extract note-parsing functions to `src/lib/notesParser.ts`.

### 27. Fragile regex-based note section parsing
Structured data crammed into a text field and re-parsed with regex. Consider a JSONB column for structured data.

### 28. `confirm()` for delete UX
Native blocking dialog. Replace with a proper modal component.

---

## 🟢 LOW — Nice to Have

### 29. Unused `postgres` dependency in `package.json`
The `postgres` package (^3.4.5) is never imported. Remove it.

### 30. `python-3.11` in `.replit` modules
This is a pure Node.js app. Remove `python-3.11` from `.replit` to speed up startup.

### 31. `.env.example` has wrong prefix
Says `ANTHROPIC_API_KEY` but client code uses `VITE_ANTHROPIC_API_KEY`. (Will be moot once AI parsing moves server-side.)

### 32. Emoji loading spinner has no ARIA label
`<div className="animate-spin text-4xl">🎧</div>` — add `role="status"` and `aria-label`.

### 33. `cors()` may be unnecessary in production
If Express serves static files on the same origin, CORS is not needed.

### 34. Wildcard schema import in `server/index.ts`
`import * as schema` is unusual. Named imports would be clearer.

### 35. `event_date` comment says "UUID generated client-side" but it's server-side
Stale comment in `schema.ts:6`.

---

## Dependency Audit Summary

| Package | Status | Action |
|---------|--------|--------|
| `@supabase/supabase-js` | ✅ Removed | None |
| `@neondatabase/serverless` | ⚠️ Unused | Remove (dead code) |
| `postgres` (^3.4.5) | ⚠️ Unused | Remove |
| `pg` (^8.13.0) | ✅ Used by server | Keep |
| `drizzle-orm` (^0.38.0) | ✅ Used | Keep |
| `drizzle-kit` | ✅ Dev dep | Keep |
| `concurrently` | ✅ Dev dep | Keep |
| `tsx` | ✅ Dev dep | Keep |
| `python-3.11` in `.replit` | ⚠️ Unused | Remove from `.replit` |

---

## Priority Fix Order

1. **Fix #2** — Add `/api/auth/user` endpoint (broken auth)
2. **Fix #1** — Rename `handleSubmit` → `handleLogin` (broken login)
3. **Fix #4** — Add `mode: 'number'` to numeric columns (data corruption)
4. **Fix #3** — Whitelist fields on POST/PUT (security)
5. **Fix #5** — Move AI parsing to server (API key exposure)
6. **Fix #6** — Remove public port 3000 or add real auth
7. **Fix #7** — Delete `src/db/index.ts` + remove unused deps
8. **Fix #8** — Add rate limiting + restrict CORS
9. **Fix #11** — Add database indexes
10. **Fix #18** — Generate Drizzle migrations
11. **Fix #20** — Add static file serving to Express
12. Remaining medium/low items as time permits

---

*Report generated by 6 specialized review agents. Full findings available in agent transcripts.*
