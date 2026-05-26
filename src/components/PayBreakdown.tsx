import { calculatePay, formatCurrency } from '../lib/payCalc';
import type { Event } from '../types/event';
import { DollarIcon, ClipboardCheckIcon, CarIcon } from './icons/Icons';

interface PayBreakdownProps {
  event: Event;
}

export default function PayBreakdown({ event }: PayBreakdownProps) {
  const pay = calculatePay(event);

  const rows = [
    { icon: <DollarIcon size={15} />, label: 'Base Pay', value: pay.base, color: 'text-text-primary' },
    ...(pay.compliance > 0
      ? [{
          icon: <ClipboardCheckIcon size={15} />,
          label: 'Compliance Bonus',
          value: pay.compliance,
          color: 'text-success',
        }]
      : []),
    ...(event.mileage_miles > 0
      ? [{
          icon: <CarIcon size={15} />,
          label: `Mileage (${event.mileage_miles} mi × ${event.mileage_rate}/mi)`,
          value: pay.mileage,
          color: 'text-text-primary',
        }]
      : []),
  ];

  return (
    <div className="card-elevated">
      <h3 className="text-sm font-semibold text-text-tertiary uppercase tracking-wider mb-4">
        Pay Breakdown
      </h3>
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="flex items-center gap-2.5 text-sm text-text-secondary">
              <span className="text-text-quaternary">{row.icon}</span>
              {row.label}
            </span>
            <span className={`text-sm font-semibold ${row.color}`}>
              {formatCurrency(row.value)}
            </span>
          </div>
        ))}
      </div>
      <div className="divider mt-4" />
      <div className="flex items-center justify-between pt-1">
        <span className="text-sm font-semibold text-text-primary">Total</span>
        <span className="text-xl font-bold tracking-tight text-accent">
          {formatCurrency(pay.total)}
        </span>
      </div>
    </div>
  );
}
