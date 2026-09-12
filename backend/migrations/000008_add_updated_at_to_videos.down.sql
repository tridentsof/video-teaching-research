-- ============================================================
-- Migration 000008 Rollback: Remove updated_at from videos
-- ============================================================

DROP INDEX IF EXISTS idx_videos_updated_at;
ALTER TABLE videos DROP COLUMN IF EXISTS updated_at;
