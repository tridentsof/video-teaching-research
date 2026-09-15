-- Migration: Add GCP Vertex AI support
-- Adds metadata JSONB column to api_keys for provider-specific configuration (project_id, region, gcs_bucket)
-- Seeds Vertex AI models into the ai_models catalog

-- 1. Add metadata column to api_keys
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 2. Seed Vertex AI models into catalog
INSERT INTO ai_models (id, provider, display_name, context_tokens, supports_multimodal, supports_reasoning, is_active, sort_order)
VALUES
    ('vertex/gemini-2.5-flash',  'vertex_ai', 'Vertex AI: Gemini 2.5 Flash',  1048576, TRUE,  FALSE, TRUE, 10),
    ('vertex/gemini-2.5-pro',    'vertex_ai', 'Vertex AI: Gemini 2.5 Pro',    2097152, TRUE,  TRUE,  TRUE, 11),
    ('vertex/gemini-3.7-flash',  'vertex_ai', 'Vertex AI: Gemini 3.7 Flash',  1048576, TRUE,  TRUE,  TRUE, 12)
ON CONFLICT (id) DO NOTHING;
