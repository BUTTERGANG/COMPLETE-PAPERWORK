import type { EventFormData, ParsedEvent } from '../types/event';
import { DEFAULT_MILEAGE_RATE } from './constants';

const defaultEvent: EventFormData = {
  event_date: '',
  event_type: '',
  venue_name: '',
  venue_address: '',
  client_name: '',
  client_phone: '',
  client_email: '',
  start_time: '',
  end_time: '',
  base_pay: 0,
  compliance_bonus: 0,
  mileage_miles: 0,
  mileage_rate: DEFAULT_MILEAGE_RATE,
  notes: '',
  raw_ai_summary: null,
  paperwork_image_data: null,
  status: 'upcoming',
};

function formatTimeline(timeline: ParsedEvent['timeline']): string {
  if (!timeline || timeline.length === 0) return '';
  return timeline.map((e) => `${e.time} – ${e.activity}`).join('\n');
}

function formatMusicSelections(music: ParsedEvent['music_selections']): string {
  if (!music) return '';
  const lines: string[] = [];

  const labeledFields: [keyof typeof music, string][] = [
    ['first_dance', 'First Dance'],
    ['father_daughter_dance', 'Father/Daughter Dance'],
    ['mother_son_dance', 'Mother/Son Dance'],
    ['cake_cutting', 'Cake Cutting'],
    ['bouquet_toss', 'Bouquet Toss'],
    ['garter_toss', 'Garter Toss'],
    ['grand_entrance', 'Grand Entrance'],
    ['last_dance', 'Last Dance'],
    ['send_off_exit', 'Send Off / Exit'],
    ['ceremony_processional', 'Ceremony Processional'],
    ['ceremony_recessional', 'Ceremony Recessional'],
    ['ceremony_interlude', 'Ceremony Interlude'],
  ];

  for (const [key, label] of labeledFields) {
    const val = music[key];
    if (val && typeof val === 'string') {
      lines.push(`${label}: ${val}`);
    }
  }

  if (music.must_play?.length) lines.push(`Must Play:\n${music.must_play.map((s) => `  • ${s}`).join('\n')}`);
  if (music.do_not_play?.length) lines.push(`Do Not Play:\n${music.do_not_play.map((s) => `  ✕ ${s}`).join('\n')}`);
  if (music.music_preferences) lines.push(`Music Preferences: ${music.music_preferences}`);

  return lines.length > 0 ? lines.join('\n') : '';
}

function formatCoupleNames(parsed: ParsedEvent): string {
  const lines: string[] = [];
  if (parsed.bride_name) lines.push(`Bride: ${parsed.bride_name}`);
  if (parsed.groom_name) lines.push(`Groom: ${parsed.groom_name}`);
  return lines.length > 0 ? lines.join('\n') : '';
}

function formatVenueInfo(parsed: ParsedEvent): string {
  const lines: string[] = [];
  if (parsed.venue_phone) lines.push(`Venue phone: ${parsed.venue_phone}`);
  if (parsed.venue_contact) lines.push(`Venue contact: ${parsed.venue_contact}`);
  if (parsed.venue_notes) lines.push(`Venue notes: ${parsed.venue_notes}`);
  return lines.length > 0 ? lines.join('\n') : '';
}

export function applyParsedData(parsed: ParsedEvent): EventFormData {
  const parts: string[] = [];

  if (parsed.load_in_time) parts.push(`Load-in: ${parsed.load_in_time}`);
  if (parsed.secondary_contact) parts.push(`Secondary contact: ${parsed.secondary_contact}`);
  if (parsed.guest_count) parts.push(`Guest count: ${parsed.guest_count}`);
  if (parsed.pay_type && parsed.pay_type !== 'flat') parts.push(`Pay type: ${parsed.pay_type}`);

  const venueInfoStr = formatVenueInfo(parsed);
  if (venueInfoStr) parts.push(`\nVenue Info:\n${venueInfoStr}`);

  const coupleStr = formatCoupleNames(parsed);
  if (coupleStr) parts.push(`\nCouple:\n${coupleStr}`);

  const timelineStr = formatTimeline(parsed.timeline);
  if (timelineStr) parts.push(`\nTimeline:\n${timelineStr}`);

  const musicStr = formatMusicSelections(parsed.music_selections);
  if (musicStr) parts.push(`\nMusic Selections:\n${musicStr}`);

  if (parsed.special_instructions) parts.push(`\nSpecial instructions:\n${parsed.special_instructions}`);
  if (parsed.notes) parts.push(`\nNotes:\n${parsed.notes}`);

  const fullNotes = parts.length > 0 ? parts.join('\n') : '';
  const has_ai_data = parsed.event_date || parsed.venue_name || parsed.event_type || parsed.client_name || parsed.bride_name || parsed.groom_name || timelineStr || musicStr;

  // Build a rich summary: "Wedding – Sarah & Mike at Venue on Jan 1"
  const coupleSummary = parsed.bride_name && parsed.groom_name
    ? `${parsed.bride_name} & ${parsed.groom_name}`
    : parsed.bride_name || parsed.groom_name || null;

  return {
    ...defaultEvent,
    event_date: parsed.event_date || '',
    event_type: parsed.event_type || '',
    venue_name: parsed.venue_name || '',
    venue_address: parsed.venue_address || '',
    client_name: parsed.client_name || coupleSummary || '',
    client_phone: parsed.client_phone || '',
    client_email: parsed.client_email || '',
    start_time: parsed.start_time || '',
    end_time: parsed.end_time || '',
    base_pay: parsed.base_pay || 0,
    compliance_bonus: parsed.compliance_bonus || 0,
    mileage_miles: parsed.mileage_miles || 0,
    notes: fullNotes,
    raw_ai_summary: has_ai_data
      ? `${parsed.event_type || 'Event'} – ${coupleSummary || 'TBD'} at ${parsed.venue_name || 'TBD'} on ${parsed.event_date || 'TBD'}`
      : null,
  };
}
