export interface Event {
  id: string;
  user_id: string;
  event_date: string;
  event_type: string | null;
  venue_name: string | null;
  venue_address: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  start_time: string | null;
  end_time: string | null;
  base_pay: number;
  compliance_bonus: number;
  mileage_miles: number;
  mileage_rate: number;
  total_pay: number;
  notes: string | null;
  raw_ai_summary: string | null;
  paperwork_images: string[];
  status: 'upcoming' | 'completed' | 'cancelled';
  created_at: string;
  updated_at: string;
}

export type EventFormData = Omit<Event, 'id' | 'user_id' | 'total_pay' | 'created_at' | 'updated_at' | 'paperwork_images'>;

export interface TimelineEntry {
  time: string;
  activity: string;
}

export interface MusicSelections {
  first_dance: string | null;
  father_daughter_dance: string | null;
  mother_son_dance: string | null;
  cake_cutting: string | null;
  bouquet_toss: string | null;
  garter_toss: string | null;
  grand_entrance: string | null;
  last_dance: string | null;
  send_off_exit: string | null;
  ceremony_processional: string | null;
  ceremony_recessional: string | null;
  ceremony_interlude: string | null;
  must_play: string[];
  do_not_play: string[];
  music_preferences: string | null;
}

export interface ParsedEvent {
  event_date: string | null;
  event_type: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_phone: string | null;
  venue_contact: string | null;
  venue_notes: string | null;
  bride_name: string | null;
  groom_name: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  secondary_contact: string | null;
  guest_count: number | null;
  load_in_time: string | null;
  start_time: string | null;
  end_time: string | null;
  base_pay: number | null;
  pay_type: string | null;
  compliance_bonus: number | null;
  mileage_miles: number | null;
  timeline: TimelineEntry[];
  music_selections: MusicSelections;
  special_instructions: string | null;
  notes: string | null;
}

export interface PayBreakdown {
  base: number;
  compliance: number;
  mileage: number;
  total: number;
}
