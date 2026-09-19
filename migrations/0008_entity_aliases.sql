CREATE TABLE IF NOT EXISTS entity_aliases (
  id TEXT PRIMARY KEY,
  alias TEXT NOT NULL COLLATE NOCASE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('government','state','senatorial_zone','lga','sector','mda','project','expenditure_type','status')),
  canonical_value TEXT NOT NULL,
  canonical_id TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (alias, entity_type)
);

CREATE INDEX IF NOT EXISTS entity_aliases_active_idx ON entity_aliases(active, entity_type, alias);

INSERT OR IGNORE INTO entity_aliases (id,alias,entity_type,canonical_value) VALUES
('alias-sector-healthcare','Healthcare','sector','Health'),
('alias-lga-bida','Bida','lga','Bida LGA'),
('alias-mda-works-ministry','Works Ministry','mda','Ministry of Works'),
('alias-sector-ict','ICT','sector','Information and Communication Technology');
