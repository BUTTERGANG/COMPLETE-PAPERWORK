CREATE TYPE "public"."note_source" AS ENUM('typed', 'image', 'pdf', 'audio');
CREATE TYPE "public"."chat_role" AS ENUM('user', 'assistant');

CREATE TABLE "public"."event_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_id" text NOT NULL,
	"source" "public"."note_source" DEFAULT 'typed' NOT NULL,
	"title" text,
	"content" text DEFAULT '' NOT NULL,
	"storage_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE TABLE "public"."event_chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_id" text NOT NULL,
	"role" "public"."chat_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX "event_notes_user_event_idx" ON "public"."event_notes" USING btree ("user_id","event_id");
CREATE INDEX "event_chat_event_idx" ON "public"."event_chat_messages" USING btree ("user_id","event_id");
