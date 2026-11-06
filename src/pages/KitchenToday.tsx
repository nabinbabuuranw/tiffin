import { useCallback, useEffect, useState } from 'react';
import { get, ApiError } from '../lib/api.ts';
import { msg } from '../lib/messages.ts';
import { addDays, longDate, npr, num, todayNpt } from '../lib/format.ts';
import { Link } from '../lib/router.tsx';
import { Notice, Skeleton, Stat } from '../components/ui.tsx';

interface Overview {
  date: string; cutoff_hour: number; active_subscribers: number;
  production: { total: number; veg: number; any: number; paused: number };
  deliveries: { out: number; delivered: number; skipped: number; pending: number };
  per_route: Record<string, number>; collected_this_month_npr: number; outstanding_npr: number;
}

export default function KitchenToday() {
  const [date, setDate] = useState(todayNpt());
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    setErr(null);
    try {
      setData(await get<Overview>(`/api/kitchen/overview?date=${date}`));
    } catch (e) {
      setErr(msg(e instanceof ApiError ? e.code : 'request_failed'));
    }
  }, [date]);
  useEffect(() => {
    load();
  }, [load]);

  const isToday = date === todayNpt();
  const d = data?.deliveries;
  const total = data ? data.production.total : 0;
  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);

  return (
    <div className="fade-in">
      <div className="toolbar" role="group" aria-label="Choose the day">
        <button className="btn btn-line btn-sm" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">Previous</button>
        <strong className="num" style={{ minWidth: 220, textAlign: 'center' }}>{isToday ? 'Today, ' : ''}{longDate(date)}</strong>
        <button className="btn btn-line btn-sm" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">Next</button>
        {!isToday && <button className="btn btn-quiet" onClick={() => setDate(todayNpt())}>Back to today</button>}
        <span className="grow" />
        <Link to={`/kitchen/routes?date=${date}`} className="btn btn-primary btn-sm">Open the route sheet</Link>
      </div>

      {err && <Notice kind="bad">{err} <button className="btn btn-quiet" onClick={load}>Try again</button></Notice>}
      {!data && !err && (
        <div aria-busy="true" className="grid-3">
          <Skeleton /><Skeleton /><Skeleton />
        </div>
      )}

      {data && (
        <>
          <div className="grid-3" style={{ marginBottom: 26 }}>
            <section className="panel" aria-labelledby="cook-h" style={{ gridColumn: 'span 2' }}>
              <h2 id="cook-h" className="eyebrow" style={{ marginBottom: 6 }}>To cook</h2>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'var(--display)', fontSize: '3.4rem', lineHeight: 1 }} className="num">{data.production.total}</span>
                <span className="muted">tiffins: {data.production.veg} vegetarian, {data.production.any} veg and non-veg</span>
              </div>
              <div className="bar" role="img" aria-label={`Delivered ${d?.delivered ?? 0}, on the way ${d?.out ?? 0}, skipped ${d?.skipped ?? 0}, still pending ${d?.pending ?? 0}`}>
                <span style={{ width: `${pct(d?.delivered ?? 0)}%`, background: 'var(--teal)' }} />
                <span style={{ width: `${pct(d?.out ?? 0)}%`, background: 'var(--ember)' }} />
                <span style={{ width: `${pct(d?.skipped ?? 0)}%`, background: 'var(--line-strong)' }} />
              </div>
              <div className="legend">
                <span><i style={{ background: 'var(--teal)' }} />Delivered {d?.delivered ?? 0}</span>
                <span><i style={{ background: 'var(--ember)' }} />On the way {d?.out ?? 0}</span>
                <span><i style={{ background: 'var(--line-strong)' }} />Skipped {d?.skipped ?? 0}</span>
                <span><i style={{ background: 'var(--sunk)', border: '1px solid var(--line-strong)' }} />Pending {d?.pending ?? 0}</span>
              </div>
              <p className="small muted" style={{ marginTop: 14 }}>
                {data.production.paused} {data.production.paused === 1 ? 'customer is' : 'customers are'} paused for this day. Pauses close at {String(data.cutoff_hour).padStart(2, '0')}:00 the evening before.
              </p>
            </section>
            <section className="panel" aria-labelledby="subs-h">
              <h2 id="subs-h" className="eyebrow" style={{ marginBottom: 12 }}>Subscribers</h2>
              <Stat k="Active subscriptions" v={<span className="num">{data.active_subscribers}</span>} />
              <div style={{ height: 18 }} />
              <Stat k="Collected this month" v={<span className="num" style={{ fontSize: '1.5rem' }}>{npr(data.collected_this_month_npr)}</span>} />
              <div style={{ height: 18 }} />
              <Stat k="Owed to the kitchen" v={<span className="num" style={{ fontSize: '1.5rem' }}>{npr(data.outstanding_npr)}</span>} meta="Across all active plans" />
            </section>
          </div>

          <section className="panel" aria-labelledby="routes-h">
            <div className="panel-head">
              <h2 id="routes-h" style={{ fontSize: '1.25rem' }}>Stops by route</h2>
              <Link to={`/kitchen/routes?date=${date}`} className="small">All stops</Link>
            </div>
            {Object.keys(data.per_route).length === 0 ? (
              <p className="muted">No tiffins are scheduled for this day.</p>
            ) : (
              <ul className="rows">
                {Object.entries(data.per_route).map(([name, n]) => (
                  <li key={name} style={{ gridTemplateColumns: '1fr auto' }}>
                    <span className="row-main">{name}</span>
                    <span className="num">{num(n)} {n === 1 ? 'stop' : 'stops'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
