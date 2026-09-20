// Ordered note-document template for a DJ event — the exact top-to-bottom
// order the operator uses when preparing a gig. Shared by the .docx exporter
// and the per-event AI assistant's context builder.
//
// The document runs: event header (date/time) -> venue notes -> pre-ceremony
// (start + background music) -> ceremony song order -> reception flow.

export interface NoteSection {
  heading: string;
  /** Rows in display order. A value of NA is shown as blank/NA. */
  rows: { label: string; value: string }[];
}

type EventRow = Record<string, unknown>;

const na = (v: unknown): string => {
  if (v === null || v === undefined) return 'NA';
  const s = String(v).trim();
  return s === '' ? 'NA' : s;
};

const song = (m: Record<string, unknown> | null | undefined, key: string): string =>
  na(m?.[key]);

export function buildNoteDocument(event: EventRow, notes: { title?: string | null; content?: string }[]): NoteSection[] {
  const m = (event.music_selections ?? {}) as Record<string, unknown>;
  const party = (event.bridesmaids as string[] | undefined) ?? [];
  const groomsmen = (event.groomsmen as string[] | undefined) ?? [];

  const sections: NoteSection[] = [];

  // 1. Event header — date, contracted time(s), venue line.
  const date = na(event.event_date);
  sections.push({
    heading: `${na(event.client_name === 'NA' ? (event.bride_name ?? event.groom_name) : event.client_name)} — ${date}`,
    rows: [
      { label: 'Event Type', value: na(event.event_type) },
      { label: 'Booked Hours', value: na(event.booked_hours) },
      { label: 'Contract Time', value: event.start_time && event.end_time ? `${event.start_time} – ${event.end_time}` : 'NA' },
      { label: 'Venue', value: [event.venue_name, event.venue_address].filter(Boolean).join(', ') || 'NA' },
      { label: 'Venue Contact', value: na(event.venue_contact) },
      { label: 'Venue Phone', value: na(event.venue_phone) },
    ],
  });

  // 2. Venue notes — first few lines, placement/logistics.
  sections.push({
    heading: 'Venue Notes & Logistics',
    rows: [{ label: 'Notes', value: na(event.venue_notes) }],
  });

  // 3. Pre-ceremony — start time + background music (top of page concern).
  sections.push({
    heading: 'Pre-Ceremony',
    rows: [
      { label: 'Pre-Ceremony Start', value: na(event.guest_arrival_time ?? event.pickup_time ?? event.setup_time) },
      { label: 'Background Music', value: na(m.background_music) },
    ],
  });

  // 4. Ceremony — start time + song order.
  sections.push({
    heading: 'Ceremony',
    rows: [
      { label: 'Ceremony Start', value: na(event.ceremony_start_time) },
      { label: 'Ceremony End', value: na(event.ceremony_end_time) },
      { label: 'Escorting the Mothers', value: song(m, 'escorting_mothers') },
      { label: 'Bridal Party (Pre-Processional)', value: song(m, 'pre_processional') },
      { label: 'Grand Entrance (Processional)', value: song(m, 'ceremony_processional') },
      { label: 'Unity Candle / Sand Ceremony', value: song(m, 'unity_ceremony') },
      { label: 'Recessional', value: song(m, 'ceremony_recessional') },
      { label: 'Cocktail Hour', value: event.ceremony_separate_location ? 'Separate location from reception' : 'Same location' },
    ],
  });

  // 5. Intros — couple and/or bridal party, and party names in order.
  const introTargets: string[] = [];
  if (event.introduce_couple) introTargets.push('Couple');
  if (event.introduce_wedding_party) introTargets.push('Wedding Party');
  const introRows: { label: string; value: string }[] = [
    { label: 'Introduce', value: introTargets.length ? introTargets.join(', ') : 'NA' },
    { label: 'Introduction Style', value: na(event.introduction_name) },
  ];
  if (party.length) introRows.push({ label: 'Bridesmaids', value: party.join(' · ') });
  if (groomsmen.length) introRows.push({ label: 'Groomsmen', value: groomsmen.join(' · ') });
  sections.push({ heading: 'Intros', rows: introRows });

  // 6. Reception flow, top-to-bottom.
  sections.push({
    heading: 'Reception',
    rows: [
      { label: 'Blessing', value: na(event.blessing_by) },
      { label: 'Dinner Service', value: na(event.dinner_service) },
      { label: 'Cake Cut', value: song(m, 'cake_cutting') },
      { label: 'Toasts', value: na(event.toasts_by) },
      { label: 'First Dance', value: song(m, 'first_dance') },
      { label: 'Father / Daughter Dance', value: song(m, 'father_daughter_dance') },
      { label: 'Mother / Son Dance', value: song(m, 'mother_son_dance') },
      { label: 'Parents / Other Dedication', value: song(m, 'parents_dance') || song(m, 'other_dedication') },
      { label: 'Open Dance', value: 'Open' },
    ],
  });

  // 7. Selected activities / icebreakers + music variety.
  const activities = (event.activities as string[] | undefined) ?? [];
  if (activities.length) {
    sections.push({ heading: 'Activities / Icebreakers', rows: [{ label: 'Selected', value: activities.join(' · ') }] });
  }
  const variety = (event.music_variety as string[] | undefined) ?? [];
  if (variety.length) {
    sections.push({ heading: 'Music Variety', rows: [{ label: 'Genres', value: variety.join(' · ') }] });
  }

  // 8. Must-play / do-not-play.
  const must = (m.must_play as string[] | undefined) ?? [];
  const dnp = (m.do_not_play as string[] | undefined) ?? [];
  if (must.length || dnp.length) {
    sections.push({
      heading: 'Song Requests',
      rows: [
        ...(must.length ? [{ label: 'Must Play', value: must.join(' · ') }] : []),
        ...(dnp.length ? [{ label: 'Do NOT Play', value: dnp.join(' · ') }] : []),
      ],
    });
  }

  // 9. Special instructions + free-form notes from the operator's own notes.
  if (na(event.special_instructions) !== 'NA') {
    sections.push({ heading: 'Special Instructions', rows: [{ label: 'Instructions', value: na(event.special_instructions) }] });
  }
  const noteTexts = notes.map((n) => n.content?.trim()).filter(Boolean);
  if (noteTexts.length) {
    sections.push({ heading: 'Operator Notes', rows: [{ label: 'Notes', value: noteTexts.join('\n') }] });
  }

  return sections;
}

/** Compact single-line context for the AI assistant's system prompt. */
export function buildEventContext(event: EventRow, notes: { title?: string | null; content?: string }[]): string {
  const sections = buildNoteDocument(event, notes);
  const lines: string[] = [];
  for (const sec of sections) {
    lines.push(`-- ${sec.heading} --`);
    for (const row of sec.rows) {
      lines.push(`${row.label}: ${row.value}`);
    }
  }
  return lines.join('\n');
}
