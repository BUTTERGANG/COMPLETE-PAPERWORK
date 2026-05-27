import { useState } from 'react';
import { useForm, type UseFormRegister, type FieldErrors } from 'react-hook-form';
import type { EventFormData, TimelineEntry } from '../types/event';
import { COMPLIANCE_BONUS_AMOUNT } from '../lib/constants';
import { ClipboardCheckIcon } from './icons/Icons';

interface EventFormProps {
  defaultValues?: Partial<EventFormData>;
  onSubmit: (data: EventFormData) => void;
  submitLabel?: string;
  loading?: boolean;
}

const defaultEvent: EventFormData = {
  event_date: '',
  event_type: '',
  assigned_dj: '',
  second_assigned: '',
  system_number: '',
  dj_attire: '',
  venue_name: '',
  venue_address: '',
  venue_phone: '',
  venue_contact: '',
  venue_notes: '',
  ceremony_separate_location: null,
  client_name: '',
  client_phone: '',
  client_email: '',
  partner_phone: '',
  partner_email: '',
  secondary_contact: '',
  bride_name: '',
  groom_name: '',
  bride_parents: '',
  groom_parents: '',
  guest_count: null,
  maid_of_honor: '',
  best_man: '',
  flower_girl: '',
  ring_bearer: '',
  introduction_name: '',
  bridesmaids: [],
  groomsmen: [],
  pickup_time: '',
  setup_time: '',
  guest_arrival_time: '',
  load_in_time: '',
  ceremony_start_time: '',
  ceremony_end_time: '',
  start_time: '',
  end_time: '',
  booked_hours: null,
  dinner_service: '',
  blessing_by: '',
  toasts_by: '',
  take_requests: null,
  introduce_couple: null,
  introduce_wedding_party: null,
  activities: [],
  music_variety: [],
  pay_type: '',
  base_pay: 0,
  compliance_bonus: 0,
  over_hours_pay: 0,
  fuel_recovery: 0,
  tip: 0,
  overtime_pay: 0,
  other_pay: 0,
  timeline: [],
  music_selections: null,
  special_instructions: '',
  notes: '',
  raw_ai_summary: null,
  status: 'upcoming',
};

const MONEY_FIELDS = ['base_pay', 'compliance_bonus', 'over_hours_pay', 'fuel_recovery', 'tip', 'overtime_pay', 'other_pay'] as const;

const SONG_FIELDS: [string, string][] = [
  ['background_music', 'Background Music (type/genre)'],
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

const ACTIVITY_OPTIONS = [
  'Cha-Cha Slide', 'Electric Slide', 'Cupid Shuffle', 'YMCA', 'Wobble',
  'Cotton Eye Joe', 'Macarena', 'Shout', 'Nae Nae', 'Dougie',
];

const MUSIC_VARIETY_OPTIONS = [
  '80s', '90s', '2000s', 'Top 40', 'Classic Rock', 'Classic R&B', 'Current R&B',
  'Classic Hip Hop', 'Current Hip Hop', 'Classic Country', 'Current Country',
  'Latin', 'EDM / Dance', 'Jazz / Swing',
];

const Field = ({
  label,
  id,
  error,
  children,
}: {
  label: string;
  id: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div>
    <label htmlFor={id} className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
      {label}
    </label>
    {children}
    {error && <p className="mt-1.5 text-xs font-medium text-danger">{error}</p>}
  </div>
);

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">{children}</h3>
);

function TextInput({
  name,
  label,
  register,
  placeholder,
  type = 'text',
}: {
  name: keyof EventFormData;
  label: string;
  register: UseFormRegister<EventFormData>;
  placeholder?: string;
  type?: string;
}) {
  return (
    <Field label={label} id={name as string}>
      <input id={name as string} type={type} placeholder={placeholder} {...register(name as never)} />
    </Field>
  );
}

function MoneyInput({
  name,
  label,
  register,
  errors,
}: {
  name: (typeof MONEY_FIELDS)[number];
  label: string;
  register: UseFormRegister<EventFormData>;
  errors: FieldErrors<EventFormData>;
}) {
  return (
    <Field label={label} id={name} error={errors[name]?.message as string | undefined}>
      <input
        id={name}
        type="number"
        step="0.01"
        min="0"
        placeholder="0.00"
        {...register(name, { valueAsNumber: true, min: { value: 0, message: 'Must be 0 or greater' } })}
      />
    </Field>
  );
}

function TagCheckboxes({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  return (
    <div>
      <span className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-1.5 text-sm text-text-secondary cursor-pointer select-none">
            <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="shrink-0" />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}

export default function EventForm({
  defaultValues,
  onSubmit,
  submitLabel = 'Save Event',
  loading = false,
}: EventFormProps) {
  const { register, handleSubmit, watch, setValue, getValues, formState: { errors } } = useForm<EventFormData>({
    defaultValues: { ...defaultEvent, ...defaultValues },
  });

  const complianceBonus = watch('compliance_bonus');
  const ceremonySeparate = watch('ceremony_separate_location');
  const takeRequests = watch('take_requests');
  const introduceCouple = watch('introduce_couple');
  const introduceParty = watch('introduce_wedding_party');

  // Complex fields managed outside react-hook-form
  const [bridesmaidsText, setBridesmaidsText] = useState(
    (defaultValues?.bridesmaids ?? []).join('\n')
  );
  const [groomsmenText, setGroomsmenText] = useState(
    (defaultValues?.groomsmen ?? []).join('\n')
  );
  const [selectedActivities, setSelectedActivities] = useState<string[]>(
    defaultValues?.activities ?? []
  );
  const [selectedMusicVariety, setSelectedMusicVariety] = useState<string[]>(
    defaultValues?.music_variety ?? []
  );
  const [mustPlayText, setMustPlayText] = useState(
    (defaultValues?.music_selections?.must_play ?? []).join('\n')
  );
  const [doNotPlayText, setDoNotPlayText] = useState(
    (defaultValues?.music_selections?.do_not_play ?? []).join('\n')
  );
  const [musicPref, setMusicPref] = useState(
    defaultValues?.music_selections?.music_preferences ?? ''
  );
  const [songFields, setSongFields] = useState<Record<string, string>>(() => {
    const ms = defaultValues?.music_selections;
    return {
      background_music: ms?.background_music ?? '',
      escorting_mothers: ms?.escorting_mothers ?? '',
      pre_processional: ms?.pre_processional ?? '',
      ceremony_processional: ms?.ceremony_processional ?? '',
      unity_ceremony: ms?.unity_ceremony ?? '',
      ceremony_recessional: ms?.ceremony_recessional ?? '',
      ceremony_interlude: ms?.ceremony_interlude ?? '',
      grand_entrance: ms?.grand_entrance ?? '',
      first_dance: ms?.first_dance ?? '',
      father_daughter_dance: ms?.father_daughter_dance ?? '',
      mother_son_dance: ms?.mother_son_dance ?? '',
      parents_dance: ms?.parents_dance ?? '',
      wedding_party_dance: ms?.wedding_party_dance ?? '',
      other_dedication: ms?.other_dedication ?? '',
      cake_cutting: ms?.cake_cutting ?? '',
      bouquet_toss: ms?.bouquet_toss ?? '',
      garter_toss: ms?.garter_toss ?? '',
      last_dance: ms?.last_dance ?? '',
      send_off_exit: ms?.send_off_exit ?? '',
    };
  });
  const [timelineRows, setTimelineRows] = useState<TimelineEntry[]>(
    defaultValues?.timeline ?? []
  );
  const [newEntry, setNewEntry] = useState<TimelineEntry>({ time: '', activity: '' });

  const updateSong = (key: string, value: string) =>
    setSongFields((prev) => ({ ...prev, [key]: value }));

  const addTimelineRow = () => {
    if (!newEntry.time && !newEntry.activity) return;
    setTimelineRows((prev) => [...prev, { ...newEntry }]);
    setNewEntry({ time: '', activity: '' });
  };

  const processSubmit = (data: EventFormData) => {
    const cleaned: EventFormData = { ...defaultEvent, ...data };
    for (const key of MONEY_FIELDS) {
      cleaned[key] = Number.isNaN(data[key]) ? 0 : data[key];
    }
    cleaned.guest_count = data.guest_count == null || Number.isNaN(data.guest_count) ? null : data.guest_count;
    cleaned.booked_hours = data.booked_hours == null || Number.isNaN(data.booked_hours) ? null : data.booked_hours;

    cleaned.bridesmaids = bridesmaidsText.split('\n').map((s) => s.trim()).filter(Boolean);
    cleaned.groomsmen = groomsmenText.split('\n').map((s) => s.trim()).filter(Boolean);
    cleaned.activities = selectedActivities;
    cleaned.music_variety = selectedMusicVariety;
    cleaned.timeline = timelineRows;

    const mustPlay = mustPlayText.split('\n').map((s) => s.trim()).filter(Boolean);
    const doNotPlay = doNotPlayText.split('\n').map((s) => s.trim()).filter(Boolean);
    const hasMusic =
      Object.values(songFields).some((v) => !!v) ||
      mustPlay.length > 0 ||
      doNotPlay.length > 0 ||
      !!musicPref;

    cleaned.music_selections = hasMusic
      ? {
          background_music: songFields.background_music || null,
          escorting_mothers: songFields.escorting_mothers || null,
          pre_processional: songFields.pre_processional || null,
          ceremony_processional: songFields.ceremony_processional || null,
          unity_ceremony: songFields.unity_ceremony || null,
          ceremony_recessional: songFields.ceremony_recessional || null,
          ceremony_interlude: songFields.ceremony_interlude || null,
          grand_entrance: songFields.grand_entrance || null,
          first_dance: songFields.first_dance || null,
          father_daughter_dance: songFields.father_daughter_dance || null,
          mother_son_dance: songFields.mother_son_dance || null,
          parents_dance: songFields.parents_dance || null,
          wedding_party_dance: songFields.wedding_party_dance || null,
          other_dedication: songFields.other_dedication || null,
          cake_cutting: songFields.cake_cutting || null,
          bouquet_toss: songFields.bouquet_toss || null,
          garter_toss: songFields.garter_toss || null,
          last_dance: songFields.last_dance || null,
          send_off_exit: songFields.send_off_exit || null,
          must_play: mustPlay,
          do_not_play: doNotPlay,
          music_preferences: musicPref || null,
        }
      : null;

    onSubmit(cleaned);
  };

  const triStateValue = (v: boolean | null) => (v == null ? '' : v ? 'yes' : 'no');
  const triStateChange = (field: 'ceremony_separate_location' | 'take_requests') =>
    (e: React.ChangeEvent<HTMLSelectElement>) =>
      setValue(field, e.target.value === '' ? null : e.target.value === 'yes');

  return (
    <form onSubmit={handleSubmit(processSubmit)} className="space-y-4 animate-fade-in">
      {/* Event & Assignment */}
      <div className="card-elevated space-y-4">
        <SectionTitle>Event</SectionTitle>
        <Field label="Date" id="event_date" error={errors.event_date?.message}>
          <input id="event_date" type="date" {...register('event_date', { required: 'Date is required' })} />
        </Field>

        <Field label="Event Type" id="event_type">
          <select id="event_type" {...register('event_type')}>
            <option value="">Select type...</option>
            <option value="wedding">Wedding</option>
            <option value="corporate">Corporate</option>
            <option value="birthday">Birthday</option>
            <option value="club">Club</option>
            <option value="private">Private Party</option>
            <option value="other">Other</option>
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <TextInput name="assigned_dj" label="Assigned DJ" register={register} placeholder="Name" />
          <TextInput name="second_assigned" label="2nd Assigned" register={register} placeholder="Name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput name="system_number" label="System #" register={register} placeholder="1" />
          <TextInput name="dj_attire" label="DJ Attire" register={register} placeholder="Semi-formal" />
        </div>
      </div>

      {/* Client & Couple */}
      <div className="card-elevated space-y-4">
        <SectionTitle>Client &amp; Couple</SectionTitle>
        <Field label="Client Name" id="client_name" error={errors.client_name?.message}>
          <input id="client_name" {...register('client_name', { required: 'Name is required' })} placeholder="John & Jane" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <TextInput name="client_phone" label="Client Phone" register={register} placeholder="(555) 123-4567" />
          <TextInput name="client_email" label="Client Email" register={register} placeholder="client@email.com" type="email" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput name="partner_phone" label="Partner Phone" register={register} placeholder="(555) 123-4567" />
          <TextInput name="partner_email" label="Partner Email" register={register} placeholder="partner@email.com" type="email" />
        </div>
        <TextInput name="secondary_contact" label="Secondary Contact" register={register} placeholder="Planner / coordinator" />

        <div className="grid grid-cols-2 gap-3">
          <TextInput name="bride_name" label="Bride" register={register} placeholder="Bride name" />
          <TextInput name="groom_name" label="Groom" register={register} placeholder="Groom name" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput name="bride_parents" label="Bride's Parents" register={register} placeholder="Names" />
          <TextInput name="groom_parents" label="Groom's Parents" register={register} placeholder="Names" />
        </div>
        <Field label="Guest Count" id="guest_count">
          <input
            id="guest_count"
            type="number"
            min="0"
            step="1"
            {...register('guest_count', { valueAsNumber: true, min: { value: 0, message: 'Must be 0 or greater' } })}
            placeholder="0"
          />
        </Field>
      </div>

      {/* Venue */}
      <div className="card-elevated space-y-4">
        <SectionTitle>Venue</SectionTitle>
        <TextInput name="venue_name" label="Venue Name" register={register} placeholder="Grand Ballroom" />
        <TextInput name="venue_address" label="Venue Address" register={register} placeholder="123 Main St, City" />
        <Field label="Venue Notes" id="venue_notes">
          <textarea id="venue_notes" {...register('venue_notes')} rows={2} placeholder="Parking, load-in, noise restrictions..." className="resize-none" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <TextInput name="venue_phone" label="Venue Phone" register={register} placeholder="(555) 123-4567" />
          <TextInput name="venue_contact" label="Venue Contact" register={register} placeholder="Coordinator name" />
        </div>
        <Field label="Ceremony in a separate location?" id="ceremony_separate_location">
          <select
            id="ceremony_separate_location"
            value={triStateValue(ceremonySeparate)}
            onChange={triStateChange('ceremony_separate_location')}
          >
            <option value="">Unknown</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>
      </div>

      {/* Wedding Party */}
      <div className="card-elevated space-y-4">
        <SectionTitle>Wedding Party</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <TextInput name="maid_of_honor" label="Maid/Matron of Honor" register={register} placeholder="Name(s)" />
          <TextInput name="best_man" label="Best Man" register={register} placeholder="Name(s)" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput name="flower_girl" label="Flower Girl" register={register} placeholder="Name" />
          <TextInput name="ring_bearer" label="Ring Bearer" register={register} placeholder="Name" />
        </div>
        <TextInput name="introduction_name" label="Introduce As" register={register} placeholder="Mr. and Mrs. Smith" />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Bridesmaids" id="bridesmaids">
            <textarea
              id="bridesmaids"
              value={bridesmaidsText}
              onChange={(e) => setBridesmaidsText(e.target.value)}
              rows={3}
              placeholder={"One name per line"}
              className="resize-none"
            />
          </Field>
          <Field label="Groomsmen" id="groomsmen">
            <textarea
              id="groomsmen"
              value={groomsmenText}
              onChange={(e) => setGroomsmenText(e.target.value)}
              rows={3}
              placeholder={"One name per line"}
              className="resize-none"
            />
          </Field>
        </div>
      </div>

      {/* Times */}
      <div className="card-elevated space-y-4">
        <SectionTitle>Times</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <TextInput name="ceremony_start_time" label="Ceremony Start" register={register} type="time" />
          <TextInput name="ceremony_end_time" label="Ceremony End" register={register} type="time" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Reception Start" id="start_time" error={errors.start_time?.message}>
            <input id="start_time" type="time" {...register('start_time', { required: 'Start time is required' })} />
          </Field>
          <Field label="Reception End" id="end_time" error={errors.end_time?.message}>
            <input
              id="end_time"
              type="time"
              {...register('end_time', {
                validate: (value) => {
                  if (!value) return true;
                  const start = getValues('start_time');
                  if (!start) return true;
                  return value > start || 'End time must be after start time';
                },
              })}
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput name="setup_time" label="Setup Time" register={register} type="time" />
          <TextInput name="guest_arrival_time" label="Guest Arrival" register={register} type="time" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextInput name="load_in_time" label="Load-in Time" register={register} type="time" />
          <TextInput name="pickup_time" label="Pickup Time" register={register} type="time" />
        </div>
        <Field label="Booked Hours" id="booked_hours">
          <input id="booked_hours" type="number" min="0" step="0.5" {...register('booked_hours', { valueAsNumber: true })} placeholder="5" />
        </Field>
      </div>

      {/* Reception Flow */}
      <div className="card-elevated space-y-4">
        <SectionTitle>Reception Flow</SectionTitle>
        <Field label="Dinner Service" id="dinner_service">
          <select id="dinner_service" {...register('dinner_service')}>
            <option value="">Select...</option>
            <option value="seated">Seated Dinner</option>
            <option value="buffet">Buffet</option>
          </select>
        </Field>
        <TextInput name="blessing_by" label="Blessing By" register={register} placeholder="Name" />
        <TextInput name="toasts_by" label="Toasts By" register={register} placeholder="FOG, FOB, best men..." />
        <Field label="Take Requests?" id="take_requests">
          <select id="take_requests" value={triStateValue(takeRequests)} onChange={triStateChange('take_requests')}>
            <option value="">Unknown</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </Field>

        <div>
          <span className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
            DJ Introduces (into reception)
          </span>
          <div className="space-y-2">
            <label htmlFor="introduce_couple" className="flex items-center gap-2.5 text-sm text-text-secondary cursor-pointer">
              <input
                id="introduce_couple"
                type="checkbox"
                checked={!!introduceCouple}
                onChange={(e) => setValue('introduce_couple', e.target.checked)}
                className="shrink-0"
              />
              The Couple
            </label>
            <label htmlFor="introduce_wedding_party" className="flex items-center gap-2.5 text-sm text-text-secondary cursor-pointer">
              <input
                id="introduce_wedding_party"
                type="checkbox"
                checked={!!introduceParty}
                onChange={(e) => setValue('introduce_wedding_party', e.target.checked)}
                className="shrink-0"
              />
              The Wedding Party
            </label>
          </div>
        </div>

        <TagCheckboxes
          label="Group Activities / Dances"
          options={ACTIVITY_OPTIONS}
          selected={selectedActivities}
          onChange={setSelectedActivities}
        />
      </div>

      {/* Music Selections */}
      <div className="card-elevated space-y-4">
        <SectionTitle>Music Selections</SectionTitle>

        {SONG_FIELDS.map(([key, label]) => (
          <Field key={key} label={label} id={`song_${key}`}>
            <input
              id={`song_${key}`}
              type="text"
              value={songFields[key]}
              onChange={(e) => updateSong(key, e.target.value)}
              placeholder="Song – Artist"
            />
          </Field>
        ))}

        <TagCheckboxes
          label="Music Variety / Genres"
          options={MUSIC_VARIETY_OPTIONS}
          selected={selectedMusicVariety}
          onChange={setSelectedMusicVariety}
        />

        <Field label="Music Preferences / Notes" id="music_preferences">
          <textarea
            id="music_preferences"
            value={musicPref}
            onChange={(e) => setMusicPref(e.target.value)}
            rows={2}
            placeholder="Genre vibes, energy notes..."
            className="resize-none"
          />
        </Field>

        <Field label="Must Play (one per line)" id="must_play">
          <textarea
            id="must_play"
            value={mustPlayText}
            onChange={(e) => setMustPlayText(e.target.value)}
            rows={3}
            placeholder={"Song – Artist\nSong – Artist"}
            className="resize-none"
          />
        </Field>

        <Field label="Do Not Play (one per line)" id="do_not_play">
          <textarea
            id="do_not_play"
            value={doNotPlayText}
            onChange={(e) => setDoNotPlayText(e.target.value)}
            rows={3}
            placeholder={"Song – Artist\nSong – Artist"}
            className="resize-none"
          />
        </Field>
      </div>

      {/* Timeline / Run of Show */}
      <div className="card-elevated space-y-4">
        <SectionTitle>Timeline / Run of Show</SectionTitle>

        {timelineRows.length > 0 && (
          <div className="space-y-0">
            {timelineRows.map((row, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border-subtle last:border-0">
                <span className="font-mono text-sm font-semibold text-accent w-14 shrink-0">{row.time}</span>
                <span className="text-sm text-text-secondary flex-1">{row.activity}</span>
                <button
                  type="button"
                  onClick={() => setTimelineRows((prev) => prev.filter((_, idx) => idx !== i))}
                  className="btn-ghost !p-1.5 text-text-quaternary hover:text-danger shrink-0"
                  aria-label="Remove entry"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2 items-end">
          <Field label="Time" id="new_entry_time">
            <input
              id="new_entry_time"
              type="time"
              value={newEntry.time}
              onChange={(e) => setNewEntry((prev) => ({ ...prev, time: e.target.value }))}
              className="w-28"
            />
          </Field>
          <Field label="Activity" id="new_entry_activity">
            <input
              id="new_entry_activity"
              type="text"
              value={newEntry.activity}
              onChange={(e) => setNewEntry((prev) => ({ ...prev, activity: e.target.value }))}
              placeholder="e.g. Grand Entrance"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTimelineRow(); } }}
            />
          </Field>
          <button
            type="button"
            onClick={addTimelineRow}
            className="btn-secondary shrink-0 mb-0"
          >
            Add
          </button>
        </div>
      </div>

      {/* Pay */}
      <div className="card-elevated space-y-4">
        <SectionTitle>Pay</SectionTitle>

        <Field label="Pay Type" id="pay_type">
          <select id="pay_type" {...register('pay_type')}>
            <option value="">Select...</option>
            <option value="flat">Flat Rate</option>
            <option value="hourly">Hourly</option>
            <option value="negotiable">Negotiable</option>
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <MoneyInput name="base_pay" label="Base Pay ($)" register={register} errors={errors} />
          <MoneyInput name="over_hours_pay" label="Over Hours ($)" register={register} errors={errors} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput name="fuel_recovery" label="Fuel Recovery ($)" register={register} errors={errors} />
          <MoneyInput name="overtime_pay" label="Overtime ($)" register={register} errors={errors} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <MoneyInput name="tip" label="Tip ($)" register={register} errors={errors} />
          <MoneyInput name="other_pay" label="Other ($)" register={register} errors={errors} />
        </div>

        <label htmlFor="compliance_bonus" className="flex items-center gap-3 p-4 bg-surface-2 rounded-xl border border-border-subtle cursor-pointer transition-colors hover:border-accent/30">
          <input
            id="compliance_bonus"
            type="checkbox"
            checked={complianceBonus > 0}
            onChange={(e) => setValue('compliance_bonus', e.target.checked ? COMPLIANCE_BONUS_AMOUNT : 0)}
            className="shrink-0"
          />
          <div className="flex items-center gap-2.5 flex-1">
            <div className="w-8 h-8 rounded-lg bg-success/15 flex items-center justify-center">
              <ClipboardCheckIcon size={15} className="text-success" />
            </div>
            <div>
              <span className="text-sm font-medium text-text-primary">Compliance Bonus</span>
              <span className="text-success font-semibold ml-1.5">+$40</span>
            </div>
          </div>
        </label>
      </div>

      {/* Status & Notes */}
      <div className="card-elevated space-y-4">
        <Field label="Status" id="status">
          <select id="status" {...register('status')}>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>

        <Field label="Special Instructions" id="special_instructions">
          <textarea id="special_instructions" {...register('special_instructions')} rows={2} placeholder="Equipment, dress code, announcements..." className="resize-none" />
        </Field>

        <Field label="Notes" id="notes">
          <textarea id="notes" {...register('notes')} rows={3} placeholder="Any additional notes..." className="resize-none" />
        </Field>
      </div>

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          submitLabel
        )}
      </button>
    </form>
  );
}
