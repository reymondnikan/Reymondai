CREATE TABLE nodes (
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

INSERT INTO nodes (id, name, display_name, flag, ip, port, sni, public_key, short_id, location, enabled, sort_order, created_at, updated_at) 
VALUES ('hetzner-nbg1-01', 'Hetzner Nuremberg', 'Germany', 'DE', '91.107.158.188', 443, 'www.cloudflare.com', 'Gv_7ATLzr6pq2esXhVHoNlVHQvoxbCMQx-BW1vkDBzI', 'ab07221358d8caae', 'Nuremberg, Germany', 1, 1, 0, 0);

INSERT INTO nodes (id, name, display_name, flag, ip, port, sni, public_key, short_id, location, enabled, sort_order, created_at, updated_at) 
VALUES ('hetzner-hel1-01', 'Hetzner Helsinki', 'Finland', 'FI', '65.109.212.39', 443, 'www.cloudflare.com', 'xzQJjh1RLnafq8rRZiex_5v1JfcyLZxgw7LTQxnfgXI', '89d4ee21f012f892', 'Helsinki, Finland', 1, 2, 0, 0);
