import React, { useCallback, useEffect, useState } from 'react';
import { get, patch, post, ApiError } from '../lib/api.ts';
import { msg } from '../lib/messages.ts';
import { npr, shortDate, todayNpt, PLAN_MASK_LABEL, weekdayShort } from '../lib/format.ts';
import { Link, navigate, match, usePath } from '../lib/router.tsx';
import { Field, Loading, Notice, Pill, Segmented, Skeleton, Stat } from '../components/ui.tsx';
import { Mark } from '../components/Mark.tsx';

interface Sub {
  id: number; plan_id: string; plan_name: string; plan_days: string; price_npr: number; diet: 'veg' | 'any';
  route_id: number | null; route_name: string | null; stop_order: number; address: string; phone: string;
  start_date: string; status: string; customer_name: string; customer_email: string; delivered?: number;
}
interface Route { id: number; name: string; area: string }

export function KitchenSubscribers() {
  const [rows, setRows] = useState<Sub[] | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'active' | 'cancelled'>('active');
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    setErr(null);
    try {
      const [s, r] = await Promise.all([get(`/api/kitchen/subscribers?status=${status}`), get<{ routes: Route[] }>('/api/plans')]);
      setRows(s.subscribers);
      setRoutes(r.routes);
    } catch (e) {
      setErr(msg(e instanceof ApiError ? e.code : 'request_failed'));
    }
  }, [status]);
  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  const changeRoute = async (id: number, routeId: number) => {
    try {
      await patch(`/api/kitchen/subscribers/${id}`, { route_id: routeId });
      load();
    } catch (e) {
      setErr(msg(e instanceof ApiError ? e.code : 'request_failed'));
    }
  };

  const filtered = (rows || []).filter((r) => {
    const t = q.trim().toLowerCase();
    return !t || r.customer_name.toLowerCase().includes(t) || r.customer_email.toLowerCase().includes(t) || r.address.toLowerCase().includes(t);
  });

  return (
    <div className="fade-in">
      <div className="toolbar">
        <label className="sr-only" htmlFor="q">Search subscribers</label>
        <input id="q" type="text" placeholder="Search name, email or address" value={q} onChange={(e) => setQ(e.target.value)} />
        <Segmented label="Status" value={status} onChange={setStatus} options={[{ value: 'active', label: 'Active' }, { value: 'cancelled', label: 'Cancelled' }]} />
        <span className="grow" />
        <span className="small muted num">{rows ? `${filtered.length} shown` : ''}</span>
      </div>
      {err && <div style={{ marginBottom: 14 }}><Notice kind="bad">{err}</Notice></div>}
      {!rows && !err && <Skeleton kind="rows" />}
      {rows && filtered.length === 0 && <p className="empty">No subscribers match that search.</p>}
      {rows && filtered.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Customer</th>
                <th scope="col">Plan</th>
                <th scope="col">Diet</th>
                <th scope="col">Route</th>
                <th scope="col" className="num">Delivered</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="click" onClick={() => navigate(`/kitchen/subscribers/${s.id}`)}>
                  <td>
                    <Link to={`/kitchen/subscribers/${s.id}`} style={{ fontWeight: 700, color: 'var(--ink)', textDecoration: 'none' }} onClick={(e) => e.stopPropagation()}>{s.customer_name}</Link>
                    <div className="small muted">{s.address}</div>
                  </td>
                  <td>{s.plan_name}<div className="small muted">{PLAN_MASK_LABEL(s.plan_days)}</div></td>
                  <td><span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Mark kind={s.diet} />{s.diet === 'veg' ? 'Veg' : 'Any'}</span></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <label className="sr-only" htmlFor={`r${s.id}`}>Route for {s.customer_name}</label>
                    <select id={`r${s.id}`} value={s.route_id ?? ''} onChange={(e) => changeRoute(s.id, Number(e.target.value))} style={{ minHeight: 36, width: 'auto' }}>
                      {!s.route_id && <option value="">No route</option>}
                      {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </td>
                  <td className="num">{s.delivered ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function KitchenSubscriber() {
  const path = usePath();
  const params = match('/kitchen/subscribers/:id', path);
  const id = params?.id;
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'bank'>('cash');
  const [note, setNote] = useState('');
  const [received, setReceived] = useState(todayNpt());
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      setData(await get(`/api/kitchen/subscribers/${id}`));
    } catch (e) {
      setErr(msg(e instanceof ApiError ? e.code : 'request_failed'));
    }
  }, [id]);
  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrs({});
    setOk(null);
    const n = Number(amount);
    if (!amount || !Number.isInteger(n) || n < 1 || n > 500000) return setErrs({ amount: msg('amount_invalid') });
    if (received > todayNpt()) return setErrs({ received: msg('date_invalid') });
    setBusy(true);
    try {
      const r = await post('/api/kitchen/payments', { subscription_id: Number(id), amount_npr: n, method, note: note.trim(), received_on: received });
      setOk(`Recorded. Balance now ${npr(r.balance_npr)}.`);
      setAmount('');
      setNote('');
      load();
    } catch (er) {
      setErr(msg(er instanceof ApiError ? er.code : 'request_failed'));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = async (status: 'active' | 'cancelled') => {
    try {
      await patch(`/api/kitchen/subscribers/${id}`, { status });
      load();
    } catch (er) {
      setErr(msg(er instanceof ApiError ? er.code : 'request_failed'));
    }
  };

  if (err && !data) return <Notice kind="bad">{err}</Notice>;
  if (!data) return <div aria-busy="true"><Skeleton kind="lines" /><Skeleton /></div>;
  const s: Sub = data.subscription;
  return (
    <div className="fade-in">
      <p className="small" style={{ marginBottom: 14 }}><Link to="/kitchen/subscribers">All subscribers</Link></p>
      {err && <div style={{ marginBottom: 14 }}><Notice kind="bad">{err}</Notice></div>}
      <div className="grid-3" style={{ marginBottom: 22 }}>
        <Stat k="Tiffins delivered" v={<span className="num">{data.billing.delivered}</span>} />
        <Stat k="Paid" v={<span className="num" style={{ fontSize: '1.5rem' }}>{npr(data.billing.paid_npr)}</span>} />
        <Stat k="Balance" v={<span className="num" style={{ fontSize: '1.5rem' }}>{npr(data.billing.balance_npr)}</span>} meta={`${data.billing.delivered} × ${npr(s.price_npr)}`} />
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="panel" aria-labelledby="who-h">
          <div className="panel-head">
            <h2 id="who-h" style={{ fontSize: '1.25rem' }}>{s.customer_name}</h2>
            <Pill kind={s.status}>{s.status}</Pill>
          </div>
          <dl className="kv">
            <dt>Email</dt><dd>{s.customer_email}</dd>
            <dt>Phone</dt><dd>{s.phone ? <a href={`tel:${s.phone.replace(/\s+/g, '')}`}>{s.phone}</a> : <span className="muted">Not given</span>}</dd>
            <dt>Address</dt><dd>{s.address}</dd>
            <dt>Plan</dt><dd>{s.plan_name} · {PLAN_MASK_LABEL(s.plan_days)}</dd>
            <dt>Diet</dt><dd>{s.diet === 'veg' ? 'Vegetarian' : 'Veg and non-veg'}</dd>
            <dt>Route</dt><dd>{s.route_name || 'No route'}</dd>
            <dt>Started</dt><dd>{shortDate(s.start_date)}</dd>
          </dl>
          <div style={{ marginTop: 18 }}>
            {s.status === 'active' ? (
              <button className="btn btn-danger btn-sm" onClick={() => setStatus('cancelled')}>Stop this subscription</button>
            ) : (
              <button className="btn btn-line btn-sm" onClick={() => setStatus('active')}>Restart this subscription</button>
            )}
          </div>
          <h3 style={{ fontSize: '1.05rem', margin: '26px 0 10px' }}>Next seven days</h3>
          <div className="day-list" role="list">
            {data.schedule.map((d: any) => (
              <div className="day" role="listitem" key={d.date} style={{ gridTemplateColumns: '90px minmax(0,1fr)' }}>
                <div className="dt">{weekdayShort(d.weekday)} <span className="num">{shortDate(d.date).split(' ').slice(1).join(' ')}</span></div>
                <div>
                  {!d.delivers ? <span className="muted small">Not on this plan</span> : d.paused ? <Pill kind="paused">Paused</Pill> : <Pill kind="pending">Scheduled</Pill>}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div>
          <section className="panel" aria-labelledby="pay-h">
            <h2 id="pay-h" style={{ fontSize: '1.25rem', marginBottom: 12 }}>Record a payment</h2>
            {ok && <div style={{ marginBottom: 12 }}><Notice kind="good">{ok}</Notice></div>}
            <form onSubmit={recordPayment} noValidate>
              <Field label="Amount (NPR)" id="amt" error={errs.amount} hint="Whole rupees only.">
                <input id="amt" type="number" inputMode="numeric" min={1} max={500000} step={1} value={amount} onChange={(e) => setAmount(e.target.value)} />
              </Field>
              <div className="field">
                <span className="label">How it was paid</span>
                <Segmented label="Payment method" value={method} onChange={setMethod} options={[{ value: 'cash', label: 'Cash' }, { value: 'bank', label: 'Bank transfer' }]} />
              </div>
              <Field label="Received on" id="rcv" error={errs.received}>
                <input id="rcv" type="date" max={todayNpt()} value={received} onChange={(e) => setReceived(e.target.value)} />
              </Field>
              <Field label="Note (optional)" id="note">
                <input id="note" type="text" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
              <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? <Loading label="Recording" /> : 'Record payment'}</button>
            </form>
          </section>
          <section className="panel" aria-labelledby="hist-h">
            <h2 id="hist-h" style={{ fontSize: '1.25rem', marginBottom: 12 }}>Payments</h2>
            {data.payments.length === 0 ? (
              <p className="muted">No payments yet.</p>
            ) : (
              <ul className="rows">
                {data.payments.map((p: any) => (
                  <li key={p.id} style={{ gridTemplateColumns: '1fr auto' }}>
                    <div>
                      <div className="row-main num">{npr(p.amount_npr)}</div>
                      <div className="small muted">{shortDate(p.received_on)} · {p.method === 'bank' ? 'Bank transfer' : 'Cash'}{p.note ? ` · ${p.note}` : ''}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
