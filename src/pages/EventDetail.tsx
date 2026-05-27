import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useEvents } from '../hooks/useEvents';
import type { Event, MusicSelections } from '../types/event';
import { parseLocalDate } from '../lib/dateUtils';
import PayBreakdown from '../components/PayBreakdown';
import { Spinner } from '../components/Spinner';
import {
  ChevronLeftIcon,
  TrashIcon,
  MapPinIcon,
  PhoneIcon,
  MailIcon,
  ClockIcon,
  CalendarIcon,
  FileTextIcon,
  SparklesIcon,
  ClipboardCheckIcon,
  HeadphonesIcon,
  HomeIcon,
} from '../components/icons/Icons';

function EventInfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border-subtle last:border-0">
      <span className="flex items-center gap-2.5 text-sm text-text-tertiary">
        <span className="text-text-quaternary">{icon}</span>
        {label}
      </span>
      <span className="text-sm font-medium text-text-primary text-right max-w-[60%] truncate">
        {value || '—'}
      </span>
    </div>
  );
}

const MUSIC_LABELS: [keyof MusicSelections, string][] = [
  ['background_music', 'Background Music'],
  ['escorting_mothers', 'Escorting Mothers'],
  ['pre_processional', 'Pre-Processional / Wedding Party'],
  ['ceremony_processional', 'Processional / Grand Entrance'],
  ['unity_ceremony', 'Unity Candle / Sand Ceremony'],
  ['ceremony_recessional', 'Recessional'],
  ['ceremony_interlude', 'Ceremony Interlude'],
  ['grand_entrance', 'Reception Entrance'],
  ['first_dance', 'First Dance'],
  ['father_daughter_dance', 'Father/Daughter Dance'],
  ['mother_son_dance', 'Mother/Son Dance'],
  ['parents_dance', 'Parents Dance'],
  ['wedding_party_dance', 'Wedding Party Dance'],
  ['other_dedication', 'Other Dedication Dance'],
  ['cake_cutting', 'Cake Cutting'],
  ['bouquet_toss', 'Bouquet Toss'],
  ['garter_toss', 'Garter Toss'],
  ['last_dance', 'Last Dance'],
  ['send_off_exit', 'Send Off / Exit'],
];

function getMusicSongs(music: MusicSelections): { label: string; song: string }[] {
  const songs: { label: string; song: string }[] = [];
  for (const [key, label] of MUSIC_LABELS) {
    const val = music[key];
    if (val && typeof val === 'string') songs.push({ label, song: val });
  }
  return songs;
}

function hasMusicContent(music: MusicSelections | null): music is MusicSelections {
  if (!music) return false;
  return (
    getMusicSongs(music).length > 0 ||
    (music.must_play?.length ?? 0) > 0 ||
    (music.do_not_play?.length ?? 0) > 0 ||
    !!music.music_preferences
  );
}

export default function EventDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.userId);
  const queryClient = useQueryClient();
  const { findEvent, useEvent, updateEvent, deleteEvent } = useEvents();
  const [saving, setSaving] = useState(false);
  const requestIdRef = useRef(0);

  const cachedEvent = id ? findEvent(id) : null;
  const { data: fetchedEvent, isLoading: isFetching } = useEvent(
    cachedEvent ? undefined : id
  );
  const event = cachedEvent ?? fetchedEvent ?? null;

  // Images are stored directly as base64 in the event record — no signed URL needed
  const images = event?.paperwork_images ?? [];
  const toDataUrl = (img: string) => (img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`);

  const handleStatusChange = async (status: Event['status']) => {
    if (!event || !id) return;
    const currentId = ++requestIdRef.current;
    setSaving(true);
    try {
      const updated = await updateEvent(id, { status });
      if (currentId === requestIdRef.current) {
        queryClient.setQueryData(['events', userId], (old: Event[] | undefined) =>
          old?.map((e) => (e.id === id ? updated : e)) ?? []
        );
      }
    } catch (err) {
      if (currentId === requestIdRef.current) {
        console.error('Failed to update status:', err);
      }
    } finally {
      if (currentId === requestIdRef.current) {
        setSaving(false);
      }
    }
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!showDeleteConfirm) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setShowDeleteConfirm(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showDeleteConfirm]);

  const handleDelete = async () => {
    if (!event || !id) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!id) return;
    setShowDeleteConfirm(false);
    await deleteEvent(id);
    navigate('/events');
  };

  const isListLoading = !queryClient.getQueryData(['events', userId]);
  const isLoading = (isListLoading && !event) || isFetching;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary mb-4">Event not found</p>
        <button onClick={() => navigate('/events')} className="btn-primary">
          Back to Events
        </button>
      </div>
    );
  }

  const hasCouple = !!(event.bride_name || event.groom_name || event.bride_parents || event.groom_parents || event.introduction_name);
  const music = event.music_selections;
  const songs = music ? getMusicSongs(music) : [];
  const musicVariety = event.music_variety ?? [];
  const showMusic = hasMusicContent(music) || musicVariety.length > 0;
  const timeline = event.timeline ?? [];
  const bridesmaids = event.bridesmaids ?? [];
  const groomsmen = event.groomsmen ?? [];
  const activities = event.activities ?? [];
  const hasVenueExtra = !!(event.venue_phone || event.venue_contact || event.venue_notes || event.ceremony_separate_location != null);
  const hasWeddingParty = !!(event.maid_of_honor || event.best_man || event.flower_girl || event.ring_bearer || bridesmaids.length || groomsmen.length);
  const hasAssignment = !!(event.assigned_dj || event.second_assigned || event.system_number || event.dj_attire);
  const introduces = [event.introduce_couple ? 'The Couple' : null, event.introduce_wedding_party ? 'The Wedding Party' : null].filter(Boolean) as string[];
  const hasReception = !!(event.dinner_service || event.blessing_by || event.toasts_by || event.take_requests != null || event.introduce_couple != null || event.introduce_wedding_party != null || activities.length);
  const triLabel = (v: boolean | null) => (v == null ? null : v ? 'Yes' : 'No');

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="btn-ghost !p-2 -ml-2" aria-label="Go back">
          <ChevronLeftIcon size={20} />
        </button>
        <div className="flex gap-1">
          <button
            onClick={handleDelete}
            className="btn-ghost btn-danger !p-2"
            aria-label="Delete event"
          >
            <TrashIcon size={17} />
          </button>
        </div>
      </div>

      {/* Title Card */}
      <div className="card-elevated">
        <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1">
          {format(parseLocalDate(event.event_date), 'EEEE, MMMM d, yyyy')}
        </p>
        <h2 className="text-xl font-bold tracking-tight text-text-primary mb-4">
          {event.client_name || 'Untitled Event'}
        </h2>

        {/* Status Toggle */}
        <div className="flex gap-2">
          {(['upcoming', 'completed', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => handleStatusChange(s)}
              disabled={saving}
              aria-pressed={event.status === s}
              aria-label={`Mark as ${s}`}
              className={`badge flex-1 py-2.5 !text-xs justify-center transition-opacity ${
                event.status === s ? '' : 'opacity-40'
              } ${s === 'upcoming' ? 'badge-upcoming' : s === 'completed' ? 'badge-completed' : 'badge-cancelled'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Couple Names */}
      {hasCouple && (
        <div className="card-elevated border-accent/20">
          <div className="flex items-center gap-2 mb-3">
            <HomeIcon size={15} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Couple
            </h3>
          </div>
          <div className="space-y-0">
            {event.bride_name && (
              <EventInfoRow icon={<HomeIcon size={15} />} label="Bride" value={event.bride_name} />
            )}
            {event.groom_name && (
              <EventInfoRow icon={<HomeIcon size={15} />} label="Groom" value={event.groom_name} />
            )}
            {event.bride_parents && (
              <EventInfoRow icon={<HomeIcon size={15} />} label="Bride's Parents" value={event.bride_parents} />
            )}
            {event.groom_parents && (
              <EventInfoRow icon={<HomeIcon size={15} />} label="Groom's Parents" value={event.groom_parents} />
            )}
            {event.introduction_name && (
              <EventInfoRow icon={<SparklesIcon size={15} />} label="Introduce As" value={event.introduction_name} />
            )}
          </div>
        </div>
      )}

      {/* Music Selections — shown near top because it's critical for DJs */}
      {showMusic && (
        <div className="card-elevated border-accent/20">
          <div className="flex items-center gap-2 mb-3">
            <HeadphonesIcon size={15} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Music Selections
            </h3>
          </div>

          {songs.length > 0 && (
            <div className="space-y-0 mb-4">
              {songs.map((entry, i) => (
                <div key={i} className="flex items-start justify-between py-2.5 border-b border-border-subtle last:border-0 gap-3">
                  <span className="text-sm text-text-tertiary shrink-0">{entry.label}</span>
                  <span className="text-sm font-medium text-text-primary text-right">{entry.song}</span>
                </div>
              ))}
            </div>
          )}

          {music && music.must_play?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">
                Additional Requests
              </p>
              <div className="flex flex-wrap gap-1.5">
                {music.must_play.map((song, i) => (
                  <span key={i} className="badge badge-upcoming !text-xs py-1">
                    ♪ {song}
                  </span>
                ))}
              </div>
            </div>
          )}

          {music && music.do_not_play?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">
                Do Not Play
              </p>
              <div className="flex flex-wrap gap-1.5">
                {music.do_not_play.map((song, i) => (
                  <span key={i} className="badge badge-cancelled !text-xs py-1">
                    ✕ {song}
                  </span>
                ))}
              </div>
            </div>
          )}

          {musicVariety.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">
                Music Variety
              </p>
              <div className="flex flex-wrap gap-1.5">
                {musicVariety.map((g, i) => (
                  <span key={i} className="badge badge-completed !text-xs py-1">{g}</span>
                ))}
              </div>
            </div>
          )}

          {music?.music_preferences && (
            <div>
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">
                Preferences
              </p>
              <p className="text-sm text-text-secondary">{music.music_preferences}</p>
            </div>
          )}
        </div>
      )}

      {/* Details */}
      <div className="card-elevated">
        <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
          Details
        </h3>
        <EventInfoRow icon={<CalendarIcon size={15} />} label="Type" value={event.event_type} />
        <EventInfoRow icon={<PhoneIcon size={15} />} label="Phone" value={event.client_phone} />
        <EventInfoRow icon={<MailIcon size={15} />} label="Email" value={event.client_email} />
        {event.partner_phone && (
          <EventInfoRow icon={<PhoneIcon size={15} />} label="Partner Phone" value={event.partner_phone} />
        )}
        {event.partner_email && (
          <EventInfoRow icon={<MailIcon size={15} />} label="Partner Email" value={event.partner_email} />
        )}
        {event.secondary_contact && (
          <EventInfoRow icon={<PhoneIcon size={15} />} label="Secondary Contact" value={event.secondary_contact} />
        )}
        {event.guest_count != null && (
          <EventInfoRow icon={<HomeIcon size={15} />} label="Guest Count" value={String(event.guest_count)} />
        )}
      </div>

      {/* Assignment */}
      {hasAssignment && (
        <div className="card-elevated">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
            Assignment
          </h3>
          {event.assigned_dj && <EventInfoRow icon={<HeadphonesIcon size={15} />} label="Assigned DJ" value={event.assigned_dj} />}
          {event.second_assigned && <EventInfoRow icon={<HeadphonesIcon size={15} />} label="2nd Assigned" value={event.second_assigned} />}
          {event.system_number && <EventInfoRow icon={<SparklesIcon size={15} />} label="System #" value={event.system_number} />}
          {event.dj_attire && <EventInfoRow icon={<SparklesIcon size={15} />} label="DJ Attire" value={event.dj_attire} />}
        </div>
      )}

      {/* Schedule */}
      <div className="card-elevated">
        <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
          Schedule
        </h3>
        {(event.ceremony_start_time || event.ceremony_end_time) && (
          <EventInfoRow
            icon={<ClockIcon size={15} />}
            label="Ceremony"
            value={[event.ceremony_start_time, event.ceremony_end_time].filter(Boolean).join(' – ') || null}
          />
        )}
        <EventInfoRow
          icon={<ClockIcon size={15} />}
          label="Reception"
          value={[event.start_time, event.end_time].filter(Boolean).join(' – ') || null}
        />
        {event.setup_time && <EventInfoRow icon={<ClockIcon size={15} />} label="Setup" value={event.setup_time} />}
        {event.guest_arrival_time && <EventInfoRow icon={<ClockIcon size={15} />} label="Guest Arrival" value={event.guest_arrival_time} />}
        {event.load_in_time && <EventInfoRow icon={<ClockIcon size={15} />} label="Load-in" value={event.load_in_time} />}
        {event.pickup_time && <EventInfoRow icon={<ClockIcon size={15} />} label="Pickup" value={event.pickup_time} />}
        {event.booked_hours != null && <EventInfoRow icon={<ClockIcon size={15} />} label="Booked Hours" value={String(event.booked_hours)} />}
      </div>

      {/* Venue */}
      {(event.venue_name || event.venue_address || hasVenueExtra) && (
        <div className="card-elevated">
          <div className="flex items-center gap-2 mb-2">
            <MapPinIcon size={14} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Venue
            </h3>
          </div>
          <EventInfoRow icon={<MapPinIcon size={15} />} label="Name" value={event.venue_name} />
          <EventInfoRow icon={<MapPinIcon size={15} />} label="Address" value={event.venue_address} />
          {event.venue_phone && (
            <EventInfoRow icon={<PhoneIcon size={15} />} label="Venue Phone" value={event.venue_phone} />
          )}
          {event.venue_contact && (
            <EventInfoRow icon={<PhoneIcon size={15} />} label="Venue Contact" value={event.venue_contact} />
          )}
          {event.ceremony_separate_location != null && (
            <EventInfoRow
              icon={<MapPinIcon size={15} />}
              label="Ceremony Location"
              value={event.ceremony_separate_location ? 'Separate from reception' : 'Same as reception'}
            />
          )}
          {event.venue_notes && (
            <div className="mt-3 p-3 rounded-xl bg-surface-2 border border-border-subtle">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">
                Venue Notes
              </p>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                {event.venue_notes}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Wedding Party */}
      {hasWeddingParty && (
        <div className="card-elevated">
          <div className="flex items-center gap-2 mb-2">
            <HomeIcon size={14} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Wedding Party
            </h3>
          </div>
          {event.maid_of_honor && <EventInfoRow icon={<HomeIcon size={15} />} label="Maid/Matron of Honor" value={event.maid_of_honor} />}
          {event.best_man && <EventInfoRow icon={<HomeIcon size={15} />} label="Best Man" value={event.best_man} />}
          {event.flower_girl && <EventInfoRow icon={<HomeIcon size={15} />} label="Flower Girl" value={event.flower_girl} />}
          {event.ring_bearer && <EventInfoRow icon={<HomeIcon size={15} />} label="Ring Bearer" value={event.ring_bearer} />}
          {bridesmaids.length > 0 && (
            <div className="pt-3">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">Bridesmaids</p>
              <div className="flex flex-wrap gap-1.5">
                {bridesmaids.map((n, i) => (
                  <span key={i} className="badge badge-upcoming !text-xs py-1">{n}</span>
                ))}
              </div>
            </div>
          )}
          {groomsmen.length > 0 && (
            <div className="pt-3">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">Groomsmen</p>
              <div className="flex flex-wrap gap-1.5">
                {groomsmen.map((n, i) => (
                  <span key={i} className="badge badge-upcoming !text-xs py-1">{n}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reception Flow */}
      {hasReception && (
        <div className="card-elevated">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardCheckIcon size={14} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Reception Flow
            </h3>
          </div>
          {event.dinner_service && (
            <EventInfoRow icon={<ClipboardCheckIcon size={15} />} label="Dinner Service" value={event.dinner_service === 'seated' ? 'Seated Dinner' : event.dinner_service === 'buffet' ? 'Buffet' : event.dinner_service} />
          )}
          {event.blessing_by && <EventInfoRow icon={<SparklesIcon size={15} />} label="Blessing By" value={event.blessing_by} />}
          {event.toasts_by && <EventInfoRow icon={<SparklesIcon size={15} />} label="Toasts By" value={event.toasts_by} />}
          {event.take_requests != null && <EventInfoRow icon={<HeadphonesIcon size={15} />} label="Take Requests" value={triLabel(event.take_requests)} />}
          {(event.introduce_couple != null || event.introduce_wedding_party != null) && (
            <EventInfoRow icon={<SparklesIcon size={15} />} label="DJ Introduces" value={introduces.length ? introduces.join(' & ') : 'None'} />
          )}
          {activities.length > 0 && (
            <div className="pt-3">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">Activities</p>
              <div className="flex flex-wrap gap-1.5">
                {activities.map((a, i) => (
                  <span key={i} className="badge badge-upcoming !text-xs py-1">{a}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timeline / Run of Show */}
      {timeline.length > 0 && (
        <div className="card-elevated">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheckIcon size={14} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Timeline / Run of Show
            </h3>
          </div>
          <div>
            {timeline.map((entry, i) => (
              <div key={i} className="flex gap-3 py-2.5 border-b border-border-subtle last:border-0">
                <span className="text-sm font-mono font-semibold text-accent shrink-0 w-14">
                  {entry.time}
                </span>
                <span className="text-sm text-text-secondary">{entry.activity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Special Instructions */}
      {event.special_instructions && (
        <div className="card-elevated">
          <div className="flex items-center gap-2 mb-3">
            <SparklesIcon size={14} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Special Instructions
            </h3>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
            {event.special_instructions}
          </p>
        </div>
      )}

      {/* Notes */}
      {event.notes && (
        <div className="card-elevated">
          <div className="flex items-center gap-2 mb-3">
            <FileTextIcon size={14} className="text-text-quaternary" />
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Notes
            </h3>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
            {event.notes}
          </p>
        </div>
      )}

      {/* Pay */}
      <PayBreakdown event={event} />

      {/* Paperwork — stored as base64 directly in the event record */}
      {images.length > 0 && (
        <div className="card-elevated">
          <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
            Paperwork {images.length > 1 && `· ${images.length} pages`}
          </h3>
          <div className={images.length === 1 ? '' : 'grid grid-cols-2 gap-2.5'}>
            {images.map((img, i) => {
              const url = toDataUrl(img);
              return (
                <div key={i} className="rounded-xl overflow-hidden border border-border-subtle">
                  <img
                    src={url}
                    alt={`Paperwork page ${i + 1}`}
                    className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(url, '_blank')}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* AI Summary */}
      {event.raw_ai_summary && (
        <div className="card-elevated">
          <div className="flex items-center gap-2 mb-3">
            <SparklesIcon size={14} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              AI Summary
            </h3>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">
            {event.raw_ai_summary}
          </p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-dialog-title"
            className="card-elevated max-w-sm mx-5 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-dialog-title" className="text-lg font-bold text-text-primary">Delete Event?</h3>
            <p className="text-sm text-text-secondary">This action cannot be undone. The event and all its data will be permanently removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={confirmDelete} className="btn-primary flex-1 bg-danger hover:bg-danger/90">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
