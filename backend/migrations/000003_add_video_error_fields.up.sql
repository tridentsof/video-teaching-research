-- Add error tracking fields to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS error_msg TEXT;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS failed_step VARCHAR(50);
