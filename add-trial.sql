CREATE TABLE IF NOT EXISTS trial_claims (
  telegram_id TEXT PRIMARY KEY,
  xray_user_name TEXT NOT NULL,
  xray_sub_token TEXT,
  claimed_at INTEGER NOT NULL
);
