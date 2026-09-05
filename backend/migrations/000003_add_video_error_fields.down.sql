-- Drop error tracking fields from videos table
ALTER TABLE videos DROP COLUMN IF EXISTS error_msg;
ALTER TABLE videos DROP COLUMN IF EXISTS failed_step;
