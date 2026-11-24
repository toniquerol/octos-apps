CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  size INTEGER NOT NULL,
  public INTEGER NOT NULL DEFAULT 0 CHECK (public IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS model_chunks (
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (model_id, position)
);

CREATE INDEX IF NOT EXISTS models_public_created ON models (public, created_at DESC, id);
