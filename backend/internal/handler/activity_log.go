package handler

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/service"
)

// ActivityLogHandler handles HTTP endpoints for Activity & Audit Logs.
type ActivityLogHandler struct {
	svc *service.ActivityLogService
}

// NewActivityLogHandler creates a new ActivityLogHandler.
func NewActivityLogHandler(svc *service.ActivityLogService) *ActivityLogHandler {
	return &ActivityLogHandler{svc: svc}
}

// ListActivityLogsResponse represents the response format for GET /api/activity-logs.
type ListActivityLogsResponse struct {
	Logs  []model.ActivityLog `json:"logs"`
	Total int                 `json:"total"`
}

// List handles GET /api/activity-logs.
func (h *ActivityLogHandler) List(c *gin.Context) {
	category := c.Query("category")
	module := c.Query("module")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	logs, total, err := h.svc.List(c.Request.Context(), category, module, limit, offset)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to query activity logs: "+err.Error())
		return
	}

	RespondSuccess(c, ListActivityLogsResponse{
		Logs:  logs,
		Total: total,
	})
}

// CreateActivityLogRequest represents the incoming payload for POST /api/activity-logs.
type CreateActivityLogRequest struct {
	Category    string `json:"category" binding:"required"`
	Module      string `json:"module" binding:"required"`
	Action      string `json:"action" binding:"required"`
	TargetID    string `json:"target_id"`
	TargetTitle string `json:"target_title"`
	Summary     string `json:"summary" binding:"required"`
	Status      string `json:"status"`
	Diff        any    `json:"diff"`
	Metadata    any    `json:"metadata"`
}

// Create handles POST /api/activity-logs.
func (h *ActivityLogHandler) Create(c *gin.Context) {
	var req CreateActivityLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	username := c.GetString("username")
	if username == "" {
		username = "admin"
	}
	clientIP := c.ClientIP()

	diffStr := ""
	if req.Diff != nil {
		if b, err := json.Marshal(req.Diff); err == nil {
			diffStr = string(b)
		}
	}
	metadataStr := ""
	if req.Metadata != nil {
		if b, err := json.Marshal(req.Metadata); err == nil {
			metadataStr = string(b)
		}
	}

	err := h.svc.Record(
		c.Request.Context(),
		req.Category,
		req.Module,
		req.Action,
		req.TargetID,
		req.TargetTitle,
		username,
		"admin",
		clientIP,
		req.Summary,
		req.Status,
		diffStr,
		metadataStr,
	)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to save activity log: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"status": "ok"})
}
