import { useEffect, useState } from 'react';
import { get } from '../lib/api.ts';
import { Link } from '../lib/router.tsx';
import { PublicFooter, PublicHeader } from '../components/Shell.tsx';
import { StackArt } from '../components/Mark.tsx';
import { Mark } from '../components/Mark.tsx';
import { Skeleton } from '../components/ui.tsx';
import { PLAN_MASK_LABEL, npr, todayNpt, weekdayShort, weekdayName } from '../lib/format.ts';

interface MenuItem { slot: string; name: string; name_ne: string; diet: string }
interface Plan { id: string; name: string; name_ne: string; days: string; price_npr: number; blurb: string }

export default function Landing() {
  const [menu, setMenu] = useState<{ days: { weekday: number; items: MenuItem[] }[]; kitchen_name: string; notice: string; cutoff_hour: number } | null>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  useEffect(() => {
    get('/api/menu').then(setMenu).catch(() => setMenu({ days: [], kitchen_name: '', notice: '', cutoff_hour: 20 } as any));
    get('/api/plans').then((r) => setPlans(r.plans)).catch(() => setPlans([]));
  }, []);
  const cutoff = menu?.cutoff_hour ?? 20;
  const today = todayNpt();
  const todayWeekday = new Date(today + 'T00:00:00Z').getUTCDay();

  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <PublicHeader />
      <main id="main">
        <section className="hero">
          <div className="fade-in">
            <div className="eyebrow">Weekly tiffin subscriptions</div>
            <h1 style={{ marginTop: 14 }}>Lunch on the same route, every working day.</h1>
            <p className="lede">
              Choose a plan, pick your delivery route and pause the days you are away. The kitchen works from one route sheet,
              so every stop is known before the first tiffin leaves.
            </p>
            <div className="actions">
              <Link to="/register" className="btn btn-primary">Start a plan</Link>
              <Link to="/login" className="btn btn-line">Try the demo</Link>
            </div>
            <p className="small muted" style={{ marginTop: 18 }}>
              Demo kitchen: prices, dishes, areas and people are invented. Payment is cash on delivery or bank transfer, recorded by the kitchen.
            </p>
          </div>
          <StackArt />
        </section>

        <section className="section" id="menu" aria-labelledby="menu-h">
          <div className="section-head">
            <div>
              <div className="eyebrow">This week</div>
              <h2 id="menu-h" style={{ marginTop: 6 }}>The menu, day by day</h2>
            </div>
            <span className="demo-tag">Demo menu</span>
          </div>
          {!menu ? (
            <Skeleton />
          ) : menu.days.length === 0 ? (
            <p className="muted">The menu is not available right now.</p>
          ) : (
            <div className="week" role="list">
              {menu.days.map((d) => (
                <div
                  key={d.weekday}
                  className={`week-day ${d.weekday === todayWeekday ? 'today' : ''}`}
                  role="listitem"
                  aria-label={weekdayName(d.weekday)}
                >
                  <h3>
                    {weekdayShort(d.weekday)}
                    {d.weekday === todayWeekday && <span className="muted"> · today</span>}
                  </h3>
                  <div className="week-items">
                    {d.items.map((it, i) => (
                      <div className="week-item" key={i} style={{ marginBottom: 10 }}>
                        <span className="slot" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <Mark kind={it.diet} /> {it.slot}
                        </span>
                        <span>{it.name}</span>
                        {it.name_ne && <span className="ne">{it.name_ne}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="section" id="plans" aria-labelledby="plans-h">
          <div className="section-head">
            <div>
              <div className="eyebrow">Plans</div>
              <h2 id="plans-h" style={{ marginTop: 6 }}>Pick the days you eat at work</h2>
            </div>
            <span className="muted small">Prices are the demo kitchen's, per tiffin.</span>
          </div>
          {!plans ? (
            <Skeleton kind="lines" />
          ) : (
            <div className="plans">
              {plans.map((p) => (
                <div className="plan-row" key={p.id}>
                  <div>
                    <h3>
                      {p.name}
                      <span className="ne">{p.name_ne}</span>
                    </h3>
                    <p className="muted" style={{ marginTop: 6 }}>{p.blurb}</p>
                  </div>
                  <div>
                    <div className="dayline" aria-label={`Delivered on ${PLAN_MASK_LABEL(p.days)}`}>
                      {p.days.split('').map((c, i) => (
                        <span key={i} className={c === '1' ? 'on' : ''}>{weekdayShort(i).slice(0, 2)}</span>
                      ))}
                    </div>
                  </div>
                  <div className="price num">
                    {npr(p.price_npr)} <small>per tiffin</small>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 24 }}>
            <Link to="/register" className="btn btn-primary">Choose a plan</Link>
          </div>
        </section>

        <section className="section" id="how" aria-labelledby="how-h">
          <div className="section-head">
            <div>
              <div className="eyebrow">How it runs</div>
              <h2 id="how-h" style={{ marginTop: 6 }}>From your phone to the route sheet</h2>
            </div>
          </div>
          <ol className="steps">
            <li>
              <span className="n">01</span>
              <div>
                <h3>Choose a plan and a route</h3>
                <p>Pick the days, veg or any, and the area you live in. Add an address and, if you want, a phone number.</p>
              </div>
            </li>
            <li>
              <span className="n">02</span>
              <div>
                <h3>The kitchen gets one sheet per route</h3>
                <p>Each route lists its stops in order, with diet and address, and the number of tiffins to cook for the day.</p>
              </div>
            </li>
            <li>
              <span className="n">03</span>
              <div>
                <h3>Pause any day before the cut-off</h3>
                <p>
                  A pause for a day closes at {String(cutoff).padStart(2, '0')}:00 the evening before. After that the kitchen has already cooked for it.
                </p>
              </div>
            </li>
            <li>
              <span className="n">04</span>
              <div>
                <h3>Pay for the tiffins you received</h3>
                <p>Cash on delivery or a bank transfer. The kitchen records each payment, and your balance follows the delivered tiffins.</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="section" aria-labelledby="qa-h">
          <div className="section-head">
            <h2 id="qa-h">Questions</h2>
          </div>
          <details className="qa">
            <summary>Is this a live service?</summary>
            <p>No. This is a demo of the platform. The menu, prices, areas and customers are invented, no orders are taken, and no money moves.</p>
          </details>
          <details className="qa">
            <summary>Can I pay online?</summary>
            <p>Not yet. Payment is cash on delivery or a bank transfer, recorded by the kitchen. No card or wallet is connected.</p>
          </details>
          <details className="qa">
            <summary>What if I am away for a week?</summary>
            <p>Select the days in your calendar, or use the date range. Pauses are allowed for up to 31 days at a time, each day up to the cut-off the evening before.</p>
          </details>
          <details className="qa">
            <summary>Which areas are covered?</summary>
            <p>The demo has three routes, labelled as demo areas. A real kitchen would name the areas it actually serves.</p>
          </details>
        </section>
      </main>
      <PublicFooter />
    </>
  );
}
