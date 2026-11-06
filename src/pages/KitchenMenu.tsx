import { useEffect, useState } from 'react';
import { get, put, ApiError } from '../lib/api.ts';
import { msg } from '../lib/messages.ts';
import { weekdayName } from '../lib/format.ts';
import { Loading, Notice, Skeleton } from '../components/ui.tsx';

type Item = { slot: 'main' | 'side' | 'sweet'; name: string; name_ne: string; diet: 'veg' | 'nonveg' };
type Day = { weekday: number; items: Item[] };

export default function KitchenMenu() {
  const [days, setDays] = useState<Day[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    get<{ days: Day[] }>('/api/kitchen/menu')
      .then((r) => setDays(r.days))
      .catch((e) => setErr(msg(e instanceof ApiError ? e.code : 'request_failed')));
  }, []);

  const update = (w: number, fn: (items: Item[]) => Item[]) => {
    setSaved(null);
    setDays((ds) => (ds ? ds.map((d) => (d.weekday === w ? { ...d, items: fn(d.items) } : d)) : ds));
  };

  const save = async () => {
    if (!days) return;
    setBusy(true);
    setErr(null);
    setSaved(null);
    try {
      await put('/api/kitchen/menu', { days });
      setSaved('Menu saved. Customers see it straight away.');
    } catch (e) {
      setErr(msg(e instanceof ApiError ? e.code : 'request_failed'));
    } finally {
      setBusy(false);
    }
  };

  if (err && !days) return <Notice kind="bad">{err}</Notice>;
  if (!days) return <Skeleton />;
  return (
    <div className="fade-in">
      <p className="muted" style={{ marginBottom: 18 }}>Up to six dishes a day. Mark each dish veg or non-veg; the veg-only plans see veg dishes only.</p>
      {err && <div style={{ marginBottom: 14 }}><Notice kind="bad">{err}</Notice></div>}
      {saved && <div style={{ marginBottom: 14 }}><Notice kind="good">{saved}</Notice></div>}
      <div style={{ display: 'grid', gap: 0 }}>
        {days.map((d) => (
          <section key={d.weekday} className="day-edit" aria-labelledby={`d${d.weekday}`}>
            <div className="panel-head" style={{ marginBottom: 10 }}>
              <h2 id={`d${d.weekday}`} style={{ fontSize: '1.1rem' }}>{weekdayName(d.weekday)}</h2>
              <button className="btn btn-quiet btn-sm" disabled={d.items.length >= 6} onClick={() => update(d.weekday, (items) => [...items, { slot: 'main', name: '', name_ne: '', diet: 'veg' }])}>
                Add a dish
              </button>
            </div>
            {d.items.length === 0 && <p className="muted small">No dishes yet for this day.</p>}
            <div className="menu-edit">
              {d.items.map((it, i) => (
                <div className="item" key={i}>
                  <label className="sr-only" htmlFor={`s${d.weekday}-${i}`}>Slot</label>
                  <select id={`s${d.weekday}-${i}`} value={it.slot} onChange={(e) => update(d.weekday, (xs) => xs.map((x, j) => (j === i ? { ...x, slot: e.target.value as Item['slot'] } : x)))}>
                    <option value="main">Main</option>
                    <option value="side">Side</option>
                    <option value="sweet">Sweet</option>
                  </select>
                  <label className="sr-only" htmlFor={`n${d.weekday}-${i}`}>Dish name</label>
                  <input id={`n${d.weekday}-${i}`} type="text" maxLength={80} value={it.name} placeholder="Dish name" onChange={(e) => update(d.weekday, (xs) => xs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                  <label className="sr-only" htmlFor={`ne${d.weekday}-${i}`}>Name in Nepali, optional</label>
                  <input id={`ne${d.weekday}-${i}`} type="text" maxLength={80} value={it.name_ne} placeholder="Nepali name (optional)" onChange={(e) => update(d.weekday, (xs) => xs.map((x, j) => (j === i ? { ...x, name_ne: e.target.value } : x)))} />
                  <label className="sr-only" htmlFor={`d${d.weekday}-${i}`}>Diet</label>
                  <select id={`d${d.weekday}-${i}`} value={it.diet} onChange={(e) => update(d.weekday, (xs) => xs.map((x, j) => (j === i ? { ...x, diet: e.target.value as Item['diet'] } : x)))}>
                    <option value="veg">Veg</option>
                    <option value="nonveg">Non-veg</option>
                  </select>
                  <button className="btn btn-quiet btn-sm" aria-label={`Remove dish ${i + 1}`} onClick={() => update(d.weekday, (xs) => xs.filter((_, j) => j !== i))}>Remove</button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div style={{ position: 'sticky', bottom: 0, background: 'var(--paper)', padding: '16px 0', borderTop: '1px solid var(--line)', marginTop: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <button className="btn btn-primary" onClick={save} disabled={busy}>{busy ? <Loading label="Saving the menu" /> : 'Save the week'}</button>
        <span className="small muted">Changes are not live until you save.</span>
      </div>
    </div>
  );
}
