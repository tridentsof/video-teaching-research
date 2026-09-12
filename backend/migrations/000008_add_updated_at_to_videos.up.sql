-- ============================================================
-- Migration 000008: Add updated_at to videos table
-- ============================================================

ALTER TABLE videos ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill: sync updated_at with uploaded_at for existing records
UPDATE videos
SET updated_at = uploaded_at
WHERE updated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_videos_updated_at ON videos(updated_at DESC);
