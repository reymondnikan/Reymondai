CREATE TABLE IF NOT EXISTS bot_buttons (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'text',
  action_value TEXT NOT NULL DEFAULT '',
  visible_to TEXT NOT NULL DEFAULT 'all',
  sort_order INTEGER NOT NULL DEFAULT 100,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bot_buttons_order ON bot_buttons(sort_order, created_at);
