ALTER TABLE admin_logs ADD COLUMN ip_hash TEXT;
CREATE INDEX IF NOT EXISTS admin_logs_auth_idx ON admin_logs(event_type,status,created_at DESC);
