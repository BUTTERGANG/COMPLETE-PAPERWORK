import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  convertInchesToTwip,
} from 'docx';
import { format } from 'date-fns';
import { parseLocalDate } from './dateUtils';
import { eventFileName } from './eventFilename';
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

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'auto' } as const;

// Section heading with a thin rule underneath
function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999' },
    },
  });
}

// "Label: Value" on one line
function field(label: string, value: string | number): Paragraph {
  return new Paragraph({
    spacing: { after: 80 },
    children: [
      new TextRun({ text: `${label}: `, bold: true }),
      new TextRun({ text: String(value) }),
    ],
  });
}

// Block of text under a bold label (for notes, preferences, etc.)
function textBlock(label: string, value: string): Paragraph[] {
  return [
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: `${label}:`, bold: true })],
    }),
    new Paragraph({
      spacing: { after: 160 },
      indent: { left: convertInchesToTwip(0.2) },
      children: [new TextRun({ text: value })],
    }),
  ];
}

// Comma-joined list on one line
function fieldList(label: string, items: string[]): Paragraph {
  return field(label, items.join(', '));
}

// Clean two-column table — used only for timeline
function timelineTable(entries: { time: string; activity: string }[]): Table {
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      tableCell('Time', 18, true),
      tableCell('Activity', 18, true),
    ],
  });

  const dataRows = entries.map(
    (entry) =>
      new TableRow({
        children: [
          tableCell(entry.time, 18, false, 18),
          tableCell(entry.activity, 18, false, 72),
        ],
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    columnWidths: [convertInchesToTwip(1.2), convertInchesToTwip(5.1)],
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' },
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: 'CCCCCC' },
      insideVertical: NO_BORDER,
    },
    rows: [headerRow, ...dataRows],
  });
}

function tableCell(
  text: string,
  size: number,
  header: boolean,
  leftPad = 0
): TableCell {
  return new TableCell({
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
    margins: { top: 80, bottom: 80, left: leftPad, right: 0 },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: header, size })],
      }),
    ],
  });
}

function spacer(pts = 80): Paragraph {
  return new Paragraph({ text: '', spacing: { after: pts } });
}

function fmt(n: number): string {
  return `$${n.toFixed(2)}`;
}

function tri(v: boolean | null): string | null {
  return v == null ? null : v ? 'Yes' : 'No';
}

export async function eventToDocx(event: Event): Promise<Blob> {
  const dateStr = format(parseLocalDate(event.event_date), 'EEEE, MMMM d, yyyy');
  const title = event.client_name || 'Untitled Event';
  const eventType = event.event_type ? ` — ${event.event_type}` : '';

  const children: (Paragraph | Table)[] = [];

  // ── Title block ────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 60 },
      children: [new TextRun({ text: `${title}${eventType}`, bold: true })],
    }),
    new Paragraph({
      spacing: { after: 40 },
      children: [new TextRun({ text: dateStr, italics: true, size: 22 })],
    }),
    new Paragraph({
      spacing: { after: 240 },
      children: [
        new TextRun({ text: 'Status: ', bold: true }),
        new TextRun({ text: event.status.charAt(0).toUpperCase() + event.status.slice(1) }),
      ],
    })
  );

  // ── Details ────────────────────────────────────────────────────────────────
  const hasDetails = event.client_phone || event.client_email || event.partner_phone ||
    event.partner_email || event.secondary_contact || event.guest_count != null;
  if (hasDetails) {
    children.push(sectionHeading('Details'));
    if (event.client_phone) children.push(field('Phone', event.client_phone));
    if (event.client_email) children.push(field('Email', event.client_email));
    if (event.partner_phone) children.push(field('Partner Phone', event.partner_phone));
    if (event.partner_email) children.push(field('Partner Email', event.partner_email));
    if (event.secondary_contact) children.push(field('Secondary Contact', event.secondary_contact));
    if (event.guest_count != null) children.push(field('Guest Count', event.guest_count));
  }

  // ── Assignment ─────────────────────────────────────────────────────────────
  const hasAssignment = event.assigned_dj || event.second_assigned || event.system_number || event.dj_attire;
  if (hasAssignment) {
    children.push(sectionHeading('Assignment'));
    if (event.assigned_dj) children.push(field('Assigned DJ', event.assigned_dj));
    if (event.second_assigned) children.push(field('2nd Assigned', event.second_assigned));
    if (event.system_number) children.push(field('System #', event.system_number));
    if (event.dj_attire) children.push(field('Attire', event.dj_attire));
  }

  // ── Schedule ───────────────────────────────────────────────────────────────
  const hasTimes = event.ceremony_start_time || event.ceremony_end_time || event.start_time ||
    event.end_time || event.setup_time || event.guest_arrival_time || event.load_in_time ||
    event.pickup_time || event.booked_hours != null;
  if (hasTimes) {
    children.push(sectionHeading('Schedule'));
    if (event.ceremony_start_time || event.ceremony_end_time)
      children.push(field('Ceremony', [event.ceremony_start_time, event.ceremony_end_time].filter(Boolean).join(' – ')));
    if (event.start_time || event.end_time)
      children.push(field('Reception', [event.start_time, event.end_time].filter(Boolean).join(' – ')));
    if (event.setup_time) children.push(field('Setup', event.setup_time));
    if (event.guest_arrival_time) children.push(field('Guest Arrival', event.guest_arrival_time));
    if (event.load_in_time) children.push(field('Load-in', event.load_in_time));
    if (event.pickup_time) children.push(field('Pickup', event.pickup_time));
    if (event.booked_hours != null) children.push(field('Booked Hours', event.booked_hours));
  }

  // ── Venue ──────────────────────────────────────────────────────────────────
  const hasVenue = event.venue_name || event.venue_address || event.venue_phone ||
    event.venue_contact || event.ceremony_separate_location != null || event.venue_notes;
  if (hasVenue) {
    children.push(sectionHeading('Venue'));
    if (event.venue_name) children.push(field('Name', event.venue_name));
    if (event.venue_address) children.push(field('Address', event.venue_address));
    if (event.venue_phone) children.push(field('Phone', event.venue_phone));
    if (event.venue_contact) children.push(field('Contact', event.venue_contact));
    if (event.ceremony_separate_location != null)
      children.push(field('Ceremony Location', event.ceremony_separate_location ? 'Separate from reception' : 'Same as reception'));
    if (event.venue_notes) children.push(...textBlock('Venue Notes', event.venue_notes));
  }

  // ── Couple ─────────────────────────────────────────────────────────────────
  const hasCouple = event.bride_name || event.groom_name || event.bride_parents ||
    event.groom_parents || event.introduction_name;
  if (hasCouple) {
    children.push(sectionHeading('Couple'));
    if (event.bride_name) children.push(field('Bride', event.bride_name));
    if (event.groom_name) children.push(field('Groom', event.groom_name));
    if (event.bride_parents) children.push(field("Bride's Parents", event.bride_parents));
    if (event.groom_parents) children.push(field("Groom's Parents", event.groom_parents));
    if (event.introduction_name) children.push(field('Introduce As', event.introduction_name));
  }

  // ── Wedding Party ──────────────────────────────────────────────────────────
  const bridesmaids = event.bridesmaids ?? [];
  const groomsmen = event.groomsmen ?? [];
  const hasParty = event.maid_of_honor || event.best_man || event.flower_girl ||
    event.ring_bearer || bridesmaids.length || groomsmen.length;
  if (hasParty) {
    children.push(sectionHeading('Wedding Party'));
    if (event.maid_of_honor) children.push(field('Maid / Matron of Honor', event.maid_of_honor));
    if (event.best_man) children.push(field('Best Man', event.best_man));
    if (event.flower_girl) children.push(field('Flower Girl', event.flower_girl));
    if (event.ring_bearer) children.push(field('Ring Bearer', event.ring_bearer));
    if (bridesmaids.length) children.push(fieldList('Bridesmaids', bridesmaids));
    if (groomsmen.length) children.push(fieldList('Groomsmen', groomsmen));
  }

  // ── Reception Flow ─────────────────────────────────────────────────────────
  const activities = event.activities ?? [];
  const introduces = [
    event.introduce_couple ? 'The Couple' : null,
    event.introduce_wedding_party ? 'The Wedding Party' : null,
  ].filter((s): s is string => s !== null);
  const hasReception = event.dinner_service || event.blessing_by || event.toasts_by ||
    event.take_requests != null || introduces.length || activities.length;
  if (hasReception) {
    children.push(sectionHeading('Reception Flow'));
    if (event.dinner_service) {
      const label = event.dinner_service === 'seated' ? 'Seated Dinner' :
        event.dinner_service === 'buffet' ? 'Buffet' : event.dinner_service;
      children.push(field('Dinner Service', label));
    }
    if (event.blessing_by) children.push(field('Blessing By', event.blessing_by));
    if (event.toasts_by) children.push(field('Toasts By', event.toasts_by));
    if (event.take_requests != null) children.push(field('Take Requests', tri(event.take_requests)!));
    if (introduces.length) children.push(field('DJ Introduces', introduces.join(' & ')));
    if (activities.length) children.push(fieldList('Activities', activities));
  }

  // ── Music Selections ───────────────────────────────────────────────────────
  const music = event.music_selections;
  const musicVariety = event.music_variety ?? [];
  const songs = music
    ? SONG_LABELS.flatMap(([key, label]) => {
        const val = music[key];
        return val && typeof val === 'string' ? [[label, val] as [string, string]] : [];
      })
    : [];
  const hasMusic = songs.length || (music?.must_play?.length ?? 0) > 0 ||
    (music?.do_not_play?.length ?? 0) > 0 || !!music?.music_preferences || musicVariety.length > 0;

  if (hasMusic) {
    children.push(sectionHeading('Music Selections'));
    for (const [label, song] of songs) {
      children.push(field(label, song));
    }
    if (musicVariety.length) children.push(fieldList('Music Variety', musicVariety));
    if (music?.must_play?.length) children.push(fieldList('Must Play', music.must_play));
    if (music?.do_not_play?.length) children.push(fieldList('Do Not Play', music.do_not_play));
    if (music?.music_preferences) children.push(...textBlock('Music Preferences', music.music_preferences));
  }

  // ── Timeline ───────────────────────────────────────────────────────────────
  const timeline = event.timeline ?? [];
  if (timeline.length) {
    children.push(sectionHeading('Timeline / Run of Show'), spacer(80), timelineTable(timeline), spacer());
  }

  // ── Special Instructions ───────────────────────────────────────────────────
  if (event.special_instructions) {
    children.push(sectionHeading('Special Instructions'));
    children.push(...textBlock('', event.special_instructions));
  }

  // ── Notes ──────────────────────────────────────────────────────────────────
  if (event.notes) {
    children.push(sectionHeading('Notes'));
    children.push(...textBlock('', event.notes));
  }

  // ── Pay Breakdown ──────────────────────────────────────────────────────────
  children.push(sectionHeading('Pay Breakdown'));
  if (event.base_pay) children.push(field('Base Pay', fmt(event.base_pay)));
  if (event.compliance_bonus) children.push(field('Compliance Bonus', fmt(event.compliance_bonus)));
  if (event.over_hours_pay) children.push(field('Over Hours Pay', fmt(event.over_hours_pay)));
  if (event.fuel_recovery) children.push(field('Fuel Recovery', fmt(event.fuel_recovery)));
  if (event.tip) children.push(field('Tip', fmt(event.tip)));
  if (event.overtime_pay) children.push(field('Overtime Pay', fmt(event.overtime_pay)));
  if (event.other_pay) children.push(field('Other Pay', fmt(event.other_pay)));
  children.push(
    spacer(80),
    new Paragraph({
      spacing: { after: 40 },
      border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'AAAAAA' } },
      children: [
        new TextRun({ text: 'Total Pay: ', bold: true, size: 24 }),
        new TextRun({ text: fmt(event.total_pay), bold: true, size: 24 }),
      ],
    })
  );

  // ── Footer ─────────────────────────────────────────────────────────────────
  children.push(
    spacer(120),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: `Exported ${format(new Date(), 'PPP')}`,
          italics: true,
          color: 'AAAAAA',
          size: 18,
        }),
      ],
    })
  );

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22, color: '1A1A1A' },
          paragraph: { spacing: { line: 276 } },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          quickFormat: true,
          run: { bold: true, size: 40, font: 'Calibri', color: '000000' },
          paragraph: { spacing: { before: 0, after: 80 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          quickFormat: true,
          run: { bold: true, size: 24, font: 'Calibri', color: '111111', allCaps: true },
          paragraph: { spacing: { before: 320, after: 120 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.25),
            },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBlob(doc);
}

export async function downloadEventDocx(event: Event): Promise<void> {
  const blob = await eventToDocx(event);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = eventFileName(event, { suffix: 'record' });
  a.click();
  URL.revokeObjectURL(url);
}
