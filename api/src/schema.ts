// Tiffin D1 schema. Statements run one by one at first request (CREATE ... IF NOT EXISTS).
export const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('kitchen','customer')),
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS settings (k TEXT PRIMARY KEY, v TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_ne TEXT NOT NULL DEFAULT '',
    days TEXT NOT NULL CHECK (length(days) = 7),
    price_npr INTEGER NOT NULL CHECK (price_npr > 0),
    blurb TEXT NOT NULL DEFAULT '',
    sort INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  )`,
  `CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    area TEXT NOT NULL DEFAULT '',
    sort INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    diet TEXT NOT NULL CHECK (diet IN ('veg','any')),
    route_id INTEGER REFERENCES routes(id),
    stop_order INTEGER NOT NULL DEFAULT 0,
    address TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    start_date TEXT NOT NULL,
    end_date TEXT,
    status TEXT NOT NULL CHECK (status IN ('active','cancelled')) DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS subs_route ON subscriptions(route_id, stop_order)`,
  `CREATE TABLE IF NOT EXISTS pauses (
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (subscription_id, date)
  )`,
  `CREATE INDEX IF NOT EXISTS pauses_date ON pauses(date)`,
  `CREATE TABLE IF NOT EXISTS menu_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
    slot TEXT NOT NULL CHECK (slot IN ('main','side','sweet')),
    name TEXT NOT NULL,
    name_ne TEXT NOT NULL DEFAULT '',
    diet TEXT NOT NULL CHECK (diet IN ('veg','nonveg')),
    sort INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS menu_day ON menu_items(weekday, sort)`,
  `CREATE TABLE IF NOT EXISTS deliveries (
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('out','delivered','skipped')),
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (subscription_id, date)
  )`,
  `CREATE INDEX IF NOT EXISTS deliveries_date ON deliveries(date)`,
  `CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    amount_npr INTEGER NOT NULL CHECK (amount_npr > 0),
    method TEXT NOT NULL CHECK (method IN ('cash','bank')),
    note TEXT NOT NULL DEFAULT '',
    received_on TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS payments_sub ON payments(subscription_id)`,
];

export interface MenuSeed { weekday: number; slot: 'main' | 'side' | 'sweet'; name: string; name_ne: string; diet: 'veg' | 'nonveg' }

// Demo menu: invented dishes for the demo kitchen. Labelled DEMO everywhere it is shown.
export const DEMO_MENU: MenuSeed[] = [
  { weekday: 0, slot: 'main', name: 'Dal, bhat and tarkari', name_ne: 'दाल, भात र तरकारी', diet: 'veg' },
  { weekday: 0, slot: 'side', name: 'Gundruk ko jhol', name_ne: 'गुन्द्रुकको झोल', diet: 'veg' },
  { weekday: 0, slot: 'sweet', name: 'Kheer', name_ne: 'खीर', diet: 'veg' },
  { weekday: 1, slot: 'main', name: 'Chicken curry, bhat', name_ne: 'कुखुराको मासु, भात', diet: 'nonveg' },
  { weekday: 1, slot: 'side', name: 'Aloo jeera', name_ne: 'आलु जीरा', diet: 'veg' },
  { weekday: 1, slot: 'sweet', name: 'Seasonal fruit', name_ne: 'मौसमी फलफूल', diet: 'veg' },
  { weekday: 2, slot: 'main', name: 'Chana masala and puri', name_ne: 'चना मसला र पुरी', diet: 'veg' },
  { weekday: 2, slot: 'side', name: 'Cucumber achar', name_ne: 'काउँलो अचार', diet: 'veg' },
  { weekday: 2, slot: 'sweet', name: 'Sel roti', name_ne: 'सेल रोटी', diet: 'veg' },
  { weekday: 3, slot: 'main', name: 'Mutton curry, bhat', name_ne: 'खसीको मासु, भात', diet: 'nonveg' },
  { weekday: 3, slot: 'side', name: 'Saag with garlic', name_ne: 'साग लसुन', diet: 'veg' },
  { weekday: 3, slot: 'sweet', name: 'Rasbari', name_ne: 'रसबरी', diet: 'veg' },
  { weekday: 4, slot: 'main', name: 'Mushroom masala, roti', name_ne: 'च्याउ मसला, रोटी', diet: 'veg' },
  { weekday: 4, slot: 'side', name: 'Dal fry', name_ne: 'दाल फ्राई', diet: 'veg' },
  { weekday: 4, slot: 'sweet', name: 'Kheer', name_ne: 'खीर', diet: 'veg' },
  { weekday: 5, slot: 'main', name: 'Fish fry, bhat', name_ne: 'माछा फ्राई, भात', diet: 'nonveg' },
  { weekday: 5, slot: 'side', name: 'Bodi tarkari', name_ne: 'बोडी तरकारी', diet: 'veg' },
  { weekday: 5, slot: 'sweet', name: 'Gulab jamun', name_ne: 'गुलाब जामुन', diet: 'veg' },
  { weekday: 6, slot: 'main', name: 'Pulao and raita', name_ne: 'पुलाउ र रायता', diet: 'veg' },
  { weekday: 6, slot: 'side', name: 'Paneer bhuji', name_ne: 'पनीर भुजी', diet: 'veg' },
  { weekday: 6, slot: 'sweet', name: 'Juju dhau', name_ne: 'जुजु धौ', diet: 'veg' },
];

export const DEMO_PLANS = [
  { id: 'office-week', name: 'Office week', name_ne: 'अफिस हप्ता', days: '1111110', price_npr: 160, blurb: 'Sunday to Friday, one lunch tiffin a day.', sort: 1 },
  { id: 'five-day', name: 'Five-day', name_ne: 'पाँच दिन', days: '1111100', price_npr: 170, blurb: 'Sunday to Thursday, for people who take Fridays off.', sort: 2 },
  { id: 'every-day', name: 'Every day', name_ne: 'हरेक दिन', days: '1111111', price_npr: 150, blurb: 'Seven days a week, including the weekend.', sort: 3 },
];

export const DEMO_ROUTES = [
  { id: 1, name: 'Route A', area: 'North side (demo area)', sort: 1 },
  { id: 2, name: 'Route B', area: 'Central (demo area)', sort: 2 },
  { id: 3, name: 'Route C', area: 'South side (demo area)', sort: 3 },
];
