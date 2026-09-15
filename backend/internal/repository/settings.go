package repository

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
)

// SettingsRepository manages api_keys, ai_models, and flow_configs database operations.
type SettingsRepository struct {
	db *DB
}

// NewSettingsRepository creates a new SettingsRepository.
func NewSettingsRepository(db *DB) *SettingsRepository {
	return &SettingsRepository{db: db}
}

// EnsureTablesAndSeed ensures tables exist and default seed data is present on startup.
func (r *SettingsRepository) EnsureTablesAndSeed(ctx context.Context) error {
	query := `
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
		id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
		provider            VARCHAR(50)  NOT NULL,
		model_id            VARCHAR(100) NOT NULL,
		display_name        VARCHAR(150) NOT NULL,
		context_tokens      INTEGER      NOT NULL DEFAULT 128000,
		supports_multimodal BOOLEAN      NOT NULL DEFAULT FALSE,
		supports_reasoning  BOOLEAN      NOT NULL DEFAULT FALSE,
		is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
		sort_order          INTEGER      NOT NULL DEFAULT 0,
		created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
		CONSTRAINT uq_provider_model_id UNIQUE(provider, model_id)
	);

	CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider);

	CREATE TABLE IF NOT EXISTS flow_configs (
		flow_key                  VARCHAR(50)  PRIMARY KEY,
		model_catalog_id          UUID         NOT NULL REFERENCES ai_models(id) ON DELETE RESTRICT,
		api_key_id                UUID         REFERENCES api_keys(id) ON DELETE SET NULL,
		temperature               NUMERIC(3,2) NOT NULL DEFAULT 0.2,
		fallback_model_catalog_id UUID         REFERENCES ai_models(id) ON DELETE SET NULL,
		updated_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW()
	);

	INSERT INTO ai_models (id, provider, model_id, display_name, context_tokens, supports_multimodal, supports_reasoning, is_active, sort_order)
	VALUES
		('10000000-0000-0000-0000-000000000001', 'gemini',     'gemini-3.7-flash',       'Google: Gemini 3.7 Flash',                 1048576, TRUE,  TRUE,  TRUE, 1),
		('10000000-0000-0000-0000-000000000002', 'gemini',     'gemini-3.6-flash',       'Google: Gemini 3.6 Flash',                 1048576, TRUE,  TRUE,  TRUE, 2),
		('10000000-0000-0000-0000-000000000003', 'gemini',     'gemini-3.5-flash',       'Google: Gemini 3.5 Flash',                 1048576, TRUE,  TRUE,  TRUE, 3),
		('10000000-0000-0000-0000-000000000004', 'gemini',     'gemini-3-flash-preview', 'Google: Gemini 3 Flash Preview',           1048576, TRUE,  TRUE,  TRUE, 4),
		('10000000-0000-0000-0000-000000000005', 'gemini',     'gemini-2.5-flash',       'Google: Gemini 2.5 Flash',                 1048576, TRUE,  FALSE, TRUE, 5),
		('10000000-0000-0000-0000-000000000006', 'gemini',     'gemini-2.5-pro',         'Google: Gemini 2.5 Pro',                   2097152, TRUE,  TRUE,  TRUE, 6),
		('10000000-0000-0000-0000-000000000007', 'gemini',     'gemini-3.8-flash',       'Google: Gemini 3.8 Flash (Preview)',       1048576, TRUE,  TRUE,  TRUE, 7),
		('20000000-0000-0000-0000-000000000001', 'vertex_ai',  'gemini-3.7-flash',       'Vertex AI: Gemini 3.7 Flash',              1048576, TRUE,  TRUE,  TRUE, 10),
		('20000000-0000-0000-0000-000000000002', 'vertex_ai',  'gemini-2.5-pro',         'Vertex AI: Gemini 2.5 Pro',                2097152, TRUE,  TRUE,  TRUE, 11),
		('20000000-0000-0000-0000-000000000003', 'vertex_ai',  'gemini-2.5-flash',       'Vertex AI: Gemini 2.5 Flash',              1048576, TRUE,  FALSE, TRUE, 12),
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

	INSERT INTO flow_configs (flow_key, model_catalog_id, temperature, fallback_model_catalog_id)
	VALUES
		('video_extraction',    '10000000-0000-0000-0000-000000000001', 0.20, '10000000-0000-0000-0000-000000000005'),
		('checklist_mapping',   '10000000-0000-0000-0000-000000000001', 0.10, '10000000-0000-0000-0000-000000000005'),
		('thematic_analysis',   '10000000-0000-0000-0000-000000000001', 0.40, '10000000-0000-0000-0000-000000000001'),
		('interview_generator', '10000000-0000-0000-0000-000000000001', 0.50, '10000000-0000-0000-0000-000000000001'),
		('codebook_generation', '10000000-0000-0000-0000-000000000001', 0.30, '10000000-0000-0000-0000-000000000005')
	ON CONFLICT (flow_key) DO NOTHING;
	`
	_, err := r.db.Pool.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to ensure settings tables: %w", err)
	}
	return nil
}

// scanAPIKey scans a single api_keys row including the metadata JSONB column.
func scanAPIKey(scan func(dest ...interface{}) error) (model.APIKey, error) {
	var k model.APIKey
	var metadataBytes []byte
	err := scan(&k.ID, &k.Provider, &k.Label, &k.KeySecret, &k.IsDefault, &k.Status, &metadataBytes, &k.CreatedAt, &k.UpdatedAt)
	if err != nil {
		return k, err
	}
	if len(metadataBytes) > 0 && string(metadataBytes) != "{}" {
		var meta model.APIKeyMetadata
		if jsonErr := json.Unmarshal(metadataBytes, &meta); jsonErr == nil {
			k.Metadata = &meta
		}
	}
	return k, nil
}

// ListAPIKeys returns all saved API keys.
func (r *SettingsRepository) ListAPIKeys(ctx context.Context) ([]model.APIKey, error) {
	query := `
		SELECT id, provider, label, key_secret, is_default, status, COALESCE(metadata, '{}'::jsonb), created_at, updated_at
		FROM api_keys
		ORDER BY created_at ASC
	`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list api keys: %w", err)
	}
	defer rows.Close()

	var keys []model.APIKey
	for rows.Next() {
		k, err := scanAPIKey(rows.Scan)
		if err != nil {
			return nil, fmt.Errorf("failed to scan api key: %w", err)
		}
		keys = append(keys, k)
	}
	return keys, nil
}

// GetAPIKeyByID retrieves a specific key by ID.
func (r *SettingsRepository) GetAPIKeyByID(ctx context.Context, id uuid.UUID) (*model.APIKey, error) {
	query := `
		SELECT id, provider, label, key_secret, is_default, status, COALESCE(metadata, '{}'::jsonb), created_at, updated_at
		FROM api_keys
		WHERE id = $1
	`
	k, err := scanAPIKey(func(dest ...interface{}) error {
		return r.db.Pool.QueryRow(ctx, query, id).Scan(dest...)
	})
	if err != nil {
		return nil, err
	}
	return &k, nil
}

// GetDefaultAPIKeyByProvider returns the default key for a given provider.
func (r *SettingsRepository) GetDefaultAPIKeyByProvider(ctx context.Context, provider string) (*model.APIKey, error) {
	query := `
		SELECT id, provider, label, key_secret, is_default, status, COALESCE(metadata, '{}'::jsonb), created_at, updated_at
		FROM api_keys
		WHERE provider = $1 AND status = 'active'
		ORDER BY is_default DESC, created_at ASC
		LIMIT 1
	`
	k, err := scanAPIKey(func(dest ...interface{}) error {
		return r.db.Pool.QueryRow(ctx, query, provider).Scan(dest...)
	})
	if err != nil {
		return nil, err
	}
	return &k, nil
}

// CreateAPIKey saves a new API key into the vault.
func (r *SettingsRepository) CreateAPIKey(ctx context.Context, key *model.APIKey) error {
	if key.ID == uuid.Nil {
		key.ID = uuid.New()
	}
	now := time.Now()
	key.CreatedAt = now
	key.UpdatedAt = now

	// If marked default, unset other defaults for this provider
	if key.IsDefault {
		_, _ = r.db.Pool.Exec(ctx, `UPDATE api_keys SET is_default = FALSE WHERE provider = $1`, key.Provider)
	}

	metadataBytes := []byte("{}")
	if key.Metadata != nil {
		if b, err := json.Marshal(key.Metadata); err == nil {
			metadataBytes = b
		}
	}

	query := `
		INSERT INTO api_keys (id, provider, label, key_secret, is_default, status, metadata, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
	`
	_, err := r.db.Pool.Exec(ctx, query,
		key.ID, key.Provider, key.Label, key.KeySecret, key.IsDefault, key.Status, string(metadataBytes), key.CreatedAt, key.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert api key: %w", err)
	}
	return nil
}

// UpdateAPIKey updates an existing API key's label, status, default flag, and optionally overwrites key secret.
func (r *SettingsRepository) UpdateAPIKey(ctx context.Context, id uuid.UUID, req model.UpdateAPIKeyRequest) error {
	existing, err := r.GetAPIKeyByID(ctx, id)
	if err != nil {
		return fmt.Errorf("api key not found: %w", err)
	}

	if req.IsDefault {
		_, _ = r.db.Pool.Exec(ctx, `UPDATE api_keys SET is_default = FALSE WHERE provider = $1 AND id != $2`, existing.Provider, id)
	}

	status := req.Status
	if status == "" {
		status = existing.Status
	}

	metadataBytes := []byte("{}")
	if req.Metadata != nil {
		if b, err := json.Marshal(req.Metadata); err == nil {
			metadataBytes = b
		}
	} else if existing.Metadata != nil {
		if b, err := json.Marshal(existing.Metadata); err == nil {
			metadataBytes = b
		}
	}

	// If a new secret was provided, overwrite it
	if req.KeySecret != nil && strings.TrimSpace(*req.KeySecret) != "" {
		query := `
			UPDATE api_keys
			SET label = $2, key_secret = $3, is_default = $4, status = $5, metadata = $6::jsonb, updated_at = NOW()
			WHERE id = $1
		`
		_, err = r.db.Pool.Exec(ctx, query, id, req.Label, strings.TrimSpace(*req.KeySecret), req.IsDefault, status, string(metadataBytes))
	} else {
		// Keep existing secret
		query := `
			UPDATE api_keys
			SET label = $2, is_default = $3, status = $4, metadata = $5::jsonb, updated_at = NOW()
			WHERE id = $1
		`
		_, err = r.db.Pool.Exec(ctx, query, id, req.Label, req.IsDefault, status, string(metadataBytes))
	}

	if err != nil {
		return fmt.Errorf("failed to update api key: %w", err)
	}
	return nil
}

// DeleteAPIKey removes an API key from the vault.
func (r *SettingsRepository) DeleteAPIKey(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM api_keys WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete api key: %w", err)
	}
	return nil
}

// ListAIModels returns all active AI models from the catalog.
func (r *SettingsRepository) ListAIModels(ctx context.Context) ([]model.AIModelInfo, error) {
	query := `
		SELECT id, provider, model_id, display_name, context_tokens, supports_multimodal, supports_reasoning, is_active, sort_order, created_at
		FROM ai_models
		WHERE is_active = TRUE
		ORDER BY sort_order ASC, created_at ASC
	`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list ai models: %w", err)
	}
	defer rows.Close()

	var models []model.AIModelInfo
	for rows.Next() {
		var m model.AIModelInfo
		if err := rows.Scan(
			&m.ID, &m.Provider, &m.ModelID, &m.DisplayName, &m.ContextTokens, &m.SupportsMultimodal, &m.SupportsReasoning, &m.IsActive, &m.SortOrder, &m.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan ai model: %w", err)
		}
		models = append(models, m)
	}
	return models, nil
}

// ListAllAIModels returns all AI models (active & inactive) for catalog management.
func (r *SettingsRepository) ListAllAIModels(ctx context.Context) ([]model.AIModelInfo, error) {
	query := `
		SELECT id, provider, model_id, display_name, context_tokens, supports_multimodal, supports_reasoning, is_active, sort_order, created_at
		FROM ai_models
		ORDER BY sort_order ASC, created_at ASC
	`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list all ai models: %w", err)
	}
	defer rows.Close()

	var models []model.AIModelInfo
	for rows.Next() {
		var m model.AIModelInfo
		if err := rows.Scan(
			&m.ID, &m.Provider, &m.ModelID, &m.DisplayName, &m.ContextTokens, &m.SupportsMultimodal, &m.SupportsReasoning, &m.IsActive, &m.SortOrder, &m.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan ai model: %w", err)
		}
		models = append(models, m)
	}
	return models, nil
}

// GetAIModelByID retrieves an AI model by its UUID.
func (r *SettingsRepository) GetAIModelByID(ctx context.Context, id uuid.UUID) (*model.AIModelInfo, error) {
	query := `
		SELECT id, provider, model_id, display_name, context_tokens, supports_multimodal, supports_reasoning, is_active, sort_order, created_at
		FROM ai_models
		WHERE id = $1
	`
	var m model.AIModelInfo
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&m.ID, &m.Provider, &m.ModelID, &m.DisplayName, &m.ContextTokens, &m.SupportsMultimodal, &m.SupportsReasoning, &m.IsActive, &m.SortOrder, &m.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// GetAIModelByProviderAndModelID retrieves an AI model by vendor provider and model_id.
func (r *SettingsRepository) GetAIModelByProviderAndModelID(ctx context.Context, provider, modelID string) (*model.AIModelInfo, error) {
	query := `
		SELECT id, provider, model_id, display_name, context_tokens, supports_multimodal, supports_reasoning, is_active, sort_order, created_at
		FROM ai_models
		WHERE provider = $1 AND model_id = $2
	`
	var m model.AIModelInfo
	err := r.db.Pool.QueryRow(ctx, query, provider, modelID).Scan(
		&m.ID, &m.Provider, &m.ModelID, &m.DisplayName, &m.ContextTokens, &m.SupportsMultimodal, &m.SupportsReasoning, &m.IsActive, &m.SortOrder, &m.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// CreateAIModel inserts a new AI model into the catalog.
func (r *SettingsRepository) CreateAIModel(ctx context.Context, m *model.AIModelInfo) error {
	if m.ID == uuid.Nil {
		m.ID = uuid.New()
	}
	if m.ContextTokens <= 0 {
		m.ContextTokens = 128000
	}
	if m.CreatedAt.IsZero() {
		m.CreatedAt = time.Now()
	}

	query := `
		INSERT INTO ai_models (id, provider, model_id, display_name, context_tokens, supports_multimodal, supports_reasoning, is_active, sort_order, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.db.Pool.Exec(ctx, query,
		m.ID, m.Provider, m.ModelID, m.DisplayName, m.ContextTokens, m.SupportsMultimodal, m.SupportsReasoning, m.IsActive, m.SortOrder, m.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create ai model: %w", err)
	}
	return nil
}

// UpdateAIModel updates an existing AI model in the catalog.
func (r *SettingsRepository) UpdateAIModel(ctx context.Context, id uuid.UUID, req model.UpdateAIModelRequest) error {
	if req.ModelID != "" {
		query := `
			UPDATE ai_models
			SET display_name = $2, model_id = $3, context_tokens = $4, supports_multimodal = $5, supports_reasoning = $6, is_active = $7, sort_order = $8
			WHERE id = $1
		`
		_, err := r.db.Pool.Exec(ctx, query,
			id, req.DisplayName, req.ModelID, req.ContextTokens, req.SupportsMultimodal, req.SupportsReasoning, req.IsActive, req.SortOrder,
		)
		if err != nil {
			return fmt.Errorf("failed to update ai model: %w", err)
		}
		return nil
	}

	query := `
		UPDATE ai_models
		SET display_name = $2, context_tokens = $3, supports_multimodal = $4, supports_reasoning = $5, is_active = $6, sort_order = $7
		WHERE id = $1
	`
	_, err := r.db.Pool.Exec(ctx, query,
		id, req.DisplayName, req.ContextTokens, req.SupportsMultimodal, req.SupportsReasoning, req.IsActive, req.SortOrder,
	)
	if err != nil {
		return fmt.Errorf("failed to update ai model: %w", err)
	}
	return nil
}

// DeleteAIModel deletes an AI model from the catalog and clears any fallback references.
func (r *SettingsRepository) DeleteAIModel(ctx context.Context, id uuid.UUID) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Clean up any fallback references so foreign key / dangling references don't linger
	if _, err := tx.Exec(ctx, `UPDATE flow_configs SET fallback_model_catalog_id = NULL WHERE fallback_model_catalog_id = $1`, id); err != nil {
		return fmt.Errorf("failed to clear fallback references: %w", err)
	}

	query := `DELETE FROM ai_models WHERE id = $1`
	if _, err := tx.Exec(ctx, query, id); err != nil {
		return fmt.Errorf("failed to delete ai model: %w", err)
	}
	return tx.Commit(ctx)
}

// IsModelInUse checks if a model catalog ID is currently bound as the primary model to any flow config.
func (r *SettingsRepository) IsModelInUse(ctx context.Context, id uuid.UUID) (bool, []string, error) {
	query := `
		SELECT flow_key 
		FROM flow_configs 
		WHERE model_catalog_id = $1
	`
	rows, err := r.db.Pool.Query(ctx, query, id)
	if err != nil {
		return false, nil, fmt.Errorf("failed to check model usage: %w", err)
	}
	defer rows.Close()

	var usedFlows []string
	for rows.Next() {
		var fk string
		if err := rows.Scan(&fk); err == nil {
			usedFlows = append(usedFlows, fk)
		}
	}
	return len(usedFlows) > 0, usedFlows, nil
}

// ListFlowConfigs returns all flow configuration entries.
func (r *SettingsRepository) ListFlowConfigs(ctx context.Context) ([]model.FlowConfig, error) {
	query := `
		SELECT flow_key, model_catalog_id, api_key_id, temperature, fallback_model_catalog_id, updated_at
		FROM flow_configs
		ORDER BY flow_key ASC
	`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list flow configs: %w", err)
	}
	defer rows.Close()

	var configs []model.FlowConfig
	for rows.Next() {
		var c model.FlowConfig
		if err := rows.Scan(&c.FlowKey, &c.ModelCatalogID, &c.APIKeyID, &c.Temperature, &c.FallbackModelCatalogID, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan flow config: %w", err)
		}
		configs = append(configs, c)
	}
	return configs, nil
}

// GetFlowConfig returns the configuration for a single flow key.
func (r *SettingsRepository) GetFlowConfig(ctx context.Context, flowKey string) (*model.FlowConfig, error) {
	query := `
		SELECT flow_key, model_catalog_id, api_key_id, temperature, fallback_model_catalog_id, updated_at
		FROM flow_configs
		WHERE flow_key = $1
	`
	var c model.FlowConfig
	err := r.db.Pool.QueryRow(ctx, query, flowKey).Scan(
		&c.FlowKey, &c.ModelCatalogID, &c.APIKeyID, &c.Temperature, &c.FallbackModelCatalogID, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// UpsertFlowConfig updates or inserts a flow config.
func (r *SettingsRepository) UpsertFlowConfig(ctx context.Context, cfg model.FlowConfig) error {
	query := `
		INSERT INTO flow_configs (flow_key, model_catalog_id, api_key_id, temperature, fallback_model_catalog_id, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (flow_key) DO UPDATE SET
			model_catalog_id = EXCLUDED.model_catalog_id,
			api_key_id = EXCLUDED.api_key_id,
			temperature = EXCLUDED.temperature,
			fallback_model_catalog_id = EXCLUDED.fallback_model_catalog_id,
			updated_at = NOW()
	`
	_, err := r.db.Pool.Exec(ctx, query, cfg.FlowKey, cfg.ModelCatalogID, cfg.APIKeyID, cfg.Temperature, cfg.FallbackModelCatalogID)
	if err != nil {
		return fmt.Errorf("failed to upsert flow config %s: %w", cfg.FlowKey, err)
	}
	return nil
}

// BulkUpsertFlowConfigs updates multiple flow configurations in a single transaction.
func (r *SettingsRepository) BulkUpsertFlowConfigs(ctx context.Context, cfgs []model.FlowConfig) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	for _, cfg := range cfgs {
		query := `
			INSERT INTO flow_configs (flow_key, model_catalog_id, api_key_id, temperature, fallback_model_catalog_id, updated_at)
			VALUES ($1, $2, $3, $4, $5, NOW())
			ON CONFLICT (flow_key) DO UPDATE SET
				model_catalog_id = EXCLUDED.model_catalog_id,
				api_key_id = EXCLUDED.api_key_id,
				temperature = EXCLUDED.temperature,
				fallback_model_catalog_id = EXCLUDED.fallback_model_catalog_id,
				updated_at = NOW()
		`
		if _, err := tx.Exec(ctx, query, cfg.FlowKey, cfg.ModelCatalogID, cfg.APIKeyID, cfg.Temperature, cfg.FallbackModelCatalogID); err != nil {
			return fmt.Errorf("failed to upsert flow %s: %w", cfg.FlowKey, err)
		}
	}
	return tx.Commit(ctx)
}
