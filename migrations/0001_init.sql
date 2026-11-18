-- People and sign-in (same shape as Smalbum).
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);

-- One live code per email, stored hashed.
CREATE TABLE login_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_user ON sessions (user_id);

-- A workspace is a team. Everyone in it sees the same products and posts.
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE members (
  workspace_id TEXT NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, user_id)
);
CREATE INDEX members_user ON members (user_id);

-- Invite links carry a token; only its hash is stored.
CREATE TABLE invites (
  token_hash TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by TEXT NOT NULL REFERENCES users (id),
  expires_at INTEGER NOT NULL
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  colour TEXT NOT NULL, -- one of the five DESIGN.md fills: cyan, magenta, lime, orange, purple
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reading', 'ready', 'failed')),
  need TEXT, -- a short note when the team must do something, e.g. 'needs a demo login'
  memory TEXT NOT NULL DEFAULT '{}', -- the Memory JSON from shared/types.ts
  creds TEXT, -- demo login, AES-GCM encrypted with CRED_KEY; never returned to the browser
  read_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX products_workspace ON products (workspace_id, created_at);

-- Elements cut out of the product's pages, stored in R2.
CREATE TABLE shots (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL,
  label TEXT NOT NULL,
  page TEXT NOT NULL,
  w INTEGER NOT NULL,
  h INTEGER NOT NULL,
  use INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE INDEX shots_product ON shots (product_id);

-- Today's best few, ranked. `day` is the UTC date the posts were written for.
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  rank INTEGER NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('carousel', 'clip', 'image')),
  pattern TEXT NOT NULL,
  title TEXT NOT NULL,
  why TEXT NOT NULL,
  flag TEXT,
  hook TEXT NOT NULL,
  copy TEXT NOT NULL, -- { X, LinkedIn, Instagram, Reddit? }
  visual TEXT NOT NULL, -- the Visual JSON from shared/types.ts
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved')),
  approved_by TEXT REFERENCES users (id),
  approved_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX posts_product_day ON posts (product_id, day, rank);

-- Each time someone posts a post somewhere. A post can go to several platforms.
CREATE TABLE postings (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users (id),
  posted_at INTEGER NOT NULL
);
CREATE INDEX postings_post ON postings (post_id);

-- Ideas the quality check refused, with the reason. Shown so the team can trust the cut.
CREATE TABLE dropped (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT NOT NULL
);
CREATE INDEX dropped_product_day ON dropped (product_id, day);

-- Background work the queue runs. The UI polls these.
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces (id) ON DELETE CASCADE,
  product_id TEXT REFERENCES products (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('read', 'write', 'render')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  progress TEXT NOT NULL DEFAULT '[]', -- step lines shown to the user while it runs
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX jobs_product ON jobs (product_id, created_at);
