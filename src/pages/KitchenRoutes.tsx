import { useCallback, useEffect, useState } from 'react';
import { get, post, ApiError } from '../lib/api.ts';
import { msg } from '../lib/messages.ts';
import { addDays, longDate, todayNpt } from '../lib/format.ts';
import { Link, navigate, usePath } from '../lib/router.tsx';
import { Loading, Notice, Pill, Skeleton } from '../components/ui.tsx';
import { Mark } from '../components/Mark.tsx';

type Status = 'pending' | 'out' | 'delivered' | 'skipped';
interface Stop { subscription_id: number; stop_order: number; customer_name: string; address: string; phone: string; diet: 'veg' | 'any'; plan_name: string; status: Status }
interface Group { route: { id: number; name: string; area: string }; stops: Stop[] }

const LABEL: Record<Status, string> = { pending: 'Pending', out: 'Out', delivered: 'Delivered', skipped: 'Skipped' };

export default function KitchenRoutes() {
  const path = usePath();
  const qs = new URLSearchParams(window.location.search);
  const date = qs.get('date') && /^\d{4}-\d{2}-\d{2}$/.test(qs.get('date')!) ? qs.get('date')! : todayNpt();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await get<{ groups: Group[] }>(`/api/kitchen/routes?date=${date}`);
      setGroups(r.groups);
    } catch (e) {
      setErr(msg(e instanceof ApiError ? e.code : 'request_failed'));
    }
  }, [date]);
  useEffect(() => {
    setGroups(null);
    load();
  }, [load, path]);

  const setDay = (d: string) => navigate(`/kitchen/routes?date=${d}`);
  const mark = async (s: Stop, status: Status) => {
    setBusy(s.subscription_id);
    try {
      await post('/api/kitchen/deliveries', { subscription_id: s.subscription_id, date, status: status === 'pending' ? 'pending' : status });
      await load();
    } catch (e) {
      setErr(msg(e instanceof ApiError ? e.code : 'request_failed'));
    } finally {
      setBusy(null);
    }
  };
  const move = async (g: Group, i: number, dir: -1 | 1) => {
    const ids = g.stops.map((s) => s.subscription_id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    try {
      await post(`/api/kitchen/routes/${g.route.id}/order`, { subscription_ids: ids });
      await load();
    } catch (e) {
      setErr(msg(e instanceof ApiError ? e.code : 'request_failed'));
    }
  };

  const total = groups?.reduce((n, g) => n + g.stops.length, 0) ?? 0;
  return (
    <div className="fade-in">
      <div className="toolbar">
        <button className="btn btn-line btn-sm" onClick={() => setDay(addDays(date, -1))}>Previous</button>
        <strong className="num">{longDate(date)}</strong>
        <button className="btn btn-line btn-sm" onClick={() => setDay(addDays(date, 1))}>Next</button>
        {date !== todayNpt() && <button className="btn btn-quiet" onClick={() => setDay(todayNpt())}>Today</button>}
        <span className="grow" />
        <button className="btn btn-line btn-sm" onClick={() => window.print()}>Print the sheet</button>
      </div>
      <p className="muted small" style={{ marginBottom: 18 }}>
        {groups ? `${total} ${total === 1 ? 'stop' : 'stops'} across ${groups.length} routes. Use the arrows to change the order of a route; the rider follows the top down.` : ''}
      </p>
      {err && <div style={{ marginBottom: 14 }}><Notice kind="bad">{err} <button className="btn btn-quiet" onClick={load}>Try again</button></Notice></div>}
      {!groups && !err && <Skeleton kind="rows" />}
      {groups?.map((g) => (
        <section key={g.route.id} className="panel" aria-labelledby={`g${g.route.id}`} style={{ marginBottom: 18 }}>
          <div className="panel-head">
            <div className="route-title">
              <h2 id={`g${g.route.id}`} style={{ fontSize: '1.3rem' }}>{g.route.name}</h2>
              <span className="small muted">{g.route.area}</span>
            </div>
            <span className="small num muted">{g.stops.length} {g.stops.length === 1 ? 'stop' : 'stops'}</span>
          </div>
          {g.stops.length === 0 && <p className="muted">No stops on this route for this day.</p>}
          {g.stops.map((s, i) => (
            <div key={s.subscription_id} className={`stop ${s.status === 'delivered' ? 'done' : ''} ${s.status === 'skipped' ? 'skip' : ''}`}>
              <div className="no">{i + 1}</div>
              <div style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Link to={`/kitchen/subscribers/${s.subscription_id}`} className="who" style={{ color: 'var(--ink)', textDecoration: 'none' }}>{s.customer_name}</Link>
                  <Mark kind={s.diet} />
                  <span className="small muted">{s.plan_name}</span>
                  <Pill kind={s.status}>{LABEL[s.status]}</Pill>
                </div>
                <div className="addr">{s.address}{s.phone ? <> · <a href={`tel:${s.phone.replace(/\s+/g, '')}`}>{s.phone}</a></> : null}</div>
                <div className="stop-actions" style={{ justifyContent: 'flex-start', marginTop: 6 }}>
                  {(['out', 'delivered', 'skipped'] as Status[]).map((st) => (
                    <button
                      key={st}
                      className={`btn btn-sm ${s.status === st ? 'btn-primary' : 'btn-line'}`}
                      aria-pressed={s.status === st}
                      disabled={busy === s.subscription_id}
                      onClick={() => mark(s, s.status === st ? 'pending' : st)}
                    >
                      {busy === s.subscription_id ? <Loading label="Saving" /> : LABEL[st]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="stop-move no-print">
                <button className="btn btn-line btn-sm" aria-label={`Move ${s.customer_name} up`} disabled={i === 0} onClick={() => move(g, i, -1)}>Up</button>
                <button className="btn btn-line btn-sm" aria-label={`Move ${s.customer_name} down`} disabled={i === g.stops.length - 1} onClick={() => move(g, i, 1)}>Down</button>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
