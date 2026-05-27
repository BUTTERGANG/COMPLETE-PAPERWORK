import { useForm } from 'react-hook-form';
import type { EventFormData } from '../types/event';
import { DEFAULT_MILEAGE_RATE, COMPLIANCE_BONUS_AMOUNT } from '../lib/constants';
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
  venue_name: '',
  venue_address: '',
  client_name: '',
  client_phone: '',
  client_email: '',
  start_time: '',
  end_time: '',
  base_pay: 0,
  compliance_bonus: 0,
  mileage_miles: 0,
  mileage_rate: DEFAULT_MILEAGE_RATE,
  notes: '',
  raw_ai_summary: null,
  paperwork_image_data: null,
  status: 'upcoming',
};

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
    {error && (
      <p className="mt-1.5 text-xs font-medium text-danger">{error}</p>
    )}
  </div>
);

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

  const processSubmit = (data: EventFormData) => {
    const cleaned: EventFormData = {
      ...data,
      base_pay: Number.isNaN(data.base_pay) ? 0 : data.base_pay,
      compliance_bonus: Number.isNaN(data.compliance_bonus) ? 0 : data.compliance_bonus,
      mileage_miles: Number.isNaN(data.mileage_miles) ? 0 : data.mileage_miles,
      mileage_rate: Number.isNaN(data.mileage_rate) ? 0 : data.mileage_rate,
    };
    onSubmit(cleaned);
  };

  return (
    <form onSubmit={handleSubmit(processSubmit)} className="space-y-4 animate-fade-in">
      <div className="card-elevated space-y-4">
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

        <Field label="Client Name" id="client_name" error={errors.client_name?.message}>
          <input id="client_name" {...register('client_name', { required: 'Name is required' })} placeholder="John & Jane" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Phone" id="client_phone">
            <input id="client_phone" {...register('client_phone')} placeholder="(555) 123-4567" />
          </Field>
          <Field label="Email" id="client_email">
            <input id="client_email" {...register('client_email')} type="email" placeholder="client@email.com" />
          </Field>
        </div>

        <Field label="Venue Name" id="venue_name">
          <input id="venue_name" {...register('venue_name')} placeholder="Grand Ballroom" />
        </Field>

        <Field label="Venue Address" id="venue_address">
          <input id="venue_address" {...register('venue_address')} placeholder="123 Main St, City" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start Time" id="start_time" error={errors.start_time?.message}>
            <input id="start_time" type="time" {...register('start_time', { required: 'Start time is required' })} />
          </Field>
          <Field label="End Time" id="end_time" error={errors.end_time?.message}>
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
      </div>

      <div className="card-elevated space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Base Pay ($)" id="base_pay" error={errors.base_pay?.message}>
            <input
              id="base_pay"
              type="number"
              step="0.01"
              min="0"
              {...register('base_pay', {
                valueAsNumber: true,
                min: { value: 0, message: 'Base pay must be 0 or greater' },
              })}
              placeholder="0.00"
            />
          </Field>
          <Field label="Mileage (mi)" id="mileage_miles" error={errors.mileage_miles?.message}>
            <input
              id="mileage_miles"
              type="number"
              step="0.1"
              min="0"
              {...register('mileage_miles', {
                valueAsNumber: true,
                min: { value: 0, message: 'Mileage must be 0 or greater' },
              })}
              placeholder="0"
            />
          </Field>
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

      <div className="card-elevated space-y-4">
        <Field label="Status" id="status">
          <select id="status" {...register('status')}>
            <option value="upcoming">Upcoming</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>

        <Field label="Notes" id="notes">
          <textarea
            id="notes"
            {...register('notes')}
            rows={3}
            placeholder="Any additional notes..."
            className="resize-none"
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full"
      >
        {loading ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          submitLabel
        )}
      </button>
    </form>
  );
}
