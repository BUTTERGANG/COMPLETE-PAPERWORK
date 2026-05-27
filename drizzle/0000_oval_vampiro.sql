CREATE TYPE "public"."event_status" AS ENUM('upcoming', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_date" text NOT NULL,
	"event_type" text,
	"venue_name" text,
	"venue_address" text,
	"client_name" text,
	"client_phone" text,
	"client_email" text,
	"start_time" text,
	"end_time" text,
	"base_pay" numeric(10, 2) DEFAULT '0' NOT NULL,
	"compliance_bonus" numeric(10, 2) DEFAULT '0' NOT NULL,
	"mileage_miles" numeric(10, 2) DEFAULT '0' NOT NULL,
	"mileage_rate" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_pay" numeric(10, 2) DEFAULT '0' NOT NULL,
	"notes" text,
	"raw_ai_summary" text,
	"paperwork_image_data" text,
	"status" "event_status" DEFAULT 'upcoming' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_user_id_idx" ON "events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "events_user_date_idx" ON "events" USING btree ("user_id","event_date");