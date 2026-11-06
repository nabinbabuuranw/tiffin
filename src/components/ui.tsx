import React from 'react';

export function Skeleton({ kind = 'block' }: { kind?: 'block' | 'lines' | 'rows' }) {
  if (kind === 'lines') {
    return (
      <div aria-hidden="true">
        <div className="skel skel-line" style={{ width: '40%', height: 22 }} />
        <div className="skel skel-line" />
        <div className="skel skel-line" style={{ width: '85%' }} />
      </div>
    );
  }
  if (kind === 'rows') {
    return (
      <div aria-hidden="true" className="rows">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} style={{ listStyle: 'none' }}>
            <div className="skel skel-line" style={{ width: `${55 + i * 8}%` }} />
          </li>
        ))}
      </div>
    );
  }
  return <div className="skel skel-block" aria-hidden="true" />;
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="pulse" style={{ padding: '12px 0' }}>
      <i /><i /><i />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Notice({ kind, children }: { kind?: 'good' | 'warn' | 'bad'; children: React.ReactNode }) {
  return <div className={`notice ${kind || ''} fade-in`} role={kind === 'bad' ? 'alert' : 'status'}>{children}</div>;
}

export function Field({ label, hint, error, children, id }: { label: string; hint?: string; error?: string; children: React.ReactNode; id?: string }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children}
      {hint && !error && <span className="hint">{hint}</span>}
      {error && <span className="field-error" role="alert">{error}</span>}
    </div>
  );
}

export function Pill({ kind, children }: { kind: string; children: React.ReactNode }) {
  return <span className={`pill ${kind}`}>{children}</span>;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented wrap" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({ k, v, meta }: { k: string; v: React.ReactNode; meta?: string }) {
  return (
    <div className="stat">
      <div className="v">{v}</div>
      <div className="k">{k}</div>
      {meta && <div className="meta">{meta}</div>}
    </div>
  );
}

export function Panel({ title, action, children, id }: { title: string; action?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section className="panel" aria-labelledby={id}>
      <div className="panel-head">
        <h2 id={id} style={{ fontSize: '1.25rem' }}>{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
