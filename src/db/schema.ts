import { pgTable, text, integer, numeric, boolean, timestamp, pgEnum, index, jsonb } from 'drizzle-orm/pg-core';
import type { TimelineEntry, MusicSelections } from '../types/event';

export const eventStatusEnum = pgEnum('event_status', ['upcoming', 'completed', 'cancelled']);

const money = (name: string) => numeric(name, { precision: 10, scale: 2, mode: 'number' }).notNull().default(0);

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  event_date: text('event_date').notNull(),
  event_type: text('event_type'),

  // Assignment / logistics
  assigned_dj: text('assigned_dj'),
  second_assigned: text('second_assigned'),
  system_number: text('system_number'),
  dj_attire: text('dj_attire'),

  // Venue
  venue_name: text('venue_name'),
  venue_address: text('venue_address'),
  venue_phone: text('venue_phone'),
  venue_contact: text('venue_contact'),
  venue_notes: text('venue_notes'),
  ceremony_separate_location: boolean('ceremony_separate_location'),

  // Client / couple
  client_name: text('client_name'),
  client_phone: text('client_phone'),
  client_email: text('client_email'),
  partner_phone: text('partner_phone'),
  partner_email: text('partner_email'),
  secondary_contact: text('secondary_contact'),
  bride_name: text('bride_name'),
  groom_name: text('groom_name'),
  bride_parents: text('bride_parents'),
  groom_parents: text('groom_parents'),
  guest_count: integer('guest_count'),

  // Wedding party
  maid_of_honor: text('maid_of_honor'),
  best_man: text('best_man'),
  flower_girl: text('flower_girl'),
  ring_bearer: text('ring_bearer'),
  introduction_name: text('introduction_name'),
  bridesmaids: jsonb('bridesmaids').$type<string[]>().notNull().default([]),
  groomsmen: jsonb('groomsmen').$type<string[]>().notNull().default([]),

  // Times
  pickup_time: text('pickup_time'),
  setup_time: text('setup_time'),
  guest_arrival_time: text('guest_arrival_time'),
  load_in_time: text('load_in_time'),
  ceremony_start_time: text('ceremony_start_time'),
  ceremony_end_time: text('ceremony_end_time'),
  start_time: text('start_time'),
  end_time: text('end_time'),
  booked_hours: numeric('booked_hours', { precision: 10, scale: 2, mode: 'number' }),

  // Reception flow
  dinner_service: text('dinner_service'),
  blessing_by: text('blessing_by'),
  toasts_by: text('toasts_by'),
  take_requests: boolean('take_requests'),
  introduce_couple: boolean('introduce_couple'),
  introduce_wedding_party: boolean('introduce_wedding_party'),
  activities: jsonb('activities').$type<string[]>().notNull().default([]),
  music_variety: jsonb('music_variety').$type<string[]>().notNull().default([]),

  // Pay
  pay_type: text('pay_type'),
  base_pay: money('base_pay'),
  compliance_bonus: money('compliance_bonus'),
  over_hours_pay: money('over_hours_pay'),
  fuel_recovery: money('fuel_recovery'),
  tip: money('tip'),
  overtime_pay: money('overtime_pay'),
  other_pay: money('other_pay'),
  total_pay: money('total_pay'),

  // Structured content
  timeline: jsonb('timeline').$type<TimelineEntry[]>().notNull().default([]),
  music_selections: jsonb('music_selections').$type<MusicSelections>(),
  special_instructions: text('special_instructions'),
  notes: text('notes'),
  raw_ai_summary: text('raw_ai_summary'),
  paperwork_images: jsonb('paperwork_images').$type<string[]>().notNull().default([]),

  status: eventStatusEnum('status').notNull().default('upcoming'),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('events_user_id_idx').on(table.user_id),
  userDateIdx: index('events_user_date_idx').on(table.user_id, table.event_date),
}));

export type EventRecord = typeof events.$inferSelect;
export type NewEventRecord = typeof events.$inferInsert;
