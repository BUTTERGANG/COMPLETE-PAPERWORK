# DJ Ops — Improvement Plan

> **Generated:** 2026-05-25
> **Reviewers:** Architecture, UI/UX, Security, and Code Quality audits (swarm analysis)
> **Current overall scores:** Architecture 5.5/10 · UI/UX 7/10 · Security 3/10 · Code Quality 5.5/10

---

## Priority Legend

| Priority | Meaning |
|----------|---------|
| **P0** | Fix immediately — security risk or data loss |
| **P1** | Fix this sprint — correctness or critical UX |
| **P2** | Fix next sprint — maintainability and polish |
| **P3** | Backlog — nice to have |

---

## P0 — Critical Security & Data Issues

### 0.1: Move Anthropic API call to a backend proxy
**File:** `src/lib/claude.ts`
**Problem:** `VITE_ANTHROPIC_API_KEY` is shipped in the browser bundle. Every user can extract it and make API calls on your account.
**Fix:** Create a Supabase Edge Function (e.g., `supabase/functions/parse-paperwork/index.ts`) that holds the API key server-side. The browser sends the base64 image to your function, which forwards it to Anthropic and returns the parsed JSON.
**Effort:** ~2 hours

### 0.2: Enable Row Level Security (RLS) on Supabase tables
**Files:** Supabase migrations (missing — need to create)
**Problem:** `EventDetail.tsx:29-34` queries events by ID without `user_id` check. `useEvents.ts:15` queries all events without `.eq('user_id', user.id)`. Any authenticated user can access other users' events.
**Fix:**
1. Create migration: `ENABLE ROW LEVEL SECURITY` on `events` table
2. Add policy: `USING (auth.uid() = user_id)` for SELECT/INSERT/UPDATE/DELETE
3. Add `.eq('user_id', user.id)` to all Supabase queries as defense-in-depth
4. Secure the `paperwork` storage bucket with RLS policies
**Effort:** ~1 hour

### 0.3: Add user_id filter to all event queries
**Files:** `src/hooks/useEvents.ts:15`, `src/pages/EventDetail.tsx:31`
**Problem:** Even as a stopgap before RLS migration, queries must scope by user.
**Fix:**
```ts
// useEvents.ts
.select('*')
.eq('user_id', user.id)
.order('event_date', { ascending: false });

// EventDetail.tsx
.eq('id', id)
.eq('user_id', data.user.id)  // pass user from auth context
```
**Effort:** ~15 minutes

---

## P1 — Correctness & Core UX Issues

### 1.1: Auth store `onAuthStateChange` listener leak
**File:** `src/store/authStore.ts:18-25`
**Problem:** Each call to `init()` adds a new `onAuthStateChange` listener without cleanup. If `init` is called more than once (e.g., HMR, re-mount), listeners stack.
**Fix:**
```ts
init: async () => {
  const { data: { session } } = await supabase.auth.getSession();
  set({ user: session?.user ?? null, loading: false });

  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    set({ user: session?.user ?? null });
  });

  // Store subscription for cleanup (or use _unsubscribe pattern)
  return () => subscription.unsubscribe();
},
```
**Effort:** ~30 minutes

### 1.2: `useEvents` is not shared state — each caller gets independent copy
**File:** `src/hooks/useEvents.ts`
**Problem:** `useEvents()` uses local `useState`, so `Dashboard`, `Events`, and `AddEvent` each have their own events array. Adding an event on `/scan` won't reflect on `/events` until a full remount.
**Fix:** Either (a) lift events into a Zustand store, or (b) adopt TanStack Query for shared server state. Option B is recommended — it also solves caching, stale-while-revalidate, and request deduplication.
**Effort:** ~3 hours (TanStack Query migration)

### 1.3: Race condition in rapid status toggles
**File:** `src/pages/EventDetail.tsx:48-58`
**Problem:** Rapidly clicking status buttons fires concurrent Supabase requests. The last response wins, which may not match the last click.
**Fix:** Use an `AbortController` or a simple request counter to ignore stale responses:
```ts
const requestId = useRef(0);
const handleStatusChange = async (status) => {
  const currentId = ++requestId.current;
  setSaving(true);
  const { data } = await supabase.from('events')...;
  if (currentId === requestId.current) setEvent(data);
  setSaving(false);
};
```
**Effort:** ~20 minutes

### 1.4: `addEvent` silently drops image upload errors
**File:** `src/hooks/useEvents.ts:30-38`
**Problem:** If `supabase.storage.upload` fails, the error is caught but execution continues — the event is created without the image and the user gets no feedback.
**Fix:** Either throw the upload error or surface it to the user:
```ts
if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`);
```
**Effort:** ~10 minutes

### 1.5: AI JSON parsing has no error handling
**File:** `src/lib/claude.ts:58-62`
**Problem:** If the AI returns prose + JSON (e.g., "Here's the data: ```json ... ```"), the regex strip fails and `JSON.parse` throws.
**Fix:**
```ts
const jsonMatch = text.match(/\{[\s\S]*\}/);
if (!jsonMatch) throw new Error('AI response did not contain valid JSON');
return JSON.parse(jsonMatch[0]);
```
**Effort:** ~15 minutes

### 1.6: No runtime validation on AI-parsed data
**File:** `src/lib/claude.ts` → `src/components/EventForm.tsx`
**Problem:** AI returns `ParsedEvent` but there's no validation that values are sane (negative pay, invalid dates, etc.).
**Fix:** Add a Zod schema:
```ts
import { z } from 'zod';
const ParsedEventSchema = z.object({
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  base_pay: z.number().min(0).max(10000).nullable(),
  // ... etc
});
```
**Effort:** ~1 hour

### 1.7: `EventDetail` doesn't handle fetch errors
**File:** `src/pages/EventDetail.tsx:34-44`
**Problem:** If the Supabase query fails, `data` is null, loading becomes false, and the user sees "Event not found" instead of "Failed to load."
**Fix:** Add error state and display:
```ts
const [error, setError] = useState<string | null>(null);
// in .then():
if (error) setError(error.message);
// in JSX:
if (error) return <div className="error">Failed to load: {error}</div>;
```
**Effort:** ~15 minutes

### 1.8: `alert()` for error reporting
**Files:** `src/pages/AddEvent.tsx:19`, `src/pages/ScanPaperwork.tsx:29`
**Problem:** `alert()` is blocking, unstyled, and provides no recovery path.
**Fix:** Replace with inline error state in the component, or add a toast system (e.g., `sonner`).
**Effort:** ~30 minutes

---

## P2 — Maintainability & Code Quality

### 2.1: Move `applyParsedData` out of the component file
**File:** `src/components/EventForm.tsx:32-50`
**Problem:** Pure data transformation logic is exported from a UI component. This makes it hard to test and creates a confusing dependency (ScanPaperwork imports from a form component).
**Fix:** Create `src/lib/eventMapper.ts` and move `applyParsedData` there.
**Effort:** ~15 minutes

### 2.2: Remove `useAuth` passthrough or add value
**File:** `src/hooks/useAuth.ts:1-5`
**Problem:** `useAuth` is a zero-value wrapper around `useAuthStore`. It adds an import layer with no benefit.
**Fix:** Either inline `useAuthStore` in consumers, or add selector optimization:
```ts
export function useAuth() {
  return useAuthStore((s) => ({ user: s.user, loading: s.loading }));
}
```
**Effort:** ~10 minutes

### 2.3: Centralize magic numbers
**Files:** `src/lib/payCalc.ts:3`, `src/components/EventForm.tsx:155`, `src/lib/claude.ts:42`
**Problem:** `0.67` (mileage rate) and `40` (compliance bonus) are hardcoded in multiple places.
**Fix:**
```ts
// src/lib/constants.ts
export const DEFAULT_MILEAGE_RATE = 0.67;
export const COMPLIANCE_BONUS_AMOUNT = 40;
```
**Effort:** ~15 minutes

### 2.4: Add `user_id` filter + error state to `useEvents`
**File:** `src/hooks/useEvents.ts:11-20`
**Problem:** `fetchEvents` silently swallows errors (`if (!error && data)`). The UI can't distinguish "failed to load" from "empty list."
**Fix:** Add `error` state, surface it, and add `.eq('user_id', user.id)`.
**Effort:** ~20 minutes

### 2.5: Unify spinner/loading components
**Files:** `App.tsx:22`, `Dashboard.tsx:65`, `Events.tsx:86`, `EventDetail.tsx:70`, `EventForm.tsx:195`, `Login.tsx:88`, `PaperworkScanner.tsx:119`
**Problem:** Four different spinner implementations (emoji, CSS border, text symbol, different sizes).
**Fix:** Create a single `<Spinner />` component with size variants:
```tsx
// src/components/Spinner.tsx
export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-10 h-10' };
  return (
    <div className={`${sizes[size]} border-2 border-border border-t-accent rounded-full animate-spin`} />
  );
}
```
**Effort:** ~20 minutes

### 2.6: Create shared `<EmptyState />` component
**Files:** `Dashboard.tsx:135-144`, `Events.tsx:89-104`
**Problem:** Empty states are duplicated with slightly different markup across pages.
**Fix:**
```tsx
// src/components/EmptyState.tsx
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}
```
**Effort:** ~30 minutes

### 2.7: Add `React.memo` to list items
**Files:** `src/components/EventCard.tsx`, `src/components/StatCard.tsx`
**Problem:** Every `EventCard` re-renders when the parent re-renders, even if its event data hasn't changed. Each card creates `new Date()` on every render.
**Fix:** Wrap exports in `React.memo()` and memoize the greeting in Dashboard.
**Effort:** ~15 minutes

### 2.8: Add `prefers-reduced-motion` support
**File:** `src/index.css:304-350`
**Problem:** Animations (fadeIn, slideUp, stagger) have no `prefers-reduced-motion` media query. This is a WCAG 2.1 SC 2.3.3 violation.
**Fix:**
```css
@media (prefers-reduced-motion: reduce) {
  .animate-fade-in,
  .animate-slide-up,
  .stagger-children > * {
    animation: none !important;
  }
}
```
**Effort:** ~10 minutes

### 2.9: Add ARIA labels to all icon-only buttons
**Files:** `Layout.tsx:40`, `Dashboard.tsx:44+163`, `Events.tsx:44`, `EventDetail.tsx:117`
**Problem:** Icon buttons use `title` attribute which is unreliable for accessibility. Screen readers announce nothing useful.
**Fix:** Add `aria-label` to every icon-only interactive element:
```tsx
<button aria-label="Sign out" onClick={handleSignOut} className="btn-ghost !p-2">
  <LogOutIcon size={18} aria-hidden="true" />
</button>
```
Also add `aria-hidden="true"` to all decorative SVGs.
**Effort:** ~30 minutes

### 2.10: Hardcoded hex values in CSS
**File:** `src/index.css:123` (`#7c3aed`), `src/index.css:259` (`#60a5fa`)
**Problem:** Two hardcoded hex values escape the design token system.
**Fix:** Add tokens:
```css
@theme {
  --color-violet-600: #7c3aed;
  --color-blue-400: #60a5fa;
}
```
**Effort:** ~5 minutes

### 2.11: Missing PWA icons
**File:** `vite.config.ts:28-29`
**Problem:** Manifest references `/icon-192.png` and `/icon-512.png` but only `favicon.svg` and `icons.svg` exist in `public/`.
**Fix:** Generate 192x192 and 512x512 PNG icons and place in `public/`.
**Effort:** ~30 minutes

### 2.12: Enable TypeScript strict mode
**File:** `tsconfig.app.json`
**Problem:** `strict: true` is not enabled. Nullable DB fields won't be caught at compile time.
**Fix:** Add `"strict": true` to `compilerOptions`.
**Effort:** ~1 hour (will surface many type errors to fix)

---

## P3 — Nice to Have / Future Enhancements

### 3.1: Adopt TanStack Query for server state
**Scope:** All data fetching
**Benefit:** Automatic caching, stale-while-revalidate, background refetch, optimistic updates, request deduplication. Solves the shared-state problem in `useEvents`.
**Effort:** ~4 hours

### 3.2: Add image compression before upload
**File:** `src/components/PaperworkScanner.tsx`
**Benefit:** Reduces memory usage and API costs. Use `browser-image-compression` or canvas-based resize.
**Effort:** ~1 hour

### 3.3: Add skeleton loaders
**Files:** `Dashboard.tsx`, `Events.tsx`, `EventDetail.tsx`
**Benefit:** Better perceived performance vs spinners.
**Effort:** ~1 hour

### 3.4: Add real-time subscriptions
**File:** `src/hooks/useEvents.ts`
**Benefit:** Events sync across tabs/devices without manual refresh.
**Effort:** ~1 hour

### 3.5: Add pagination for events list
**File:** `src/hooks/useEvents.ts`
**Benefit:** Performance for users with many historical events.
**Effort:** ~1 hour

### 3.6: Add a toast notification system
**Scope:** Global
**Benefit:** Consistent feedback for all success/error states. Replace `alert()` and inline error banners.
**Effort:** ~1 hour (using `sonner`)

### 3.7: Add form-level validation UX
**File:** `src/components/EventForm.tsx`
**Benefit:** Inline error messages, `aria-invalid`, visual feedback on blur.
**Effort:** ~1 hour

### 3.8: Add optimistic updates for mutations
**Scope:** `useEvents` mutations
**Benefit:** UI feels instant on slow networks.
**Effort:** ~1 hour (or free with TanStack Query)

### 3.9: Lazy-load route pages
**File:** `src/App.tsx`
**Benefit:** Smaller initial bundle. Use `React.lazy()` + `Suspense`.
**Effort:** ~30 minutes

### 3.10: Add `autoComplete` attributes to login form
**File:** `src/pages/Login.tsx:53+65`
**Benefit:** Better mobile autofill support.
**Effort:** ~5 minutes

---

## Recommended Execution Order

| Order | Task | Priority | Est. Time |
|-------|------|----------|-----------|
| 1 | 0.1 Move API key to backend | P0 | 2h |
| 2 | 0.2 Enable RLS | P0 | 1h |
| 3 | 0.3 Add user_id filters | P0 | 15m |
| 4 | 1.4 Fix image upload error handling | P1 | 10m |
| 5 | 1.5 Fix AI JSON parsing | P1 | 15m |
| 6 | 1.7 Add error state to EventDetail | P1 | 15m |
| 7 | 1.8 Replace `alert()` with inline errors | P1 | 30m |
| 8 | 1.1 Fix auth listener leak | P1 | 30m |
| 9 | 1.3 Fix status toggle race condition | P1 | 20m |
| 10 | 1.6 Add Zod validation for AI data | P1 | 1h |
| 11 | 2.3 Centralize magic numbers | P2 | 15m |
| 12 | 2.1 Move `applyParsedData` | P2 | 15m |
| 13 | 2.2 Fix/remove `useAuth` passthrough | P2 | 10m |
| 14 | 2.4 Add error state to `useEvents` | P2 | 20m |
| 15 | 2.5 Unify spinner component | P2 | 20m |
| 16 | 2.6 Create `<EmptyState />` component | P2 | 30m |
| 17 | 2.9 Add ARIA labels | P2 | 30m |
| 18 | 2.8 Add `prefers-reduced-motion` | P2 | 10m |
| 19 | 2.10 Fix hardcoded CSS hex values | P2 | 5m |
| 20 | 2.11 Generate PWA icons | P2 | 30m |
| 21 | 2.7 Add `React.memo` | P2 | 15m |
| 22 | 2.12 Enable strict mode | P2 | 1h |
| 23 | 1.2 Adopt TanStack Query | P1 | 3h |
| 24 | 3.6 Add toast system | P3 | 1h |
| 25 | 3.2 Add image compression | P3 | 1h |
| 26 | 3.3 Add skeleton loaders | P3 | 1h |
| 27 | 3.4 Add real-time subscriptions | P3 | 1h |
| 28 | 3.9 Lazy-load routes | P3 | 30m |

**Total estimated effort:** ~20-22 hours

---

## Target Architecture (Post-Improvement)

```
src/
├── app/
│   ├── App.tsx                 # Providers, router, lazy loading
│   └── providers.tsx           # ErrorBoundary, ToastProvider
├── features/
│   └── events/
│       ├── api/eventsApi.ts    # All Supabase calls (centralized)
│       ├── hooks/useEvents.ts  # TanStack Query hooks
│       ├── schemas/eventSchema.ts  # Zod validation
│       ├── components/
│       │   ├── EventCard.tsx
│       │   ├── EventForm.tsx
│       │   ├── EventDetail.tsx
│       │   └── PayBreakdown.tsx
│       └── pages/
│           ├── Dashboard.tsx
│           ├── EventsList.tsx
│           ├── EventDetailPage.tsx
│           └── AddEventPage.tsx
├── shared/
│   ├── components/             # Spinner, EmptyState, Skeleton
│   ├── ui/                     # Button, Input, Badge, Card primitives
│   ├── lib/                    # supabase, payCalc, eventMapper, constants
│   ├── types/                  # event.ts + shared types
│   └── icons/                  # Icons.tsx (or lucide-react)
├── supabase/
│   └── migrations/             # RLS policies, schema
└── config/
    └── vite.config.ts
```
