-- Rollback: Remove GCP Vertex AI support

-- 1. Remove Vertex AI models from catalog
DELETE FROM ai_models WHERE provider = 'vertex_ai';

-- 2. Remove metadata column from api_keys
ALTER TABLE api_keys DROP COLUMN IF EXISTS metadata;
