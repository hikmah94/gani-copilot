CREATE TABLE rate_limit_events (
  id TEXT PRIMARY KEY,
  route TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  bucket TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX rate_limit_events_bucket_idx ON rate_limit_events(bucket);
CREATE INDEX rate_limit_events_created_idx ON rate_limit_events(created_at);

CREATE TABLE ai_usage_events (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  query_type TEXT NOT NULL DEFAULT 'general',
  document_id TEXT REFERENCES documents(id),
  status TEXT NOT NULL,
  latency_ms INTEGER,
  input_chars INTEGER,
  output_chars INTEGER,
  evidence_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT
);
CREATE INDEX ai_usage_events_created_idx ON ai_usage_events(created_at DESC);
CREATE INDEX ai_usage_events_status_idx ON ai_usage_events(status, created_at DESC);

CREATE TABLE analytics_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'question_asked','question_completed','evidence_opened','project_viewed',
    'document_viewed','filter_applied','search_performed',
    'community_report_submitted','no_evidence_found','ai_error'
  )),
  properties TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX analytics_events_type_idx ON analytics_events(event_type, created_at DESC);
