export interface TimelineEntry {
  time: string;
  activity: string;
}

export interface MusicSelections {
  background_music: string | null;
  escorting_mothers: string | null;
  pre_processional: string | null;
  ceremony_processional: string | null;
  unity_ceremony: string | null;
  ceremony_recessional: string | null;
  ceremony_interlude: string | null;
  grand_entrance: string | null;
  first_dance: string | null;
  father_daughter_dance: string | null;
  mother_son_dance: string | null;
  parents_dance: string | null;
  wedding_party_dance: string | null;
  other_dedication: string | null;
  cake_cutting: string | null;
  bouquet_toss: string | null;
  garter_toss: string | null;
  last_dance: string | null;
  send_off_exit: string | null;
  must_play: string[];
  do_not_play: string[];
  music_preferences: string | null;
}

export interface Event {
  id: string;
  user_id: string;
  event_date: string;
  event_type: string | null;

  // Assignment / logistics
  assigned_dj: string | null;
  second_assigned: string | null;
  system_number: string | null;
  dj_attire: string | null;

  // Venue
  venue_name: string | null;
  venue_address: string | null;
  venue_phone: string | null;
  venue_contact: string | null;
  venue_notes: string | null;
  ceremony_separate_location: boolean | null;

  // Client / couple
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  partner_phone: string | null;
  partner_email: string | null;
  secondary_contact: string | null;
  bride_name: string | null;
  groom_name: string | null;
  bride_parents: string | null;
  groom_parents: string | null;
  guest_count: number | null;

  // Wedding party
  maid_of_honor: string | null;
  best_man: string | null;
  flower_girl: string | null;
  ring_bearer: string | null;
  introduction_name: string | null;
  bridesmaids: string[];
  groomsmen: string[];

  // Times
  pickup_time: string | null;
  setup_time: string | null;
  guest_arrival_time: string | null;
  load_in_time: string | null;
  ceremony_start_time: string | null;
  ceremony_end_time: string | null;
  start_time: string | null;
  end_time: string | null;
  booked_hours: number | null;

  // Reception flow
  dinner_service: string | null;
  blessing_by: string | null;
  toasts_by: string | null;
  take_requests: boolean | null;
  introduce_couple: boolean | null;
  introduce_wedding_party: boolean | null;
  activities: string[];
  music_variety: string[];

  // Pay
  pay_type: string | null;
  base_pay: number;
  compliance_bonus: number;
  over_hours_pay: number;
  fuel_recovery: number;
  tip: number;
  overtime_pay: number;
  other_pay: number;
  total_pay: number;

  // Structured content
  timeline: TimelineEntry[];
  music_selections: MusicSelections | null;
  special_instructions: string | null;
  notes: string | null;
  raw_ai_summary: string | null;
  paperwork_images: string[];

  status: 'upcoming' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

// All fields editable in the manual/scan form (excludes system fields).
export type EventFormData = Omit<Event, 'id' | 'user_id' | 'total_pay' | 'created_at' | 'updated_at' | 'paperwork_images'>;

export interface ParsedEvent {
  event_date: string | null;
  event_type: string | null;
  assigned_dj: string | null;
  second_assigned: string | null;
  system_number: string | null;
  dj_attire: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_phone: string | null;
  venue_contact: string | null;
  venue_notes: string | null;
  ceremony_separate_location: boolean | null;
  bride_name: string | null;
  groom_name: string | null;
  bride_parents: string | null;
  groom_parents: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  partner_phone: string | null;
  partner_email: string | null;
  secondary_contact: string | null;
  guest_count: number | null;
  maid_of_honor: string | null;
  best_man: string | null;
  flower_girl: string | null;
  ring_bearer: string | null;
  introduction_name: string | null;
  bridesmaids: string[];
  groomsmen: string[];
  pickup_time: string | null;
  setup_time: string | null;
  guest_arrival_time: string | null;
  load_in_time: string | null;
  ceremony_start_time: string | null;
  ceremony_end_time: string | null;
  start_time: string | null;
  end_time: string | null;
  booked_hours: number | null;
  dinner_service: string | null;
  blessing_by: string | null;
  toasts_by: string | null;
  take_requests: boolean | null;
  introduce_couple: boolean | null;
  introduce_wedding_party: boolean | null;
  activities: string[];
  music_variety: string[];
  pay_type: string | null;
  base_pay: number | null;
  compliance_bonus: number | null;
  over_hours_pay: number | null;
  fuel_recovery: number | null;
  tip: number | null;
  overtime_pay: number | null;
  other_pay: number | null;
  timeline: TimelineEntry[];
  music_selections: MusicSelections;
  special_instructions: string | null;
  notes: string | null;
}

export interface PayBreakdown {
  base: number;
  compliance: number;
  over_hours: number;
  fuel: number;
  tip: number;
  overtime: number;
  other: number;
  total: number;
}
