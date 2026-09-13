-- ============================================================
-- Migration 000010: Drop file_size from videos table
-- ============================================================

ALTER TABLE videos DROP COLUMN IF EXISTS file_size;
