-- ============================================================
-- Video Teaching Research: AI Settings & Key Vault Seed Script
-- Safe to run multiple times in Supabase SQL Editor or psql
-- ============================================================

BEGIN;

-- 1. Ensure Tables Exist
CREATE TABLE IF NOT EXISTS api_keys (
    id           UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider     VARCHAR(50)  NOT NULL,
    label        VARCHAR(100) NOT NULL,
    key_secret   TEXT         NOT NULL,
    is_default   BOOLEAN      NOT NULL DEFAULT FALSE,
    status       VARCHAR(50)  NOT NULL DEFAULT 'active',
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_provider ON api_keys(provider);

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

-- 2. Upsert AI Model Catalog
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
    ('deepseek-r1',              'openrouter', 'DeepSeek: R1 (OpenRouter)',                  64000,   FALSE, TRUE,  TRUE, 9)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    context_tokens = EXCLUDED.context_tokens,
    supports_multimodal = EXCLUDED.supports_multimodal,
    supports_reasoning = EXCLUDED.supports_reasoning,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order;

-- 3. Seed Primary Gemini API Key from Current .env
-- Key ID: a0000000-0000-0000-0000-000000000001 (Deterministic UUID for idempotent seeding)
INSERT INTO api_keys (id, provider, label, key_secret, is_default, status)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'gemini',
    'Gemini Primary (Environment)',
    'GEMINI_API_KEY_PLACEHOLDER',
    TRUE,
    'active'
)
ON CONFLICT (id) DO UPDATE SET
    key_secret = EXCLUDED.key_secret,
    label = EXCLUDED.label,
    is_default = EXCLUDED.is_default,
    status = EXCLUDED.status,
    updated_at = NOW();

-- 4. Seed 5 Pipeline Flow Configurations Linked to the Primary Key
INSERT INTO flow_configs (flow_key, model_id, api_key_id, temperature, fallback_model_id)
VALUES
    ('video_extraction',    'gemini-3.7-flash', 'a0000000-0000-0000-0000-000000000001', 0.20, 'gemini-2.5-flash'),
    ('checklist_mapping',   'gemini-3.7-flash', 'a0000000-0000-0000-0000-000000000001', 0.10, 'gemini-2.5-flash'),
    ('thematic_analysis',   'gemini-3.7-flash', 'a0000000-0000-0000-0000-000000000001', 0.40, 'gemini-3.7-flash'),
    ('interview_generator', 'gemini-3.7-flash', 'a0000000-0000-0000-0000-000000000001', 0.50, 'gemini-3.7-flash'),
    ('codebook_generation', 'gemini-3.7-flash', 'a0000000-0000-0000-0000-000000000001', 0.30, 'gemini-2.5-flash')
ON CONFLICT (flow_key) DO UPDATE SET
    model_id = EXCLUDED.model_id,
    api_key_id = EXCLUDED.api_key_id,
    temperature = EXCLUDED.temperature,
    fallback_model_id = EXCLUDED.fallback_model_id,
    updated_at = NOW();

COMMIT;
