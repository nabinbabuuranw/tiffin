import React, { useState } from 'react';
import { post } from '../lib/api.ts';
import { msg } from '../lib/messages.ts';
import { navigate, Link } from '../lib/router.tsx';
import { useSession } from '../lib/session.tsx';
import { Field, Notice } from '../components/ui.tsx';
import { StackArt } from '../components/Mark.tsx';
import { Brand } from '../components/Shell.tsx';
import { ApiError } from '../lib/api.ts';

export default function Auth({ mode }: { mode: 'login' | 'register' }) {
  const { setUser, refresh } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});
  const isLogin = mode === 'login';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErr({});
    if (!isLogin && name.trim().length < 2) return setFieldErr({ name: msg('name_too_short') });
    if (!email.includes('@')) return setFieldErr({ email: msg('email_invalid') });
    if (!isLogin && password.length < 8) return setFieldErr({ password: msg('password_length') });
    setBusy(true);
    try {
      const r = await post(isLogin ? '/api/auth/login' : '/api/auth/register', isLogin ? { email, password } : { name, email, password });
      setUser(r.user);
      await refresh();
      navigate(r.user.role === 'kitchen' ? '/kitchen' : '/app');
    } catch (err) {
      const code = err instanceof ApiError ? err.code : 'request_failed';
      if (code === 'email_taken' || code === 'email_invalid') setFieldErr({ email: msg(code) });
      else if (code === 'password_length') setFieldErr({ password: msg(code) });
      else setError(msg(code));
    } finally {
      setBusy(false);
    }
  };

  const demo = async (role: 'customer' | 'kitchen') => {
    setError(null);
    setBusy(true);
    try {
      const r = await post('/api/auth/demo', { role });
      setUser(r.user);
      await refresh();
      navigate(role === 'kitchen' ? '/kitchen' : '/app');
    } catch (err) {
      setError(msg(err instanceof ApiError ? err.code : 'request_failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-split">
      <aside className="auth-side">
        <Brand small="Subscription tiffin, Nepal" />
        <div>
          <h2>{isLogin ? 'Back to your table.' : 'Start with the days you eat at work.'}</h2>
          <p style={{ marginTop: 14 }}>
            {isLogin
              ? 'Your plan, pauses and balance are waiting. Sign in with the email you used at sign-up.'
              : 'It takes about two minutes. You choose the plan, the route and the first delivery day. Nothing is charged online.'}
          </p>
        </div>
        <StackArt />
      </aside>
      <div className="auth-form">
        <div className="inner fade-in">
          <div className="eyebrow">{isLogin ? 'Sign in' : 'Create an account'}</div>
          <h1 style={{ fontSize: '2.1rem', margin: '8px 0 22px' }}>{isLogin ? 'Welcome back' : 'New customer'}</h1>
          <form onSubmit={submit} noValidate>
            {!isLogin && (
              <Field label="Full name" id="name" error={fieldErr.name} hint="As the kitchen should call you.">
                <input id="name" type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
              </Field>
            )}
            <Field label="Email" id="email" error={fieldErr.email}>
              <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <Field label="Password" id="password" error={fieldErr.password} hint={isLogin ? undefined : 'At least 8 characters.'}>
              <input id="password" type="password" autoComplete={isLogin ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            {error && <div style={{ marginBottom: 14 }}><Notice kind="bad">{error}</Notice></div>}
            <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
              {busy ? 'Please wait' : isLogin ? 'Sign in' : 'Create account'}
            </button>
          </form>
          <p className="small" style={{ marginTop: 16 }}>
            {isLogin ? (
              <>New here? <Link to="/register">Create an account</Link></>
            ) : (
              <>Already a customer? <Link to="/login">Sign in</Link></>
            )}
          </p>
          <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '26px 0' }} />
          <p className="eyebrow" style={{ marginBottom: 10 }}>Demo accounts</p>
          <p className="small muted" style={{ marginBottom: 12 }}>
            One tap, no password. These are invented accounts on the demo kitchen. Changes you make are visible to anyone using the demo.
          </p>
          <div style={{ display: 'grid', gap: 10 }}>
            <button className="btn btn-line btn-block" type="button" onClick={() => demo('customer')} disabled={busy}>
              Open the customer app (DEMO)
            </button>
            <button className="btn btn-line btn-block" type="button" onClick={() => demo('kitchen')} disabled={busy}>
              Open the kitchen desk (DEMO)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
