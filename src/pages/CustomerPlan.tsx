import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { get, put, post, del, ApiError } from '../lib/api.ts';
import { msg } from '../lib/messages.ts';
import { addDays, npr, shortDate, PLAN_MASK_LABEL, weekdayName, weekdayShort } from '../lib/format.ts';
import { Field, Loading, Notice, Pill, Skeleton, Stat } from '../components/ui.tsx';
import { Mark } from '../components/Mark.tsx';

interface Plan { id: string; name: string; name_ne: string; days: string; price_npr: number; blurb: string }
interface Route { id: number; name: string; area: string }
interface Day { date: string; weekday: number; delivers: boolean; paused: boolean; locked: boolean; pausable: boolean; status: string | null }
interface Sub { id: number; plan_id: string; plan_name: string; plan_days: string; price_npr: number; diet: 'veg' | 'any'; route_id: number; route_name: string | null; address: string; phone: string; start_date: string; status: string }
interface Summary { subscription: Sub | null; schedule: Day[]; billing: { delivered: number; billed_npr: number; paid_npr: number; balance_npr: number } | null; routes: Route[]; pause_cutoff_hour: number; today: string }
interface MenuDay { weekday: number; items: { slot: string; name: string; name_ne: string; diet: string }[] }

export default function CustomerPlan() {
  const [data, setData] = useState<Summary | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [menu, setMenu] = useState<MenuDay[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [s, p, m] = await Promise.all([get<Summary>('/api/me/subscription'), get<{ plans: Plan[] }>('/api/plans'), get<{ days: MenuDay[] }>('/api/menu')]);
      setData(s);
      setPlans(p.plans);
      setMenu(m.days);
    } catch (e) {
      setError(msg(e instanceof ApiError ? e.code : 'request_failed'));
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (error) return <Notice kind="bad">{error} <button className="btn btn-quiet" onClick={load}>Try again</button></Notice>;
  if (!data) return <div aria-busy="true"><Skeleton kind="lines" /><Skeleton /><Skeleton kind="rows" /></div>;

  const sub = data.subscription;
  if (!sub || sub.status !== 'active' || editing) {
    return (
      <SubscribeForm
        plans={plans}
        routes={data.routes}
        existing={sub && sub.status === 'active' ? sub : null}
        today={data.today}
        onDone={() => {
          setEditing(false);
          load();
        }}
        onCancel={sub && sub.status === 'active' ? () => setEditing(false) : undefined}
      />
    );
  }
  return (
    <div className="fade-in">
      <div className="grid-3" style={{ marginBottom: 26 }}>
        <Stat k="Plan" v={<span style={{ fontSize: '1.4rem' }}>{sub.plan_name}</span>} meta={PLAN_MASK_LABEL(sub.plan_days)} />
        <Stat k="Meals delivered" v={<span className="num">{data.billing?.delivered ?? 0}</span>} meta="Since your start date" />
        <Stat k="Balance" v={<span className="num">{npr(data.billing?.balance_npr ?? 0)}</span>} meta={(data.billing?.balance_npr ?? 0) > 0 ? 'Owed to the kitchen' : 'Nothing owed'} />
      </div>

      <section className="panel" aria-labelledby="sub-h">
        <div className="panel-head">
          <h2 id="sub-h" style={{ fontSize: '1.25rem' }}>Your details</h2>
          <button className="btn btn-line btn-sm" onClick={() => setEditing(true)}>Edit details</button>
        </div>
        <dl className="kv">
          <dt>Diet</dt><dd>{sub.diet === 'veg' ? 'Vegetarian only' : 'Veg and non-veg'}</dd>
          <dt>Route</dt><dd>{sub.route_name || 'No route yet'}</dd>
          <dt>Address</dt><dd>{sub.address}</dd>
          <dt>Price</dt><dd className="num">{npr(sub.price_npr)} per tiffin</dd>
          <dt>Starts</dt><dd>{shortDate(sub.start_date)}</dd>
        </dl>
      </section>

      <Calendar sub={sub} schedule={data.schedule} menu={menu} onChanged={load} today={data.today} />
    </div>
  );
}

function SubscribeForm({
  plans, routes, existing, today, onDone, onCancel,
}: { plans: Plan[]; routes: Route[]; existing: Sub | null; today: string; onDone: () => void; onCancel?: () => void }) {
  const tomorrow = addDays(today, 1);
  const maxStart = addDays(today, 30);
  const [planId, setPlanId] = useState(existing?.plan_id || 'office-week');
  const [diet, setDiet] = useState<'veg' | 'any'>(existing?.diet || 'veg');
  const [routeId, setRouteId] = useState<string>(String(existing?.route_id || routes[0]?.id || ''));
  const [address, setAddress] = useState(existing?.address || '');
  const [phone, setPhone] = useState(existing?.phone || '');
  const [start, setStart] = useState(tomorrow);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (address.trim().length < 5) errs.address = msg('address_too_short');
    if (!routeId) errs.route = msg('route_invalid');
    if (!existing && (start < tomorrow || start > maxStart)) errs.start = start < tomorrow ? msg('start_must_be_future') : msg('start_too_far');
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setFormError(null);
    try {
      await put('/api/me/subscription', { plan_id: planId, diet, route_id: Number(routeId), address: address.trim(), phone: phone.trim(), start_date: existing ? existing.start_date : start });
      setDone(existing ? 'Your details are saved.' : 'Your plan is set. Your first tiffin is on ' + shortDate(start) + '.');
      window.setTimeout(onDone, 900);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'request_failed';
      if (code === 'address_too_short' || code === 'phone_invalid' || code === 'route_invalid' || code === 'start_must_be_future' || code === 'start_too_far') setErrors({ [code.startsWith('address') ? 'address' : code.startsWith('phone') ? 'phone' : code.startsWith('route') ? 'route' : 'start']: msg(code) });
      else setFormError(msg(code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid-2 fade-in" style={{ alignItems: 'start' }}>
      <form onSubmit={submit} noValidate className="panel" aria-labelledby="form-h">
        <h2 id="form-h" style={{ fontSize: '1.4rem', marginBottom: 6 }}>{existing ? 'Edit your details' : 'Start your plan'}</h2>
        <p className="muted small" style={{ marginBottom: 20 }}>{existing ? 'Changes apply from the next day that is not yet cooked.' : 'You can pause any day later, up to the cut-off the evening before.'}</p>

        <fieldset style={{ border: 0, padding: 0, margin: '0 0 18px' }}>
          <legend className="label" style={{ marginBottom: 8 }}>Plan</legend>
          <div className="plans" style={{ borderTopWidth: 1 }}>
            {plans.map((p) => (
              <label key={p.id} className="plan-row" style={{ gridTemplateColumns: 'auto minmax(0,1fr) auto', cursor: 'pointer', padding: '14px 0' }}>
                <input type="radio" name="plan" value={p.id} checked={planId === p.id} onChange={() => setPlanId(p.id)} />
                <span>
                  <strong>{p.name}</strong> <span className="muted small">{PLAN_MASK_LABEL(p.days)}</span>
                  <span className="small muted" style={{ display: 'block' }}>{p.blurb}</span>
                </span>
                <span className="num">{npr(p.price_npr)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset style={{ border: 0, padding: 0, margin: '0 0 18px' }}>
          <legend className="label" style={{ marginBottom: 8 }}>Diet</legend>
          <div className="segmented" role="group" aria-label="Diet">
            <button type="button" aria-pressed={diet === 'veg'} onClick={() => setDiet('veg')}>Vegetarian</button>
            <button type="button" aria-pressed={diet === 'any'} onClick={() => setDiet('any')}>Veg and non-veg</button>
          </div>
        </fieldset>

        <Field label="Delivery route" id="route" error={errors.route} hint="Routes are the demo areas. The kitchen orders stops within each route.">
          <select id="route" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
            {routes.map((r) => (
              <option key={r.id} value={r.id}>{r.name}: {r.area}</option>
            ))}
          </select>
        </Field>

        <Field label="Delivery address" id="address" error={errors.address} hint="Building, floor and a landmark help the rider.">
          <textarea id="address" value={address} onChange={(e) => setAddress(e.target.value)} maxLength={200} />
        </Field>

        <Field label="Phone (optional)" id="phone" error={errors.phone} hint="Only the kitchen sees this, for the rider.">
          <input id="phone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={16} />
        </Field>

        {!existing && (
          <Field label="First delivery day" id="start" error={errors.start} hint={`Any day from ${shortDate(tomorrow)} up to ${shortDate(maxStart)}.`}>
            <input id="start" type="date" min={tomorrow} max={maxStart} value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
        )}

        {formError && <div style={{ marginBottom: 14 }}><Notice kind="bad">{formError}</Notice></div>}
        {done && <div style={{ marginBottom: 14 }}><Notice kind="good">{done}</Notice></div>}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-primary" type="submit" disabled={busy || !!done}>
            {busy ? <Loading label="Saving" /> : existing ? 'Save details' : 'Start my plan'}
          </button>
          {onCancel && <button className="btn btn-line" type="button" onClick={onCancel}>Back</button>}
        </div>
        <p className="small muted" style={{ marginTop: 16 }}>Pay cash on delivery or by bank transfer. No card is taken online.</p>
      </form>
      <aside className="panel" aria-label="Summary">
        <div className="eyebrow">Summary</div>
        <h3 style={{ marginTop: 6 }}>{plans.find((p) => p.id === planId)?.name}</h3>
        <p className="muted" style={{ marginTop: 6 }}>{PLAN_MASK_LABEL(plans.find((p) => p.id === planId)?.days || '0000000')}</p>
        <dl className="kv" style={{ marginTop: 18 }}>
          <dt>Per tiffin</dt><dd className="num">{npr(plans.find((p) => p.id === planId)?.price_npr || 0)}</dd>
          <dt>Diet</dt><dd>{diet === 'veg' ? 'Vegetarian' : 'Veg and non-veg'}</dd>
          <dt>Route</dt><dd>{routes.find((r) => String(r.id) === routeId)?.name || '-'}</dd>
        </dl>
        <p className="small muted" style={{ marginTop: 18 }}>Prices are the demo kitchen's and are invented.</p>
      </aside>
    </div>
  );
}

function Calendar({ sub, schedule, menu, onChanged, today }: { sub: Sub; schedule: Day[]; menu: MenuDay[]; onChanged: () => void; today: string }) {
  const [busyDate, setBusyDate] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [from, setFrom] = useState(addDays(today, 2));
  const [to, setTo] = useState(addDays(today, 4));
  const [rangeNote, setRangeNote] = useState<string | null>(null);
  const first = schedule[0]?.date;
  const minFrom = useMemo(() => addDays(today, 1), [today]);

  const toggle = async (d: Day) => {
    setBusyDate(d.date);
    setErr(null);
    try {
      if (d.paused) await del('/api/me/pauses', { dates: [d.date] });
      else await post('/api/me/pauses', { dates: [d.date] });
      onChanged();
    } catch (e) {
      setErr(msg(e instanceof ApiError ? e.code : 'request_failed'));
    } finally {
      setBusyDate(null);
    }
  };

  const pauseRange = async () => {
    setErr(null);
    setRangeNote(null);
    if (from > to) return setErr('The end date is before the start date.');
    const dates: string[] = [];
    for (let d = from; d <= to && dates.length <= 31; d = addDays(d, 1)) {
      const row = schedule.find((s) => s.date === d);
      if (row && row.delivers && row.pausable && !row.paused) dates.push(d);
    }
    if (!dates.length) return setErr('No tiffins in that range can be paused. Check the days, or the cut-off.');
    if (dates.length > 31) return setErr('Pick up to 31 days at a time.');
    setBusyDate('range');
    try {
      await post('/api/me/pauses', { dates });
      setRangeNote(`Paused ${dates.length} ${dates.length === 1 ? 'day' : 'days'}.`);
      onChanged();
    } catch (e) {
      setErr(msg(e instanceof ApiError ? e.code : 'request_failed'));
    } finally {
      setBusyDate(null);
    }
  };

  const cancel = async () => {
    setBusyDate('cancel');
    try {
      await post('/api/me/subscription/cancel', {});
      onChanged();
    } catch (e) {
      setErr(msg(e instanceof ApiError ? e.code : 'request_failed'));
      setBusyDate(null);
    }
  };
  const [confirmCancel, setConfirmCancel] = useState(false);

  return (
    <section className="panel" aria-labelledby="cal-h" style={{ marginTop: 16 }}>
      <div className="panel-head">
        <div>
          <h2 id="cal-h" style={{ fontSize: '1.25rem' }}>The next three weeks</h2>
          <p className="small muted" style={{ marginTop: 4 }}>Pause a day up to the cut-off the evening before. Days already cooked cannot be paused.</p>
        </div>
      </div>
      {err && <div style={{ marginBottom: 12 }}><Notice kind="bad">{err}</Notice></div>}
      <div className="day-list" role="list" aria-label="Upcoming days">
        {schedule.map((d) => {
          const m = menu.find((x) => x.weekday === d.weekday)?.items.find((i) => i.slot === 'main');
          const isToday = d.date === today;
          const cls = `day ${isToday ? 'today' : ''} ${!d.delivers ? 'off' : ''}`;
          let state: React.ReactNode;
          if (!d.delivers) state = <span className="muted small">No tiffin on {weekdayName(d.weekday)}s in this plan</span>;
          else if (d.paused) state = <Pill kind="paused">Paused</Pill>;
          else if (d.status === 'delivered') state = <Pill kind="delivered">Delivered</Pill>;
          else if (d.status === 'out') state = <Pill kind="out">On the way</Pill>;
          else if (d.status === 'skipped') state = <Pill kind="skipped">Not delivered</Pill>;
          else state = <Pill kind="pending">Scheduled</Pill>;
          return (
            <div className={cls} role="listitem" key={d.date}>
              <div className="dt">
                {isToday ? 'Today' : weekdayShort(d.weekday)} <span className="num">{shortDate(d.date).split(' ').slice(1).join(' ')}</span>
              </div>
              <div style={{ display: 'grid', gap: 4 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {state}
                  {d.delivers && m && (
                    <span className="small" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                      <Mark kind={m.diet} /> {m.name}
                    </span>
                  )}
                </div>
              </div>
              {d.delivers && (
                <div>
                  {d.pausable ? (
                    <button className="btn btn-line btn-sm" onClick={() => toggle(d)} disabled={busyDate !== null} aria-label={`${d.paused ? 'Resume' : 'Pause'} ${shortDate(d.date)}`}>
                      {busyDate === d.date ? <Loading label="Saving" /> : d.paused ? 'Resume' : 'Pause'}
                    </button>
                  ) : (
                    <span className="pill locked" title="Pauses for this day have closed">Locked</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 26 }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: 10 }}>Pause a run of days</h3>
        <div className="toolbar">
          <label className="small" htmlFor="pf">From</label>
          <input id="pf" type="date" min={minFrom} value={from} max={first ? addDays(first, 40) : undefined} onChange={(e) => setFrom(e.target.value)} style={{ maxWidth: 180 }} />
          <label className="small" htmlFor="pt">To</label>
          <input id="pt" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} style={{ maxWidth: 180 }} />
          <button className="btn btn-primary btn-sm" onClick={pauseRange} disabled={busyDate !== null}>Pause these days</button>
        </div>
        {rangeNote && <Notice kind="good">{rangeNote}</Notice>}
      </div>

      <div style={{ marginTop: 28, paddingTop: 18, borderTop: '1px solid var(--line)' }}>
        {!confirmCancel ? (
          <button className="btn btn-danger btn-sm" onClick={() => setConfirmCancel(true)}>Cancel my subscription</button>
        ) : (
          <div className="notice bad" role="alert">
            <p>Cancelling stops every tiffin from now on, including today if it is not yet delivered.</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-danger btn-sm" onClick={cancel} disabled={busyDate !== null}>Yes, cancel</button>
              <button className="btn btn-line btn-sm" onClick={() => setConfirmCancel(false)}>Keep it</button>
            </div>
          </div>
        )}
      </div>
      <span className="sr-only">Plan starts {sub.start_date}</span>
    </section>
  );
}
