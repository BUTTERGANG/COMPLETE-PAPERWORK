import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useEvents } from '../hooks/useEvents';
import type { Event } from '../types/event';
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

/** Extract lines from a labeled section in notes (e.g. "Timeline:\n...") */
function extractSection(notes: string | null, header: string): string[] {
  if (!notes) return [];
  const idx = notes.indexOf(header);
  if (idx === -1) return [];
  const afterHeader = notes.slice(idx + header.length).trim();
  const nextSection = afterHeader.search(/\n[A-Z][\w\s]+:/);
  const raw = nextSection === -1 ? afterHeader : afterHeader.slice(0, nextSection);
  return raw.split('\n').map((l) => l.trim()).filter(Boolean);
}

/** Extract plain text from a labeled section */
function extractSectionText(notes: string | null, header: string): string {
  if (!notes) return '';
  const lines = extractSection(notes, header);
  return lines.join('\n');
}

/** Get the "base" notes before any labeled section */
function getBaseNotes(notes: string | null): string {
  if (!notes) return '';
  const firstSection = notes.search(/\n[A-Z][\w\s]+:/);
  if (firstSection === -1) return notes.trim();
  const base = notes.slice(0, firstSection).trim();
  return base.split('\n').filter((l) =>
    !l.startsWith('Load-in:') &&
    !l.startsWith('Secondary contact:') &&
    !l.startsWith('Guest count:') &&
    !l.startsWith('Pay type:')
  ).join('\n');
}

/** Parse the Couple section */
function parseCoupleSection(notes: string | null): { bride: string; groom: string } | null {
  if (!notes?.includes('Couple:')) return null;
  const lines = extractSection(notes, 'Couple:');
  let bride = '';
  let groom = '';
  for (const line of lines) {
    if (line.startsWith('Bride:')) bride = line.replace('Bride:', '').trim();
    if (line.startsWith('Groom:')) groom = line.replace('Groom:', '').trim();
  }
  return bride || groom ? { bride, groom } : null;
}

/** Parse the Venue Info section */
function parseVenueSection(notes: string | null): { phone: string; contact: string; notes: string } | null {
  if (!notes?.includes('Venue Info:')) return null;
  const lines = extractSection(notes, 'Venue Info:');
  let phone = '';
  let contact = '';
  let venueNotes = '';
  for (const line of lines) {
    if (line.startsWith('Venue phone:')) phone = line.replace('Venue phone:', '').trim();
    if (line.startsWith('Venue contact:')) contact = line.replace('Venue contact:', '').trim();
    if (line.startsWith('Venue notes:')) venueNotes = line.replace('Venue notes:', '').trim();
  }
  return phone || contact || venueNotes ? { phone, contact, notes: venueNotes } : null;
}

/** Parse the Music Selections section into structured sub-sections for rich display */
function parseMusicSection(notes: string | null): {
  songs: { label: string; song: string }[];
  mustPlay: string[];
  doNotPlay: string[];
  preferences: string;
} | null {
  if (!notes?.includes('Music Selections:')) return null;

  const lines = extractSection(notes, 'Music Selections:');
  if (lines.length === 0) return null;

  const songs: { label: string; song: string }[] = [];
  const mustPlay: string[] = [];
  const doNotPlay: string[] = [];
  let preferences = '';

  let currentList: 'must' | 'must_not' | null = null;

  for (const line of lines) {
    if (line.startsWith('Music Preferences:')) {
      preferences = line.replace('Music Preferences:', '').trim();
      currentList = null;
      continue;
    }
    if (line === 'Must Play:') {
      currentList = 'must';
      continue;
    }
    if (line === 'Do Not Play:') {
      currentList = 'must_not';
      continue;
    }
    if (currentList === 'must') {
      const cleaned = line.replace(/^[•\-\s]+/, '');
      if (cleaned) mustPlay.push(cleaned);
      continue;
    }
    if (currentList === 'must_not') {
      const cleaned = line.replace(/^[✕\-\s]+/, '');
      if (cleaned) doNotPlay.push(cleaned);
      continue;
    }

    // Label: Value pattern (e.g. "First Dance: Thinking Out Loud – Ed Sheeran")
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const label = line.slice(0, colonIdx).trim();
      const song = line.slice(colonIdx + 1).trim();
      if (song) songs.push({ label, song });
    }
  }

  return { songs, mustPlay, doNotPlay, preferences };
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

  const notes = event.notes || '';
  const hasCouple = notes.includes('Couple:');
  const hasVenueInfo = notes.includes('Venue Info:');
  const hasTimeline = notes.includes('Timeline:');
  const hasMusic = notes.includes('Music Selections:');
  const hasSpecialInstructions = notes.includes('Special instructions:');
  const hasLabeledNotes = notes.includes('Notes:');
  const baseNotes = getBaseNotes(notes);
  const coupleData = parseCoupleSection(notes);
  const venueData = parseVenueSection(notes);
  const musicData = parseMusicSection(notes);

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
      {hasCouple && coupleData && (
        <div className="card-elevated border-accent/20">
          <div className="flex items-center gap-2 mb-3">
            <HomeIcon size={15} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Couple
            </h3>
          </div>
          <div className="space-y-0">
            {coupleData.bride && (
              <div className="flex items-center justify-between py-2.5 border-b border-border-subtle">
                <span className="text-sm text-text-tertiary">Bride</span>
                <span className="text-sm font-semibold text-text-primary">{coupleData.bride}</span>
              </div>
            )}
            {coupleData.groom && (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-text-tertiary">Groom</span>
                <span className="text-sm font-semibold text-text-primary">{coupleData.groom}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Music Selections — shown near top because it's critical for DJs */}
      {hasMusic && musicData && (
        <div className="card-elevated border-accent/20">
          <div className="flex items-center gap-2 mb-3">
            <HeadphonesIcon size={15} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Music Selections
            </h3>
          </div>

          {/* Key moment songs */}
          {musicData.songs.length > 0 && (
            <div className="space-y-0 mb-4">
              {musicData.songs.map((entry, i) => (
                <div key={i} className="flex items-start justify-between py-2.5 border-b border-border-subtle last:border-0 gap-3">
                  <span className="text-sm text-text-tertiary shrink-0">{entry.label}</span>
                  <span className="text-sm font-medium text-text-primary text-right">{entry.song}</span>
                </div>
              ))}
            </div>
          )}

          {/* Must Play */}
          {musicData.mustPlay.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">
                Must Play
              </p>
              <div className="flex flex-wrap gap-1.5">
                {musicData.mustPlay.map((song, i) => (
                  <span key={i} className="badge badge-upcoming !text-xs py-1">
                    ♪ {song}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Do Not Play */}
          {musicData.doNotPlay.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">
                Do Not Play
              </p>
              <div className="flex flex-wrap gap-1.5">
                {musicData.doNotPlay.map((song, i) => (
                  <span key={i} className="badge badge-cancelled !text-xs py-1">
                    ✕ {song}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Music Preferences */}
          {musicData.preferences && (
            <div>
              <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-1.5">
                Preferences
              </p>
              <p className="text-sm text-text-secondary">{musicData.preferences}</p>
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
        <EventInfoRow icon={<MapPinIcon size={15} />} label="Venue" value={event.venue_name} />
        <EventInfoRow icon={<MapPinIcon size={15} />} label="Address" value={event.venue_address} />
        <EventInfoRow icon={<ClockIcon size={15} />} label="Start" value={event.start_time} />
        <EventInfoRow icon={<ClockIcon size={15} />} label="End" value={event.end_time} />
        {baseNotes && <EventInfoRow icon={<FileTextIcon size={15} />} label="Notes" value={baseNotes} />}
      </div>

      {/* Venue Info */}
      {hasVenueInfo && venueData && (
        <div className="card-elevated">
          <div className="flex items-center gap-2 mb-3">
            <MapPinIcon size={14} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Venue Info
            </h3>
          </div>
          <div className="space-y-0">
            {venueData.phone && (
              <div className="flex items-center justify-between py-2.5 border-b border-border-subtle">
                <span className="text-sm text-text-tertiary">Venue Phone</span>
                <span className="text-sm font-medium text-text-primary">{venueData.phone}</span>
              </div>
            )}
            {venueData.contact && (
              <div className="flex items-center justify-between py-2.5 border-b border-border-subtle">
                <span className="text-sm text-text-tertiary">Venue Contact</span>
                <span className="text-sm font-medium text-text-primary">{venueData.contact}</span>
              </div>
            )}
            {venueData.notes && (
              <div className="pt-2.5">
                <span className="text-sm text-text-tertiary block mb-1">Venue Notes</span>
                <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{venueData.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline / Run of Show */}
      {hasTimeline && (
        <div className="card-elevated">
          <div className="flex items-center gap-2 mb-3">
            <ClipboardCheckIcon size={14} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Timeline / Run of Show
            </h3>
          </div>
          <div>
            {extractSection(notes, 'Timeline:').map((entry, i) => {
              const dashIdx = entry.indexOf('–');
              const time = dashIdx >= 0 ? entry.slice(0, dashIdx).trim() : entry.trim();
              const activity = dashIdx >= 0 ? entry.slice(dashIdx + 1).trim() : '';
              return (
                <div key={i} className="flex gap-3 py-2.5 border-b border-border-subtle last:border-0">
                  <span className="text-sm font-mono font-semibold text-accent shrink-0 w-14">
                    {time}
                  </span>
                  <span className="text-sm text-text-secondary">{activity}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Special Instructions */}
      {hasSpecialInstructions && (
        <div className="card-elevated">
          <div className="flex items-center gap-2 mb-3">
            <SparklesIcon size={14} className="text-accent" />
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Special Instructions
            </h3>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
            {extractSectionText(notes, 'Special instructions:')}
          </p>
        </div>
      )}

      {/* Standalone Notes (only shown when no structured sections exist) */}
      {!hasTimeline && !hasMusic && !hasSpecialInstructions && !hasLabeledNotes && notes && (
        <div className="card-elevated">
          <div className="flex items-center gap-2 mb-3">
            <FileTextIcon size={14} className="text-text-quaternary" />
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
              Notes
            </h3>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
            {notes}
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
