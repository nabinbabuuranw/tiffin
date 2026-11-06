// Dates are ISO (YYYY-MM-DD) in Nepal Time. Formatting is done by hand so it reads the same in every browser.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parts(iso: string) {
  const d = new Date(iso + 'T00:00:00Z');
  return { weekday: d.getUTCDay(), day: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear() };
}
export function shortDate(iso: string): string {
  const p = parts(iso);
  return `${DAYS[p.weekday]} ${p.day} ${MONTHS[p.month]}`;
}
export function longDate(iso: string): string {
  const p = parts(iso);
  return `${DAYS_LONG[p.weekday]} ${p.day} ${MONTHS[p.month]} ${p.year}`;
}
export function weekdayName(n: number): string {
  return DAYS_LONG[n];
}
export function weekdayShort(n: number): string {
  return DAYS[n];
}
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function npr(n: number): string {
  const neg = n < 0;
  const s = Math.abs(Math.round(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + 'NPR ' + s;
}
export function num(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
/** Nepal Time today, computed from the clock (UTC+05:45). */
export function todayNpt(): string {
  return new Date(Date.now() + 345 * 60000).toISOString().slice(0, 10);
}
export function lockText(cutoff: number, iso: string): string {
  const prev = addDays(iso, -1);
  const p = parts(prev);
  return `Closes ${String(cutoff).padStart(2, '0')}:00 ${DAYS_LONG[p.weekday]}`;
}
export const PLAN_MASK_LABEL = (mask: string) =>
  mask.split('').map((c, i) => (c === '1' ? DAYS[i] : null)).filter(Boolean).join(' ');
