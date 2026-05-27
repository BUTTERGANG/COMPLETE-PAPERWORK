import type { PayBreakdown } from '../types/event';

export interface PayInput {
  base_pay: number;
  compliance_bonus: number;
  over_hours_pay: number;
  fuel_recovery: number;
  tip: number;
  overtime_pay: number;
  other_pay: number;
}

const round2 = (n: number) => parseFloat((n || 0).toFixed(2));

export function calculatePay(event: PayInput): PayBreakdown {
  const base = round2(event.base_pay);
  const compliance = round2(event.compliance_bonus);
  const over_hours = round2(event.over_hours_pay);
  const fuel = round2(event.fuel_recovery);
  const tip = round2(event.tip);
  const overtime = round2(event.overtime_pay);
  const other = round2(event.other_pay);
  return {
    base,
    compliance,
    over_hours,
    fuel,
    tip,
    overtime,
    other,
    total: round2(base + compliance + over_hours + fuel + tip + overtime + other),
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}
