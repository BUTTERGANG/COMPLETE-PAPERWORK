---
status: done
priority: P1
agent_claimed: null
claimed_at: null
updated: 2026-09-20
---

# PDF Upload, Notes + AI Assistant, Note-Template .docx

> **Repo:** COMPLETE-PAPERWORK
> **Description:** Build all three — PDF paperwork upload, per-event notes + AI chat, and structured note-template Word export.

---

## Done

- **PDF upload & parse**: scanner accepts `application/pdf` (mixed with images); `POST /api/parse-paperwork` sends native Anthropic `document` blocks via a unified `payloads` array (backwards compatible with `base64Images`).
- **Per-event notes**: `event_notes` table; `POST/GET/DELETE /api/events/:id/notes`. Typed notes stored directly; PDF/photo pages run through Claude to extract text; call audio is transcribed to text.
- **Transcription**: local keyless whisper.cpp via `nodejs-whisper` (verified: 13s clip → text on CPU). Pluggable `STT_BASE_URL`/`STT_API_KEY` for a hosted endpoint.
- **AI assistant chat**: `event_chat_messages` table; `GET/POST /api/events/:id/chat`. Answers grounded in the event record + notes + recent history (no external context). Persists history.
- **Note-template .docx**: `GET /api/events/:id/export-docx` renders the operator's exact top-to-bottom note order (venue→pre-ceremony→ceremony song order→intros→reception flow→DNP→notes) via the `docx` lib. Verified valid zip + correct ordered content.
- **UI**: `EventAssistant` component (notes + uploads + chat) on EventDetail; Download-docx button; PDF tiles in scanner.
- Tables: `event_notes`, `event_chat_messages` + enums `note_source`, `chat_role` (drizzle migration `0002_notes_and_chat`).

## Verified

- `tsc --noEmit` clean; `pnpm build` clean (no new lint errors — 2 pre-existing in EventForm/imageCompress).
- End-to-end against a throwaway Postgres: event CRUD, typed note, audio→transcript note (201), docx export (200, valid zip, correct filename), image/chat degrade to 503 without an Anthropic key.
- Note-template render confirmed in the exact requested order.

## Notes / follow-ups

- Pre-existing schema drift (migration snapshot vs `schema.ts`) is out of scope — flagged separately.
- Whisper needs cmake/gcc/make/ffmpeg (added to `replit.nix`); model downloads on first use.
- AI parse/chat need a real `ANTHROPIC_API_KEY` to exercise end-to-end (not available in this env).
