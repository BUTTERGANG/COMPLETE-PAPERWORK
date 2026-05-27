import { pgTable, text, numeric, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const eventStatusEnum = pgEnum('event_status', ['upcoming', 'completed', 'cancelled']);

export const events = pgTable('events', {
  id: text('id').primaryKey(), // UUID generated client-side
  user_id: text('user_id').notNull(),
  event_date: text('event_date').notNull(),
  event_type: text('event_type'),
  venue_name: text('venue_name'),
  venue_address: text('venue_address'),
  client_name: text('client_name'),
  client_phone: text('client_phone'),
  client_email: text('client_email'),
  start_time: text('start_time'),
  end_time: text('end_time'),
  base_pay: numeric('base_pay', { precision: 10, scale: 2 }).notNull().default('0'),
  compliance_bonus: numeric('compliance_bonus', { precision: 10, scale: 2 }).notNull().default('0'),
  mileage_miles: numeric('mileage_miles', { precision: 10, scale: 2 }).notNull().default('0'),
  mileage_rate: numeric('mileage_rate', { precision: 10, scale: 2 }).notNull().default('0'),
  total_pay: numeric('total_pay', { precision: 10, scale: 2 }).notNull().default('0'),
  notes: text('notes'),
  raw_ai_summary: text('raw_ai_summary'),
  paperwork_image_data: text('paperwork_image_data'), // base64 image data stored inline in NeonDB (can be null)
  status: eventStatusEnum('status').notNull().default('upcoming'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
});

export type EventRecord = typeof events.$inferSelect;
export type NewEventRecord = typeof events.$inferInsert;
