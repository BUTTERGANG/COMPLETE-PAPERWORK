import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
} from 'docx';
import { eventFileName } from '../src/lib/eventFilename';

/**
 * Run sheet — a one-page, editable order of events synthesized from the
 * event record + planning-sheet data. Concise by design: known values fill
 * in, unknown ones render as (TBD) so it's a starting point to edit from
 * rather than pages of redundant detail.
 */

const TBD = '(TBD)';

// "18:00" -> "6:00" (12-hour, no am/pm — matches how DJs write run sheets)
function time12(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = iso.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = Number(m[1]) % 24;
  h = h % 12 === 0 ? 12 : h % 12;
  return `${h}:${m[2]}`;
}

// "12156 N. Meridian St., Carmel, IN 46032" -> "Carmel"
function cityOf(address: string | null | undefined): string | null {
  if (!address) return null;
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : null;
}

// Couple display names: explicit bride/groom first, then planner "Couple:" note.
function coupleNames(event: Record<string, unknown>): string {
  const bride = typeof event.bride_name === 'string' ? event.bride_name.trim() : '';
  const groom = typeof event.groom_name === 'string' ? event.groom_name.trim() : '';
  if (bride || groom) return [bride, groom].filter(Boolean).join(' AND ');
  const notes = typeof event.notes === 'string' ? event.notes : '';
  const m = notes.match(/Couple:\s*(.+?)\s*\+\s*(.+)$/m);
  if (m) return `${m[1].trim()} AND ${m[2].trim()}`;
  return (typeof event.client_name === 'string' ? event.client_name : '').toUpperCase();
}

interface Line {
  label: string;
  value: string | null;
  bare?: boolean; // print label alone (e.g. "NO INTROS", "OPEN DANCE")
}

function lines(event: Record<string, unknown>): Line[] {
  const ms = (event.music_selections ?? {}) as Record<string, string | null>;
  const timeline = (event.timeline ?? []) as { time?: string; activity?: string }[];
  const tlFind = (re: RegExp) => {
    const hit = timeline.find((t) => re.test((t.activity ?? '') + ' ' + (t.time ?? '')));
    return hit ? [hit.time, hit.activity] as const : null;
  };

  const s = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null);

  const out: Line[] = [];

  // Ceremony block
  const preCer = s(String(event.ceremony_pre_time ?? '')) || (tlFind(/pre-?ceremony/i)?.[0] ?? null);
  const cerStart = s(event.ceremony_start_time as string) || (tlFind(/ceremony/i)?.[0] ?? null);
  if (preCer) out.push({ label: `PRE-CEREMONY- ${time12(preCer) ?? preCer}`, value: null, bare: true });
  else if (cerStart) out.push({ label: `PRE-CEREMONY- ${TBD}`, value: null, bare: true });
  if (cerStart) out.push({ label: `CEREMONY ${time12(cerStart)}`, value: null, bare: true });

  out.push({ label: 'ESCORT MOMS', value: s(ms.escorting_mothers) });
  out.push({ label: 'BRIDAL PARTY', value: s(ms.pre_processional) });
  out.push({ label: 'GRAND ENTRANCE', value: s(ms.grand_entrance) });
  out.push({ label: 'RECESSIONAL', value: s(ms.ceremony_recessional) });

  // Intros
  if (event.introduce_couple === false || event.introduce_wedding_party === false) {
    out.push({ label: 'NO INTROS', value: null, bare: true });
  } else if (s(ms.grand_entrance) || event.introduce_couple === true) {
    out.push({ label: 'INTROS', value: s(ms.grand_entrance) ?? TBD });
  }

  // Dinner
  const dinner = s(event.dinner_service as string);
  if (dinner === 'buffet') out.push({ label: 'BUFFET- RELEASE TABLES', value: null, bare: true });
  else if (dinner === 'seated') out.push({ label: 'DINNER- SEATED', value: null, bare: true });
  else out.push({ label: 'DINNER', value: TBD });
  out.push({ label: 'TABLE DASH', value: TBD });
  out.push({ label: 'CAKE CUT', value: s(ms.cake_cutting) });
  out.push({ label: 'TOASTS', value: s(event.toasts_by as string) });

  // Dedication dances
  out.push({ label: 'FIRST DANCE', value: s(ms.first_dance) });
  out.push({ label: 'FATHER/DAUGHTER', value: s(ms.father_daughter_dance) });
  out.push({ label: 'MOTHER/SON', value: s(ms.mother_son_dance) });
  out.push({ label: 'PARENTS DANCE', value: s(ms.parents_dance) });
  out.push({ label: 'ANNIVERSARY DANCE', value: TBD });
  out.push({ label: 'BOUQUET TOSS', value: s(ms.bouquet_toss) });
  out.push({ label: 'GARTER TOSS', value: s(ms.garter_toss) });

  out.push({ label: 'OPEN DANCE', value: null, bare: true });

  // Requests
  const mustPlay = Array.isArray(ms.must_play) ? ms.must_play.filter(Boolean) : [];
  const rawRequests = s(event.notes ? (event.notes.match(/Requests?-\s*(.+)$/m)?.[1] ?? null) : null);
  const requests = mustPlay.length ? mustPlay.join(', ') : rawRequests;
  out.push({ label: 'Requests', value: requests ?? TBD });

  // Send-off / last dance when known
  if (s(ms.last_dance)) out.push({ label: 'LAST DANCE', value: s(ms.last_dance) });
  if (s(ms.send_off_exit)) out.push({ label: 'SEND OFF', value: s(ms.send_off_exit) });

  return out;
}

export async function generateRunSheetDocx(event: Record<string, unknown>): Promise<Buffer> {
  const paras: Paragraph[] = [];

  const head = (text: string, size = 24, bold = true, before = 0, after = 120) =>
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before, after },
      children: [new TextRun({ text, bold, size })],
    });

  // Header block
  paras.push(head(coupleNames(event), 28, true, 0, 200));

  const start = time12(event.start_time as string);
  const end = time12(event.end_time as string);
  // CEM venue names end in " - CITY"; strip that suffix before appending the city.
  const rawVenue = (event.venue_name as string | undefined) ?? '';
  const city = cityOf(event.venue_address as string);
  const venue = city && rawVenue.toLowerCase().endsWith(`- ${city.toLowerCase()}`)
    ? rawVenue.slice(0, -city.length - 2).trim()
    : rawVenue;
  const when = `${start ?? TBD}-${end ?? TBD} AT ${venue || TBD}${city && !venue.toLowerCase().includes(city.toLowerCase()) ? ` IN ${city.toUpperCase()}` : ''}`;
  paras.push(head(when, 22, true, 0, 80));

  const ms = (event.music_selections ?? {}) as Record<string, string | null>;
  const bg = ms.background_music && ms.background_music.trim();
  const variety = Array.isArray(event.music_variety) && event.music_variety.length
    ? (event.music_variety as string[]).join(', ')
    : null;
  paras.push(head(`BACKGROUND MUSIC- ${bg || variety || TBD}`, 22, true, 0, 200));

  // Flow lines — label bold, " - " then value; bare lines are their own text
  for (const line of lines(event)) {
    if (line.bare) {
      paras.push(head(line.label, 22, true, 120, 40));
    } else {
      paras.push(
        new Paragraph({
          spacing: { before: 120, after: 40 },
          children: [
            new TextRun({ text: `${line.label}- `, bold: true, size: 22 }),
            new TextRun({ text: line.value || TBD, size: 22 }),
          ],
        })
      );
    }
  }

  // Special instructions footer (equipment / logistics), if any
  const si = typeof event.special_instructions === 'string' ? event.special_instructions.trim() : '';
  if (si) {
    paras.push(head('NOTES', 22, true, 240, 80));
    for (const l of si.split('\n').filter(Boolean)) {
      paras.push(new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: l, size: 22 })] }));
    }
  }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children: paras }],
  });
  return Packer.toBuffer(doc);
}

export function runSheetFilename(event: Record<string, unknown>): string {
  return eventFileName(
    event as { event_date?: string | null; client_name?: string | null; bride_name?: string | null; groom_name?: string | null },
    { suffix: 'runsheet' },
  );
}