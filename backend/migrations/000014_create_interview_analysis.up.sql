-- ============================================================
-- Migration 000014: Create Interview Analysis Tables
-- Post-Interview Analysis: Audio Transcription, Meaning Units, Coding, Triangulation
-- ============================================================

-- 1. Interview Audio & Responses (ghi âm & câu trả lời phỏng vấn)
CREATE TABLE IF NOT EXISTS interview_responses (
    id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_run_id     UUID         NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    teacher_id          VARCHAR(10)  NOT NULL,
    question_id         UUID         REFERENCES interview_questions(id) ON DELETE SET NULL,
    question_text       TEXT         NOT NULL DEFAULT '',
    audio_blob_path     TEXT,                  -- Đường dẫn lưu file audio (/storage/interviews/...)
    audio_filename      VARCHAR(255),          -- Tên file gốc người dùng tải lên
    audio_duration_sec  FLOAT        DEFAULT 0, -- Thời lượng audio (giây)
    language            VARCHAR(10)  DEFAULT 'vi', -- 'en', 'vi', 'mixed'
    raw_transcript      TEXT,                  -- Văn bản bóc băng thô nguyên gốc từ AI (có timestamps/speaker)
    transcript_status   VARCHAR(30)  NOT NULL DEFAULT 'draft', -- 'draft', 'uploading', 'transcribing', 'transcribed', 'reviewed', 'finalized'
    response_text       TEXT         NOT NULL DEFAULT '', -- Văn bản câu trả lời sau khi manual review & finalized
    recorded_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_responses_run ON interview_responses(analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_interview_responses_teacher ON interview_responses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_interview_responses_run_teacher ON interview_responses(analysis_run_id, teacher_id);
CREATE INDEX IF NOT EXISTS idx_interview_responses_status ON interview_responses(transcript_status);

-- 2. Meaning Units (đơn vị ý nghĩa đã tách)
CREATE TABLE IF NOT EXISTS meaning_units (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    response_id     UUID         NOT NULL REFERENCES interview_responses(id) ON DELETE CASCADE,
    teacher_id      VARCHAR(10)  NOT NULL,
    unit_text       TEXT         NOT NULL,
    unit_index      INTEGER      NOT NULL,
    initial_code    VARCHAR(200),
    category        VARCHAR(200),
    is_ai_generated BOOLEAN      NOT NULL DEFAULT TRUE,
    is_user_edited  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meaning_units_response ON meaning_units(response_id);
CREATE INDEX IF NOT EXISTS idx_meaning_units_teacher ON meaning_units(teacher_id);
CREATE INDEX IF NOT EXISTS idx_meaning_units_category ON meaning_units(category);

-- 3. Interview Codes (bảng mã tổng hợp với frequency)
CREATE TABLE IF NOT EXISTS interview_codes (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_run_id UUID         NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    code_name       VARCHAR(200) NOT NULL,
    category        VARCHAR(200) NOT NULL,
    frequency       INTEGER      NOT NULL DEFAULT 0,
    teacher_ids     TEXT[]       DEFAULT '{}',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interview_codes_run ON interview_codes(analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_interview_codes_category ON interview_codes(category);

-- 4. Observation–Interview Triangulation
CREATE TABLE IF NOT EXISTS triangulation_entries (
    id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_run_id     UUID         NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    observation_finding TEXT         NOT NULL,
    interview_evidence  TEXT         NOT NULL,
    teacher_ref         VARCHAR(10),
    relationship        VARCHAR(50)  NOT NULL DEFAULT 'confirms', -- confirms | explains | contradicts | adds_info
    theme_id            UUID         REFERENCES themes(id) ON DELETE SET NULL,
    is_ai_generated     BOOLEAN      NOT NULL DEFAULT TRUE,
    is_user_edited      BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triangulation_run ON triangulation_entries(analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_triangulation_relationship ON triangulation_entries(relationship);

-- 5. Representative Quotes (trích dẫn tiêu biểu)
CREATE TABLE IF NOT EXISTS representative_quotes (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    analysis_run_id UUID         NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
    teacher_id      VARCHAR(10)  NOT NULL,
    quote_text      TEXT         NOT NULL,
    quote_source    VARCHAR(100),
    theme_id        UUID         REFERENCES themes(id) ON DELETE SET NULL,
    rq_category     VARCHAR(10),            -- 'RQ1', 'RQ2', 'RQ3'
    relevance_type  VARCHAR(50),            -- 'explains_observation', 'representative', 'notable_difference', 'answers_rq'
    is_selected     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rep_quotes_run ON representative_quotes(analysis_run_id);
CREATE INDEX IF NOT EXISTS idx_rep_quotes_teacher ON representative_quotes(teacher_id);
CREATE INDEX IF NOT EXISTS idx_rep_quotes_rq ON representative_quotes(rq_category);

-- 6. Default AI Flow Configurations for Interview Transcription and Qualitative Analysis
INSERT INTO flow_configs (flow_key, model_catalog_id, api_key_id, temperature, fallback_model_catalog_id)
VALUES
    ('interview_transcription', '10000000-0000-0000-0000-000000000001', (SELECT id FROM api_keys WHERE is_default = TRUE LIMIT 1), 0.20, '10000000-0000-0000-0000-000000000005'),
    ('interview_analysis',      '10000000-0000-0000-0000-000000000001', (SELECT id FROM api_keys WHERE is_default = TRUE LIMIT 1), 0.30, '10000000-0000-0000-0000-000000000001')
ON CONFLICT (flow_key) DO NOTHING;

