-- Complete Weddings + Events (CEM portal) sync tracking.
-- cem_event_id     — portal event id (/api/events/{id})
-- cem_service_id   — portal event-service id (unique per staff assignment)
-- cem_synced_at    — last time the portal updated this row
ALTER TABLE "events" ADD COLUMN "cem_event_id" bigint;
ALTER TABLE "events" ADD COLUMN "cem_service_id" bigint;
ALTER TABLE "events" ADD COLUMN "cem_synced_at" timestamp;
CREATE UNIQUE INDEX "events_cem_service_id_idx" ON "events" ("cem_service_id") WHERE "cem_service_id" IS NOT NULL;
