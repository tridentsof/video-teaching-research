-- Migration: Refactor AI Models & Flow Configs (Option A: UUID + Unique Provider-Model)
-- 1. ai_models uses UUID PK + UNIQUE(provider, model_id)
-- 2. flow_configs uses model_catalog_id UUID referencing ai_models(id)

-- Step 1: Drop foreign key constraints and dependent objects
ALTER TABLE IF EXISTS flow_configs DROP CONSTRAINT IF EXISTS flow_configs_model_id_fkey;
ALTER TABLE IF EXISTS flow_configs DROP CONSTRAINT IF EXISTS flow_configs_model_catalog_id_fkey;
ALTER TABLE IF EXISTS flow_configs DROP CONSTRAINT IF EXISTS flow_configs_fallback_model_catalog_id_fkey;

-- Step 2: Drop existing ai_models and flow_configs tables to restructure cleanly
DROP TABLE IF EXISTS flow_configs CASCADE;
DROP TABLE IF EXISTS ai_models CASCADE;

-- Step 3: Recreate ai_models table with UUID PK and UNIQUE(provider, model_id)
CREATE TABLE ai_models (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider            VARCHAR(50)  NOT NULL, -- 'gemini', 'vertex_ai', 'openrouter'
    model_id            VARCHAR(100) NOT NULL, -- Pure vendor technical ID (e.g. 'gemini-3.7-flash')
    display_name        VARCHAR(150) NOT NULL,
    context_tokens      INTEGER      NOT NULL DEFAULT 128000,
    supports_multimodal BOOLEAN      NOT NULL DEFAULT FALSE,
    supports_reasoning  BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order          INTEGER      NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_provider_model_id UNIQUE(provider, model_id)
);

CREATE INDEX idx_ai_models_provider ON ai_models(provider);

-- Step 4: Seed standard model catalog using deterministic UUIDs for reproducibility
INSERT INTO ai_models (id, provider, model_id, display_name, context_tokens, supports_multimodal, supports_reasoning, is_active, sort_order)
VALUES
    -- Google AI Studio (gemini direct API)
    ('10000000-0000-0000-0000-000000000001', 'gemini', 'gemini-3.7-flash',       'Google: Gemini 3.7 Flash',                 1048576, TRUE,  TRUE,  TRUE, 1),
    ('10000000-0000-0000-0000-000000000002', 'gemini', 'gemini-3.6-flash',       'Google: Gemini 3.6 Flash',                 1048576, TRUE,  TRUE,  TRUE, 2),
    ('10000000-0000-0000-0000-000000000003', 'gemini', 'gemini-3.5-flash',       'Google: Gemini 3.5 Flash',                 1048576, TRUE,  TRUE,  TRUE, 3),
    ('10000000-0000-0000-0000-000000000004', 'gemini', 'gemini-3-flash-preview', 'Google: Gemini 3 Flash Preview',           1048576, TRUE,  TRUE,  TRUE, 4),
    ('10000000-0000-0000-0000-000000000005', 'gemini', 'gemini-2.5-flash',       'Google: Gemini 2.5 Flash',                 1048576, TRUE,  FALSE, TRUE, 5),
    ('10000000-0000-0000-0000-000000000006', 'gemini', 'gemini-2.5-pro',         'Google: Gemini 2.5 Pro',                   2097152, TRUE,  TRUE,  TRUE, 6),
    ('10000000-0000-0000-0000-000000000007', 'gemini', 'gemini-3.8-flash',       'Google: Gemini 3.8 Flash (Preview)',       1048576, TRUE,  TRUE,  TRUE, 7),

    -- Google Cloud Vertex AI (vertex_ai) - Pure vendor IDs identical to Gemini, independent provider
    ('20000000-0000-0000-0000-000000000001', 'vertex_ai', 'gemini-3.7-flash',   'Vertex AI: Gemini 3.7 Flash',              1048576, TRUE,  TRUE,  TRUE, 10),
    ('20000000-0000-0000-0000-000000000002', 'vertex_ai', 'gemini-2.5-pro',     'Vertex AI: Gemini 2.5 Pro',                2097152, TRUE,  TRUE,  TRUE, 11),
    ('20000000-0000-0000-0000-000000000003', 'vertex_ai', 'gemini-2.5-flash',   'Vertex AI: Gemini 2.5 Flash',              1048576, TRUE,  FALSE, TRUE, 12),
    ('20000000-0000-0000-0000-000000000004', 'vertex_ai', 'gemini-3.8-flash',   'Vertex AI: Gemini 3.8 Flash (Global)',     1048576, TRUE,  TRUE,  TRUE, 13),

    -- OpenRouter (openrouter)
    ('30000000-0000-0000-0000-000000000001', 'openrouter', 'anthropic/claude-3.7-sonnet', 'Anthropic: Claude 3.7 Sonnet (OpenRouter)', 200000, FALSE, TRUE, TRUE, 20),
    ('30000000-0000-0000-0000-000000000002', 'openrouter', 'openai/gpt-4o',              'OpenAI: GPT-4o (OpenRouter)',               128000, FALSE, TRUE, TRUE, 21),
    ('30000000-0000-0000-0000-000000000003', 'openrouter', 'deepseek/deepseek-r1',        'DeepSeek: R1 (OpenRouter)',                  64000,  FALSE, TRUE, TRUE, 22),
    ('30000000-0000-0000-0000-000000000004', 'openrouter', 'claude-3.7-sonnet',          'Anthropic: Claude 3.7 Sonnet (Direct)',     200000, FALSE, TRUE, TRUE, 23),
    ('30000000-0000-0000-0000-000000000005', 'openrouter', 'gpt-4o',                     'OpenAI: GPT-4o (Direct)',                   128000, FALSE, TRUE, TRUE, 24),
    ('30000000-0000-0000-0000-000000000006', 'openrouter', 'deepseek-r1',                'DeepSeek: R1 (Direct)',                      64000,  FALSE, TRUE, TRUE, 25)
ON CONFLICT (provider, model_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    context_tokens = EXCLUDED.context_tokens,
    supports_multimodal = EXCLUDED.supports_multimodal,
    supports_reasoning = EXCLUDED.supports_reasoning,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order;

-- Step 5: Recreate flow_configs table referencing ai_models(id) via model_catalog_id
CREATE TABLE flow_configs (
    flow_key                  VARCHAR(50)  PRIMARY KEY,
    model_catalog_id          UUID         NOT NULL REFERENCES ai_models(id) ON DELETE RESTRICT,
    api_key_id                UUID         REFERENCES api_keys(id) ON DELETE SET NULL,
    temperature               NUMERIC(3,2) NOT NULL DEFAULT 0.2,
    fallback_model_catalog_id UUID         REFERENCES ai_models(id) ON DELETE SET NULL,
    updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Step 6: Re-seed default 5 pipeline flows bound to default Gemini models and primary key
INSERT INTO flow_configs (flow_key, model_catalog_id, api_key_id, temperature, fallback_model_catalog_id)
VALUES
    ('video_extraction',    '10000000-0000-0000-0000-000000000001', (SELECT id FROM api_keys WHERE provider = 'gemini' AND is_default = TRUE LIMIT 1), 0.20, '10000000-0000-0000-0000-000000000005'),
    ('checklist_mapping',   '10000000-0000-0000-0000-000000000001', (SELECT id FROM api_keys WHERE provider = 'gemini' AND is_default = TRUE LIMIT 1), 0.10, '10000000-0000-0000-0000-000000000005'),
    ('thematic_analysis',   '10000000-0000-0000-0000-000000000001', (SELECT id FROM api_keys WHERE provider = 'gemini' AND is_default = TRUE LIMIT 1), 0.40, '10000000-0000-0000-0000-000000000001'),
    ('interview_generator', '10000000-0000-0000-0000-000000000001', (SELECT id FROM api_keys WHERE provider = 'gemini' AND is_default = TRUE LIMIT 1), 0.50, '10000000-0000-0000-0000-000000000001'),
    ('codebook_generation', '10000000-0000-0000-0000-000000000001', (SELECT id FROM api_keys WHERE provider = 'gemini' AND is_default = TRUE LIMIT 1), 0.30, '10000000-0000-0000-0000-000000000005')
ON CONFLICT (flow_key) DO UPDATE SET
    model_catalog_id = EXCLUDED.model_catalog_id,
    api_key_id = EXCLUDED.api_key_id,
    temperature = EXCLUDED.temperature,
    fallback_model_catalog_id = EXCLUDED.fallback_model_catalog_id,
    updated_at = NOW();
