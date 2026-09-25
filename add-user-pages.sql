CREATE TABLE IF NOT EXISTS user_pages (
  token TEXT PRIMARY KEY,
  telegram_id TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_pages_telegram ON user_pages(telegram_id);
