-- Pre-ceremony (cocktail-hour) start time, parsed from the portal's
-- schedule notes by cem-sync ("PRECEREMONY 3:30" -> ceremony_pre_time).
ALTER TABLE "events" ADD COLUMN "ceremony_pre_time" text;