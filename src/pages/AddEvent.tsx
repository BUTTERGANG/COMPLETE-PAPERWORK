import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';
import EventForm from '../components/EventForm';
import type { EventFormData } from '../types/event';
import { ChevronLeftIcon, AlertCircleIcon } from '../components/icons/Icons';

export default function AddEvent() {
  const navigate = useNavigate();
  const { addEvent } = useEvents();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async (form: EventFormData) => {
    setSaving(true);
    setError(null);
    try {
      const event = await addEvent(form);
      if (event) navigate(`/events/${event.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost !p-2 -ml-2">
          <ChevronLeftIcon size={20} />
        </button>
        <h2 className="text-2xl font-bold tracking-tight text-text-primary">Add Event</h2>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-danger/10 border border-danger/20">
          <AlertCircleIcon size={16} className="text-danger shrink-0" />
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      <EventForm
        onSubmit={handleSave}
        submitLabel="Create Event"
        loading={saving}
      />
    </div>
  );
}
