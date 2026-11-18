-- Screens the team adds themselves (moments a link can't reach, like a file mid-crush) sit beside the cut-out ones.
ALTER TABLE shots ADD COLUMN source TEXT NOT NULL DEFAULT 'read' CHECK (source IN ('read', 'upload'));
ALTER TABLE shots ADD COLUMN mime TEXT NOT NULL DEFAULT 'image/png';
ALTER TABLE shots ADD COLUMN added_by TEXT REFERENCES users (id);
