package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/service"
)

// SettingsHandler handles HTTP endpoints for AI routing and API key management.
type SettingsHandler struct {
	routerSvc        *service.AIRouterService
	telegramNotifier *service.DefaultTelegramNotifier
}

// NewSettingsHandler creates a new SettingsHandler.
func NewSettingsHandler(routerSvc *service.AIRouterService) *SettingsHandler {
	return &SettingsHandler{routerSvc: routerSvc}
}

// SetTelegramNotifier sets the telegram notifier for testing and status inspection.
func (h *SettingsHandler) SetTelegramNotifier(notifier *service.DefaultTelegramNotifier) {
	h.telegramNotifier = notifier
}

// GetAIFlows returns the complete configuration of flows, available models, and saved keys.
// GET /api/settings/ai-flows
func (h *SettingsHandler) GetAIFlows(c *gin.Context) {
	resp, err := h.routerSvc.GetCompleteSettings(c.Request.Context())
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to get AI settings: "+err.Error())
		return
	}
	RespondSuccess(c, resp)
}

// UpdateAIFlows updates the AI model, API key, and parameters for flows in bulk.
// PUT /api/settings/ai-flows
func (h *SettingsHandler) UpdateAIFlows(c *gin.Context) {
	var req model.UpdateFlowConfigsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	if err := h.routerSvc.UpdateFlowConfigs(c.Request.Context(), req); err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to update flow configs: "+err.Error())
		return
	}

	// Return updated state
	resp, err := h.routerSvc.GetCompleteSettings(c.Request.Context())
	if err != nil {
		RespondSuccess(c, gin.H{"status": "updated"})
		return
	}
	RespondSuccess(c, resp)
}

// ListAPIKeys returns all saved API keys (masked).
// GET /api/settings/api-keys
func (h *SettingsHandler) ListAPIKeys(c *gin.Context) {
	keys, err := h.routerSvc.ListAPIKeys(c.Request.Context())
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to list API keys: "+err.Error())
		return
	}
	RespondSuccess(c, gin.H{"api_keys": keys})
}

// CreateAPIKey adds a new API key to the vault.
// POST /api/settings/api-keys
func (h *SettingsHandler) CreateAPIKey(c *gin.Context) {
	var req model.CreateAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	keyResp, err := h.routerSvc.CreateAPIKey(c.Request.Context(), req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to create API key: "+err.Error())
		return
	}

	RespondCreated(c, keyResp)
}

// UpdateAPIKey updates an existing API key's label, default status, and optionally overwrites the secret.
// PUT /api/settings/api-keys/:id
func (h *SettingsHandler) UpdateAPIKey(c *gin.Context) {
	keyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid key ID")
		return
	}

	var req model.UpdateAPIKeyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	resp, err := h.routerSvc.UpdateAPIKey(c.Request.Context(), keyID, req)
	if err != nil {
		RespondError(c, http.StatusBadRequest, err.Error())
		return
	}

	RespondSuccess(c, resp)
}

// DeleteAPIKey removes an API key from the vault.
// DELETE /api/settings/api-keys/:id
func (h *SettingsHandler) DeleteAPIKey(c *gin.Context) {
	keyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid key ID")
		return
	}

	if err := h.routerSvc.DeleteAPIKey(c.Request.Context(), keyID); err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to delete API key: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"status": "deleted"})
}

// TestPing checks connection and measures latency for a model and API key.
// POST /api/settings/test-ping
func (h *SettingsHandler) TestPing(c *gin.Context) {
	var req model.TestPingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	res, err := h.routerSvc.TestPing(c.Request.Context(), req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "ping error: "+err.Error())
		return
	}

	RespondSuccess(c, res)
}

// ListModels returns all models in the catalog.
// GET /api/settings/models
func (h *SettingsHandler) ListModels(c *gin.Context) {
	models, err := h.routerSvc.ListAllModels(c.Request.Context())
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to list models: "+err.Error())
		return
	}
	RespondSuccess(c, gin.H{"models": models})
}

// CreateModel registers a new model in the catalog.
// POST /api/settings/models
func (h *SettingsHandler) CreateModel(c *gin.Context) {
	var req model.CreateAIModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	m, err := h.routerSvc.CreateAIModel(c.Request.Context(), req)
	if err != nil {
		RespondError(c, http.StatusBadRequest, err.Error())
		return
	}

	RespondCreated(c, m)
}

// UpdateModel updates properties of an existing model.
// PUT /api/settings/models/*id
func (h *SettingsHandler) UpdateModel(c *gin.Context) {
	id := strings.TrimPrefix(c.Param("id"), "/")
	if id == "" {
		RespondError(c, http.StatusBadRequest, "model ID is required")
		return
	}

	var req model.UpdateAIModelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	m, err := h.routerSvc.UpdateAIModel(c.Request.Context(), id, req)
	if err != nil {
		RespondError(c, http.StatusBadRequest, err.Error())
		return
	}

	RespondSuccess(c, m)
}

// DeleteModel removes a model from the catalog if not in use.
// DELETE /api/settings/models/*id
func (h *SettingsHandler) DeleteModel(c *gin.Context) {
	id := strings.TrimPrefix(c.Param("id"), "/")
	if id == "" {
		RespondError(c, http.StatusBadRequest, "model ID is required")
		return
	}

	if err := h.routerSvc.DeleteAIModel(c.Request.Context(), id); err != nil {
		RespondError(c, http.StatusBadRequest, err.Error())
		return
	}

	RespondSuccess(c, gin.H{"status": "deleted", "id": id})
}

// GetTelegramStatus returns current bot and subscriber information.
// GET /api/settings/telegram/status
func (h *SettingsHandler) GetTelegramStatus(c *gin.Context) {
	if h.telegramNotifier == nil {
		RespondSuccess(c, gin.H{
			"is_enabled":         false,
			"has_bot_token":      false,
			"active_subscribers": 0,
			"bot_username":       "tesol_video_teaching_bot",
		})
		return
	}

	st, err := h.telegramNotifier.GetStatus(c.Request.Context())
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to get telegram status: "+err.Error())
		return
	}
	RespondSuccess(c, st)
}

// SendTelegramTestRequest is payload for sending a test message.
type SendTelegramTestRequest struct {
	Message string `json:"message"`
}

// SendTelegramTest dispatches a test notification message.
// POST /api/settings/telegram/test
func (h *SettingsHandler) SendTelegramTest(c *gin.Context) {
	if h.telegramNotifier == nil || !h.telegramNotifier.IsEnabled() {
		RespondError(c, http.StatusBadRequest, "Telegram bot chưa được kích hoạt hoặc chưa cấu hình token")
		return
	}

	var req SendTelegramTestRequest
	_ = c.ShouldBindJSON(&req)

	count, err := h.telegramNotifier.SendTestMessage(c.Request.Context(), req.Message)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "Lỗi gửi thông báo Telegram: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"status":      "sent",
		"recipients": count,
		"message":    "Đã gửi tin nhắn test thành công tới Telegram!",
	})
}

