-- ============================================================
-- Migration 000010: Add file_size to videos table
-- ============================================================

ALTER TABLE videos ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT NULL;
