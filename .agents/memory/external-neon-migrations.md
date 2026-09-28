---
name: External Neon migration state
description: The app uses one external Neon connection for both development and production, and schema can predate Drizzle migration tracking.
---

Before applying a Drizzle migration to the app's external Neon database, inspect the live objects as well as the migration ledger. The shared `NEONDB` secret is available to both development and production; the database can contain schema already applied without a `drizzle.__drizzle_migrations` table.

**Why:** On 2026-09-28, the configured Neon database already matched the event notes/chat migration, while no Drizzle migration ledger existed. Replaying the migration would have failed on duplicate enum and table creation.

**How to apply:** Confirm which environment the app connects to, compare live columns, defaults, enums, and indexes with the migration, and only execute SQL for objects that are actually missing. Do not treat an absent ledger alone as permission to replay migrations.