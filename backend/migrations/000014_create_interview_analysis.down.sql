-- ============================================================
-- Migration 000014 DOWN: Drop Interview Analysis Tables
-- ============================================================

DROP TABLE IF EXISTS representative_quotes;
DROP TABLE IF EXISTS triangulation_entries;
DROP TABLE IF EXISTS interview_codes;
DROP TABLE IF EXISTS meaning_units;
DROP TABLE IF EXISTS interview_responses;
DELETE FROM flow_configs WHERE flow_key IN ('interview_transcription', 'interview_analysis');

