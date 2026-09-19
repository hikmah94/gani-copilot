CREATE TABLE IF NOT EXISTS administrators (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('administrator','super_administrator')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS system_configuration (
  config_key TEXT PRIMARY KEY,
  config_value TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  trust_level TEXT NOT NULL DEFAULT 'review_required',
  enabled INTEGER NOT NULL DEFAULT 1,
  last_checked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feature_flags (
  flag_key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS destructive_operation_requests (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','executed')),
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO system_configuration (config_key,config_value,category,description,updated_by) VALUES
('ai.model','@cf/openai/gpt-oss-20b','ai','Primary Workers AI model','system'),
('ai.max_output_tokens','700','ai','Maximum response tokens','system'),
('ai.temperature','0.2','ai','Generation temperature','system'),
('system.public_submissions','enabled','system','Community submission policy','system');

INSERT OR IGNORE INTO feature_flags (flag_key,label,description,enabled,updated_by) VALUES
('community_reports','Community reporting','Allow public community observations',1,'system'),
('semantic_search','Semantic search','Enable vector-backed search when indexing is available',0,'system'),
('project_explorer','Project explorer','Expose verified project records publicly',1,'system');

