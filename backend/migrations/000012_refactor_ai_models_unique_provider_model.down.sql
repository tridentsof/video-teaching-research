-- Down Migration: Revert AI Models & Flow Configs refactor
DROP TABLE IF EXISTS flow_configs CASCADE;
DROP TABLE IF EXISTS ai_models CASCADE;

CREATE TABLE IF NOT EXISTS ai_models (
    id                  VARCHAR(100) PRIMARY KEY,
    provider            VARCHAR(50)  NOT NULL,
    display_name        VARCHAR(150) NOT NULL,
    context_tokens      INTEGER      NOT NULL DEFAULT 128000,
    supports_multimodal BOOLEAN      NOT NULL DEFAULT FALSE,
    supports_reasoning  BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order          INTEGER      NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flow_configs (
    flow_key          VARCHAR(50)  PRIMARY KEY,
    model_id          VARCHAR(100) NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    api_key_id        UUID         REFERENCES api_keys(id) ON DELETE SET NULL,
    temperature       NUMERIC(3,2) NOT NULL DEFAULT 0.2,
    fallback_model_id VARCHAR(100),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed models
INSERT INTO ai_models (id, provider, display_name, context_tokens, supports_multimodal, supports_reasoning, is_active, sort_order)
VALUES
    ('gemini-3.7-flash',         'gemini',     'Google: Gemini 3.7 Flash',                 1048576, TRUE,  TRUE,  TRUE, 1),
    ('gemini-3.6-flash',         'gemini',     'Google: Gemini 3.6 Flash',                 1048576, TRUE,  TRUE,  TRUE, 2),
    ('gemini-3.5-flash',         'gemini',     'Google: Gemini 3.5 Flash',                 1048576, TRUE,  TRUE,  TRUE, 3),
    ('gemini-3-flash-preview',   'gemini',     'Google: Gemini 3 Flash Preview',           1048576, TRUE,  TRUE,  TRUE, 4),
    ('gemini-2.5-flash',         'gemini',     'Google: Gemini 2.5 Flash',                 1048576, TRUE,  FALSE, TRUE, 5),
    ('gemini-2.5-pro',           'gemini',     'Google: Gemini 2.5 Pro',                   2097152, TRUE,  TRUE,  TRUE, 6),
    ('claude-3.7-sonnet',        'openrouter', 'Anthropic: Claude 3.7 Sonnet (OpenRouter)', 200000,  FALSE, TRUE,  TRUE, 7),
    ('gpt-4o',                   'openrouter', 'OpenAI: GPT-4o (OpenRouter)',               128000,  FALSE, TRUE,  TRUE, 8),
    ('deepseek-r1',              'openrouter', 'DeepSeek: R1 (OpenRouter)',                  64000,   FALSE, TRUE,  TRUE, 9),
    ('vertex/gemini-2.5-flash',  'vertex_ai',  'Vertex AI: Gemini 2.5 Flash',              1048576, TRUE,  FALSE, TRUE, 10),
    ('vertex/gemini-2.5-pro',    'vertex_ai',  'Vertex AI: Gemini 2.5 Pro',                2097152, TRUE,  TRUE,  TRUE, 11),
    ('vertex/gemini-3.7-flash',  'vertex_ai',  'Vertex AI: Gemini 3.7 Flash',              1048576, TRUE,  TRUE,  TRUE, 12)
ON CONFLICT (id) DO NOTHING;

INSERT INTO flow_configs (flow_key, model_id, temperature, fallback_model_id)
VALUES
    ('video_extraction',   'gemini-3.7-flash', 0.20, 'gemini-2.5-flash'),
    ('checklist_mapping',  'gemini-3.7-flash', 0.10, 'gemini-2.5-flash'),
    ('thematic_analysis',  'gemini-3.7-flash', 0.40, 'gemini-3.7-flash'),
    ('interview_generator','gemini-3.7-flash', 0.50, 'gemini-3.7-flash'),
    ('codebook_generation','gemini-3.7-flash', 0.30, 'gemini-2.5-flash')
ON CONFLICT (flow_key) DO NOTHING;
