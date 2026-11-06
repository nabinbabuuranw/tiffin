// Tiffin API: one Cloudflare Worker over D1. Serves /api/* and the SPA shell; everything else is a static asset.
import { SCHEMA, DEMO_MENU, DEMO_PLANS, DEMO_ROUTES } from './schema.ts';
import { hashPassword, verifyPassword, randomToken, sha256hex } from './crypto.ts';
import * as L from '../../shared/logic.ts';

export interface Env {
  DB: any;
  ASSETS: { fetch(req: Request): Promise<Response> };
}

export const SESSION_COOKIE = 'tiffin_sid';
const SESSION_MS = 14 * 24 * 3600 * 1000;
const DEMO_KITCHEN_EMAIL = 'kitchen.demo@tiffin.invalid';
const DEMO_CUSTOMER_EMAIL = 'customer.demo@tiffin.invalid';

export class HttpError extends Error {
  status: number;
  code: string;
  extra: Record<string, unknown>;
  constructor(status: number, code: string, extra: Record<string, unknown> = {}) {
    super(code);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}
function fail(status: number, code: string, extra: Record<string, unknown> = {}): never {
  throw new HttpError(status, code, extra);
}

interface User { id: number; email: string; name: string; role: 'kitchen' | 'customer'; is_demo: number }

const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Frame-Options': 'DENY',
};

function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...headers },
  });
}

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('Cookie') || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

const sessionCookie = (token: string, maxAgeS: number) =>
  `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeS}`;

// ---------- D1 helpers ----------
async function one<T = any>(env: Env, sql: string, ...args: unknown[]): Promise<T | null> {
  return (await env.DB.prepare(sql).bind(...args).first()) as T | null;
}
async function all<T = any>(env: Env, sql: string, ...args: unknown[]): Promise<T[]> {
  const r = await env.DB.prepare(sql).bind(...args).all();
  return (r.results || []) as T[];
}
async function run(env: Env, sql: string, ...args: unknown[]) {
  return env.DB.prepare(sql).bind(...args).run();
}

const readyFor = new WeakMap<object, Promise<void>>();
export function ensureReady(env: Env): Promise<void> {
  let p = readyFor.get(env.DB);
  if (!p) {
    p = setup(env).catch((e) => {
      readyFor.delete(env.DB);
      throw e;
    });
    readyFor.set(env.DB, p);
  }
  return p;
}

async function setting(env: Env, k: string): Promise<string | null> {
  const r = await one<{ v: string }>(env, 'SELECT v FROM settings WHERE k = ?', k);
  return r ? r.v : null;
}
async function cutoffHour(env: Env): Promise<number> {
  const v = Number(await setting(env, 'cutoff_hour'));
  return Number.isInteger(v) ? v : L.DEFAULT_CUTOFF_HOUR;
}

async function setup(env: Env): Promise<void> {
  for (const stmt of SCHEMA) await env.DB.prepare(stmt).run();
  if (await setting(env, 'seeded')) return;
  await seed(env);
}

async function seed(env: Env): Promise<void> {
  const now = Date.now();
  const today = L.todayNpt(now);
  await run(env, 'INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)', 'kitchen_name', 'Ghar ko Dabba (DEMO kitchen)');
  await run(env, 'INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)', 'cutoff_hour', String(L.DEFAULT_CUTOFF_HOUR));
  await run(env, 'INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)', 'notice', 'Demo kitchen. The menu, prices, names and addresses are invented so you can try every screen.');
  for (const p of DEMO_PLANS) {
    await run(env, 'INSERT OR REPLACE INTO plans (id, name, name_ne, days, price_npr, blurb, sort, active) VALUES (?,?,?,?,?,?,?,1)', p.id, p.name, p.name_ne, p.days, p.price_npr, p.blurb, p.sort);
  }
  for (const r of DEMO_ROUTES) await run(env, 'INSERT OR REPLACE INTO routes (id, name, area, sort) VALUES (?,?,?,?)', r.id, r.name, r.area, r.sort);
  let i = 0;
  for (const m of DEMO_MENU) {
    await run(env, 'INSERT INTO menu_items (weekday, slot, name, name_ne, diet, sort) VALUES (?,?,?,?,?,?)', m.weekday, m.slot, m.name, m.name_ne, m.diet, i++);
  }
  const hash = await hashPassword(randomToken(24)); // nobody signs in with a password; the demo buttons do
  const k = await run(env, 'INSERT INTO users (email, name, password_hash, role, is_demo, created_at) VALUES (?,?,?,?,1,?)', DEMO_KITCHEN_EMAIL, 'Demo kitchen', hash, 'kitchen', now);
  void k;
  const demoCustomers: { name: string; plan: string; diet: 'veg' | 'any'; route: number; start: number; skip: number[]; paidFrac: number }[] = [
    { name: 'Demo · Sita Gurung', plan: 'office-week', diet: 'veg', route: 1, start: -40, skip: [2], paidFrac: 1 },
    { name: 'Demo · Bikash Thapa', plan: 'five-day', diet: 'any', route: 1, start: -25, skip: [], paidFrac: 0.5 },
    { name: 'Demo · Anita Shrestha', plan: 'every-day', diet: 'veg', route: 2, start: -18, skip: [4], paidFrac: 0 },
    { name: 'Demo · Ramesh Karki', plan: 'office-week', diet: 'any', route: 2, start: -12, skip: [], paidFrac: 0.2 },
    { name: 'Demo · Priya Maharjan', plan: 'five-day', diet: 'veg', route: 3, start: -33, skip: [1, 3], paidFrac: 1 },
    { name: 'Demo · Suman Adhikari', plan: 'office-week', diet: 'any', route: 3, start: -6, skip: [], paidFrac: 0 },
  ];
  const pw = await hashPassword(randomToken(24));
  await run(env, 'INSERT INTO users (email, name, password_hash, role, is_demo, created_at) VALUES (?,?,?,?,1,?)', DEMO_CUSTOMER_EMAIL, 'Demo customer', pw, 'customer', now);
  const demoRows: { name: string; email: string; plan: string; diet: 'veg' | 'any'; route: number; start: number; skip: number[]; paidFrac: number }[] = [{ name: 'Demo customer', email: DEMO_CUSTOMER_EMAIL, plan: 'office-week', diet: 'veg', route: 1, start: -10, skip: [], paidFrac: 0.5 }];
  demoCustomers.forEach((c, idx) => demoRows.push({ ...c, email: `customer${idx + 1}.demo@tiffin.invalid` }));
  for (const c of demoRows) {
    if (c.email !== DEMO_CUSTOMER_EMAIL) {
      await run(env, 'INSERT INTO users (email, name, password_hash, role, is_demo, created_at) VALUES (?,?,?,?,1,?)', c.email, c.name, pw, 'customer', now);
    }
    const u = await one<{ id: number }>(env, 'SELECT id FROM users WHERE email = ?', c.email);
    const start = L.addDays(today, c.start);
    const sid = (await run(env, `INSERT INTO subscriptions (user_id, plan_id, diet, route_id, stop_order, address, phone, start_date, status, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,'active',?,?)`, u!.id, c.plan, c.diet, c.route, idx_of(c.name), 'Demo address, ' + (DEMO_ROUTES.find((r) => r.id === c.route)?.area || ''), '', start, now, now)).meta.last_row_id;
    const sub = { plan_days: DEMO_PLANS.find((p) => p.id === c.plan)!.days, start_date: start, end_date: null, status: 'active' };
    const price = DEMO_PLANS.find((p) => p.id === c.plan)!.price_npr;
    let delivered = 0;
    for (let d = -5; d <= -1; d++) {
      const iso = L.addDays(today, d);
      if (iso < start) continue;
      if (!L.isDeliveryDay(sub, new Set(), iso)) continue;
      const skipIt = c.skip.includes(-d);
      await run(env, 'INSERT INTO deliveries (subscription_id, date, status, updated_at) VALUES (?,?,?,?)', sid, iso, skipIt ? 'skipped' : 'delivered', now);
      if (!skipIt) delivered++;
    }
    if (c.paidFrac > 0) {
      const amt = Math.floor(delivered * price * c.paidFrac);
      if (amt > 0) await run(env, "INSERT INTO payments (subscription_id, amount_npr, method, note, received_on, created_at) VALUES (?,?,?,?,?,?)", sid, amt, 'cash', 'Demo entry', today, now);
    }
    if (c.email === DEMO_CUSTOMER_EMAIL) {
      const tomorrow = L.addDays(today, 2);
      await run(env, 'INSERT INTO pauses (subscription_id, date, created_at) VALUES (?,?,?)', sid, tomorrow, now);
    }
  }
  await run(env, "INSERT OR REPLACE INTO settings (k, v) VALUES ('seeded', '1')");
}
function idx_of(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h % 5;
}

// ---------- sessions ----------
async function userFromRequest(env: Env, req: Request): Promise<User | null> {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return null;
  const row = await one<User & { expires_at: number }>(
    env,
    `SELECT u.id, u.email, u.name, u.role, u.is_demo, s.expires_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    await sha256hex(token),
  );
  if (!row || row.expires_at < Date.now()) return null;
  return { id: row.id, email: row.email, name: row.name, role: row.role, is_demo: row.is_demo };
}

async function startSession(env: Env, userId: number): Promise<Response> {
  const token = randomToken(32);
  await run(env, 'INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?,?,?)', await sha256hex(token), userId, Date.now() + SESSION_MS);
  const user = await one<User>(env, 'SELECT id, email, name, role, is_demo FROM users WHERE id = ?', userId);
  return json({ user: publicUser(user!) }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_MS / 1000) });
}

function publicUser(u: User) {
  return { id: u.id, email: u.email, name: u.name, role: u.role, is_demo: !!u.is_demo };
}

async function requireRole(env: Env, req: Request, role: 'kitchen' | 'customer'): Promise<User> {
  const u = await userFromRequest(env, req);
  if (!u) fail(401, 'not_signed_in');
  if (u.role !== role) fail(403, 'wrong_role');
  return u;
}

async function body(req: Request): Promise<Record<string, any>> {
  const ct = req.headers.get('Content-Type') || '';
  if (!ct.includes('application/json')) fail(415, 'json_required');
  try {
    const b = await req.json();
    if (!b || typeof b !== 'object' || Array.isArray(b)) fail(400, 'bad_json');
    return b as Record<string, any>;
  } catch {
    return fail(400, 'bad_json');
  }
}

const clean = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

// ---------- shapes ----------
interface SubRaw {
  id: number; user_id: number; plan_id: string; diet: 'veg' | 'any'; route_id: number | null; stop_order: number;
  address: string; phone: string; start_date: string; end_date: string | null; status: string; created_at: number;
  plan_days: string; price_npr: number; plan_name: string; route_name: string | null; customer_name: string; customer_email: string;
}
const SUB_SELECT = `SELECT s.id, s.user_id, s.plan_id, s.diet, s.route_id, s.stop_order, s.address, s.phone, s.start_date, s.end_date, s.status, s.created_at,
  p.days AS plan_days, p.price_npr, p.name AS plan_name, r.name AS route_name, u.name AS customer_name, u.email AS customer_email
  FROM subscriptions s JOIN plans p ON p.id = s.plan_id JOIN users u ON u.id = s.user_id LEFT JOIN routes r ON r.id = s.route_id`;

async function subsWhere(env: Env, where: string, ...args: unknown[]): Promise<SubRaw[]> {
  return all<SubRaw>(env, `${SUB_SELECT} WHERE ${where}`, ...args);
}
async function pausesFor(env: Env, subIds: number[], from: string, to: string): Promise<Map<number, Set<string>>> {
  const m = new Map<number, Set<string>>();
  if (!subIds.length) return m;
  const rows = await all<{ subscription_id: number; date: string }>(env, 'SELECT subscription_id, date FROM pauses WHERE date >= ? AND date <= ?', from, to);
  for (const r of rows) {
    if (!m.has(r.subscription_id)) m.set(r.subscription_id, new Set());
    m.get(r.subscription_id)!.add(r.date);
  }
  return m;
}
function subLogic(s: SubRaw) {
  return { plan_days: s.plan_days, start_date: s.start_date, end_date: s.end_date, status: s.status };
}
function subJson(s: SubRaw) {
  return {
    id: s.id, plan_id: s.plan_id, plan_name: s.plan_name, plan_days: s.plan_days, price_npr: s.price_npr, diet: s.diet,
    route_id: s.route_id, route_name: s.route_name, stop_order: s.stop_order, address: s.address, phone: s.phone,
    start_date: s.start_date, end_date: s.end_date, status: s.status, customer_name: s.customer_name, customer_email: s.customer_email,
  };
}

async function deliveredCount(env: Env, subId: number): Promise<number> {
  const r = await one<{ n: number }>(env, "SELECT COUNT(*) AS n FROM deliveries WHERE subscription_id = ? AND status = 'delivered'", subId);
  return r ? Number(r.n) : 0;
}
async function paidTotal(env: Env, subId: number): Promise<number> {
  const r = await one<{ n: number }>(env, 'SELECT COALESCE(SUM(amount_npr), 0) AS n FROM payments WHERE subscription_id = ?', subId);
  return r ? Number(r.n) : 0;
}

async function menuByDay(env: Env) {
  const rows = await all<any>(env, 'SELECT weekday, slot, name, name_ne, diet FROM menu_items ORDER BY weekday, sort, id');
  const days: { weekday: number; items: any[] }[] = [];
  for (let w = 0; w < 7; w++) days.push({ weekday: w, items: rows.filter((r) => r.weekday === w).map((r) => ({ slot: r.slot, name: r.name, name_ne: r.name_ne, diet: r.diet })) });
  return days;
}

// ---------- API ----------
export async function handleApi(req: Request, env: Env, url: URL): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '');
  const m = req.method;
  const now = Date.now();
  const today = L.todayNpt(now);

  if (path === '/api/health' && m === 'GET') return json({ ok: true });

  // auth
  if (path === '/api/auth/me' && m === 'GET') {
    const u = await userFromRequest(env, req);
    return json({ user: u ? publicUser(u) : null });
  }
  if (path === '/api/auth/register' && m === 'POST') {
    const b = await body(req);
    const name = clean(b.name, 60);
    const email = clean(b.email, 254).toLowerCase();
    const password = typeof b.password === 'string' ? b.password : '';
    if (name.length < 2) fail(422, 'name_too_short');
    if (!EMAIL_RE.test(email)) fail(422, 'email_invalid');
    if (password.length < 8 || password.length > 200) fail(422, 'password_length');
    if (await one(env, 'SELECT id FROM users WHERE email = ?', email)) fail(409, 'email_taken');
    const hash = await hashPassword(password);
    const res = await run(env, 'INSERT INTO users (email, name, password_hash, role, is_demo, created_at) VALUES (?,?,?,?,0,?)', email, name, hash, 'customer', now);
    return startSession(env, Number(res.meta.last_row_id));
  }
  if (path === '/api/auth/login' && m === 'POST') {
    const b = await body(req);
    const email = clean(b.email, 254).toLowerCase();
    const password = typeof b.password === 'string' ? b.password : '';
    const u = await one<{ id: number; password_hash: string }>(env, 'SELECT id, password_hash FROM users WHERE email = ?', email);
    if (!u || !(await verifyPassword(password, u.password_hash))) fail(401, 'wrong_email_or_password');
    return startSession(env, u.id);
  }
  if (path === '/api/auth/demo' && m === 'POST') {
    const b = await body(req);
    const email = b.role === 'kitchen' ? DEMO_KITCHEN_EMAIL : b.role === 'customer' ? DEMO_CUSTOMER_EMAIL : null;
    if (!email) fail(422, 'role_invalid');
    const u = await one<{ id: number }>(env, 'SELECT id FROM users WHERE email = ? AND is_demo = 1', email);
    if (!u) fail(404, 'demo_missing');
    return startSession(env, u.id);
  }
  if (path === '/api/auth/logout' && m === 'POST') {
    const token = readCookie(req, SESSION_COOKIE);
    if (token) await run(env, 'DELETE FROM sessions WHERE token_hash = ?', await sha256hex(token));
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
  }

  // public catalogue
  if (path === '/api/plans' && m === 'GET') {
    const rows = await all<any>(env, 'SELECT id, name, name_ne, days, price_npr, blurb FROM plans WHERE active = 1 ORDER BY sort');
    const routes = await all<any>(env, 'SELECT id, name, area FROM routes ORDER BY sort');
    return json({ plans: rows, routes });
  }
  if (path === '/api/menu' && m === 'GET') {
    const kitchen = (await setting(env, 'kitchen_name')) || 'Tiffin kitchen';
    const notice = (await setting(env, 'notice')) || '';
    return json({ kitchen_name: kitchen, notice, days: await menuByDay(env), is_demo: true, cutoff_hour: await cutoffHour(env) });
  }

  // customer
  if (path === '/api/me/subscription' && m === 'GET') {
    const u = await requireRole(env, req, 'customer');
    const subs = await subsWhere(env, 's.user_id = ?', u.id);
    const cut = await cutoffHour(env);
    const sub = subs[0];
    if (!sub) return json({ subscription: null, schedule: [], billing: null, routes: await routesList(env), pause_cutoff_hour: cut, today });
    const pausedMap = await pausesFor(env, [sub.id], today, L.addDays(today, L.HORIZON_DAYS));
    const paused = pausedMap.get(sub.id) || new Set<string>();
    const schedule = L.scheduleWindow(subLogic(sub), paused, today, now, cut);
    const delivered = await deliveredCount(env, sub.id);
    const paid = await paidTotal(env, sub.id);
    const statuses = await all<{ date: string; status: string }>(env, 'SELECT date, status FROM deliveries WHERE subscription_id = ? AND date >= ?', sub.id, L.addDays(today, -1));
    const sMap: Record<string, string> = {};
    for (const s of statuses) sMap[s.date] = s.status;
    return json({
      subscription: subJson(sub),
      schedule: schedule.map((d) => ({ ...d, status: sMap[d.date] || null })),
      billing: L.billing(delivered, sub.price_npr, paid),
      routes: await routesList(env),
      pause_cutoff_hour: cut,
      today,
    });
  }
  if (path === '/api/me/subscription' && m === 'PUT') {
    const u = await requireRole(env, req, 'customer');
    const b = await body(req);
    const existing = (await subsWhere(env, 's.user_id = ?', u.id))[0];
    const planId = typeof b.plan_id === 'string' ? b.plan_id : '';
    const plan = await one<{ id: string; price_npr: number }>(env, 'SELECT id, price_npr FROM plans WHERE id = ? AND active = 1', planId);
    if (!plan) fail(422, 'plan_invalid');
    const diet = L.normalizeDiet(b.diet);
    if (!diet) fail(422, 'diet_invalid');
    const routeId = Number(b.route_id);
    if (!(await one(env, 'SELECT id FROM routes WHERE id = ?', routeId))) fail(422, 'route_invalid');
    const address = clean(b.address, 200);
    if (address.length < 5) fail(422, 'address_too_short');
    const phone = clean(b.phone, 16);
    if (phone && !/^\+?[0-9][0-9 \-]{6,15}$/.test(phone)) fail(422, 'phone_invalid');
    if (existing && existing.status === 'active') {
      await run(env, 'UPDATE subscriptions SET plan_id = ?, diet = ?, route_id = ?, address = ?, phone = ?, updated_at = ? WHERE id = ?', planId, diet, routeId, address, phone, now, existing.id);
      return json({ ok: true, updated: true });
    }
    const start = typeof b.start_date === 'string' ? b.start_date : '';
    if (!L.isIsoDate(start)) fail(422, 'start_invalid');
    if (start <= today) fail(422, 'start_must_be_future');
    if (L.daysBetween(today, start) > 30) fail(422, 'start_too_far');
    if (existing) {
      await run(env, "UPDATE subscriptions SET plan_id = ?, diet = ?, route_id = ?, address = ?, phone = ?, start_date = ?, end_date = NULL, status = 'active', updated_at = ? WHERE id = ?", planId, diet, routeId, address, phone, start, now, existing.id);
    } else {
      await run(env, `INSERT INTO subscriptions (user_id, plan_id, diet, route_id, stop_order, address, phone, start_date, status, created_at, updated_at)
        VALUES (?,?,?,?,(SELECT COALESCE(MAX(stop_order),0)+1 FROM subscriptions WHERE route_id = ?),?,?,?,'active',?,?)`, u.id, planId, diet, routeId, routeId, address, phone, start, now, now);
    }
    return json({ ok: true, created: true });
  }
  if (path === '/api/me/subscription/cancel' && m === 'POST') {
    const u = await requireRole(env, req, 'customer');
    const existing = (await subsWhere(env, 's.user_id = ?', u.id))[0];
    if (!existing || existing.status !== 'active') fail(404, 'no_active_subscription');
    await run(env, "UPDATE subscriptions SET status = 'cancelled', updated_at = ? WHERE id = ?", now, existing.id);
    return json({ ok: true });
  }
  if (path === '/api/me/pauses' && (m === 'POST' || m === 'DELETE')) {
    const u = await requireRole(env, req, 'customer');
    const sub = (await subsWhere(env, 's.user_id = ? AND s.status = ?', u.id, 'active'))[0];
    if (!sub) fail(404, 'no_active_subscription');
    const b = await body(req);
    const dates: unknown[] = Array.isArray(b.dates) ? b.dates : [];
    if (!dates.length || dates.length > L.MAX_PAUSE_DAYS) fail(422, 'dates_count');
    const cut = await cutoffHour(env);
    for (const d of dates) {
      if (!L.isIsoDate(d)) fail(422, 'date_invalid');
      if (!L.isPausable(d, now, cut)) fail(422, 'date_locked', { date: d });
      if (d < sub.start_date || (sub.end_date && d > sub.end_date)) fail(422, 'date_outside_plan', { date: d });
    }
    for (const d of dates as string[]) {
      if (m === 'POST') await run(env, 'INSERT OR IGNORE INTO pauses (subscription_id, date, created_at) VALUES (?,?,?)', sub.id, d, now);
      else await run(env, 'DELETE FROM pauses WHERE subscription_id = ? AND date = ?', sub.id, d);
    }
    return json({ ok: true, count: dates.length });
  }
  if (path === '/api/me/billing' && m === 'GET') {
    const u = await requireRole(env, req, 'customer');
    const sub = (await subsWhere(env, 's.user_id = ?', u.id))[0];
    if (!sub) return json({ billing: null, payments: [] });
    const delivered = await deliveredCount(env, sub.id);
    const paid = await paidTotal(env, sub.id);
    const payments = await all<any>(env, 'SELECT amount_npr, method, note, received_on FROM payments WHERE subscription_id = ? ORDER BY received_on DESC, id DESC LIMIT 20', sub.id);
    return json({ billing: L.billing(delivered, sub.price_npr, paid), price_npr: sub.price_npr, payments, method_note: 'Cash on delivery or a bank transfer you make to the kitchen. The kitchen records each payment by hand. No online payment is taken here.' });
  }

  // kitchen
  if (path.startsWith('/api/kitchen/')) {
    const k = await requireRole(env, req, 'kitchen');
    return kitchenApi(req, env, url, path, m, k, now, today);
  }

  return fail(404, 'not_found');
}

async function routesList(env: Env) {
  return all<any>(env, 'SELECT id, name, area FROM routes ORDER BY sort');
}

async function kitchenApi(req: Request, env: Env, url: URL, path: string, m: string, k: User, now: number, today: string): Promise<Response> {
  void k;
  if (path === '/api/kitchen/settings' && m === 'GET') {
    return json({ kitchen_name: await setting(env, 'kitchen_name'), cutoff_hour: await cutoffHour(env), notice: (await setting(env, 'notice')) || '', is_demo: true });
  }
  if (path === '/api/kitchen/settings' && m === 'PUT') {
    const b = await body(req);
    const name = clean(b.kitchen_name, 60);
    if (name.length < 2) fail(422, 'name_too_short');
    const cut = Number(b.cutoff_hour);
    if (!Number.isInteger(cut) || cut < 12 || cut > 23) fail(422, 'cutoff_invalid');
    const notice = clean(b.notice, 280);
    await run(env, 'INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)', 'kitchen_name', name);
    await run(env, 'INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)', 'cutoff_hour', String(cut));
    await run(env, 'INSERT OR REPLACE INTO settings (k, v) VALUES (?, ?)', 'notice', notice);
    return json({ ok: true });
  }
  if (path === '/api/kitchen/menu' && m === 'GET') {
    return json({ days: await menuByDay(env) });
  }
  if (path === '/api/kitchen/menu' && m === 'PUT') {
    const b = await body(req);
    const days: any[] = Array.isArray(b.days) ? b.days : [];
    if (days.length !== 7) fail(422, 'days_count');
    const rows: { weekday: number; slot: string; name: string; name_ne: string; diet: string }[] = [];
    for (const d of days) {
      if (!Number.isInteger(d.weekday) || d.weekday < 0 || d.weekday > 6) fail(422, 'weekday_invalid');
      const items: any[] = Array.isArray(d.items) ? d.items : [];
      if (items.length > 6) fail(422, 'too_many_items');
      for (const it of items) {
        const name = clean(it.name, 80);
        if (name.length < 2) fail(422, 'item_name_short');
        if (!['main', 'side', 'sweet'].includes(it.slot)) fail(422, 'slot_invalid');
        if (!['veg', 'nonveg'].includes(it.diet)) fail(422, 'item_diet_invalid');
        rows.push({ weekday: d.weekday, slot: it.slot, name, name_ne: clean(it.name_ne, 80), diet: it.diet });
      }
    }
    await run(env, 'DELETE FROM menu_items');
    let i = 0;
    for (const r of rows) await run(env, 'INSERT INTO menu_items (weekday, slot, name, name_ne, diet, sort) VALUES (?,?,?,?,?,?)', r.weekday, r.slot, r.name, r.name_ne, r.diet, i++);
    return json({ ok: true, items: rows.length });
  }
  if (path === '/api/kitchen/overview' && m === 'GET') {
    const date = url.searchParams.get('date') || today;
    if (!L.isIsoDate(date)) fail(422, 'date_invalid');
    const subs = await subsWhere(env, "s.status = 'active'");
    const cut = await cutoffHour(env);
    const pm = await pausesFor(env, subs.map((s) => s.id), date, date);
    let veg = 0, any = 0, paused = 0;
    const perRoute: Record<string, number> = {};
    for (const s of subs) {
      const paus = pm.get(s.id) || new Set<string>();
      if (paus.has(date)) paused++;
      if (L.isDeliveryDay(subLogic(s), paus, date)) {
        if (s.diet === 'veg') veg++; else any++;
        const rn = s.route_name || 'No route';
        perRoute[rn] = (perRoute[rn] || 0) + 1;
      }
    }
    const statuses = await all<{ status: string; n: number }>(env, 'SELECT d.status, COUNT(*) AS n FROM deliveries d WHERE d.date = ? GROUP BY d.status', date);
    const st: Record<string, number> = { out: 0, delivered: 0, skipped: 0 };
    for (const r of statuses) st[r.status] = Number(r.n);
    const monthFrom = L.monthStart(date);
    const collected = await one<{ n: number }>(env, 'SELECT COALESCE(SUM(amount_npr),0) AS n FROM payments WHERE received_on >= ? AND received_on <= ?', monthFrom, date);
    // outstanding across all active subscriptions
    let outstanding = 0;
    for (const s of subs) {
      const b = L.billing(await deliveredCount(env, s.id), s.price_npr, await paidTotal(env, s.id));
      outstanding += b.balance_npr;
    }
    return json({
      date, cutoff_hour: cut,
      active_subscribers: subs.length,
      production: { total: veg + any, veg, any, paused },
      deliveries: { out: st.out, delivered: st.delivered, skipped: st.skipped, pending: Math.max(0, veg + any - st.out - st.delivered - st.skipped) },
      per_route: perRoute,
      collected_this_month_npr: Number(collected?.n || 0),
      outstanding_npr: outstanding,
    });
  }
  if (path === '/api/kitchen/subscribers' && m === 'GET') {
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const status = url.searchParams.get('status') === 'cancelled' ? 'cancelled' : 'active';
    const rows = await subsWhere(env, 's.status = ?', status);
    const out = [];
    for (const s of rows) {
      if (q && !(s.customer_name.toLowerCase().includes(q) || s.customer_email.toLowerCase().includes(q) || s.address.toLowerCase().includes(q))) continue;
      out.push({ ...subJson(s), delivered: await deliveredCount(env, s.id) });
    }
    return json({ subscribers: out });
  }
  const sm = path.match(/^\/api\/kitchen\/subscribers\/(\d+)$/);
  if (sm && m === 'GET') {
    const s = (await subsWhere(env, 's.id = ?', Number(sm[1])))[0];
    if (!s) fail(404, 'not_found');
    const cut = await cutoffHour(env);
    const pm = await pausesFor(env, [s.id], L.addDays(today, -7), L.addDays(today, L.HORIZON_DAYS));
    const paus = pm.get(s.id) || new Set<string>();
    const payments = await all<any>(env, 'SELECT id, amount_npr, method, note, received_on FROM payments WHERE subscription_id = ? ORDER BY received_on DESC, id DESC', s.id);
    const recent = await all<any>(env, 'SELECT date, status FROM deliveries WHERE subscription_id = ? ORDER BY date DESC LIMIT 14', s.id);
    const delivered = await deliveredCount(env, s.id);
    const paid = await paidTotal(env, s.id);
    return json({
      subscription: subJson(s), billing: L.billing(delivered, s.price_npr, paid), payments, recent_deliveries: recent,
      upcoming_pauses: [...paus].filter((d) => d >= today).sort(), cutoff_hour: cut,
      schedule: L.scheduleWindow(subLogic(s), paus, today, now, cut).slice(0, 7),
    });
  }
  if (sm && m === 'PATCH') {
    const s = (await subsWhere(env, 's.id = ?', Number(sm[1])))[0];
    if (!s) fail(404, 'not_found');
    const b = await body(req);
    if (b.route_id !== undefined) {
      const rid = Number(b.route_id);
      if (!(await one(env, 'SELECT id FROM routes WHERE id = ?', rid))) fail(422, 'route_invalid');
      await run(env, 'UPDATE subscriptions SET route_id = ?, stop_order = (SELECT COALESCE(MAX(stop_order),0)+1 FROM subscriptions WHERE route_id = ?), updated_at = ? WHERE id = ?', rid, rid, now, s.id);
    }
    if (b.status !== undefined) {
      if (b.status !== 'active' && b.status !== 'cancelled') fail(422, 'status_invalid');
      await run(env, 'UPDATE subscriptions SET status = ?, updated_at = ? WHERE id = ?', b.status, now, s.id);
    }
    return json({ ok: true });
  }
  if (path === '/api/kitchen/routes' && m === 'GET') {
    const date = url.searchParams.get('date') || today;
    if (!L.isIsoDate(date)) fail(422, 'date_invalid');
    const routes = await routesList(env);
    const subs = await subsWhere(env, "s.status = 'active' AND s.route_id IS NOT NULL");
    const pm = await pausesFor(env, subs.map((s) => s.id), date, date);
    const sts = await all<{ subscription_id: number; status: string }>(env, 'SELECT subscription_id, status FROM deliveries WHERE date = ?', date);
    const sMap = new Map(sts.map((r) => [r.subscription_id, r.status]));
    const groups = routes.map((r) => ({
      route: r,
      stops: subs
        .filter((s) => s.route_id === r.id && L.isDeliveryDay(subLogic(s), pm.get(s.id) || new Set(), date))
        .sort(L.stopOrderSorter)
        .map((s) => ({ subscription_id: s.id, stop_order: s.stop_order, customer_name: s.customer_name, address: s.address, phone: s.phone, diet: s.diet, plan_name: s.plan_name, status: sMap.get(s.id) || 'pending' })),
    }));
    return json({ date, groups });
  }
  const rm = path.match(/^\/api\/kitchen\/routes\/(\d+)\/order$/);
  if (rm && m === 'POST') {
    const b = await body(req);
    const ids: unknown[] = Array.isArray(b.subscription_ids) ? b.subscription_ids : [];
    if (!ids.length || ids.length > 200) fail(422, 'ids_invalid');
    const rid = Number(rm[1]);
    for (let i = 0; i < ids.length; i++) {
      await run(env, 'UPDATE subscriptions SET stop_order = ? WHERE id = ? AND route_id = ?', i + 1, Number(ids[i]), rid);
    }
    return json({ ok: true });
  }
  if (path === '/api/kitchen/deliveries' && m === 'POST') {
    const b = await body(req);
    const s = (await subsWhere(env, 's.id = ?', Number(b.subscription_id)))[0];
    if (!s) fail(404, 'not_found');
    if (!L.isIsoDate(b.date)) fail(422, 'date_invalid');
    const pm = await pausesFor(env, [s.id], b.date, b.date);
    if (!L.isDeliveryDay(subLogic(s), pm.get(s.id) || new Set(), b.date)) fail(422, 'not_a_delivery_day');
    if (b.status === 'pending') {
      await run(env, 'DELETE FROM deliveries WHERE subscription_id = ? AND date = ?', s.id, b.date);
    } else {
      const st = L.normalizeStatus(b.status);
      if (!st || st === 'pending') fail(422, 'status_invalid');
      await run(env, 'INSERT OR REPLACE INTO deliveries (subscription_id, date, status, updated_at) VALUES (?,?,?,?)', s.id, b.date, st, now);
    }
    return json({ ok: true });
  }
  if (path === '/api/kitchen/payments' && m === 'POST') {
    const b = await body(req);
    const s = (await subsWhere(env, 's.id = ?', Number(b.subscription_id)))[0];
    if (!s) fail(404, 'not_found');
    if (!L.validAmount(b.amount_npr)) fail(422, 'amount_invalid');
    if (b.method !== 'cash' && b.method !== 'bank') fail(422, 'method_invalid');
    const received = b.received_on === undefined ? today : b.received_on;
    if (!L.isIsoDate(received) || received > today) fail(422, 'date_invalid');
    const note = clean(b.note, 120);
    await run(env, 'INSERT INTO payments (subscription_id, amount_npr, method, note, received_on, created_at) VALUES (?,?,?,?,?,?)', s.id, b.amount_npr, b.method, note, received, now);
    return json({ ok: true, balance_npr: L.billing(await deliveredCount(env, s.id), s.price_npr, await paidTotal(env, s.id)).balance_npr });
  }
  return fail(404, 'not_found');
}

// ---------- entry ----------
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) {
      try {
        await ensureReady(env);
        return await handleApi(req, env, url);
      } catch (e) {
        if (e instanceof HttpError) return json({ error: e.code, ...e.extra }, e.status);
        console.error('api error', e);
        return json({ error: 'server_error' }, 500);
      }
    }
    // Static assets come from the ASSETS binding; paths without an extension get the app shell.
    const hasExt = /\.[a-zA-Z0-9]+$/.test(url.pathname);
    const target = hasExt ? req : new Request(new URL('/app-shell.html', url), req);
    const res = await env.ASSETS.fetch(target);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
    if (!hasExt) headers.set('Cache-Control', 'no-cache');
    return new Response(res.body, { status: res.status, headers });
  },
};
