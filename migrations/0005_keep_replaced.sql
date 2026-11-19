-- Asking for more ideas no longer deletes the day's untouched drafts; it marks them replaced so they stay in "all posts".
ALTER TABLE posts ADD COLUMN replaced_at INTEGER;
