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

CREATE TABLE IF NOT EXISTS access_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('master', 'apps', 'secondary')),
  apps TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS access_sessions (
  token_key TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES access_profiles(id) ON DELETE CASCADE,
  idle_until INTEGER NOT NULL,
  end_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS access_sessions_expiry ON access_sessions(idle_until);

CREATE TABLE IF NOT EXISTS access_limits (
  id TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS model_access (
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL REFERENCES access_profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (model_id, profile_id)
);
