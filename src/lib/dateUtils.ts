/**
 * Parse a YYYY-MM-DD date string as a LOCAL date (not UTC).
 *
 * `new Date("2026-03-15")` treats the string as UTC midnight, which in
 * timezones behind UTC (e.g. US Eastern) shows the PREVIOUS day.
 * This helper constructs the date in the local timezone instead.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
}
