ALTER TABLE xray_users ADD COLUMN owner_telegram_id TEXT;
CREATE INDEX IF NOT EXISTS idx_xray_users_owner ON xray_users(owner_telegram_id);
