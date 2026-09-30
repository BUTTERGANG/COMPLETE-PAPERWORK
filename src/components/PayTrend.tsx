import { format, addMonths, startOfMonth } from 'date-fns';
import { useEvents } from '../hooks/useEvents';
import { parseLocalDate } from '../lib/dateUtils';

/**
 * 6-month pay trend: completed events' actual pay (solid) vs upcoming
 * events' projected pay (hatched/outline). Pure CSS bars — no chart lib.
 */
export default function PayTrend() {
  const { events } = useEvents();

  const months = (() => {
    const rows = [] as { key: string; label: string; actual: number; projected: number }[];
    // 3 months back + current + 2 ahead
    for (let i = -3; i <= 2; i += 1) {
      const start = startOfMonth(addMonths(new Date(), i));
      rows.push({ key: format(start, 'yyyy-MM'), label: format(start, 'MMM'), actual: 0, projected: 0 });
    }
    const byKey = new Map(rows.map((r) => [r.key, r]));
    for (const e of events) {
      const row = byKey.get(format(parseLocalDate(e.event_date), 'yyyy-MM'));
      if (!row) continue;
      if (e.status === 'completed') row.actual += e.total_pay;
      else if (e.status === 'upcoming') row.projected += e.total_pay;
    }
    return rows;
  })();

  const max = Math.max(...months.map((m) => m.actual + m.projected), 1);

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-secondary/60 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider">
          Pay trend
        </h3>
        <span className="flex items-center gap-3 text-xs text-text-tertiary">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-accent inline-block" /> earned
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm border border-accent/60 inline-block" /> projected
          </span>
        </span>
      </div>
      <div className="flex items-end gap-2 h-28">
        {months.map((m) => {
          const actualH = (m.actual / max) * 100;
          const projH = (m.projected / max) * 100;
          return (
            <div key={m.key} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <div className="w-full flex-1 flex flex-col justify-end gap-0.5">
                {projH > 0 && (
                  <div
                    className="w-full rounded-t-md border border-accent/50 bg-accent/10"
                    style={{ height: `${projH}%` }}
                    title={`Projected: $${m.projected.toFixed(0)}`}
                  />
                )}
                {actualH > 0 && (
                  <div
                    className={`w-full rounded-md bg-accent ${projH > 0 ? 'rounded-b-md' : 'rounded-t-md'}`}
                    style={{ height: `${actualH}%` }}
                    title={`Earned: $${m.actual.toFixed(0)}`}
                  />
                )}
              </div>
              <span className="text-[11px] text-text-tertiary font-medium">{m.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}