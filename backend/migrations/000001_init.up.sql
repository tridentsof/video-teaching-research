-- ============================================================
-- Video Teaching Research — Full Database Schema
-- Phase 1–5 (Core Pipeline) + Phase 6 (Report Analysis)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- VIDEOS
-- ============================================================
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id VARCHAR(20) NOT NULL,         -- e.g. "T01", "T12"
    title VARCHAR(500) NOT NULL,
    blob_url TEXT,                            -- Azure Blob URL
    duration_sec INTEGER,                    -- video duration in seconds
    status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
    -- status: uploaded | chunking | chunked | extracting | extracted
    --         | merging | merged | review_pending | mapping | mapped
    --         | statistics | report_generated | error
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_videos_teacher_id ON videos(teacher_id);
CREATE INDEX idx_videos_status ON videos(status);

-- ============================================================
-- VIDEO CHUNKS
-- ============================================================
CREATE TABLE video_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_start_sec INTEGER NOT NULL,
    chunk_end_sec INTEGER NOT NULL,
    blob_path TEXT,                           -- Azure Blob path for this chunk
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- status: pending | uploading | uploaded | processing | processed | error
    gemini_raw_output JSONB,                 -- raw JSON response from Gemini, for re-parsing
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_video_chunks_video_id ON video_chunks(video_id);

-- ============================================================
-- RAW EVENTS (Event Repository)
-- ============================================================
CREATE TABLE raw_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    teacher_id VARCHAR(20) NOT NULL,
    chunk_id UUID REFERENCES video_chunks(id) ON DELETE SET NULL,
    timestamp_sec NUMERIC(10,2) NOT NULL,    -- relative timestamp in seconds (supports fractional)
    event_type VARCHAR(20) NOT NULL,         -- visual | audio | context
    event_key VARCHAR(200) NOT NULL,         -- normalized key, e.g. "teacher_points_to_board"
    description TEXT NOT NULL,               -- human-readable description
    confidence NUMERIC(4,3),                 -- 0.000 to 1.000
    duration_sec NUMERIC(8,2),               -- duration of the event in seconds
    is_duplicate_of UUID REFERENCES raw_events(id) ON DELETE SET NULL,
    -- null = original event, non-null = this is a duplicate of the referenced event
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_raw_events_video_id ON raw_events(video_id);
CREATE INDEX idx_raw_events_teacher_id ON raw_events(teacher_id);
CREATE INDEX idx_raw_events_event_key ON raw_events(event_key);
CREATE INDEX idx_raw_events_timestamp ON raw_events(video_id, timestamp_sec);
CREATE INDEX idx_raw_events_not_duplicate ON raw_events(video_id) WHERE is_duplicate_of IS NULL;

-- ============================================================
-- CHECKLISTS
-- ============================================================
CREATE TABLE checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    version VARCHAR(50) NOT NULL DEFAULT 'v1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CHECKLIST ITEMS
-- ============================================================
CREATE TABLE checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
    section VARCHAR(5) NOT NULL,             -- A | B | C | D | E
    text TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checklist_items_checklist ON checklist_items(checklist_id);
CREATE INDEX idx_checklist_items_section ON checklist_items(checklist_id, section);

-- ============================================================
-- EVENT MAPPINGS (Checklist ↔ Event)
-- ============================================================
CREATE TABLE event_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    raw_event_id UUID NOT NULL REFERENCES raw_events(id) ON DELETE CASCADE,
    checklist_item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
    match_score NUMERIC(4,3) NOT NULL,       -- 0.000 to 1.000
    match_method VARCHAR(20) NOT NULL,       -- exact | semantic | contextual
    matched_by_model VARCHAR(100),           -- e.g. "anthropic/claude-3.5-sonnet"
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_mappings_event ON event_mappings(raw_event_id);
CREATE INDEX idx_event_mappings_checklist ON event_mappings(checklist_item_id);

-- ============================================================
-- REPORTS
-- ============================================================
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    teacher_id VARCHAR(20) NOT NULL,
    checklist_id UUID NOT NULL REFERENCES checklists(id),
    checklist_version VARCHAR(50),
    markdown_content TEXT NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_video ON reports(video_id);

-- ============================================================
-- REPORT ITEMS (statistics per checklist item)
-- ============================================================
CREATE TABLE report_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    checklist_item_id UUID NOT NULL REFERENCES checklist_items(id),
    checklist_section VARCHAR(5) NOT NULL,
    checklist_text TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    avg_confidence NUMERIC(4,3),
    avg_duration_sec NUMERIC(8,2),
    occurrences JSONB NOT NULL DEFAULT '[]',
    -- JSON array: [{"timestamp_sec": 271, "confidence": 0.95, "duration_sec": 6}, ...]
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_report_items_report ON report_items(report_id);

-- ============================================================
-- PIPELINE JOBS (tracks each pipeline step)
-- ============================================================
CREATE TABLE pipeline_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    step VARCHAR(50) NOT NULL,
    -- step: chunking | event_extraction | event_merge | mapping | statistics | report_generation
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- status: pending | running | completed | error
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    error_msg TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_pipeline_jobs_video ON pipeline_jobs(video_id);
CREATE INDEX idx_pipeline_jobs_status ON pipeline_jobs(video_id, status);

-- ============================================================
-- PHASE 6: ANALYSIS RUNS
-- ============================================================
CREATE TABLE analysis_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    -- status: pending | aggregating | detecting | categorizing | theming
    --         | review | confirmed | analyzing | generating | completed | error
    config JSONB NOT NULL DEFAULT '{}',
    -- configuration for the analysis run (model settings, thresholds, etc.)
    error_msg TEXT,
    completed_at TIMESTAMPTZ
);

-- ============================================================
-- PHASE 6: PATTERNS (recurring strategies)
-- ============================================================
CREATE TABLE patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    checklist_item_id UUID REFERENCES checklist_items(id),
    event_key VARCHAR(200),
    description TEXT,
    frequency_score NUMERIC(6,3),
    threshold_method VARCHAR(100),           -- how the threshold was determined
    intra_teacher_count INTEGER DEFAULT 0,   -- how many teachers show this pattern in both videos
    cross_teacher_count INTEGER DEFAULT 0,   -- how many different teachers show this pattern
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patterns_analysis ON patterns(analysis_run_id);

-- ============================================================
-- PHASE 6: CATEGORIES (behavior categories)
-- ============================================================
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    pattern_ids UUID[] NOT NULL DEFAULT '{}',
    -- array of pattern IDs that belong to this category
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_categories_analysis ON categories(analysis_run_id);

-- ============================================================
-- PHASE 6: THEMES (higher-level themes from grounded theory)
-- ============================================================
CREATE TABLE themes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    reasoning_trace TEXT,                    -- AI explanation with cited evidence
    category_ids UUID[] NOT NULL DEFAULT '{}',
    -- array of category IDs that belong to this theme
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    -- status: draft | confirmed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_themes_analysis ON themes(analysis_run_id);
CREATE INDEX idx_themes_status ON themes(analysis_run_id, status);

-- ============================================================
-- PHASE 6: TEACHER ANALYSES
-- ============================================================
CREATE TABLE teacher_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_run_id UUID NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    teacher_id VARCHAR(20) NOT NULL,
    theme_ids UUID[] NOT NULL DEFAULT '{}',
    context_summary TEXT,
    markdown_content TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_teacher_analyses_analysis ON teacher_analyses(analysis_run_id);
CREATE INDEX idx_teacher_analyses_teacher ON teacher_analyses(teacher_id);

-- ============================================================
-- PHASE 6: INTERVIEW QUESTIONS
-- ============================================================
CREATE TABLE interview_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_analysis_id UUID NOT NULL REFERENCES teacher_analyses(id) ON DELETE CASCADE,
    teacher_id VARCHAR(20) NOT NULL,
    type VARCHAR(20) NOT NULL,               -- core | dynamic
    question_text TEXT NOT NULL,
    evidence_ref TEXT,                        -- cited evidence (timestamps, counts)
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_interview_questions_analysis ON interview_questions(teacher_analysis_id);
CREATE INDEX idx_interview_questions_teacher ON interview_questions(teacher_id);
