import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../../shared/logic.ts';

const sub = (over: Partial<L.SubRow> = {}): L.SubRow => ({ plan_days: '1111110', start_date: '2026-11-01', end_date: null, status: 'active', ...over });

test('NPT clock: 23:30 UTC is already the next day in Kathmandu', () => {
  const ms = Date.UTC(2026, 10, 6, 23, 30); // 2026-11-06 23:30 UTC = 2026-11-07 05:15 NPT
  assert.equal(L.todayNpt(ms), '2026-11-07');
  assert.equal(L.nptParts(ms).hour, 5);
});

test('date helpers: validation, addDays across months, weekday with Sunday = 0', () => {
  assert.equal(L.isIsoDate('2026-02-29'), false);
  assert.equal(L.isIsoDate('2028-02-29'), true);
  assert.equal(L.isIsoDate('2026-13-01'), false);
  assert.equal(L.addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(L.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(L.weekdayOf('2026-11-08'), 0); // Sunday
  assert.equal(L.weekdayOf('2026-11-14'), 6); // Saturday
  assert.equal(L.daysBetween('2026-11-01', '2026-11-30'), 29);
});

test('plan mask is Sunday first; office week skips Saturday only', () => {
  assert.equal(L.planAllows('1111110', 0), true);
  assert.equal(L.planAllows('1111110', 5), true);
  assert.equal(L.planAllows('1111110', 6), false);
  assert.equal(L.planDaysPerWeek('1111100'), 5);
  assert.equal(L.validDaysMask('1111110'), true);
  assert.equal(L.validDaysMask('0000000'), false);
  assert.equal(L.validDaysMask('111111'), false);
});

test('a subscription delivers only inside its dates, on its days, and not on paused days', () => {
  const s = sub({ start_date: '2026-11-02', end_date: '2026-11-20' });
  assert.equal(L.isDeliveryDay(s, new Set(), '2026-11-01'), false); // before start
  assert.equal(L.isDeliveryDay(s, new Set(), '2026-11-08'), true); // Sunday
  assert.equal(L.isDeliveryDay(s, new Set(), '2026-11-14'), false); // Saturday
  assert.equal(L.isDeliveryDay(s, new Set(['2026-11-08']), '2026-11-08'), false); // paused
  assert.equal(L.isDeliveryDay(s, new Set(), '2026-11-21'), false); // after end
  assert.equal(L.isDeliveryDay(sub({ status: 'cancelled' }), new Set(), '2026-11-08'), false);
});

test('pause lock: a pause for D closes at 20:00 NPT on D-1', () => {
  const date = '2026-11-10';
  const lock = L.pauseLockMs(date, 20); // 2026-11-09 20:00 NPT
  assert.equal(new Date(lock).toISOString(), '2026-11-09T14:15:00.000Z');
  assert.equal(L.isPausable(date, lock - 1, 20), true);
  assert.equal(L.isPausable(date, lock, 20), false);
  // today can never be paused, even early in the day
  assert.equal(L.isPausable('2026-11-10', Date.UTC(2026, 10, 10, 1, 0), 20), false);
});

test('schedule window: 21 days, locked flags follow the cut-off, paused days keep their meal visible', () => {
  const now = Date.UTC(2026, 10, 9, 4, 0); // 2026-11-09 10:00 NPT, before the cut-off
  const win = L.scheduleWindow(sub({ start_date: '2026-11-01' }), new Set(['2026-11-11']), '2026-11-09', now, 20);
  assert.equal(win.length, L.HORIZON_DAYS);
  const d10 = win.find((d) => d.date === '2026-11-10')!;
  assert.equal(d10.pausable, true);
  assert.equal(d10.locked, false);
  const d09 = win[0];
  assert.equal(d09.pausable, false); // today
  const d11 = win.find((d) => d.date === '2026-11-11')!;
  assert.equal(d11.paused, true);
  assert.equal(d11.delivers, true); // a tiffin is scheduled, and paused
  const sat = win.find((d) => d.date === '2026-11-14')!;
  assert.equal(sat.delivers, false);
});

test('billing counts delivered meals only, and balance can go negative for credit', () => {
  assert.deepEqual(L.billing(10, 160, 1000), { delivered: 10, billed_npr: 1600, paid_npr: 1000, balance_npr: 600 });
  assert.equal(L.billing(2, 150, 400).balance_npr, -100);
});

test('input guards: amounts are whole NPR 1 to 500000; diet and status are closed sets', () => {
  assert.equal(L.validAmount(160), true);
  assert.equal(L.validAmount(0), false);
  assert.equal(L.validAmount(12.5), false);
  assert.equal(L.validAmount(500001), false);
  assert.equal(L.normalizeDiet('veg'), 'veg');
  assert.equal(L.normalizeDiet('vegan'), null);
  assert.equal(L.normalizeStatus('delivered'), 'delivered');
  assert.equal(L.normalizeStatus('paid'), null);
});

test('month start and stop order', () => {
  assert.equal(L.monthStart('2026-11-17'), '2026-11-01');
  const rows = [{ id: 3, stop_order: 2 }, { id: 1, stop_order: 2 }, { id: 2, stop_order: 1 }].sort(L.stopOrderSorter);
  assert.deepEqual(rows.map((r) => r.id), [2, 1, 3]);
});
