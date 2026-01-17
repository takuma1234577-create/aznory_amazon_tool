/**
 * Get start of UTC day (00:00:00 UTC)
 */
export function startOfUtcDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Get start of UTC month (00:00:00 UTC on 1st day)
 */
export function startOfUtcMonth(date: Date): Date {
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
