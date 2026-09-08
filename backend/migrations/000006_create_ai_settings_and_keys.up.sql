-- ============================================================
-- AI Settings, Model Registry & Key Vault
-- ============================================================

-- 1. API Keys Vault
CREATE TABLE IF NOT EXISTS api_keys (
    id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider     VARCHAR(50)  NOT NULL, -- 'gemini', 'openrouter', 'anthropic', 'openai'
    label        VARCHAR(100) NOT NULL,
    key_secret   TEXT         NOT NULL,
    is_default   BOOLEAN      NOT NULL DEFAULT FALSE,
    status       VARCHAR(50)  NOT NULL DEFAULT 'active',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider);

-- 2. AI Model Catalog
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

-- 3. Flow Configurations (Routing registry per stage)
CREATE TABLE IF NOT EXISTS flow_configs (
    flow_key          VARCHAR(50)  PRIMARY KEY,
    model_id          VARCHAR(100) NOT NULL REFERENCES ai_models(id) ON DELETE CASCADE,
    api_key_id        UUID         REFERENCES api_keys(id) ON DELETE SET NULL,
    temperature       NUMERIC(3,2) NOT NULL DEFAULT 0.2,
    fallback_model_id VARCHAR(100),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Seed Default AI Models
-- ============================================================
INSERT INTO ai_models (id, provider, display_name, context_tokens, supports_multimodal, supports_reasoning, is_active, sort_order)
VALUES
    ('gemini-3.7-flash',  'gemini',     'Google: Gemini 3.7 Flash',                 1048576, TRUE,  TRUE,  TRUE, 1),
    ('gemini-2.5-flash',  'gemini',     'Google: Gemini 2.5 Flash',                 1048576, TRUE,  FALSE, TRUE, 2),
    ('gemini-2.5-pro',    'gemini',     'Google: Gemini 2.5 Pro',                   2097152, TRUE,  TRUE,  TRUE, 3),
    ('claude-3.7-sonnet', 'openrouter', 'Anthropic: Claude 3.7 Sonnet (OpenRouter)', 200000,  FALSE, TRUE,  TRUE, 4),
    ('gpt-4o',            'openrouter', 'OpenAI: GPT-4o (OpenRouter)',               128000,  FALSE, TRUE,  TRUE, 5),
    ('deepseek-r1',       'openrouter', 'DeepSeek: R1 (OpenRouter)',                  64000,   FALSE, TRUE,  TRUE, 6)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    context_tokens = EXCLUDED.context_tokens,
    supports_multimodal = EXCLUDED.supports_multimodal,
    supports_reasoning = EXCLUDED.supports_reasoning,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order;

-- ============================================================
-- Seed Default Flow Configurations
-- ============================================================
INSERT INTO flow_configs (flow_key, model_id, temperature, fallback_model_id)
VALUES
    ('video_extraction',   'gemini-3.7-flash', 0.20, 'gemini-2.5-flash'),
    ('checklist_mapping',  'gemini-3.7-flash', 0.10, 'gemini-2.5-flash'),
    ('thematic_analysis',  'gemini-3.7-flash', 0.40, 'gemini-3.7-flash'),
    ('interview_generator','gemini-3.7-flash', 0.50, 'gemini-3.7-flash'),
    ('codebook_generation','gemini-3.7-flash', 0.30, 'gemini-2.5-flash')
ON CONFLICT (flow_key) DO UPDATE SET
    model_id = EXCLUDED.model_id,
    temperature = EXCLUDED.temperature,
    fallback_model_id = EXCLUDED.fallback_model_id;
