import { format } from 'date-fns';
import { parseLocalDate } from './dateUtils';
import type { Event, MusicSelections } from '../types/event';

const SONG_LABELS: [keyof MusicSelections, string][] = [
  ['background_music', 'Background Music'],
  ['escorting_mothers', 'Escorting Mothers'],
  ['pre_processional', 'Pre-Processional / Wedding Party'],
  ['ceremony_processional', 'Ceremony Processional'],
  ['unity_ceremony', 'Unity Candle / Sand Ceremony'],
  ['ceremony_recessional', 'Recessional'],
  ['ceremony_interlude', 'Ceremony Interlude'],
  ['grand_entrance', 'Reception Entrance'],
  ['first_dance', 'First Dance'],
  ['father_daughter_dance', 'Father / Daughter Dance'],
  ['mother_son_dance', 'Mother / Son Dance'],
  ['parents_dance', 'Parents Dance'],
  ['wedding_party_dance', 'Wedding Party Dance'],
  ['other_dedication', 'Other Dedication Dance'],
  ['cake_cutting', 'Cake Cutting'],
  ['bouquet_toss', 'Bouquet Toss'],
  ['garter_toss', 'Garter Toss'],
  ['last_dance', 'Last Dance'],
  ['send_off_exit', 'Send Off / Exit'],
];

function row(label: string, value: string | number | null | undefined): string {
  if (value == null || value === '') return '';
  return `**${label}:** ${value}  `;
}

function tri(v: boolean | null): string | null {
  return v == null ? null : v ? 'Yes' : 'No';
}

function fmt(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function eventToMarkdown(event: Event): string {
  const lines: string[] = [];

  const dateStr = format(parseLocalDate(event.event_date), 'EEEE, MMMM d, yyyy');
  const title = event.client_name || 'Untitled Event';
  const eventType = event.event_type ? ` — ${event.event_type}` : '';

  lines.push(`# ${title}${eventType}`);
  lines.push(`**Date:** ${dateStr}  `);
  lines.push(`**Status:** ${event.status}  `);

  // Details
  const details = [
    row('Phone', event.client_phone),
    row('Email', event.client_email),
    row('Partner Phone', event.partner_phone),
    row('Partner Email', event.partner_email),
    row('Secondary Contact', event.secondary_contact),
    row('Guest Count', event.guest_count),
  ].filter(Boolean);
  if (details.length) {
    lines.push('', '---', '', '## Details');
    lines.push(...details);
  }

  // Assignment
  const assignment = [
    row('Assigned DJ', event.assigned_dj),
    row('2nd Assigned', event.second_assigned),
    row('System #', event.system_number),
    row('Attire', event.dj_attire),
  ].filter(Boolean);
  if (assignment.length) {
    lines.push('', '---', '', '## Assignment');
    lines.push(...assignment);
  }

  // Schedule
  const schedule = [
    event.ceremony_start_time || event.ceremony_end_time
      ? row('Ceremony', [event.ceremony_start_time, event.ceremony_end_time].filter(Boolean).join(' – '))
      : '',
    row('Reception', [event.start_time, event.end_time].filter(Boolean).join(' – ') || null),
    row('Setup', event.setup_time),
    row('Guest Arrival', event.guest_arrival_time),
    row('Load-in', event.load_in_time),
    row('Pickup', event.pickup_time),
    event.booked_hours != null ? row('Booked Hours', event.booked_hours) : '',
  ].filter(Boolean);
  if (schedule.length) {
    lines.push('', '---', '', '## Schedule');
    lines.push(...schedule);
  }

  // Venue
  const hasVenue = event.venue_name || event.venue_address || event.venue_phone || event.venue_contact || event.venue_notes || event.ceremony_separate_location != null;
  if (hasVenue) {
    lines.push('', '---', '', '## Venue');
    lines.push(
      ...([
        row('Name', event.venue_name),
        row('Address', event.venue_address),
        row('Phone', event.venue_phone),
        row('Contact', event.venue_contact),
        event.ceremony_separate_location != null
          ? row('Ceremony Location', event.ceremony_separate_location ? 'Separate from reception' : 'Same as reception')
          : '',
      ].filter(Boolean))
    );
    if (event.venue_notes) {
      lines.push('', `**Venue Notes:**  `, event.venue_notes);
    }
  }

  // Couple
  const hasCouple = event.bride_name || event.groom_name || event.bride_parents || event.groom_parents || event.introduction_name;
  if (hasCouple) {
    lines.push('', '---', '', '## Couple');
    lines.push(
      ...([
        row('Bride', event.bride_name),
        row('Groom', event.groom_name),
        row("Bride's Parents", event.bride_parents),
        row("Groom's Parents", event.groom_parents),
        row('Introduce As', event.introduction_name),
      ].filter(Boolean))
    );
  }

  // Wedding Party
  const bridesmaids = event.bridesmaids ?? [];
  const groomsmen = event.groomsmen ?? [];
  const hasParty = event.maid_of_honor || event.best_man || event.flower_girl || event.ring_bearer || bridesmaids.length || groomsmen.length;
  if (hasParty) {
    lines.push('', '---', '', '## Wedding Party');
    lines.push(
      ...([
        row('Maid / Matron of Honor', event.maid_of_honor),
        row('Best Man', event.best_man),
        row('Flower Girl', event.flower_girl),
        row('Ring Bearer', event.ring_bearer),
      ].filter(Boolean))
    );
    if (bridesmaids.length) lines.push(`**Bridesmaids:** ${bridesmaids.join(', ')}  `);
    if (groomsmen.length) lines.push(`**Groomsmen:** ${groomsmen.join(', ')}  `);
  }

  // Reception Flow
  const activities = event.activities ?? [];
  const introduces = [event.introduce_couple ? 'The Couple' : null, event.introduce_wedding_party ? 'The Wedding Party' : null].filter(Boolean);
  const hasReception = event.dinner_service || event.blessing_by || event.toasts_by || event.take_requests != null || introduces.length || activities.length;
  if (hasReception) {
    lines.push('', '---', '', '## Reception Flow');
    const dinnerLabel = event.dinner_service === 'seated' ? 'Seated Dinner' : event.dinner_service === 'buffet' ? 'Buffet' : event.dinner_service;
    lines.push(
      ...([
        row('Dinner Service', dinnerLabel),
        row('Blessing By', event.blessing_by),
        row('Toasts By', event.toasts_by),
        row('Take Requests', tri(event.take_requests)),
        introduces.length ? row('DJ Introduces', introduces.join(' & ')) : '',
      ].filter(Boolean))
    );
    if (activities.length) lines.push(`**Activities:** ${activities.join(', ')}  `);
  }

  // Music Selections
  const music = event.music_selections;
  const musicVariety = event.music_variety ?? [];
  const songs = music
    ? SONG_LABELS.flatMap(([key, label]) => {
        const val = music[key];
        return val && typeof val === 'string' ? [`**${label}:** ${val}  `] : [];
      })
    : [];
  const hasMusic = songs.length || (music?.must_play?.length ?? 0) > 0 || (music?.do_not_play?.length ?? 0) > 0 || music?.music_preferences || musicVariety.length;
  if (hasMusic) {
    lines.push('', '---', '', '## Music Selections');
    if (songs.length) lines.push(...songs);
    if (musicVariety.length) lines.push(`**Music Variety:** ${musicVariety.join(', ')}  `);
    if (music?.must_play?.length) lines.push(`**Must Play:** ${music.must_play.join(', ')}  `);
    if (music?.do_not_play?.length) lines.push(`**Do Not Play:** ${music.do_not_play.join(', ')}  `);
    if (music?.music_preferences) lines.push('', `**Music Preferences:**  `, music.music_preferences);
  }

  // Timeline
  const timeline = event.timeline ?? [];
  if (timeline.length) {
    lines.push('', '---', '', '## Timeline / Run of Show');
    lines.push('| Time | Activity |', '|------|----------|');
    for (const entry of timeline) {
      lines.push(`| ${entry.time} | ${entry.activity} |`);
    }
  }

  // Special Instructions
  if (event.special_instructions) {
    lines.push('', '---', '', '## Special Instructions');
    lines.push(event.special_instructions);
  }

  // Notes
  if (event.notes) {
    lines.push('', '---', '', '## Notes');
    lines.push(event.notes);
  }

  // Pay
  lines.push('', '---', '', '## Pay Breakdown');
  const payRows = [
    ['Base Pay', event.base_pay],
    ['Compliance Bonus', event.compliance_bonus],
    ['Over Hours Pay', event.over_hours_pay],
    ['Fuel Recovery', event.fuel_recovery],
    ['Tip', event.tip],
    ['Overtime Pay', event.overtime_pay],
    ['Other Pay', event.other_pay],
  ] as [string, number][];
  for (const [label, amount] of payRows) {
    if (amount) lines.push(row(label, fmt(amount)));
  }
  lines.push(`**Total Pay:** ${fmt(event.total_pay)}  `);

  lines.push('', '---', `*Exported ${format(new Date(), 'PPP')}*`);

  return lines.join('\n');
}

export function downloadEventMarkdown(event: Event): void {
  const content = eventToMarkdown(event);
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = (event.client_name || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const datePart = event.event_date.replace(/-/g, '');
  a.href = url;
  a.download = `${datePart}-${slug}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
