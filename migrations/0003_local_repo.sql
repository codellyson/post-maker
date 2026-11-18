-- The desktop app reads a product's local repo: it signs in with an access key,
-- uploads screens of the locally running app, and the commits that shipped.

CREATE TABLE access_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER
);

-- Screens now also come from the local app ('local'). SQLite can't change a CHECK, so the table is rebuilt.
CREATE TABLE shots_new (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  label TEXT NOT NULL,
  page TEXT NOT NULL,
  w INTEGER NOT NULL,
  h INTEGER NOT NULL,
  use INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'read' CHECK (source IN ('read', 'upload', 'local')),
  mime TEXT NOT NULL DEFAULT 'image/png',
  added_by TEXT REFERENCES users (id)
);
INSERT INTO shots_new (id, product_id, r2_key, label, page, w, h, use, created_at, source, mime, added_by)
  SELECT id, product_id, r2_key, label, page, w, h, use, created_at, source, mime, added_by FROM shots;
DROP TABLE shots;
ALTER TABLE shots_new RENAME TO shots;
CREATE INDEX shots_product ON shots (product_id);

-- What shipped, from the repo's git history. The writer turns recent ones into "new this week" posts.
CREATE TABLE shipped (
  product_id TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  sha TEXT NOT NULL,
  subject TEXT NOT NULL,
  at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (product_id, sha)
);
