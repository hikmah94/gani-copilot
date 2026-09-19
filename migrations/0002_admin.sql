CREATE TABLE IF NOT EXISTS admin_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'success',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ingestion_jobs (
  id TEXT PRIMARY KEY,
  document_id TEXT REFERENCES documents(id),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS admin_logs_created_idx ON admin_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS ingestion_jobs_status_idx ON ingestion_jobs(status, created_at DESC);

INSERT OR IGNORE INTO governments (id,name,government_type,country,state,year)
VALUES ('niger-state','Niger State Government','State','Nigeria','Niger',2026);

