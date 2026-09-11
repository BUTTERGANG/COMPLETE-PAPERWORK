import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';
import EventForm from '../components/EventForm';
import type { EventFormData } from '../types/event';
import { ChevronLeftIcon, AlertCircleIcon } from '../components/icons/Icons';
import { Spinner } from '../components/Spinner';

export default function EditEvent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { findEvent, useEvent, updateEvent } = useEvents();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cachedEvent = id ? findEvent(id) : null;
  const { data: fetchedEvent, isLoading } = useEvent(cachedEvent ? undefined : id);
  const event = cachedEvent ?? fetchedEvent ?? null;

  const handleSave = async (form: EventFormData) => {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await updateEvent(id, form);
      navigate(`/events/${id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading && !event) {
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

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost !p-2 -ml-2">
          <ChevronLeftIcon size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">Edit Event</h2>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-danger/10 border border-danger/20">
          <AlertCircleIcon size={16} className="text-danger shrink-0" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <EventForm
        defaultValues={event}
        onSubmit={handleSave}
        submitLabel="Save Changes"
        loading={saving}
      />
    </div>
  );
}
