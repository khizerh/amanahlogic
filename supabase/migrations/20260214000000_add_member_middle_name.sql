-- Add middle_name column to members table
ALTER TABLE members ADD COLUMN middle_name text;

-- Update the search index to include middle_name
DROP INDEX IF EXISTS idx_members_search;
CREATE INDEX idx_members_search ON members
  USING gin(to_tsvector('english', first_name || ' ' || coalesce(middle_name, '') || ' ' || last_name || ' ' || coalesce(email, '')));
