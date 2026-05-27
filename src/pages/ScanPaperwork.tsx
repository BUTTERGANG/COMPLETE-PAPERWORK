import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEvents } from '../hooks/useEvents';
import PaperworkScanner from '../components/PaperworkScanner';
import EventForm from '../components/EventForm';
import { applyParsedData } from '../lib/eventMapper';
import type { ParsedEvent, EventFormData } from '../types/event';
import { SparklesIcon, ChevronLeftIcon, AlertCircleIcon } from '../components/icons/Icons';

export default function ScanPaperwork() {
  const navigate = useNavigate();
  const { addEvent } = useEvents();
  const [parsed, setParsed] = useState<ParsedEvent | null>(null);
  const [imageData, setImageData] = useState<string[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParsed = (data: ParsedEvent, base64Images: string[], previewUrls: string[]) => {
    setParsed(data);
    setImageData(base64Images);
    setPreviews(previewUrls);
  };

  const handleSave = async (form: EventFormData) => {
    setSaving(true);
    setError(null);
    try {
      const event = await addEvent(form, imageData);
      if (event) navigate(`/events/${event.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const formData = parsed ? applyParsedData(parsed) : undefined;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {!parsed && (
            <button onClick={() => navigate(-1)} className="btn-ghost !p-2 -ml-2" aria-label="Go back">
              <ChevronLeftIcon size={20} />
            </button>
          )}
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">Scan Paperwork</h2>
        </div>
        {parsed && (
          <button
            onClick={() => {
              setParsed(null);
              setImageData([]);
              setPreviews([]);
            }}
            className="text-sm font-medium text-text-tertiary hover:text-text-secondary"
          >
            Start Over
          </button>
        )}
      </div>

      {!parsed ? (
        <PaperworkScanner onParsed={handleParsed} />
      ) : (
        <div className="space-y-4 animate-slide-up">
          {previews.length > 0 && (
            <div className="card-elevated p-2.5">
              <div className="grid grid-cols-4 gap-2">
                {previews.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`Paperwork page ${i + 1}`}
                    className="w-full aspect-square object-cover rounded-lg border border-border-subtle"
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-accent/8 border border-accent/20">
            <SparklesIcon size={15} className="text-accent shrink-0" />
            <p className="text-sm text-text-secondary">
              AI extracted the details below. Review and edit before saving.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-danger/10 border border-danger/20">
              <AlertCircleIcon size={16} className="text-danger shrink-0" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <EventForm
            defaultValues={formData}
            onSubmit={handleSave}
            submitLabel="Save Event"
            loading={saving}
          />
        </div>
      )}
    </div>
  );
}
