/**
 * cem-planner.ts — turn a CEM planning-sheet JSON payload into
 * COMPLETE-PAPERWORK event fields.
 *
 * The portal exposes the client's planning answers as panels of
 * { prompt, value, options } questions. This maps the prompts we care
 * about onto typed event fields and folds the rest into notes so nothing
 * the couple filled out is lost.
 */

export interface CemQuestion {
  prompt: string;
  value?: string | string[] | null;
  answerTypeCode?: string;
  options?: { id: number; label: string; isPreselected?: boolean }[];
}

export interface CemPanel {
  name: string;
  questions: CemQuestion[];
}

export interface CemSection {
  name: string;
  panels: CemPanel[];
}

export interface CemPlanningSheet {
  name: string;
  sections: CemSection[];
}

export interface CemPlanner {
  isLocked?: boolean;
  planningSheets?: CemPlanningSheet[];
}

export interface PlannerFields {
  [key: string]: unknown; // event column names
}

const NA = /^(n\/?a|none|no answer)$/i;

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = Array.isArray(v) ? v.join(', ') : String(v);
  const t = s.trim();
  return t === '' || NA.test(t) ? null : t;
}

// Resolve selected labels for checkbox/tile-radio questions. When the value
// holds option ids, look the labels up; when it holds labels directly, use them.
function selectedLabels(q: CemQuestion): string[] {
  const opts = q.options ?? [];
  const labelById = new Map(opts.map((o) => [String(o.id), o.label]));
  if (Array.isArray(q.value)) {
    const vals = q.value.map(String).filter(Boolean);
    if (vals.length && vals.every((v) => labelById.has(v))) {
      return vals.map((v) => labelById.get(v)!);
    }
    return vals;
  }
  if (typeof q.value === 'string' && labelById.has(q.value)) return [labelById.get(q.value)!];
  return [];
}

export function extractPlannerFields(planner: CemPlanner): PlannerFields {
  // prompt lookup (case-insensitive, exact)
  const byPrompt = new Map<string, CemQuestion>();
  const questions: { section: string; panel: string; q: CemQuestion }[] = [];
  for (const sheet of planner.planningSheets ?? []) {
    for (const section of sheet.sections ?? []) {
      for (const panel of section.panels ?? []) {
        for (const q of panel.questions ?? []) {
          if (q.prompt) {
            byPrompt.set(q.prompt.toLowerCase(), q);
            questions.push({ section: section.name, panel: panel.name, q });
          }
        }
      }
    }
  }
  const get = (prompt: string) => byPrompt.get(prompt.toLowerCase());
  const val = (prompt: string) => str(get(prompt)?.value);
  const sel = (prompt: string) => {
    const q = get(prompt);
    return q ? selectedLabels(q) : [];
  };
  const selOne = (prompt: string) => sel(prompt)[0] ?? null;
  // Range labels like "1-50" / "50-75" → use the upper bound as the estimate.
  const guests = () => {
    const labels = sel('Estimated Number of Guests');
    if (!labels.length) {
      const s = val('Estimated Number of Guests');
      return s ? Number(s.match(/\d+/)?.[0] ?? NaN) || null : null;
    }
    const nums = labels.join(' ').match(/\d+/g);
    return nums ? Math.max(...nums.map(Number)) : null;
  };

  // Emails / phones come in pairs (couple) — first = client, second = partner.
  const emailQs = questions.filter(({ q }) => /^email$/i.test(q.prompt));
  const cellQs = questions.filter(({ q }) => /^(cell|phone|mobile)$/i.test(q.prompt));

  const f: PlannerFields = {
    client_email: emailQs[0] ? str(emailQs[0].q.value) : null,
    partner_email: emailQs[1] ? str(emailQs[1].q.value) : null,
    client_phone: cellQs[0] ? str(cellQs[0].q.value) : null,
    partner_phone: cellQs[1] ? str(cellQs[1].q.value) : null,
    guest_count: guests(),
    ceremony_start_time: val('Start Time') /* ceremony panel wins below */,
    dj_attire: selOne('DJ Attire Preference'),
    dinner_service: selOne('Will you be serving:')?.toLowerCase().includes('seated')
      ? 'seated'
      : selOne('Will you be serving:')?.toLowerCase().includes('buffet')
        ? 'buffet'
        : null,
    blessing_by: val('Who will give the blessing if applicable?'),
    toasts_by: val('Who will be giving toasts?'),
    maid_of_honor: val('Maid/Matron of Honor'),
    best_man: val('Best Man/Person'),
    flower_girl: val('Flower Girl'),
    ring_bearer: val('Ring Bearer'),
    take_requests: (selOne('Would you like your DJ to take requests?') ?? '').toLowerCase() === 'yes'
      ? true
      : (get('would you like your dj to take requests?') ? false : null),
    introduce_couple: (selOne('Would you like to be introduced upon arrival?') ?? '').toLowerCase() === 'yes'
      ? true
      : (get('would you like to be introduced upon arrival?') ? false : null),
    introduce_wedding_party: (selOne('Would you like the DJ to introduce the wedding party?') ?? '').toLowerCase() === 'yes'
      ? true
      : (get('would you like the dj to introduce the wedding party?') ? false : null),
    activities: sel('Interactive activities to encourage your guests to get involved that make for an enjoyable evening!'),
    music_variety: sel('Dance Floor Music'),
  };

  // Ceremony vs Reception both have 'Start Time'/'End Time' — pull them per section.
  const sectionTimes = (sectionName: string) => {
    const qs = questions.filter(({ section }) => section.toLowerCase() === sectionName.toLowerCase());
    const pick = (p: string) => {
      const hit = qs.find(({ q }) => q.prompt.toLowerCase() === p.toLowerCase());
      return hit ? str(hit.q.value) : null;
    };
    return { start: pick('Start Time'), end: pick('End Time') };
  };
  const cer = sectionTimes('Ceremony Information');
  const rec = sectionTimes('Reception Information');
  f.ceremony_start_time = cer.start;
  f.ceremony_end_time = cer.end;
  f.start_time = rec.start;
  f.end_time = rec.end;

  // Dedication dances → music_selections
  f.music_selections = {
    background_music: selOne('Background Music'),
    first_dance: val('First Dance Song Choice'),
    father_daughter_dance: val('Father/Daughter Dance Song Choice'),
    mother_son_dance: val('Mother/Son Dance Song Choice'),
    wedding_party_dance: val('Wedding Party Dance Song Choice'),
    other_dedication: val('Additional/Other Dedication Dances'),
    last_dance: val('Last Dance Song Choice'),
    parents_dance: val("Parents' Dance Song Choice"),
    cake_cutting: val('Cake Cutting Song Choice'),
    bouquet_toss: val('Bouquet Toss Song Choice'),
    garter_toss: val('Garter Toss Song Choice'),
    grand_entrance: val('Grand Entrance Song Choice'),
    ceremony_processional: val('Processional Song Choice'),
    ceremony_recessional: val('Recessional Song Choice'),
    music_preferences: [
      val('If other, please specify'),
      val('Additional music requests or notes'),
    ].filter(Boolean).join(' | ') || null,
  };

  // Everything else the couple filled out → notes so the AI assistant can use it.
  const noteLines: string[] = [];
  const MAPPED = new Set([
    'estimated number of guests', 'your name', "fiance's name", 'email', 'cell', 'phone', 'mobile',
    'start time', 'end time', 'dj attire preference', 'will you be serving:',
    'who will give the blessing if applicable?', 'who will be giving toasts?',
    'maid/matron of honor', 'best man/person', 'flower girl', 'ring bearer',
    'would you like your dj to take requests?', 'would you like to be introduced upon arrival?',
    'would you like the dj to introduce the wedding party?',
    'interactive activities to encourage your guests to get involved that make for an enjoyable evening!',
    'dance floor music', 'background music', 'if other, please specify',
    'first dance song choice', 'father/daughter dance song choice', 'mother/son dance song choice',
    'wedding party dance song choice', 'additional/other dedication dances',
  ]);
  for (const { section, panel, q } of questions) {
    if (MAPPED.has(q.prompt.toLowerCase())) continue;
    const v = str(q.value) ?? (selectedLabels(q).join(', ') || null);
    if (!v) continue;
    noteLines.push(`${section} > ${panel} > ${q.prompt}: ${v}`);
  }
  // Couple names: 'Your Name' is client_name (set below); keep fiance for context.
  const yourName = val('Your Name');
  const fiance = val("Fiance's Name");
  if (fiance) noteLines.push(`Couple: ${yourName ?? 'client'} + ${fiance}`);

  f.planner_notes = noteLines.join('\n');
  if (yourName) f.client_name = yourName;

  return f;
}