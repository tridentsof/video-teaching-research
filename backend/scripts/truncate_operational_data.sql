-- ============================================================
-- Truncate Operational / Business Data
-- Preserves: users, checklists, checklist_items, api_keys, ai_models, flow_configs
-- ============================================================

BEGIN;

TRUNCATE TABLE 
    interview_questions,
    teacher_analyses,
    themes,
    categories,
    patterns,
    analysis_runs,
    report_items,
    reports,
    event_mappings,
    raw_events,
    codebook_entries,
    video_chunks,
    pipeline_jobs,
    videos
RESTART IDENTITY CASCADE;

COMMIT;
