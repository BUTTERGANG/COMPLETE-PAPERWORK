ALTER TABLE "events" RENAME COLUMN "paperwork_image_data" TO "paperwork_images";--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "paperwork_images" TYPE jsonb USING COALESCE(paperwork_images::jsonb, '[]'::jsonb);--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "paperwork_images" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "paperwork_images" SET DEFAULT '[]';
