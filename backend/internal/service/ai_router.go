package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/ai"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// AIRouterService provides dynamic AI provider routing, model selection, and key vault management.
type AIRouterService struct {
	repo                 *repository.SettingsRepository
	defaultGeminiKey     string
	defaultGeminiModel   string
	defaultOpenRouterKey string
	defaultOpenRouterModel string

	// Cached provider instances by key secret
	geminiProviders     map[string]*ai.GeminiDirectProvider
	openRouterProviders map[string]*ai.OpenRouterProvider
	vertexProviders     map[string]*ai.VertexAIProvider
	mu                  sync.RWMutex
}

// NewAIRouterService creates a new AIRouterService.
func NewAIRouterService(
	repo *repository.SettingsRepository,
	defaultGeminiKey string,
	defaultGeminiModel string,
	defaultOpenRouterKey string,
	defaultOpenRouterModel string,
) *AIRouterService {
	if defaultGeminiModel == "" {
		defaultGeminiModel = "gemini-3.7-flash"
	}
	if defaultOpenRouterModel == "" {
		defaultOpenRouterModel = "anthropic/claude-3.7-sonnet"
	}

	return &AIRouterService{
		repo:                 repo,
		defaultGeminiKey:     defaultGeminiKey,
		defaultGeminiModel:   defaultGeminiModel,
		defaultOpenRouterKey: defaultOpenRouterKey,
		defaultOpenRouterModel: defaultOpenRouterModel,
		geminiProviders:     make(map[string]*ai.GeminiDirectProvider),
		openRouterProviders: make(map[string]*ai.OpenRouterProvider),
		vertexProviders:     make(map[string]*ai.VertexAIProvider),
	}
}

// MaskKey returns a secure display string for secret API keys (e.g. "AIzaSy...4xK9").
func MaskKey(key string) string {
	if len(key) <= 8 {
		return "••••••••"
	}
	prefixLen := 6
	suffixLen := 4
	if len(key) < 12 {
		prefixLen = 3
		suffixLen = 2
	}
	return key[:prefixLen] + "..." + key[len(key)-suffixLen:]
}

// getGeminiProvider returns or creates a cached GeminiDirectProvider for a specific API key.
func (s *AIRouterService) getGeminiProvider(apiKey string, modelName string) *ai.GeminiDirectProvider {
	s.mu.Lock()
	defer s.mu.Unlock()

	if apiKey == "" {
		apiKey = s.defaultGeminiKey
	}
	cacheKey := apiKey + ":" + modelName
	if p, ok := s.geminiProviders[cacheKey]; ok {
		return p
	}
	p := ai.NewGeminiDirectProvider(apiKey, modelName)
	s.geminiProviders[cacheKey] = p
	return p
}

// getOpenRouterProvider returns or creates a cached OpenRouterProvider for a specific API key.
func (s *AIRouterService) getOpenRouterProvider(apiKey string) *ai.OpenRouterProvider {
	s.mu.Lock()
	defer s.mu.Unlock()

	if apiKey == "" {
		apiKey = s.defaultOpenRouterKey
	}
	if p, ok := s.openRouterProviders[apiKey]; ok {
		return p
	}
	p := ai.NewOpenRouterProvider(apiKey)
	s.openRouterProviders[apiKey] = p
	return p
}

// getVertexProvider returns or creates a cached VertexAIProvider for a specific project/region/model combo.
func (s *AIRouterService) getVertexProvider(saJSON, projectID, region, gcsBucket, modelName string) *ai.VertexAIProvider {
	s.mu.Lock()
	defer s.mu.Unlock()

	cacheKey := projectID + ":" + region + ":" + modelName
	if p, ok := s.vertexProviders[cacheKey]; ok {
		return p
	}
	p := ai.NewVertexAIProvider(saJSON, projectID, region, gcsBucket, modelName)
	s.vertexProviders[cacheKey] = p
	return p
}

// ResolveFlowConfig retrieves the active model, provider, and API key for a given pipeline flow.
// Enforces a strict SINGLE SOURCE OF TRUTH: Configuration MUST exist in DB/UI.
// No fallbacks to environment variables or cross-provider substitutions are permitted.
func (s *AIRouterService) ResolveFlowConfig(ctx context.Context, flowKey string) (providerType string, modelName string, apiKeySecret string, temperature float64, metadata *model.APIKeyMetadata, err error) {
	if s.repo == nil {
		return "", "", "", 0, nil, fmt.Errorf("settings repository is not configured")
	}

	// 1. Fetch flow configuration from database
	cfg, err := s.repo.GetFlowConfig(ctx, flowKey)
	if err != nil {
		return "", "", "", 0, nil, fmt.Errorf("failed to load flow config for '%s' from database: %w", flowKey, err)
	}
	if cfg == nil || cfg.ModelCatalogID == uuid.Nil {
		return "", "", "", 0, nil, fmt.Errorf("flow '%s' is not configured in database; please configure model and API key in Settings UI", flowKey)
	}

	temperature = cfg.Temperature

	// 2. Validate model in model catalog
	mInfo, err := s.repo.GetAIModelByID(ctx, cfg.ModelCatalogID)
	if err != nil || mInfo == nil {
		return "", "", "", 0, nil, fmt.Errorf("model catalog entry '%s' configured for flow '%s' does not exist in model catalog", cfg.ModelCatalogID.String(), flowKey)
	}
	if !mInfo.IsActive {
		return "", "", "", 0, nil, fmt.Errorf("model '%s' (%s) configured for flow '%s' is deactivated", mInfo.DisplayName, mInfo.ModelID, flowKey)
	}
	providerType = mInfo.Provider
	modelName = mInfo.ModelID

	// 3. Strictly validate assigned API key (NO fallback to default or environment)
	if cfg.APIKeyID == nil || *cfg.APIKeyID == uuid.Nil {
		return "", "", "", 0, nil, fmt.Errorf("flow '%s' has no API key assigned; please assign a valid API key in Settings UI", flowKey)
	}

	keyObj, err := s.repo.GetAPIKeyByID(ctx, *cfg.APIKeyID)
	if err != nil || keyObj == nil {
		return "", "", "", 0, nil, fmt.Errorf("API key configured for flow '%s' (ID: %s) was not found in key vault", flowKey, cfg.APIKeyID.String())
	}

	if keyObj.Status != "active" {
		return "", "", "", 0, nil, fmt.Errorf("API key '%s' assigned to flow '%s' is %s (must be active)", keyObj.Label, flowKey, keyObj.Status)
	}

	apiKeySecret = strings.TrimSpace(keyObj.KeySecret)
	if apiKeySecret == "" {
		return "", "", "", 0, nil, fmt.Errorf("API key '%s' assigned to flow '%s' has an empty key secret", keyObj.Label, flowKey)
	}

	// 4. Ensure provider compatibility
	if keyObj.Provider != providerType {
		return "", "", "", 0, nil, fmt.Errorf("provider mismatch for flow '%s': model '%s' requires '%s', but assigned key '%s' is for '%s'",
			flowKey, modelName, providerType, keyObj.Label, keyObj.Provider)
	}

	metadata = keyObj.Metadata
	return providerType, modelName, apiKeySecret, temperature, metadata, nil
}

// GetTextProviderForFlow dynamically resolves and returns the TextCompletionProvider for a given flow.
// Fails immediately if configuration or key is missing or invalid.
func (s *AIRouterService) GetTextProviderForFlow(ctx context.Context, flowKey string) (ai.TextCompletionProvider, string, error) {
	providerType, modelName, apiKeySecret, _, metadata, err := s.ResolveFlowConfig(ctx, flowKey)
	if err != nil {
		return nil, "", fmt.Errorf("flow '%s' configuration error: %w", flowKey, err)
	}

	switch providerType {
	case "openrouter":
		return s.getOpenRouterProvider(apiKeySecret), modelName, nil
	case "gemini":
		return s.getGeminiProvider(apiKeySecret, modelName), modelName, nil
	case "vertex_ai":
		projectID, region, gcsBucket := "", "", ""
		if metadata != nil {
			projectID = metadata.ProjectID
			region = metadata.Region
			gcsBucket = metadata.GCSBucket
		}
		return s.getVertexProvider(apiKeySecret, projectID, region, gcsBucket, modelName), modelName, nil
	default:
		return nil, "", fmt.Errorf("unsupported AI provider '%s' for flow '%s'", providerType, flowKey)
	}
}

// GetVideoProviderForFlow dynamically resolves and returns the VideoAnalysisProvider for video extraction.
// Supports both Gemini (AI Studio) and Vertex AI providers for multimodal video analysis.
// Fails immediately if configuration or key is missing or invalid.
func (s *AIRouterService) GetVideoProviderForFlow(ctx context.Context, flowKey string) (ai.VideoAnalysisProvider, string, error) {
	providerType, modelName, apiKeySecret, _, metadata, err := s.ResolveFlowConfig(ctx, flowKey)
	if err != nil {
		return nil, "", fmt.Errorf("flow '%s' configuration error: %w", flowKey, err)
	}

	switch providerType {
	case "gemini":
		return s.getGeminiProvider(apiKeySecret, modelName), modelName, nil
	case "vertex_ai":
		projectID, region, gcsBucket := "", "", ""
		if metadata != nil {
			projectID = metadata.ProjectID
			region = metadata.Region
			gcsBucket = metadata.GCSBucket
		}
		if gcsBucket == "" {
			return nil, "", fmt.Errorf("vertex AI video extraction requires a GCS Bucket configured in the API key metadata")
		}
		return s.getVertexProvider(apiKeySecret, projectID, region, gcsBucket, modelName), modelName, nil
	default:
		return nil, "", fmt.Errorf("video extraction flow '%s' requires a multimodal video provider (gemini or vertex_ai), but '%s' was configured", flowKey, providerType)
	}
}

// GetCompleteSettings aggregates all flows, active models, and saved API keys for the UI.
func (s *AIRouterService) GetCompleteSettings(ctx context.Context) (*model.AIFlowsSettingsResponse, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("settings repository is not configured")
	}

	// 1. Fetch AI Models
	rawModels, err := s.repo.ListAIModels(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list models: %w", err)
	}
	models := make([]model.AIModelInfo, 0)
	if rawModels != nil {
		models = rawModels
	}
	modelMap := make(map[uuid.UUID]model.AIModelInfo)
	for _, m := range models {
		modelMap[m.ID] = m
	}

	// 2. Fetch API Keys
	rawKeys, err := s.repo.ListAPIKeys(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list api keys: %w", err)
	}
	apiKeys := make([]model.APIKeyResponse, 0)
	keyMap := make(map[uuid.UUID]model.APIKeyResponse)
	for _, k := range rawKeys {
		resp := model.APIKeyResponse{
			ID:        k.ID,
			Provider:  k.Provider,
			Label:     k.Label,
			MaskedKey: MaskKey(k.KeySecret),
			IsDefault: k.IsDefault,
			Status:    k.Status,
			Metadata:  k.Metadata,
			CreatedAt: k.CreatedAt,
			UpdatedAt: k.UpdatedAt,
		}
		apiKeys = append(apiKeys, resp)
		keyMap[k.ID] = resp
	}

	// 3. Fetch Flow Configs
	flowConfigs, err := s.repo.ListFlowConfigs(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list flow configs: %w", err)
	}

	flows := make([]model.FlowConfigResponse, 0)
	for _, fc := range flowConfigs {
		var mInfo *model.AIModelInfo
		for i := range models {
			if models[i].ID == fc.ModelCatalogID {
				mInfo = &models[i]
				break
			}
		}
		var fallbackMInfo *model.AIModelInfo
		if fc.FallbackModelCatalogID != nil {
			for i := range models {
				if models[i].ID == *fc.FallbackModelCatalogID {
					fallbackMInfo = &models[i]
					break
				}
			}
		}
		var kInfo *model.APIKeyResponse
		if fc.APIKeyID != nil {
			if k, ok := keyMap[*fc.APIKeyID]; ok {
				kInfo = &k
			}
		}

		flows = append(flows, model.FlowConfigResponse{
			FlowKey:                fc.FlowKey,
			ModelCatalogID:         fc.ModelCatalogID,
			ModelInfo:              mInfo,
			APIKeyID:               fc.APIKeyID,
			APIKeyInfo:             kInfo,
			Temperature:            fc.Temperature,
			FallbackModelCatalogID: fc.FallbackModelCatalogID,
			FallbackModelInfo:      fallbackMInfo,
			UpdatedAt:              fc.UpdatedAt,
		})
	}

	return &model.AIFlowsSettingsResponse{
		Flows:   flows,
		Models:  models,
		APIKeys: apiKeys,
	}, nil
}

// UpdateFlowConfigs updates flow model assignments and parameters in bulk.
func (s *AIRouterService) UpdateFlowConfigs(ctx context.Context, req model.UpdateFlowConfigsRequest) error {
	if s.repo == nil {
		return fmt.Errorf("settings repository is not configured")
	}

	var configs []model.FlowConfig
	for _, item := range req.Flows {
		configs = append(configs, model.FlowConfig{
			FlowKey:                item.FlowKey,
			ModelCatalogID:         item.ModelCatalogID,
			APIKeyID:               item.APIKeyID,
			Temperature:            item.Temperature,
			FallbackModelCatalogID: item.FallbackModelCatalogID,
		})
	}

	return s.repo.BulkUpsertFlowConfigs(ctx, configs)
}

// ListAPIKeys returns all saved API keys masked for security.
func (s *AIRouterService) ListAPIKeys(ctx context.Context) ([]model.APIKeyResponse, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("settings repository is not configured")
	}

	rawKeys, err := s.repo.ListAPIKeys(ctx)
	if err != nil {
		return nil, err
	}

	var resp []model.APIKeyResponse
	for _, k := range rawKeys {
		resp = append(resp, model.APIKeyResponse{
			ID:        k.ID,
			Provider:  k.Provider,
			Label:     k.Label,
			MaskedKey: MaskKey(k.KeySecret),
			IsDefault: k.IsDefault,
			Status:    k.Status,
			Metadata:  k.Metadata,
			CreatedAt: k.CreatedAt,
			UpdatedAt: k.UpdatedAt,
		})
	}
	return resp, nil
}

// CreateAPIKey adds a new API key into the vault.
func (s *AIRouterService) CreateAPIKey(ctx context.Context, req model.CreateAPIKeyRequest) (*model.APIKeyResponse, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("settings repository is not configured")
	}

	keyObj := &model.APIKey{
		ID:        uuid.New(),
		Provider:  req.Provider,
		Label:     req.Label,
		KeySecret: strings.TrimSpace(req.KeySecret),
		IsDefault: req.IsDefault,
		Status:    "active",
		Metadata:  req.Metadata,
	}

	// Auto-extract ProjectID from Service Account JSON if provider is vertex_ai and ProjectID is missing
	if keyObj.Provider == "vertex_ai" {
		var sa struct {
			ProjectID string `json:"project_id"`
		}
		if err := json.Unmarshal([]byte(keyObj.KeySecret), &sa); err == nil && sa.ProjectID != "" {
			if keyObj.Metadata == nil {
				keyObj.Metadata = &model.APIKeyMetadata{
					ProjectID: sa.ProjectID,
					Region:    "us-central1",
				}
			} else if keyObj.Metadata.ProjectID == "" {
				keyObj.Metadata.ProjectID = sa.ProjectID
			}
		}
	}

	if err := s.repo.CreateAPIKey(ctx, keyObj); err != nil {
		return nil, err
	}

	return &model.APIKeyResponse{
		ID:        keyObj.ID,
		Provider:  keyObj.Provider,
		Label:     keyObj.Label,
		MaskedKey: MaskKey(keyObj.KeySecret),
		IsDefault: keyObj.IsDefault,
		Status:    keyObj.Status,
		Metadata:  keyObj.Metadata,
		CreatedAt: keyObj.CreatedAt,
		UpdatedAt: keyObj.UpdatedAt,
	}, nil
}

// UpdateAPIKey updates API key metadata and optionally overwrites key secret.
func (s *AIRouterService) UpdateAPIKey(ctx context.Context, id uuid.UUID, req model.UpdateAPIKeyRequest) (*model.APIKeyResponse, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("settings repository is not configured")
	}

	req.Label = strings.TrimSpace(req.Label)
	if req.Label == "" {
		return nil, fmt.Errorf("label is required")
	}

	// Auto-extract ProjectID from Service Account JSON if new key_secret provided and ProjectID is missing
	if req.KeySecret != nil && strings.TrimSpace(*req.KeySecret) != "" {
		var sa struct {
			ProjectID string `json:"project_id"`
		}
		if err := json.Unmarshal([]byte(*req.KeySecret), &sa); err == nil && sa.ProjectID != "" {
			if req.Metadata == nil {
				req.Metadata = &model.APIKeyMetadata{
					ProjectID: sa.ProjectID,
					Region:    "us-central1",
				}
			} else if req.Metadata.ProjectID == "" {
				req.Metadata.ProjectID = sa.ProjectID
			}
		}
	}

	if err := s.repo.UpdateAPIKey(ctx, id, req); err != nil {
		return nil, err
	}

	updated, err := s.repo.GetAPIKeyByID(ctx, id)
	if err != nil || updated == nil {
		return nil, fmt.Errorf("failed to load updated key: %w", err)
	}

	// Invalidate cached provider instance if key was updated
	s.mu.Lock()
	delete(s.geminiProviders, updated.KeySecret)
	delete(s.openRouterProviders, updated.KeySecret)
	// Invalidate vertex providers matching this key's project
	if updated.Metadata != nil && updated.Metadata.ProjectID != "" {
		for k := range s.vertexProviders {
			if strings.HasPrefix(k, updated.Metadata.ProjectID+":") {
				delete(s.vertexProviders, k)
			}
		}
	}
	s.mu.Unlock()

	return &model.APIKeyResponse{
		ID:        updated.ID,
		Provider:  updated.Provider,
		Label:     updated.Label,
		MaskedKey: MaskKey(updated.KeySecret),
		IsDefault: updated.IsDefault,
		Status:    updated.Status,
		Metadata:  updated.Metadata,
		CreatedAt: updated.CreatedAt,
		UpdatedAt: updated.UpdatedAt,
	}, nil
}

// DeleteAPIKey removes an API key from the vault.
func (s *AIRouterService) DeleteAPIKey(ctx context.Context, id uuid.UUID) error {
	if s.repo == nil {
		return fmt.Errorf("settings repository is not configured")
	}
	return s.repo.DeleteAPIKey(ctx, id)
}

// TestPing performs a lightweight ping to verify API key validity and measure response latency.
func (s *AIRouterService) TestPing(ctx context.Context, req model.TestPingRequest) (*model.TestPingResponse, error) {
	start := time.Now()

	keySecret := ""
	if req.KeySecret != nil && *req.KeySecret != "" {
		keySecret = *req.KeySecret
	} else if req.APIKeyID != nil && s.repo != nil {
		k, err := s.repo.GetAPIKeyByID(ctx, *req.APIKeyID)
		if err == nil && k != nil {
			keySecret = k.KeySecret
		}
	}

	if keySecret == "" {
		return &model.TestPingResponse{
			Success:   false,
			LatencyMs: 0,
			Message:   fmt.Sprintf("No valid API key selected for provider '%s'; please assign an active API key from the vault", req.Provider),
		}, nil
	}

	var pingErr error
	switch req.Provider {
	case "gemini":
		provider := s.getGeminiProvider(keySecret, req.ModelID)
		_, pingErr = provider.CompleteText(ctx, req.ModelID, "You are a test ping agent.", "Ping. Reply with 'Pong'.")
	case "vertex_ai":
		// For vertex_ai, we need metadata from the DB key
		projectID, region, gcsBucket := "", "", ""
		if req.APIKeyID != nil && s.repo != nil {
			if kObj, err := s.repo.GetAPIKeyByID(ctx, *req.APIKeyID); err == nil && kObj != nil && kObj.Metadata != nil {
				projectID = kObj.Metadata.ProjectID
				region = kObj.Metadata.Region
				gcsBucket = kObj.Metadata.GCSBucket
			}
		}
		provider := s.getVertexProvider(keySecret, projectID, region, gcsBucket, req.ModelID)
		_, pingErr = provider.CompleteText(ctx, req.ModelID, "You are a test ping agent.", "Ping. Reply with 'Pong'.")
	default:
		provider := s.getOpenRouterProvider(keySecret)
		_, pingErr = provider.CompleteText(ctx, req.ModelID, "You are a test ping agent.", "Ping. Reply with 'Pong'.")
	}

	latency := time.Since(start).Milliseconds()
	if pingErr != nil {
		return &model.TestPingResponse{
			Success:   false,
			LatencyMs: latency,
			Message:   fmt.Sprintf("Connection failed: %v", pingErr),
		}, nil
	}

	return &model.TestPingResponse{
		Success:   true,
		LatencyMs: latency,
		Message:   fmt.Sprintf("200 OK — Model '%s' responded in %dms", req.ModelID, latency),
	}, nil
}

// ListAllModels returns all models from the catalog.
func (s *AIRouterService) ListAllModels(ctx context.Context) ([]model.AIModelInfo, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("settings repository is not configured")
	}
	models, err := s.repo.ListAllAIModels(ctx)
	if err != nil {
		return nil, err
	}
	if models == nil {
		models = make([]model.AIModelInfo, 0)
	}
	return models, nil
}

// CreateAIModel registers a new AI model in the catalog.
func (s *AIRouterService) CreateAIModel(ctx context.Context, req model.CreateAIModelRequest) (*model.AIModelInfo, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("settings repository is not configured")
	}

	modelID := strings.TrimSpace(req.ModelID)
	if modelID == "" {
		return nil, fmt.Errorf("model ID is required")
	}
	provider := strings.ToLower(strings.TrimSpace(req.Provider))
	if provider == "" {
		return nil, fmt.Errorf("provider is required")
	}

	// Check if already exists for this provider and model_id
	existing, _ := s.repo.GetAIModelByProviderAndModelID(ctx, provider, modelID)
	if existing != nil {
		return nil, fmt.Errorf("model '%s' for provider '%s' already exists in catalog", modelID, provider)
	}

	ctxTokens := req.ContextTokens
	if ctxTokens <= 0 {
		ctxTokens = 128000
	}

	m := &model.AIModelInfo{
		ID:                 uuid.New(),
		Provider:           provider,
		ModelID:            modelID,
		DisplayName:        strings.TrimSpace(req.DisplayName),
		ContextTokens:      ctxTokens,
		SupportsMultimodal: req.SupportsMultimodal,
		SupportsReasoning:  req.SupportsReasoning,
		IsActive:           req.IsActive,
		SortOrder:          req.SortOrder,
		CreatedAt:          time.Now(),
	}

	if err := s.repo.CreateAIModel(ctx, m); err != nil {
		return nil, err
	}
	return m, nil
}

// UpdateAIModel updates model properties.
func (s *AIRouterService) UpdateAIModel(ctx context.Context, id uuid.UUID, req model.UpdateAIModelRequest) (*model.AIModelInfo, error) {
	if s.repo == nil {
		return nil, fmt.Errorf("settings repository is not configured")
	}

	existing, err := s.repo.GetAIModelByID(ctx, id)
	if err != nil || existing == nil {
		return nil, fmt.Errorf("model '%s' not found", id)
	}

	if err := s.repo.UpdateAIModel(ctx, id, req); err != nil {
		return nil, err
	}

	return s.repo.GetAIModelByID(ctx, id)
}

// DeleteAIModel deletes an AI model if not currently assigned to any flow.
func (s *AIRouterService) DeleteAIModel(ctx context.Context, id uuid.UUID) error {
	if s.repo == nil {
		return fmt.Errorf("settings repository is not configured")
	}

	inUse, flows, err := s.repo.IsModelInUse(ctx, id)
	if err != nil {
		return fmt.Errorf("failed to check model usage: %w", err)
	}
	if inUse {
		return fmt.Errorf("cannot delete model '%s': currently configured as the primary model for pipeline flow(s): %s. Please reassign those flows first", id, strings.Join(flows, ", "))
	}

	return s.repo.DeleteAIModel(ctx, id)
}
