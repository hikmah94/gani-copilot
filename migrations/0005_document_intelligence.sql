CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id),
  page INTEGER NOT NULL,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  char_count INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(document_id,page,chunk_index)
);
CREATE INDEX IF NOT EXISTS document_chunks_document_idx ON document_chunks(document_id,page);
CREATE VIRTUAL TABLE IF NOT EXISTS document_chunks_fts USING fts5(text,content='document_chunks',content_rowid='rowid');
CREATE TRIGGER IF NOT EXISTS document_chunks_ai AFTER INSERT ON document_chunks BEGIN INSERT INTO document_chunks_fts(rowid,text) VALUES(new.rowid,new.text); END;
CREATE TRIGGER IF NOT EXISTS document_chunks_ad AFTER DELETE ON document_chunks BEGIN INSERT INTO document_chunks_fts(document_chunks_fts,rowid,text) VALUES('delete',old.rowid,old.text); END;
CREATE TRIGGER IF NOT EXISTS document_chunks_au AFTER UPDATE ON document_chunks BEGIN INSERT INTO document_chunks_fts(document_chunks_fts,rowid,text) VALUES('delete',old.rowid,old.text); INSERT INTO document_chunks_fts(rowid,text) VALUES(new.rowid,new.text); END;

CREATE TABLE IF NOT EXISTS ai_intent_logs (
  id TEXT PRIMARY KEY,
  intent TEXT NOT NULL,
  route_used TEXT NOT NULL,
  confidence REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
