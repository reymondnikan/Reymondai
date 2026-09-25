-- Nodes table
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  flag TEXT DEFAULT '',
  ip TEXT NOT NULL,
  port INTEGER DEFAULT 443,
  sni TEXT DEFAULT 'www.cloudflare.com',
  public_key TEXT NOT NULL,
  short_id TEXT NOT NULL,
  location TEXT DEFAULT '',
  enabled INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 100,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Add node_id to xray_users
ALTER TABLE xray_users ADD COLUMN node_id TEXT DEFAULT 'hetzner-nbg1-01';

-- Index
CREATE INDEX IF NOT EXISTS idx_xray_users_node ON xray_users(node_id);
