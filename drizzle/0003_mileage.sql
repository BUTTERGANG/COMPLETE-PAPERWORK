-- Mileage tracking: two commute categories per event, computed server-side
-- via OSRM when venue_address is set (see server/mileage.ts).
--   miles_to_office — home → office, one-way (the fixed daily commute)
--   miles_to_event  — office → venue → office (the event roundtrip)
ALTER TABLE "events" ADD COLUMN "miles_to_office" numeric(10, 1);
ALTER TABLE "events" ADD COLUMN "miles_to_event" numeric(10, 1);
