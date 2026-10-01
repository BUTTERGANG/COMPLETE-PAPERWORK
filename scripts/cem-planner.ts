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
  // Values sometimes arrive as JSON strings ('["1620","1621",...]' or
  // '[{"id":..,"label":"Name"}]') — unwrap those first.
  let value: unknown = q.value;
  if (typeof value === 'string' && /^[\[{]/.test(value.trim())) {
    try { value = JSON.parse(value); } catch { /* keep raw */ }
  }
  if (Array.isArray(value)) {
    // Object arrays (wedding party members) → labels
    if (value.length && typeof value[0] === 'object' && value[0] !== null && 'label' in value[0]) {
      return (value as { label: string }[]).map((o) => o.label).filter(Boolean);
    }
    const vals = value.map(String).filter(Boolean);
    if (vals.length && vals.every((v) => labelById.has(v))) {
      return vals.map((v) => labelById.get(v)!);
    }
    return vals;
  }
  if (typeof value === 'string' && labelById.has(value)) return [labelById.get(value)!];
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
  const emailQs = questions.filter(({ q }) => /^email/i.test(q.prompt));
  const cellQs = questions.filter(({ q }) => /^(cell|phone|mobile)/i.test(q.prompt));

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
    take_requests: yesNo('Would you like your DJ to take requests?'),
    introduce_couple: yesNo('Would you like to be introduced upon arrival?'),
    introduce_wedding_party: yesNo('Would you like the DJ to introduce the wedding party?'),
    activities: sel('Interactive activities to encourage your guests to get involved that make for an enjoyable evening!'),
    music_variety: sel('Dance Floor Music'),
  };

  // Yes/No questions: only trust an actual answer. Unanswered must stay
  // null — a couple skipping the question doesn't mean "No".
  function yesNo(prompt: string): boolean | null {
    const v = (selOne(prompt) ?? '').toLowerCase();
    if (v.startsWith('yes') || v.startsWith('y')) return true;
    if (v.startsWith('no') || v.startsWith('n')) return false;
    return null;
  }

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

  // Music + flow questions. The portal's prompt wording varies between
  // planner versions ("Escorting Mothers Song" vs "Escorting Mothers",
  // "What type of background music would you like?" vs "Background
  // Music"), so match by ordered patterns instead of exact prompts.
  // First match wins; matched prompts are excluded from the notes dump.
  const ms: Record<string, string | string[] | null> = {
    background_music: null, escorting_mothers: null, pre_processional: null,
    ceremony_processional: null, unity_ceremony: null, ceremony_recessional: null,
    ceremony_interlude: null, grand_entrance: null, first_dance: null,
    father_daughter_dance: null, mother_son_dance: null, parents_dance: null,
    wedding_party_dance: null, other_dedication: null, cake_cutting: null,
    bouquet_toss: null, garter_toss: null, last_dance: null, send_off_exit: null,
    must_play: [], do_not_play: [], music_preferences: null,
  };
  f.introduction_name = null;
  f.guest_arrival_time = null;
  const prefExtras: string[] = [];
  const matchedPrompts = new Set<string>();

  // "3:30pm" / "3:30 pm" -> "15:30"; leaves "16:00" alone. Small hours = PM.
  const time24 = (s: string): string | null => {
    const m = s.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (!m) return null;
    let h = Number(m[1]);
    const ampm = m[3]?.toLowerCase();
    if (ampm === 'pm' && h < 12) h += 12;
    else if (ampm === 'am' && h === 12) h = 0;
    else if (!ampm && h < 7) h += 12;
    return `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
  };

  const patterns: [RegExp, (q: CemQuestion, display: string, labels: string[]) => void][] = [
    // "If other..." variants must win over their parent question's pattern
    [/^if other.*background music/i, (q) => { const v = str(q.value); if (v) prefExtras.push(v); }],
    [/^if other/i, (q) => { const v = str(q.value); if (v) prefExtras.push(v); }],
    [/background music/i, (q, _d, l) => { ms.background_music = l[0] ?? str(q.value); }],
    [/escorting mothers/i, (q) => { ms.escorting_mothers = str(q.value); }],
    [/pre-?processional/i, (q) => { ms.pre_processional = str(q.value); }],
    [/processional/i, (q) => { ms.ceremony_processional = str(q.value); }],
    [/unity (candle|sand)/i, (q) => { ms.unity_ceremony = str(q.value); }],
    [/recessional/i, (q) => { ms.ceremony_recessional = str(q.value); }],
    [/interlude/i, (q) => { ms.ceremony_interlude = str(q.value); }],
    [/grand entrance/i, (q) => { ms.grand_entrance = str(q.value); }],
    [/first dance/i, (q) => { ms.first_dance = str(q.value); }],
    [/father\s*\/?\s*daughter/i, (q) => { ms.father_daughter_dance = str(q.value); }],
    [/mother\s*\/?\s*son/i, (q) => { ms.mother_son_dance = str(q.value); }],
    [/wedding party dance/i, (q) => { ms.wedding_party_dance = str(q.value); }],
    [/parents'? dance/i, (q) => { ms.parents_dance = str(q.value); }],
    [/dedication/i, (q) => { ms.other_dedication = str(q.value); }],
    [/cake cutting/i, (q) => { ms.cake_cutting = str(q.value); }],
    [/bouquet/i, (q) => { ms.bouquet_toss = str(q.value); }],
    [/garter/i, (q) => { ms.garter_toss = str(q.value); }],
    [/last dance/i, (q) => { ms.last_dance = str(q.value); }],
    [/send[- ]?off|grand exit/i, (q) => { ms.send_off_exit = str(q.value); }],
    [/additional songs you would like played|must play/i, (q) => {
      ms.must_play = String(q.value ?? '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }],
    [/do not play|don'?t play/i, (q) => {
      ms.do_not_play = String(q.value ?? '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }],
    [/additional music requests or notes/i, (q) => { const v = str(q.value); if (v) prefExtras.push(v); }],
    [/how would you like to be introduced/i, (q) => { f.introduction_name = str(q.value); }],
    [/guest arrival/i, (q) => { const v = str(q.value); if (v) f.guest_arrival_time = time24(v) ?? v; }],
    [/doors open/i, () => { /* venue logistics — left in notes */ }],
  ];

  for (const { q } of questions) {
    const display = (str(q.value) ?? selectedLabels(q).join(', ')) || null;
    if (!display) continue;
    for (const [re, apply] of patterns) {
      if (re.test(q.prompt)) {
        const labels = selectedLabels(q);
        apply(q, display, labels);
        matchedPrompts.add(q.prompt.toLowerCase());
        break;
      }
    }
  }
  ms.music_preferences = prefExtras.join(' | ') || null;
  // "Background Music: Other" is meaningless alone — the real answer is the
  // "if other..." free text.
  const bg = ms.background_music;
  if (typeof bg === 'string' && bg.toLowerCase() === 'other' && prefExtras.length) {
    ms.background_music = prefExtras[0];
  }
  f.music_selections = ms;

  // Being told what to introduce them as implies they want an intro.
  if (f.introduction_name && f.introduce_couple === null) f.introduce_couple = true;

  // Bridesmaids / groomsmen answers arrive as object arrays → label lists.
  const bridalQ = questions.find(({ q }) => /^bridesmaids$/i.test(q.prompt));
  const groomsQ = questions.find(({ q }) => /^groomsmen$/i.test(q.prompt));
  if (bridalQ) f.bridesmaids = selectedLabels(bridalQ.q);
  if (groomsQ) f.groomsmen = selectedLabels(groomsQ.q);

  // Everything else the couple filled out → notes so the AI assistant can use it.
  const noteLines: string[] = [];
  const contactRe = /^estimated number of guests|^your name$|^fiance's name|^email|^cell|^phone|^mobile|^mailing address|^address line|^city$|^state\/province|^zip|^what are the best days|^what is the best time|^social media|^wedding website|^pinterest|^instagram|^facebook|^favorite/i;
  const mappedRe = /^(start time|end time|dj attire preference|will you be serving:|who will give the blessing|who will be giving toasts|maid\/matron of honor|best man|flower girl|ring bearer|would you like your dj|would you like to be introduced|would you like the dj to introduce|interactive activities|dance floor music)/i;
  for (const { section, panel, q } of questions) {
    const p = q.prompt.toLowerCase();
    if (matchedPrompts.has(p) || mappedRe.test(p) || contactRe.test(p)) continue;
    // Checkbox groups store option ids — resolve to labels for readability.
    const labels = selectedLabels(q);
    const v = (str(q.value) && !/^\d+(\s*,\s*\d+)*$/.test(str(q.value)!))
      ? str(q.value)
      : (labels.join(', ') || null);
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