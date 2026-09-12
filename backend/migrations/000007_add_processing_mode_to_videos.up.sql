-- ============================================================
-- Migration 000007: Add processing_mode to videos table & backfill
-- ============================================================

ALTER TABLE videos ADD COLUMN IF NOT EXISTS processing_mode VARCHAR(20) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_videos_processing_mode ON videos(processing_mode);

-- Backfill 1: Videos processed via chunking
-- Identified by having chunks created, having raw events with chunk_id, or completed chunking job
UPDATE videos
SET processing_mode = 'chunk'
WHERE processing_mode IS NULL
  AND (
    id IN (SELECT DISTINCT video_id FROM video_chunks)
    OR id IN (SELECT DISTINCT video_id FROM raw_events WHERE chunk_id IS NOT NULL)
    OR id IN (SELECT DISTINCT video_id FROM pipeline_jobs WHERE step = 'chunking' AND status = 'completed')
  );

-- Backfill 2: Videos processed via direct full video
-- Identified by skipped chunking job or having raw events where none have chunk_id
UPDATE videos
SET processing_mode = 'full'
WHERE processing_mode IS NULL
  AND (
    id IN (SELECT DISTINCT video_id FROM pipeline_jobs WHERE step = 'chunking' AND status = 'skipped')
    OR (
      EXISTS (SELECT 1 FROM raw_events re WHERE re.video_id = videos.id)
      AND NOT EXISTS (SELECT 1 FROM raw_events re2 WHERE re2.video_id = videos.id AND re2.chunk_id IS NOT NULL)
    )
  );
