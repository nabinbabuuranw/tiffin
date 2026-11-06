import React from 'react';
import { usePath, match, Link } from './lib/router.tsx';
import { SessionProvider, useSession } from './lib/session.tsx';
import { AppFrame, NavItem } from './components/Shell.tsx';
import { Loading, Notice, Skeleton } from './components/ui.tsx';
import Landing from './pages/Landing.tsx';
import Auth from './pages/Auth.tsx';
import { Terms, Privacy } from './pages/Legal.tsx';
import CustomerPlan from './pages/CustomerPlan.tsx';
import { CustomerMenu, CustomerBilling, CustomerAccount } from './pages/CustomerMisc.tsx';
import KitchenToday from './pages/KitchenToday.tsx';
import KitchenMenu from './pages/KitchenMenu.tsx';
import { KitchenSubscribers, KitchenSubscriber } from './pages/KitchenPeople.tsx';
import KitchenRoutes from './pages/KitchenRoutes.tsx';
import KitchenSettings from './pages/KitchenSettings.tsx';

const CUSTOMER_NAV: NavItem[] = [
  { to: '/app', label: 'My plan', idx: '01' },
  { to: '/app/menu', label: 'Menu', idx: '02' },
  { to: '/app/billing', label: 'Billing', idx: '03' },
  { to: '/app/account', label: 'Account', idx: '04' },
];
const KITCHEN_NAV: NavItem[] = [
  { to: '/kitchen', label: 'Today', idx: '01' },
  { to: '/kitchen/menu', label: 'Menu', idx: '02' },
  { to: '/kitchen/subscribers', label: 'Subscribers', idx: '03' },
  { to: '/kitchen/routes', label: 'Routes', idx: '04' },
  { to: '/kitchen/settings', label: 'Settings', idx: '05' },
];

const TITLES: Record<string, [string, string]> = {
  '/app': ['Customer', 'Your plan'],
  '/app/menu': ['Customer', 'This week'],
  '/app/billing': ['Customer', 'Billing'],
  '/app/account': ['Customer', 'Account'],
  '/kitchen': ['Kitchen desk', 'Today'],
  '/kitchen/menu': ['Kitchen desk', 'Weekly menu'],
  '/kitchen/subscribers': ['Kitchen desk', 'Subscribers'],
  '/kitchen/routes': ['Kitchen desk', 'Route sheet'],
  '/kitchen/settings': ['Kitchen desk', 'Settings'],
};

/** Shows the page only to the right kind of account. Signed out, it asks to sign in; the wrong kind, it points home. */
function Guard({ role, children }: { role: 'kitchen' | 'customer'; children: React.ReactNode }) {
  const { user, ready } = useSession();
  if (!ready) return <div style={{ padding: 40 }} aria-busy="true"><Skeleton kind="lines" /><Skeleton /></div>;
  if (!user) return <Auth mode="login" />;
  if (user.role !== role) {
    return (
      <div className="narrow">
        <Notice kind="warn">This area is for {role === 'kitchen' ? 'kitchen' : 'customer'} accounts. You are signed in as the other kind.</Notice>
        <p style={{ marginTop: 16 }}>
          <Link to={user.role === 'kitchen' ? '/kitchen' : '/app'}>Go to your own area</Link>
        </p>
      </div>
    );
  }
  return <>{children}</>;
}

function Shell({ role, path, nav, children }: { role: 'kitchen' | 'customer'; path: string; nav: NavItem[]; children: React.ReactNode }) {
  const [eyebrow, title] = TITLES[path] || [role === 'kitchen' ? 'Kitchen desk' : 'Customer', ''];
  return (
    <Guard role={role}>
      <AppFrame items={nav} eyebrow={eyebrow} title={title}>
        {children}
      </AppFrame>
    </Guard>
  );
}

function Router() {
  const path = usePath();
  const sub = match('/kitchen/subscribers/:id', path);
  if (path === '/') return <Landing />;
  if (path === '/login') return <Auth mode="login" />;
  if (path === '/register') return <Auth mode="register" />;
  if (path === '/terms') return <Terms />;
  if (path === '/privacy') return <Privacy />;
  if (path === '/app') return <Shell role="customer" path={path} nav={CUSTOMER_NAV}><CustomerPlan /></Shell>;
  if (path === '/app/menu') return <Shell role="customer" path={path} nav={CUSTOMER_NAV}><CustomerMenu /></Shell>;
  if (path === '/app/billing') return <Shell role="customer" path={path} nav={CUSTOMER_NAV}><CustomerBilling /></Shell>;
  if (path === '/app/account') return <Shell role="customer" path={path} nav={CUSTOMER_NAV}><CustomerAccount /></Shell>;
  if (path === '/kitchen') return <Shell role="kitchen" path={path} nav={KITCHEN_NAV}><KitchenToday /></Shell>;
  if (path === '/kitchen/menu') return <Shell role="kitchen" path={path} nav={KITCHEN_NAV}><KitchenMenu /></Shell>;
  if (path === '/kitchen/subscribers') return <Shell role="kitchen" path={path} nav={KITCHEN_NAV}><KitchenSubscribers /></Shell>;
  if (sub) return <Shell role="kitchen" path="/kitchen/subscribers" nav={KITCHEN_NAV}><KitchenSubscriber /></Shell>;
  if (path === '/kitchen/routes') return <Shell role="kitchen" path={path} nav={KITCHEN_NAV}><KitchenRoutes /></Shell>;
  if (path === '/kitchen/settings') return <Shell role="kitchen" path={path} nav={KITCHEN_NAV}><KitchenSettings /></Shell>;
  return (
    <div className="narrow">
      <h1 style={{ fontSize: '2rem' }}>That page is not here.</h1>
      <p className="muted" style={{ margin: '12px 0 20px' }}>The link may be old, or the address was typed differently.</p>
      <Link to="/" className="btn btn-primary">Back to Tiffin</Link>
    </div>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Router />
    </SessionProvider>
  );
}

export { Loading };
