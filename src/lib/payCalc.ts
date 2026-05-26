import type { PayBreakdown } from '../types/event';
import { DEFAULT_MILEAGE_RATE } from './constants';

export function calculatePay(event: {
  base_pay: number;
  compliance_bonus: number;
  mileage_miles: number;
  mileage_rate?: number;
}): PayBreakdown {
  const rate = event.mileage_rate ?? DEFAULT_MILEAGE_RATE;
  const mileage = parseFloat((event.mileage_miles * rate).toFixed(2));
  return {
    base: event.base_pay,
    compliance: event.compliance_bonus,
    mileage,
    total: parseFloat((
      event.base_pay +
      event.compliance_bonus +
      mileage
    ).toFixed(2))
  };
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount);
}
