import React, { useEffect, useState } from 'react';
import { get, put, ApiError } from '../lib/api.ts';
import { msg } from '../lib/messages.ts';
import { Field, Loading, Notice, Skeleton } from '../components/ui.tsx';

export default function KitchenSettings() {
  const [s, setS] = useState<{ kitchen_name: string; cutoff_hour: number; notice: string } | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    get('/api/kitchen/settings')
      .then(setS)
      .catch((e) => setErr(msg(e instanceof ApiError ? e.code : 'request_failed')));
  }, []);
  if (!s) return err ? <Notice kind="bad">{err}</Notice> : <Skeleton kind="lines" />;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrs({});
    setErr(null);
    setOk(null);
    if (s.kitchen_name.trim().length < 2) return setErrs({ name: msg('name_too_short') });
    setBusy(true);
    try {
      await put('/api/kitchen/settings', { kitchen_name: s.kitchen_name.trim(), cutoff_hour: s.cutoff_hour, notice: s.notice.trim() });
      setOk('Settings saved.');
    } catch (er) {
      const code = er instanceof ApiError ? er.code : 'request_failed';
      if (code === 'name_too_short') setErrs({ name: msg(code) });
      else if (code === 'cutoff_invalid') setErrs({ cutoff: msg(code) });
      else setErr(msg(code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} noValidate className="panel fade-in" style={{ maxWidth: 620 }}>
      <Field label="Kitchen name" id="kn" error={errs.name} hint="Shown to customers on the menu and in the app.">
        <input id="kn" type="text" maxLength={60} value={s.kitchen_name} onChange={(e) => setS({ ...s, kitchen_name: e.target.value })} />
      </Field>
      <Field label="Pause cut-off" id="co" error={errs.cutoff} hint="A pause for a day closes at this hour on the evening before.">
        <select id="co" value={s.cutoff_hour} onChange={(e) => setS({ ...s, cutoff_hour: Number(e.target.value) })} style={{ maxWidth: 220 }}>
          {Array.from({ length: 12 }, (_, i) => i + 12).map((h) => (
            <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
          ))}
        </select>
      </Field>
      <Field label="Note to customers" id="nt" hint="Shown on the customer menu. Up to 280 characters.">
        <textarea id="nt" maxLength={280} value={s.notice} onChange={(e) => setS({ ...s, notice: e.target.value })} />
      </Field>
      {err && <div style={{ marginBottom: 12 }}><Notice kind="bad">{err}</Notice></div>}
      {ok && <div style={{ marginBottom: 12 }}><Notice kind="good">{ok}</Notice></div>}
      <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? <Loading label="Saving" /> : 'Save settings'}</button>
    </form>
  );
}
