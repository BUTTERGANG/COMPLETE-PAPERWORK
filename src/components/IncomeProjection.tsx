import { useMemo, useState } from 'react';
import { format, addMonths, startOfMonth } from 'date-fns';
import { useEvents } from '../hooks/useEvents';
import { formatCurrency } from '../lib/payCalc';
import { parseLocalDate } from '../lib/dateUtils';
import { Spinner } from './Spinner';
import { EmptyState } from './EmptyState';
import { CalendarIcon, DollarIcon, PlusIcon } from './icons/Icons';
import { useNavigate } from 'react-router-dom';

// Monthly debt-carry is personal, not event data — persisted locally.
const DEBT_CARRY_KEY = 'cp:monthly-debt-carry';

const MONTHS_AHEAD = 3;

export default function IncomeProjection() {
  const { events, loading, error } = useEvents();
  const navigate = useNavigate();
  const [debtCarry, setDebtCarry] = useState<number>(() => {
    const raw = localStorage.getItem(DEBT_CARRY_KEY);
    const n = raw == null ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  });

  const months = useMemo(() => {
    const rows: {
      key: string;
      label: string;
      estimated: number;
      actual: number;
      upcomingCount: number;
    }[] = [];

    for (let i = 0; i < MONTHS_AHEAD; i += 1) {
      const start = i === 0 ? startOfMonth(new Date()) : startOfMonth(addMonths(new Date(), i));
      rows.push({
        key: format(start, 'yyyy-MM'),
        label: i === 0 ? `${format(start, 'MMMM')} (this month)` : format(start, 'MMMM yyyy'),
        estimated: 0,
        actual: 0,
        upcomingCount: 0,
      });
    }
    const byKey = new Map(rows.map((r) => [r.key, r]));

    for (const e of events) {
      const d = parseLocalDate(e.event_date);
      const key = format(d, 'yyyy-MM');
      const row = byKey.get(key);
      if (!row) continue;
      if (e.status === 'upcoming') {
        row.estimated += e.total_pay;
        row.upcomingCount += 1;
      } else if (e.status === 'completed') {
        row.actual += e.total_pay;
      }
    }
    return rows;
  }, [events]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="md" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-danger">Failed to load income projection: {error}</p>
    );
  }

  const totalProjected = months.reduce((s, m) => s + m.estimated, 0);
  const totalNet = totalProjected - debtCarry * MONTHS_AHEAD;
  const hasAny = months.some((m) => m.estimated > 0 || m.actual > 0);

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface-secondary/60 p-4">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider">
          Income Projection
        </h3>
        <span className="text-xs text-text-tertiary">
          next {MONTHS_AHEAD} months, from upcoming events
        </span>
      </div>

      {!hasAny ? (
        <EmptyState
          icon={<CalendarIcon size={24} className="text-accent" />}
          title="No future events yet"
          description="Add an upcoming gig to see projected income by month"
          action={{ label: 'Add Event', onClick: () => navigate('/scan') }}
        />
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {months.map((m) => {
              const gross = m.estimated + m.actual;
              const net = gross - debtCarry;
              return (
                <div
                  key={m.key}
                  className="flex items-center justify-between gap-3 py-2 px-3 rounded-xl bg-surface-1/80 border border-border-subtle"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text-primary truncate">{m.label}</p>
                    <p className="text-xs text-text-tertiary">
                      {m.upcomingCount > 0
                        ? `${m.upcomingCount} upcoming event${m.upcomingCount > 1 ? 's' : ''}`
                        : 'no upcoming events'}
                      {m.actual > 0 && ` · ${formatCurrency(m.actual)} completed`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-text-primary tabular-nums">
                      {formatCurrency(gross)}
                    </p>
                    <p
                      className={`text-xs tabular-nums ${
                        net >= 0 ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {debtCarry > 0
                        ? `${net >= 0 ? '+' : ''}${formatCurrency(net)} after debt`
                        : `${m.upcomingCount > 0 ? 'projected' : 'booked'}`}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {debtCarry > 0 && (
            <div className="mt-3 pt-3 border-t border-border-subtle flex items-center justify-between">
              <p className="text-xs text-text-tertiary font-medium uppercase">
                {MONTHS_AHEAD}-month net after debt carry
              </p>
              <p
                className={`text-sm font-bold tabular-nums ${
                  totalNet >= 0 ? 'text-success' : 'text-danger'
                }`}
              >
                {totalNet >= 0 ? '+' : ''}
                {formatCurrency(totalNet)}
              </p>
            </div>
          )}
        </>
      )}

      {/* Debt carry input — personal figure, kept in localStorage */}
      <div className="mt-3 pt-3 border-t border-border-subtle">
        <label
          htmlFor="debt-carry"
          className="flex items-center gap-1.5 text-xs font-semibold text-text-tertiary uppercase tracking-wider"
        >
          <DollarIcon size={13} className="text-accent" />
          Monthly debt carry
        </label>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-text-secondary">$</span>
          <input
            id="debt-carry"
            type="number"
            min={0}
            step={50}
            inputMode="numeric"
            value={debtCarry > 0 ? debtCarry : ''}
            placeholder="0"
            onChange={(ev) => {
              const n = Number(ev.target.value);
              const v = Number.isFinite(n) && n > 0 ? n : 0;
              setDebtCarry(v);
              if (v > 0) localStorage.setItem(DEBT_CARRY_KEY, String(v));
              else localStorage.removeItem(DEBT_CARRY_KEY);
            }}
            className="w-28 px-2.5 py-1.5 rounded-lg bg-surface-1 border border-border-subtle text-sm text-text-primary tabular-nums focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <span className="text-xs text-text-tertiary">
            subtracted monthly from projected income
          </span>
        </div>
      </div>

      <button
        onClick={() => navigate('/add')}
        className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
      >
        <PlusIcon size={13} />
        Add a future event
      </button>
    </div>
  );
}
