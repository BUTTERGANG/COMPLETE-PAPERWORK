import { pgTable, text, numeric, timestamp, pgEnum, index } from 'drizzle-orm/pg-core';

export const eventStatusEnum = pgEnum('event_status', ['upcoming', 'completed', 'cancelled']);

export const events = pgTable('events', {
  id: text('id').primaryKey(),
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
  base_pay: numeric('base_pay', { precision: 10, scale: 2, mode: 'number' }).notNull().default('0'),
  compliance_bonus: numeric('compliance_bonus', { precision: 10, scale: 2, mode: 'number' }).notNull().default('0'),
  mileage_miles: numeric('mileage_miles', { precision: 10, scale: 2, mode: 'number' }).notNull().default('0'),
  mileage_rate: numeric('mileage_rate', { precision: 10, scale: 2, mode: 'number' }).notNull().default('0'),
  total_pay: numeric('total_pay', { precision: 10, scale: 2, mode: 'number' }).notNull().default('0'),
  notes: text('notes'),
  raw_ai_summary: text('raw_ai_summary'),
  paperwork_image_data: text('paperwork_image_data'),
  status: eventStatusEnum('status').notNull().default('upcoming'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('events_user_id_idx').on(table.user_id),
  userDateIdx: index('events_user_date_idx').on(table.user_id, table.event_date),
}));

export type EventRecord = typeof events.$inferSelect;
export type NewEventRecord = typeof events.$inferInsert;
