package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/service"
)

// ChecklistHandler handles checklist HTTP endpoints.
type ChecklistHandler struct {
	svc *service.ChecklistService
}

// NewChecklistHandler creates a new ChecklistHandler.
func NewChecklistHandler(svc *service.ChecklistService) *ChecklistHandler {
	return &ChecklistHandler{svc: svc}
}

// List returns all checklists.
// GET /api/checklists
func (h *ChecklistHandler) List(c *gin.Context) {
	checklists, err := h.svc.List(c.Request.Context())
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to list checklists")
		return
	}

	if checklists == nil {
		checklists = []model.Checklist{} // avoid null JSON
	}

	RespondSuccess(c, gin.H{"checklists": checklists})
}

// GetByID returns a single checklist with items.
// GET /api/checklists/:id
func (h *ChecklistHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid checklist ID")
		return
	}

	cl, err := h.svc.GetByID(c.Request.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			RespondError(c, http.StatusNotFound, "checklist not found")
			return
		}
		RespondError(c, http.StatusInternalServerError, "failed to get checklist")
		return
	}

	RespondSuccess(c, cl)
}

// Create creates a new checklist.
// POST /api/checklists
func (h *ChecklistHandler) Create(c *gin.Context) {
	var req service.CreateChecklistRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	cl, err := h.svc.Create(c.Request.Context(), req)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to create checklist")
		return
	}

	RespondCreated(c, cl)
}

// UpdateItems replaces all items for a checklist.
// PUT /api/checklists/:id/items
func (h *ChecklistHandler) UpdateItems(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid checklist ID")
		return
	}

	var req service.UpdateItemsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	cl, err := h.svc.UpdateItems(c.Request.Context(), id, req)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			RespondError(c, http.StatusNotFound, "checklist not found")
			return
		}
		RespondError(c, http.StatusInternalServerError, "failed to update items")
		return
	}

	RespondSuccess(c, cl)
}

// Delete removes a checklist.
// DELETE /api/checklists/:id
func (h *ChecklistHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid checklist ID")
		return
	}

	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		if strings.Contains(err.Error(), "not found") {
			RespondError(c, http.StatusNotFound, "checklist not found")
			return
		}
		RespondError(c, http.StatusInternalServerError, "failed to delete checklist")
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
