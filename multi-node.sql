
-- ============================================
-- Multi-Node support
-- ============================================

CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT,
  ip TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 443,
  sni TEXT NOT NULL DEFAULT 'www.cloudflare.com',
  public_key TEXT,
  short_id TEXT,
  location TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO nodes (id, name, display_name, ip, port, sni, public_key, short_id, location, enabled, sort_order, created_at, updated_at)
VALUES (
  'hetzner-nbg1-01',
  'Hetzner Nuremberg',
  '🇩🇪 Germany',
  '91.107.158.188',
  443,
  'www.cloudflare.com',
  'Gv_7ATLzr6pq2esXhVHoNlVHQvoxbCMQx-BW1vkDBzI',
  'ab07221358d8caae',
  'Nuremberg, Germany',
  1,
  1,
  0,
  0
);