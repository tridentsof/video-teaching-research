package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/service"
)

// InterviewBaseHandler handles HTTP endpoints for managing the 22 semi-structured base interview questions.
type InterviewBaseHandler struct {
	svc *service.InterviewBaseService
}

// NewInterviewBaseHandler creates a new InterviewBaseHandler.
func NewInterviewBaseHandler(svc *service.InterviewBaseService) *InterviewBaseHandler {
	return &InterviewBaseHandler{svc: svc}
}

// List returns all base interview questions.
// GET /api/interview-base-questions
func (h *InterviewBaseHandler) List(c *gin.Context) {
	onlyActive := c.Query("only_active") == "true"
	questions, err := h.svc.ListBaseQuestions(c.Request.Context(), onlyActive)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to list base questions: "+err.Error())
		return
	}
	RespondSuccess(c, gin.H{"questions": questions})
}

// GetByID returns a single base question by ID.
// GET /api/interview-base-questions/:id
func (h *InterviewBaseHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid question ID")
		return
	}
	q, err := h.svc.GetBaseQuestion(c.Request.Context(), id)
	if err != nil {
		RespondError(c, http.StatusNotFound, err.Error())
		return
	}
	RespondSuccess(c, q)
}

// Create creates a new base question in the bank.
// POST /api/interview-base-questions
func (h *InterviewBaseHandler) Create(c *gin.Context) {
	var input service.CreateBaseQuestionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	q, err := h.svc.CreateBaseQuestion(c.Request.Context(), input)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to create base question: "+err.Error())
		return
	}
	RespondSuccess(c, q)
}

// Update updates an existing base question.
// PUT /api/interview-base-questions/:id
func (h *InterviewBaseHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid question ID")
		return
	}
	var input service.UpdateBaseQuestionInput
	if err := c.ShouldBindJSON(&input); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}
	q, err := h.svc.UpdateBaseQuestion(c.Request.Context(), id, input)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to update base question: "+err.Error())
		return
	}
	RespondSuccess(c, q)
}

// Delete deletes a base question by ID.
// DELETE /api/interview-base-questions/:id
func (h *InterviewBaseHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid question ID")
		return
	}
	if err := h.svc.DeleteBaseQuestion(c.Request.Context(), id); err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to delete base question: "+err.Error())
		return
	}
	RespondSuccess(c, gin.H{"deleted": true})
}

// ResetToDefaults resets the base questions to the 22 canonical questions.
// POST /api/interview-base-questions/reset
func (h *InterviewBaseHandler) ResetToDefaults(c *gin.Context) {
	questions, err := h.svc.ResetToDefaults(c.Request.Context())
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to reset base questions: "+err.Error())
		return
	}
	RespondSuccess(c, gin.H{"questions": questions})
}
