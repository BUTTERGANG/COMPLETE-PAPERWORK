import { useMemo } from 'react';
import { format } from 'date-fns';
import type { Event } from '../types/event';
import { useEvents } from '../hooks/useEvents';
import { parseLocalDate } from '../lib/dateUtils';

/**
 * Past-due events: dates have passed but status is still 'upcoming'.
 * The portal sync / manual entry can leave these behind; surface them
 * prominently with a one-tap completion action.
 */
export default function PastDueEvents() {
  const { events, updateEvent } = useEvents();

  const pastDue = useMemo(
    () =>
      events
        .filter(
          (e) =>
            e.status === 'upcoming' &&
            parseLocalDate(e.event_date) < new Date(new Date().toDateString())
        )
        .sort(
          (a, b) =>
            parseLocalDate(a.event_date).getTime() - parseLocalDate(b.event_date).getTime()
        ),
    [events]
  );

  if (pastDue.length === 0) return null;

  return (
    <div className="rounded-2xl border border-warn/30 bg-warn/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-warn uppercase tracking-wider">
          Needs attention
        </h3>
        <span className="text-xs text-text-tertiary">
          {pastDue.length} past event{pastDue.length > 1 ? 's' : ''} still marked upcoming
        </span>
      </div>
      <div className="space-y-2">
        {pastDue.map((e: Event) => (
          <div
            key={e.id}
            className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl bg-surface-1/80 border border-border-subtle"
          >
            <button
              onClick={() => window.location.assign(`/events/${e.id}`)}
              className="min-w-0 text-left"
            >
              <p className="text-sm font-semibold text-text-primary truncate">
                {e.client_name || 'Untitled Event'}
              </p>
              <p className="text-xs text-text-tertiary">
                {format(parseLocalDate(e.event_date), 'MMM d, yyyy')}
                {e.venue_name ? ` · ${e.venue_name}` : ''}
              </p>
            </button>
            <button
              onClick={() => updateEvent(e.id, { status: 'completed' })}
              className="shrink-0 px-3 py-1.5 rounded-lg bg-success/15 text-success text-xs font-semibold hover:bg-success/25 transition-colors"
            >
              Mark completed
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}