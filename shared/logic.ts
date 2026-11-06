// Tiffin scheduling and billing rules. Pure functions: the Worker, the app and the tests all use this file.
// Time: the kitchen runs on Nepal Time (UTC+05:45). Dates are ISO strings (YYYY-MM-DD) in that zone.

export const NPT_OFFSET_MIN = 345;
export const DEFAULT_CUTOFF_HOUR = 20; // a pause for day D must be set before 20:00 NPT on D-1
export const HORIZON_DAYS = 21;        // the customer calendar shows this many days
export const MAX_PAUSE_DAYS = 31;

export type Diet = 'veg' | 'any';
export type DeliveryStatus = 'pending' | 'out' | 'delivered' | 'skipped';

export interface PlanRow { id: string; days: string; price_npr: number }
export interface SubRow {
  plan_days: string;
  start_date: string;
  end_date: string | null;
  status: string;
}

/** Nepal Time parts of an instant. */
export function nptParts(ms: number): { iso: string; hour: number; minute: number } {
  const d = new Date(ms + NPT_OFFSET_MIN * 60000);
  return { iso: d.toISOString().slice(0, 10), hour: d.getUTCHours(), minute: d.getUTCMinutes() };
}

export function todayNpt(ms: number = Date.now()): string {
  return nptParts(ms).iso;
}

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Day of week, 0 = Sunday ... 6 = Saturday (the Nepali office week starts on Sunday). */
export function weekdayOf(iso: string): number {
  return new Date(iso + 'T00:00:00Z').getUTCDay();
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + 'T00:00:00Z') - Date.parse(fromIso + 'T00:00:00Z')) / 86400000);
}

/** The instant (ms) after which a pause for `iso` can no longer be set: the day before, at the cut-off hour NPT. */
export function pauseLockMs(iso: string, cutoffHour: number = DEFAULT_CUTOFF_HOUR): number {
  const prev = addDays(iso, -1);
  const [y, m, d] = prev.split('-').map(Number);
  return Date.UTC(y, m - 1, d, cutoffHour) - NPT_OFFSET_MIN * 60000;
}

export function isPausable(iso: string, nowMs: number, cutoffHour: number = DEFAULT_CUTOFF_HOUR): boolean {
  return iso > todayNpt(nowMs) && nowMs < pauseLockMs(iso, cutoffHour);
}

/** A plan's days are a 7-character mask, Sunday first: "1111110" is Sunday to Friday. */
export function planAllows(days: string, weekday: number): boolean {
  return days.charAt(weekday) === '1';
}

export function planDaysPerWeek(days: string): number {
  return days.split('').filter((c) => c === '1').length;
}

export function isDeliveryDay(sub: SubRow, pausedDates: Set<string>, iso: string): boolean {
  if (sub.status !== 'active') return false;
  if (iso < sub.start_date) return false;
  if (sub.end_date && iso > sub.end_date) return false;
  if (!planAllows(sub.plan_days, weekdayOf(iso))) return false;
  return !pausedDates.has(iso);
}

export interface ScheduleDay {
  date: string;
  weekday: number;
  delivers: boolean;
  paused: boolean;
  locked: boolean;
  pausable: boolean;
}

/** The customer's calendar: each day from `fromIso` for HORIZON_DAYS, with what it means for this subscription. */
export function scheduleWindow(
  sub: SubRow,
  pausedDates: Set<string>,
  fromIso: string,
  nowMs: number,
  cutoffHour: number = DEFAULT_CUTOFF_HOUR,
): ScheduleDay[] {
  const out: ScheduleDay[] = [];
  for (let i = 0; i < HORIZON_DAYS; i++) {
    const date = addDays(fromIso, i);
    const paused = pausedDates.has(date);
    const pausable = isPausable(date, nowMs, cutoffHour);
    out.push({
      date,
      weekday: weekdayOf(date),
      delivers: isDeliveryDay(sub, pausedDates, date) || (paused && isDeliveryDayIgnoringPause(sub, date)),
      paused,
      locked: !pausable,
      pausable,
    });
  }
  return out;
}

function isDeliveryDayIgnoringPause(sub: SubRow, iso: string): boolean {
  return isDeliveryDay(sub, new Set(), iso);
}

export interface Billing {
  delivered: number;
  billed_npr: number;
  paid_npr: number;
  balance_npr: number; // positive: owed to the kitchen; negative: credit
}

export function billing(delivered: number, pricePerMeal: number, paidNpr: number): Billing {
  const billed = delivered * pricePerMeal;
  return { delivered, billed_npr: billed, paid_npr: paidNpr, balance_npr: billed - paidNpr };
}

export function normalizeDiet(v: unknown): Diet | null {
  return v === 'veg' || v === 'any' ? v : null;
}

export function normalizeStatus(v: unknown): DeliveryStatus | null {
  return v === 'pending' || v === 'out' || v === 'delivered' || v === 'skipped' ? v : null;
}

/** A plan mask from plain input: exactly seven 0/1 characters with at least one day on. */
export function validDaysMask(s: unknown): s is string {
  return typeof s === 'string' && /^[01]{7}$/.test(s) && s.includes('1');
}

export function stopOrderSorter(a: { stop_order: number; id: number }, b: { stop_order: number; id: number }): number {
  return a.stop_order - b.stop_order || a.id - b.id;
}

/** Whole NPR amounts only; a payment is 1 to 500,000 NPR. */
export function validAmount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 500000;
}

export function monthStart(iso: string): string {
  return iso.slice(0, 8) + '01';
}
