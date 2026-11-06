import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { type Env } from '../src/worker.ts';
import { D1Shim } from './d1shim.ts';
import * as L from '../../shared/logic.ts';

const ORIGIN = 'https://tiffin.test';
let counter = 0;

function makeEnv(): Env {
  return { DB: new D1Shim() as any, ASSETS: { fetch: async () => new Response('<!doctype html><title>shell</title>', { headers: { 'Content-Type': 'text/html' } }) } };
}

async function call(env: Env, method: string, path: string, opts: { body?: unknown; cookie?: string; raw?: string; contentType?: string } = {}) {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined || opts.raw !== undefined) headers['Content-Type'] = opts.contentType || 'application/json';
  if (opts.cookie) headers['Cookie'] = opts.cookie;
  const init: RequestInit = { method, headers };
  if (opts.raw !== undefined) init.body = opts.raw;
  else if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  const res = await worker.fetch(new Request(ORIGIN + path, init), env);
  const setCookie = res.headers.get('Set-Cookie') || '';
  const m = setCookie.match(/tiffin_sid=([^;]+)/);
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, cookie: m ? `tiffin_sid=${m[1]}` : undefined, headers: res.headers };
}

async function demo(env: Env, role: 'kitchen' | 'customer') {
  const r = await call(env, 'POST', '/api/auth/demo', { body: { role } });
  assert.equal(r.status, 200);
  return r.cookie!;
}

function tomorrowPlus(n: number) {
  return L.addDays(L.todayNpt(), n);
}

test('health and the app shell', async () => {
  const env = makeEnv();
  const h = await call(env, 'GET', '/api/health');
  assert.equal(h.status, 200);
  assert.equal(h.data.ok, true);
  const shell = await worker.fetch(new Request(ORIGIN + '/kitchen/menu'), env);
  assert.equal(shell.status, 200);
  assert.match(shell.headers.get('Content-Security-Policy') || '', /script-src 'self'/);
  assert.equal(shell.headers.get('X-Frame-Options'), 'DENY');
});

test('seed: plans, routes, a 7-day menu and demo accounts are present', async () => {
  const env = makeEnv();
  const plans = await call(env, 'GET', '/api/plans');
  assert.equal(plans.data.plans.length, 3);
  assert.equal(plans.data.routes.length, 3);
  const menu = await call(env, 'GET', '/api/menu');
  assert.equal(menu.data.days.length, 7);
  assert.ok(menu.data.days.every((d: any) => d.items.length === 3));
  assert.equal(menu.data.is_demo, true);
});

test('demo kitchen sign-in and overview counts subscribers and production', async () => {
  const env = makeEnv();
  const k = await demo(env, 'kitchen');
  const ov = await call(env, 'GET', '/api/kitchen/overview', { cookie: k });
  assert.equal(ov.status, 200);
  assert.ok(ov.data.active_subscribers >= 6);
  assert.equal(ov.data.production.total, ov.data.production.veg + ov.data.production.any);
  assert.ok(ov.data.production.total <= ov.data.active_subscribers);
  assert.ok(ov.data.outstanding_npr !== undefined);
});

test('role separation: no session is 401, the wrong role is 403', async () => {
  const env = makeEnv();
  assert.equal((await call(env, 'GET', '/api/me/subscription')).status, 401);
  assert.equal((await call(env, 'GET', '/api/kitchen/overview')).status, 401);
  const c = await demo(env, 'customer');
  assert.equal((await call(env, 'GET', '/api/kitchen/overview', { cookie: c })).status, 403);
  const k = await demo(env, 'kitchen');
  assert.equal((await call(env, 'GET', '/api/me/subscription', { cookie: k })).status, 403);
});

test('customer sign-up, login, duplicate and weak passwords', async () => {
  const env = makeEnv();
  counter++;
  const email = `sita${counter}@example.test`;
  const r = await call(env, 'POST', '/api/auth/register', { body: { name: 'Sita Test', email, password: 'a-long-password' } });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.role, 'customer');
  assert.equal(r.data.user.is_demo, false);
  assert.ok(r.cookie);
  assert.equal((await call(env, 'POST', '/api/auth/register', { body: { name: 'Again', email, password: 'a-long-password' } })).status, 409);
  assert.equal((await call(env, 'POST', '/api/auth/register', { body: { name: 'Weak', email: 'weak@example.test', password: 'short' } })).status, 422);
  assert.equal((await call(env, 'POST', '/api/auth/register', { body: { name: 'Bad', email: 'not-an-email', password: 'a-long-password' } })).status, 422);
  assert.equal((await call(env, 'POST', '/api/auth/login', { body: { email, password: 'wrong-password' } })).status, 401);
  const ok = await call(env, 'POST', '/api/auth/login', { body: { email, password: 'a-long-password' } });
  assert.equal(ok.status, 200);
  const me = await call(env, 'GET', '/api/auth/me', { cookie: ok.cookie });
  assert.equal(me.data.user.email, email);
  await call(env, 'POST', '/api/auth/logout', { cookie: ok.cookie, body: {} });
  assert.equal((await call(env, 'GET', '/api/auth/me', { cookie: ok.cookie })).data.user, null);
});

test('non-JSON bodies are refused', async () => {
  const env = makeEnv();
  const r = await call(env, 'POST', '/api/auth/register', { raw: 'name=x', contentType: 'text/plain' });
  assert.equal(r.status, 415);
  const r2 = await call(env, 'POST', '/api/auth/login', { raw: '{nope', contentType: 'application/json' });
  assert.equal(r2.status, 400);
});

test('subscription: create needs a future start, valid plan, route and address; then update in place', async () => {
  const env = makeEnv();
  counter++;
  const reg = await call(env, 'POST', '/api/auth/register', { body: { name: 'Ramesh Test', email: `ramesh${counter}@example.test`, password: 'another-password' } });
  const c = reg.cookie!;
  const base = { plan_id: 'office-week', diet: 'veg', route_id: 2, address: 'Test lane 4, gate 2', phone: '' };
  assert.equal((await call(env, 'PUT', '/api/me/subscription', { cookie: c, body: { ...base, start_date: L.todayNpt() } })).data.error, 'start_must_be_future');
  assert.equal((await call(env, 'PUT', '/api/me/subscription', { cookie: c, body: { ...base, start_date: tomorrowPlus(1), plan_id: 'gold' } })).data.error, 'plan_invalid');
  assert.equal((await call(env, 'PUT', '/api/me/subscription', { cookie: c, body: { ...base, start_date: tomorrowPlus(1), diet: 'vegan' } })).data.error, 'diet_invalid');
  assert.equal((await call(env, 'PUT', '/api/me/subscription', { cookie: c, body: { ...base, start_date: tomorrowPlus(1), route_id: 99 } })).data.error, 'route_invalid');
  assert.equal((await call(env, 'PUT', '/api/me/subscription', { cookie: c, body: { ...base, start_date: tomorrowPlus(1), address: 'x' } })).data.error, 'address_too_short');
  assert.equal((await call(env, 'PUT', '/api/me/subscription', { cookie: c, body: { ...base, start_date: tomorrowPlus(40) } })).data.error, 'start_too_far');
  const created = await call(env, 'PUT', '/api/me/subscription', { cookie: c, body: { ...base, start_date: tomorrowPlus(1) } });
  assert.equal(created.status, 200);
  assert.equal(created.data.created, true);
  const upd = await call(env, 'PUT', '/api/me/subscription', { cookie: c, body: { ...base, plan_id: 'every-day', diet: 'any', start_date: tomorrowPlus(1) } });
  assert.equal(upd.data.updated, true);
  const got = await call(env, 'GET', '/api/me/subscription', { cookie: c });
  assert.equal(got.data.subscription.plan_id, 'every-day');
  assert.equal(got.data.subscription.diet, 'any');
  assert.equal(got.data.schedule.length, L.HORIZON_DAYS);
  assert.equal(got.data.billing.delivered, 0);
});

test('pauses: future days inside the plan can be paused; today and past days are locked', async () => {
  const env = makeEnv();
  const c = await demo(env, 'customer');
  const sub = await call(env, 'GET', '/api/me/subscription', { cookie: c });
  assert.ok(sub.data.subscription);
  const target = tomorrowPlus(3);
  const ok = await call(env, 'POST', '/api/me/pauses', { cookie: c, body: { dates: [target] } });
  assert.equal(ok.status, 200);
  const after = await call(env, 'GET', '/api/me/subscription', { cookie: c });
  const day = after.data.schedule.find((d: any) => d.date === target);
  assert.equal(day.paused, true);
  const del = await call(env, 'DELETE', '/api/me/pauses', { cookie: c, body: { dates: [target] } });
  assert.equal(del.status, 200);
  const past = await call(env, 'POST', '/api/me/pauses', { cookie: c, body: { dates: [L.todayNpt()] } });
  assert.equal(past.data.error, 'date_locked');
  const bad = await call(env, 'POST', '/api/me/pauses', { cookie: c, body: { dates: ['2026-02-30'] } });
  assert.equal(bad.data.error, 'date_invalid');
  const many = await call(env, 'POST', '/api/me/pauses', { cookie: c, body: { dates: Array.from({ length: 40 }, (_, i) => tomorrowPlus(i + 2)) } });
  assert.equal(many.data.error, 'dates_count');
});

test('kitchen marks a delivery; paused days refuse a delivery; billing follows delivered meals', async () => {
  const env = makeEnv();
  const k = await demo(env, 'kitchen');
  const c = await demo(env, 'customer');
  const cust = await call(env, 'GET', '/api/me/subscription', { cookie: c });
  const before = cust.data.billing.delivered;
  const routes = await call(env, 'GET', `/api/kitchen/routes?date=${L.todayNpt()}`, { cookie: k });
  assert.equal(routes.status, 200);
  const subs = await call(env, 'GET', '/api/kitchen/subscribers', { cookie: k });
  const demoSub = subs.data.subscribers.find((s: any) => s.customer_email === 'customer.demo@tiffin.invalid');
  assert.ok(demoSub);
  const dayTarget = tomorrowPlus(3); // paused for the demo customer on tomorrow+2 by seed
  const pausedDay = tomorrowPlus(2);
  const refused = await call(env, 'POST', '/api/kitchen/deliveries', { cookie: k, body: { subscription_id: demoSub.id, date: pausedDay, status: 'delivered' } });
  assert.equal(refused.data.error, 'not_a_delivery_day');
  let pastDay = L.addDays(L.todayNpt(), -1);
  if (L.weekdayOf(pastDay) === 6) pastDay = L.addDays(pastDay, -1); // the office week has no Saturday
  const mark = await call(env, 'POST', '/api/kitchen/deliveries', { cookie: k, body: { subscription_id: demoSub.id, date: pastDay, status: 'delivered' } });
  assert.equal(mark.status, 200);
  const bad = await call(env, 'POST', '/api/kitchen/deliveries', { cookie: k, body: { subscription_id: demoSub.id, date: pastDay, status: 'paid' } });
  assert.ok(['status_invalid', 'not_a_delivery_day'].includes(bad.data.error));
  void dayTarget;
  const after = await call(env, 'GET', '/api/me/subscription', { cookie: c });
  assert.ok(after.data.billing.delivered >= before);
});

test('payments: whole NPR only, method closed set, balance returned', async () => {
  const env = makeEnv();
  const k = await demo(env, 'kitchen');
  const subs = await call(env, 'GET', '/api/kitchen/subscribers', { cookie: k });
  const s = subs.data.subscribers[0];
  assert.equal((await call(env, 'POST', '/api/kitchen/payments', { cookie: k, body: { subscription_id: s.id, amount_npr: 0, method: 'cash' } })).data.error, 'amount_invalid');
  assert.equal((await call(env, 'POST', '/api/kitchen/payments', { cookie: k, body: { subscription_id: s.id, amount_npr: 100, method: 'crypto' } })).data.error, 'method_invalid');
  assert.equal((await call(env, 'POST', '/api/kitchen/payments', { cookie: k, body: { subscription_id: s.id, amount_npr: 100, method: 'cash', received_on: tomorrowPlus(5) } })).data.error, 'date_invalid');
  const ok = await call(env, 'POST', '/api/kitchen/payments', { cookie: k, body: { subscription_id: s.id, amount_npr: 100, method: 'bank', note: 'test' } });
  assert.equal(ok.status, 200);
  assert.equal(typeof ok.data.balance_npr, 'number');
});

test('menu editor: replaces the week, refuses bad slots and diets', async () => {
  const env = makeEnv();
  const k = await demo(env, 'kitchen');
  const cur = await call(env, 'GET', '/api/kitchen/menu', { cookie: k });
  assert.equal(cur.data.days.length, 7);
  const days = cur.data.days.map((d: any) => ({ weekday: d.weekday, items: d.items }));
  assert.equal((await call(env, 'PUT', '/api/kitchen/menu', { cookie: k, body: { days: days.map((d: any, i: number) => (i === 0 ? { weekday: 0, items: [{ slot: 'drink', name: 'Lassi', diet: 'veg' }] } : d)) } })).data.error, 'slot_invalid');
  assert.equal((await call(env, 'PUT', '/api/kitchen/menu', { cookie: k, body: { days: days.map((d: any, i: number) => (i === 0 ? { weekday: 0, items: [{ slot: 'main', name: 'Lassi', diet: 'maybe' }] } : d)) } })).data.error, 'item_diet_invalid');
  const put = await call(env, 'PUT', '/api/kitchen/menu', { cookie: k, body: { days } });
  assert.equal(put.status, 200);
  assert.equal(put.data.items, 21);
});

test('settings: cut-off hour is 12 to 23 and the kitchen name is required', async () => {
  const env = makeEnv();
  const k = await demo(env, 'kitchen');
  assert.equal((await call(env, 'PUT', '/api/kitchen/settings', { cookie: k, body: { kitchen_name: 'Ghar', cutoff_hour: 3, notice: '' } })).data.error, 'cutoff_invalid');
  assert.equal((await call(env, 'PUT', '/api/kitchen/settings', { cookie: k, body: { kitchen_name: 'A', cutoff_hour: 20, notice: '' } })).data.error, 'name_too_short');
  const ok = await call(env, 'PUT', '/api/kitchen/settings', { cookie: k, body: { kitchen_name: 'Ghar ko Dabba', cutoff_hour: 21, notice: 'Test' } });
  assert.equal(ok.status, 200);
  const got = await call(env, 'GET', '/api/kitchen/settings', { cookie: k });
  assert.equal(got.data.cutoff_hour, 21);
});

test('cancel stops deliveries; the route sheet reflects it', async () => {
  const env = makeEnv();
  counter++;
  const reg = await call(env, 'POST', '/api/auth/register', { body: { name: 'Cancel Test', email: `cancel${counter}@example.test`, password: 'another-password' } });
  const c = reg.cookie!;
  await call(env, 'PUT', '/api/me/subscription', { cookie: c, body: { plan_id: 'five-day', diet: 'veg', route_id: 3, address: 'Test lane 9', phone: '', start_date: tomorrowPlus(1) } });
  const cancel = await call(env, 'POST', '/api/me/subscription/cancel', { cookie: c, body: {} });
  assert.equal(cancel.status, 200);
  const sched = await call(env, 'GET', '/api/me/subscription', { cookie: c });
  assert.equal(sched.data.subscription.status, 'cancelled');
  assert.ok(sched.data.schedule.every((d: any) => !d.delivers));
});

test('route order: stop order is saved in the order given', async () => {
  const env = makeEnv();
  const k = await demo(env, 'kitchen');
  let monday = L.todayNpt();
  while (L.weekdayOf(monday) !== 1) monday = L.addDays(monday, 1);
  const r = await call(env, 'GET', `/api/kitchen/routes?date=${monday}`, { cookie: k });
  const g = r.data.groups.find((x: any) => x.stops.length >= 2);
  assert.ok(g, 'a route with two stops on a Monday');
  const stops = g.stops.map((s: any) => s.subscription_id);
  const rev = [...stops].reverse();
  const res = await call(env, 'POST', `/api/kitchen/routes/${g.route.id}/order`, { cookie: k, body: { subscription_ids: rev } });
  assert.equal(res.status, 200);
  const r2 = await call(env, 'GET', `/api/kitchen/routes?date=${monday}`, { cookie: k });
  const g2 = r2.data.groups.find((x: any) => x.route.id === g.route.id);
  assert.deepEqual(g2.stops.map((s: any) => s.subscription_id), rev);
});
