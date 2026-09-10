package repository

import (
	"context"
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

	INSERT INTO flow_configs (flow_key, model_id, temperature, fallback_model_id)
	VALUES
		('video_extraction',   'gemini-3.7-flash', 0.20, 'gemini-2.5-flash'),
		('checklist_mapping',  'gemini-3.7-flash', 0.10, 'gemini-2.5-flash'),
		('thematic_analysis',  'gemini-3.7-flash', 0.40, 'gemini-3.7-flash'),
		('interview_generator','gemini-3.7-flash', 0.50, 'gemini-3.7-flash'),
		('codebook_generation','gemini-3.7-flash', 0.30, 'gemini-2.5-flash')
	ON CONFLICT (flow_key) DO NOTHING;
	`
	_, err := r.db.Pool.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to ensure settings tables: %w", err)
	}
	return nil
}

// ListAPIKeys returns all saved API keys.
func (r *SettingsRepository) ListAPIKeys(ctx context.Context) ([]model.APIKey, error) {
	query := `
		SELECT id, provider, label, key_secret, is_default, status, created_at, updated_at
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
		var k model.APIKey
		if err := rows.Scan(&k.ID, &k.Provider, &k.Label, &k.KeySecret, &k.IsDefault, &k.Status, &k.CreatedAt, &k.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan api key: %w", err)
		}
		keys = append(keys, k)
	}
	return keys, nil
}

// GetAPIKeyByID retrieves a specific key by ID.
func (r *SettingsRepository) GetAPIKeyByID(ctx context.Context, id uuid.UUID) (*model.APIKey, error) {
	query := `
		SELECT id, provider, label, key_secret, is_default, status, created_at, updated_at
		FROM api_keys
		WHERE id = $1
	`
	var k model.APIKey
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&k.ID, &k.Provider, &k.Label, &k.KeySecret, &k.IsDefault, &k.Status, &k.CreatedAt, &k.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &k, nil
}

// GetDefaultAPIKeyByProvider returns the default key for a given provider.
func (r *SettingsRepository) GetDefaultAPIKeyByProvider(ctx context.Context, provider string) (*model.APIKey, error) {
	query := `
		SELECT id, provider, label, key_secret, is_default, status, created_at, updated_at
		FROM api_keys
		WHERE provider = $1 AND status = 'active'
		ORDER BY is_default DESC, created_at ASC
		LIMIT 1
	`
	var k model.APIKey
	err := r.db.Pool.QueryRow(ctx, query, provider).Scan(
		&k.ID, &k.Provider, &k.Label, &k.KeySecret, &k.IsDefault, &k.Status, &k.CreatedAt, &k.UpdatedAt,
	)
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

	query := `
		INSERT INTO api_keys (id, provider, label, key_secret, is_default, status, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := r.db.Pool.Exec(ctx, query,
		key.ID, key.Provider, key.Label, key.KeySecret, key.IsDefault, key.Status, key.CreatedAt, key.UpdatedAt,
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

	// If a new secret was provided, overwrite it
	if req.KeySecret != nil && strings.TrimSpace(*req.KeySecret) != "" {
		query := `
			UPDATE api_keys
			SET label = $2, key_secret = $3, is_default = $4, status = $5, updated_at = NOW()
			WHERE id = $1
		`
		_, err = r.db.Pool.Exec(ctx, query, id, req.Label, strings.TrimSpace(*req.KeySecret), req.IsDefault, status)
	} else {
		// Keep existing secret
		query := `
			UPDATE api_keys
			SET label = $2, is_default = $3, status = $4, updated_at = NOW()
			WHERE id = $1
		`
		_, err = r.db.Pool.Exec(ctx, query, id, req.Label, req.IsDefault, status)
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
		SELECT id, provider, display_name, context_tokens, supports_multimodal, supports_reasoning, is_active, sort_order, created_at
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
			&m.ID, &m.Provider, &m.DisplayName, &m.ContextTokens, &m.SupportsMultimodal, &m.SupportsReasoning, &m.IsActive, &m.SortOrder, &m.CreatedAt,
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
		SELECT id, provider, display_name, context_tokens, supports_multimodal, supports_reasoning, is_active, sort_order, created_at
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
			&m.ID, &m.Provider, &m.DisplayName, &m.ContextTokens, &m.SupportsMultimodal, &m.SupportsReasoning, &m.IsActive, &m.SortOrder, &m.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan ai model: %w", err)
		}
		models = append(models, m)
	}
	return models, nil
}

// GetAIModelByID retrieves an AI model by its ID.
func (r *SettingsRepository) GetAIModelByID(ctx context.Context, id string) (*model.AIModelInfo, error) {
	query := `
		SELECT id, provider, display_name, context_tokens, supports_multimodal, supports_reasoning, is_active, sort_order, created_at
		FROM ai_models
		WHERE id = $1
	`
	var m model.AIModelInfo
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&m.ID, &m.Provider, &m.DisplayName, &m.ContextTokens, &m.SupportsMultimodal, &m.SupportsReasoning, &m.IsActive, &m.SortOrder, &m.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

// CreateAIModel inserts a new AI model into the catalog.
func (r *SettingsRepository) CreateAIModel(ctx context.Context, m *model.AIModelInfo) error {
	if m.ContextTokens <= 0 {
		m.ContextTokens = 128000
	}
	if m.CreatedAt.IsZero() {
		m.CreatedAt = time.Now()
	}

	query := `
		INSERT INTO ai_models (id, provider, display_name, context_tokens, supports_multimodal, supports_reasoning, is_active, sort_order, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`
	_, err := r.db.Pool.Exec(ctx, query,
		m.ID, m.Provider, m.DisplayName, m.ContextTokens, m.SupportsMultimodal, m.SupportsReasoning, m.IsActive, m.SortOrder, m.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create ai model: %w", err)
	}
	return nil
}

// UpdateAIModel updates an existing AI model in the catalog.
func (r *SettingsRepository) UpdateAIModel(ctx context.Context, id string, req model.UpdateAIModelRequest) error {
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
func (r *SettingsRepository) DeleteAIModel(ctx context.Context, id string) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Clean up any fallback references so foreign key / dangling references don't linger
	if _, err := tx.Exec(ctx, `UPDATE flow_configs SET fallback_model_id = NULL WHERE fallback_model_id = $1`, id); err != nil {
		return fmt.Errorf("failed to clear fallback references: %w", err)
	}

	query := `DELETE FROM ai_models WHERE id = $1`
	if _, err := tx.Exec(ctx, query, id); err != nil {
		return fmt.Errorf("failed to delete ai model: %w", err)
	}
	return tx.Commit(ctx)
}

// IsModelInUse checks if a model ID is currently bound as the primary model to any flow config.
func (r *SettingsRepository) IsModelInUse(ctx context.Context, modelID string) (bool, []string, error) {
	query := `
		SELECT flow_key 
		FROM flow_configs 
		WHERE model_id = $1
	`
	rows, err := r.db.Pool.Query(ctx, query, modelID)
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
		SELECT flow_key, model_id, api_key_id, temperature, fallback_model_id, updated_at
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
		if err := rows.Scan(&c.FlowKey, &c.ModelID, &c.APIKeyID, &c.Temperature, &c.FallbackModelID, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan flow config: %w", err)
		}
		configs = append(configs, c)
	}
	return configs, nil
}

// GetFlowConfig returns the configuration for a single flow key.
func (r *SettingsRepository) GetFlowConfig(ctx context.Context, flowKey string) (*model.FlowConfig, error) {
	query := `
		SELECT flow_key, model_id, api_key_id, temperature, fallback_model_id, updated_at
		FROM flow_configs
		WHERE flow_key = $1
	`
	var c model.FlowConfig
	err := r.db.Pool.QueryRow(ctx, query, flowKey).Scan(
		&c.FlowKey, &c.ModelID, &c.APIKeyID, &c.Temperature, &c.FallbackModelID, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

// UpsertFlowConfig updates or inserts a flow config.
func (r *SettingsRepository) UpsertFlowConfig(ctx context.Context, cfg model.FlowConfig) error {
	query := `
		INSERT INTO flow_configs (flow_key, model_id, api_key_id, temperature, fallback_model_id, updated_at)
		VALUES ($1, $2, $3, $4, $5, NOW())
		ON CONFLICT (flow_key) DO UPDATE SET
			model_id = EXCLUDED.model_id,
			api_key_id = EXCLUDED.api_key_id,
			temperature = EXCLUDED.temperature,
			fallback_model_id = EXCLUDED.fallback_model_id,
			updated_at = NOW()
	`
	_, err := r.db.Pool.Exec(ctx, query, cfg.FlowKey, cfg.ModelID, cfg.APIKeyID, cfg.Temperature, cfg.FallbackModelID)
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
			INSERT INTO flow_configs (flow_key, model_id, api_key_id, temperature, fallback_model_id, updated_at)
			VALUES ($1, $2, $3, $4, $5, NOW())
			ON CONFLICT (flow_key) DO UPDATE SET
				model_id = EXCLUDED.model_id,
				api_key_id = EXCLUDED.api_key_id,
				temperature = EXCLUDED.temperature,
				fallback_model_id = EXCLUDED.fallback_model_id,
				updated_at = NOW()
		`
		if _, err := tx.Exec(ctx, query, cfg.FlowKey, cfg.ModelID, cfg.APIKeyID, cfg.Temperature, cfg.FallbackModelID); err != nil {
			return fmt.Errorf("failed to upsert flow %s: %w", cfg.FlowKey, err)
		}
	}
	return tx.Commit(ctx)
}
