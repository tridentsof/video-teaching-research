package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/video-teaching-research/backend/internal/repository"
)

// AnalyticsHandler handles HTTP endpoints for research metrics and longitudinal analytics.
type AnalyticsHandler struct {
	repo *repository.AnalyticsRepository
}

// NewAnalyticsHandler creates a new AnalyticsHandler.
func NewAnalyticsHandler(repo *repository.AnalyticsRepository) *AnalyticsHandler {
	return &AnalyticsHandler{repo: repo}
}

// GetPedagogical returns aggregated real research metrics from the database.
// GET /api/analytics/pedagogical
func (h *AnalyticsHandler) GetPedagogical(c *gin.Context) {
	data, err := h.repo.GetPedagogicalAnalytics(c.Request.Context())
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to compute pedagogical analytics: "+err.Error())
		return
	}
	RespondSuccess(c, data)
}
