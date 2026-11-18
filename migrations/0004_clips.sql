-- Real screen recordings of the locally running app, one per flow, made by the desktop engine.
-- Each local run replaces the last run's clips.
CREATE TABLE clips (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  title TEXT NOT NULL,
  why TEXT NOT NULL,
  captions TEXT NOT NULL, -- JSON [{ at: seconds, cap: string }]
  duration REAL NOT NULL,
  w INTEGER NOT NULL,
  h INTEGER NOT NULL,
  use INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX clips_product ON clips (product_id);
