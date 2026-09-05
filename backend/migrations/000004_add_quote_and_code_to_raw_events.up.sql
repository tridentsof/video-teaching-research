-- Add quote and code columns to raw_events table for qualitative teaching research
ALTER TABLE raw_events ADD COLUMN IF NOT EXISTS quote TEXT;
ALTER TABLE raw_events ADD COLUMN IF NOT EXISTS code VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_raw_events_code ON raw_events(code) WHERE code IS NOT NULL;
