import React from 'react';
import { Link, navigate, usePath } from '../lib/router.tsx';
import { useSession } from '../lib/session.tsx';
import { post } from '../lib/api.ts';
import { TierMark } from './Mark.tsx';

export function Brand({ small = 'Subscription tiffin, Nepal' }: { small?: string }) {
  return (
    <Link to="/" className="brand" aria-label="Tiffin home">
      <TierMark />
      <span>
        <span className="dn">Tiffin</span>
        <small>{small}</small>
      </span>
    </Link>
  );
}

export function PublicFooter() {
  return (
    <footer className="site-footer">
      <span>Tiffin is a demo platform. No orders are taken and no money moves here.</span>
      <span style={{ display: 'flex', gap: 16 }}>
        <Link to="/terms">Terms</Link>
        <Link to="/privacy">Privacy</Link>
      </span>
    </footer>
  );
}

export function PublicHeader() {
  const { user } = useSession();
  return (
    <header className="site-header">
      <Brand />
      <nav className="site-nav" aria-label="Site">
        <a href="/#menu" className="hide-sm">This week</a>
        <a href="/#plans" className="hide-sm">Plans</a>
        <a href="/#how">How it runs</a>
        {user ? (
          <Link to={user.role === 'kitchen' ? '/kitchen' : '/app'} className="btn btn-line btn-sm">Open my app</Link>
        ) : (
          <>
            <Link to="/login" className="btn btn-line btn-sm">Sign in</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Start a plan</Link>
          </>
        )}
      </nav>
    </header>
  );
}

export interface NavItem { to: string; label: string; idx: string }

export function AppFrame({ items, title, children, eyebrow, actions }: { items: NavItem[]; title: string; children: React.ReactNode; eyebrow?: string; actions?: React.ReactNode }) {
  const { user, signOut } = useSession();
  const path = usePath();
  const isKitchen = user?.role === 'kitchen';
  const onSignOut = async () => {
    await signOut();
    navigate('/');
  };
  // The longest matching item wins, so /kitchen/routes highlights Routes and not Today.
  const activeTo = items
    .filter((it) => path === it.to || path.startsWith(it.to + '/'))
    .sort((a, b) => b.to.length - a.to.length)[0]?.to;
  const current = (to: string) => (to === activeTo ? 'page' : undefined);
  return (
    <div className="frame">
      <aside className="rail" aria-label="Sections">
        <Brand small={isKitchen ? 'Kitchen desk' : 'Customer app'} />
        <nav style={{ display: 'grid', gap: 2 }}>
          {items.map((it) => (
            <Link key={it.to} to={it.to} aria-current={current(it.to)}>
              <span className="idx">{it.idx}</span>
              <span>{it.label}</span>
            </Link>
          ))}
        </nav>
        <div className="who">
          <span>{user?.name}</span>
          {user?.is_demo && <span className="demo-tag" style={{ justifySelf: 'start' }}>Demo account</span>}
          <button className="btn btn-line btn-sm" type="button" onClick={onSignOut}>Sign out</button>
        </div>
      </aside>
      <main className="app-main" id="main">
        <div className="app-head">
          <div>
            {eyebrow && <div className="eyebrow">{eyebrow}</div>}
            <h1>{title}</h1>
          </div>
          {actions}
        </div>
        {children}
      </main>
      <nav className="bottom-nav" aria-label="Sections" style={{ ['--cols' as any]: items.length }}>
        {items.map((it) => (
          <Link key={it.to} to={it.to} aria-current={current(it.to)}>
            {it.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function useSignedIn(role: 'kitchen' | 'customer') {
  const { user, ready } = useSession();
  return { ready, user, ok: !!user && user.role === role };
}

export async function demoSignIn(role: 'kitchen' | 'customer', refresh: () => Promise<void>) {
  await post('/api/auth/demo', { role });
  await refresh();
}
