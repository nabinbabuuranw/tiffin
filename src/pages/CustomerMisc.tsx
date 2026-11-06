import { useEffect, useState } from 'react';
import { get, ApiError } from '../lib/api.ts';
import { msg } from '../lib/messages.ts';
import { npr, shortDate, todayNpt, weekdayName } from '../lib/format.ts';
import { Notice, Skeleton, Stat } from '../components/ui.tsx';
import { Mark } from '../components/Mark.tsx';
import { useSession } from '../lib/session.tsx';
import { navigate } from '../lib/router.tsx';

interface MenuDay { weekday: number; items: { slot: string; name: string; name_ne: string; diet: string }[] }

export function CustomerMenu() {
  const [days, setDays] = useState<MenuDay[] | null>(null);
  const [kitchen, setKitchen] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    get('/api/menu')
      .then((r) => {
        setDays(r.days);
        setKitchen(r.kitchen_name);
      })
      .catch((e) => setErr(msg(e instanceof ApiError ? e.code : 'request_failed')));
  }, []);
  const today = new Date(todayNpt() + 'T00:00:00Z').getUTCDay();
  if (err) return <Notice kind="bad">{err}</Notice>;
  if (!days) return <Skeleton kind="lines" />;
  return (
    <div className="fade-in">
      <p className="muted" style={{ marginBottom: 18 }}>{kitchen}. Dishes change weekly. Demo menu, invented dishes.</p>
      <div className="day-list" role="list">
        {days.map((d) => (
          <div key={d.weekday} role="listitem" className={`day ${d.weekday === today ? 'today' : ''}`} style={{ gridTemplateColumns: '130px minmax(0,1fr)' }}>
            <div className="dt">{weekdayName(d.weekday)}{d.weekday === today && <small>Today</small>}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {d.items.map((it, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '18px 1fr', gap: 10, alignItems: 'start' }}>
                  <Mark kind={it.diet} />
                  <div>
                    <span className="small muted" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.7rem' }}>{it.slot}</span>
                    <div>{it.name}</div>
                    {it.name_ne && <div className="small muted">{it.name_ne}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CustomerBilling() {
  const [data, setData] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    get('/api/me/billing')
      .then(setData)
      .catch((e) => setErr(msg(e instanceof ApiError ? e.code : 'request_failed')));
  }, []);
  if (err) return <Notice kind="bad">{err}</Notice>;
  if (!data) return <Skeleton />;
  if (!data.billing) return <p className="muted">You do not have a plan yet. <a href="/app" onClick={(e) => { e.preventDefault(); navigate('/app'); }}>Start one</a>.</p>;
  const b = data.billing;
  return (
    <div className="fade-in">
      <div className="grid-3" style={{ marginBottom: 26 }}>
        <Stat k="Tiffins delivered" v={<span className="num">{b.delivered}</span>} />
        <Stat k="Billed" v={<span className="num">{npr(b.billed_npr)}</span>} meta={`${b.delivered} × ${npr(data.price_npr)}`} />
        <Stat k={b.balance_npr > 0 ? 'Still to pay' : 'Balance'} v={<span className="num">{npr(Math.abs(b.balance_npr))}</span>} meta={b.balance_npr > 0 ? 'Cash or bank transfer to the kitchen' : b.balance_npr < 0 ? 'Credit with the kitchen' : 'All settled'} />
      </div>
      <section className="panel" aria-labelledby="pay-h">
        <h2 id="pay-h" style={{ fontSize: '1.25rem', marginBottom: 12 }}>Payments recorded</h2>
        {data.payments.length === 0 ? (
          <p className="muted">No payments are recorded yet. The kitchen adds each one when it is received.</p>
        ) : (
          <ul className="rows">
            {data.payments.map((p: any, i: number) => (
              <li key={i} style={{ gridTemplateColumns: '1fr auto' }}>
                <div>
                  <div className="row-main num">{npr(p.amount_npr)}</div>
                  <div className="small muted">{shortDate(p.received_on)} · {p.method === 'bank' ? 'Bank transfer' : 'Cash'}{p.note ? ` · ${p.note}` : ''}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="small muted" style={{ marginTop: 16 }}>{data.method_note}</p>
      </section>
    </div>
  );
}

export function CustomerAccount() {
  const { user, signOut } = useSession();
  return (
    <div className="fade-in" style={{ maxWidth: 620 }}>
      <section className="panel">
        <dl className="kv">
          <dt>Name</dt><dd>{user?.name}</dd>
          <dt>Email</dt><dd>{user?.email}</dd>
          <dt>Account</dt><dd>{user?.is_demo ? 'Demo customer' : 'Customer'}</dd>
        </dl>
      </section>
      <section className="panel" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: 8 }}>Sign out</h2>
        <p className="muted small" style={{ marginBottom: 14 }}>Your plan and pauses stay saved.</p>
        <button className="btn btn-line" onClick={async () => { await signOut(); navigate('/'); }}>Sign out</button>
      </section>
      <p className="small muted" style={{ marginTop: 18 }}>To delete your account, email hello@tab.bot. A self-service delete is not built yet.</p>
    </div>
  );
}
