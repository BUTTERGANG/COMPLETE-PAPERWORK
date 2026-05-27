import React from 'react';
import { format } from 'date-fns';
import type { Event } from '../types/event';
import { formatCurrency } from '../lib/payCalc';
import { parseLocalDate } from '../lib/dateUtils';
import { MapPinIcon, ClockIcon } from './icons/Icons';

interface EventCardProps {
  event: Event;
  onClick: () => void;
}

function EventCard({ event, onClick }: EventCardProps) {
  const statusClass = {
    upcoming: 'badge-upcoming',
    completed: 'badge-completed',
    cancelled: 'badge-cancelled',
  }[event.status];

  return (
    <button onClick={onClick} className="card-elevated card-interactive w-full text-left animate-fade-in">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-0.5">
            {format(parseLocalDate(event.event_date), 'EEEE')}
          </p>
          <p className="text-xl font-bold text-text-primary tracking-tight">
            {format(parseLocalDate(event.event_date), 'MMM d')}
          </p>
        </div>
        <span className={`badge ${statusClass}`} role="img" aria-label={`Status: ${event.status}`} />
      </div>

      <p className="text-base font-semibold text-text-primary mb-1 truncate">
        {event.client_name || 'Untitled Event'}
      </p>

      <div className="flex items-center gap-3 text-text-tertiary text-sm mb-4">
        {event.venue_name && (
          <span className="flex items-center gap-1 truncate">
            <MapPinIcon size={13} className="shrink-0" />
            {event.venue_name}
          </span>
        )}
        {event.start_time && (
          <span className="flex items-center gap-1 shrink-0">
            <ClockIcon size={13} />
            {event.start_time}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
        <span className="text-xs font-medium text-text-quaternary uppercase tracking-wider">
          {event.event_type || 'Event'}
        </span>
        <span className="text-base font-bold text-accent">{formatCurrency(event.total_pay)}</span>
      </div>
    </button>
  );
}

export default React.memo(EventCard);
