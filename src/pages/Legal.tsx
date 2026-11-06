import { Link } from '../lib/router.tsx';
import { Brand } from '../components/Shell.tsx';

export function Terms() {
  return (
    <div className="legal">
      <Brand />
      <h1 style={{ marginTop: 24 }}>Terms of use</h1>
      <p className="muted small" style={{ marginTop: 8 }}>Last updated 7 November 2026. Applies to the Tiffin demo at this address.</p>
      <h2>What this is</h2>
      <p>Tiffin is a demonstration of subscription tiffin software for kitchens in Nepal. The menu, prices, areas, customers and payments shown are invented. No real meal is cooked or delivered through this site.</p>
      <h2>Accounts</h2>
      <p>You may create a customer account with your own email address and a password of at least eight characters. Demo accounts are shared by everyone who uses the demo, so do not enter anything personal into them.</p>
      <h2>Subscriptions and pauses</h2>
      <p>A subscription records the plan, diet, route and dates you pick. A pause for a day must be set before the kitchen's cut-off on the evening before. The rules shown in the app are the rules the demo applies.</p>
      <h2>Payments</h2>
      <p>The demo takes no online payment. Cash and bank transfer entries are recorded by hand by the kitchen account and are for display only.</p>
      <h2>Availability and changes</h2>
      <p>The demo may be changed, reset or removed at any time without notice. No service level is promised.</p>
      <h2>Contact</h2>
      <p>Questions about this demo: hello@tab.bot.</p>
      <p style={{ marginTop: 28 }}><Link to="/">Back to Tiffin</Link> · <Link to="/privacy">Privacy</Link></p>
    </div>
  );
}

export function Privacy() {
  return (
    <div className="legal">
      <Brand />
      <h1 style={{ marginTop: 24 }}>Privacy</h1>
      <p className="muted small" style={{ marginTop: 8 }}>Last updated 7 November 2026.</p>
      <h2>What we store</h2>
      <p>For a customer account: name, email, a password stored only as a salted hash, the delivery address and optional phone number you enter, your plan and pause dates, and delivery and payment records the kitchen enters.</p>
      <h2>Who sees it</h2>
      <p>Your own account sees your own record. The kitchen account sees the subscriber list, addresses, phone numbers and balances for the demo kitchen. Nothing is sold or shared with advertisers.</p>
      <h2>Cookies</h2>
      <p>One session cookie keeps you signed in. It is HttpOnly and expires after 14 days or when you sign out. No analytics or advertising cookies are set by this demo.</p>
      <h2>Deleting data</h2>
      <p>Ask for your account to be deleted at hello@tab.bot. The demo does not yet include a self-service delete button.</p>
      <p style={{ marginTop: 28 }}><Link to="/">Back to Tiffin</Link> · <Link to="/terms">Terms</Link></p>
    </div>
  );
}
