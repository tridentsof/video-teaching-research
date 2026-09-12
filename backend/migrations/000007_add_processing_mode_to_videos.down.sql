-- ============================================================
-- Migration 000007 Rollback: Remove processing_mode from videos
-- ============================================================

DROP INDEX IF EXISTS idx_videos_processing_mode;
ALTER TABLE videos DROP COLUMN IF EXISTS processing_mode;
