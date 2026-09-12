package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/repository"
	"github.com/video-teaching-research/backend/internal/service"
)

// PipelineHandler handles HTTP endpoints for pipeline triggers and progress inspection.
type PipelineHandler struct {
	orchestrator *service.PipelineOrchestrator
	rawEventRepo *repository.RawEventRepository
}

// NewPipelineHandler creates a new PipelineHandler.
func NewPipelineHandler(orchestrator *service.PipelineOrchestrator, rawEventRepo *repository.RawEventRepository) *PipelineHandler {
	return &PipelineHandler{
		orchestrator: orchestrator,
		rawEventRepo: rawEventRepo,
	}
}

type triggerPipelineRequest struct {
	ChecklistID    *uuid.UUID `json:"checklist_id,omitempty"`
	EnableChunking *bool      `json:"enable_chunking,omitempty"`
	Mode           string     `json:"mode,omitempty"` // "resume" or "restart"
}

// ProcessVideo triggers the full 5-phase analysis pipeline.
// POST /api/videos/:id/process
func (h *PipelineHandler) ProcessVideo(c *gin.Context) {
	videoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid video ID")
		return
	}

	var req triggerPipelineRequest
	_ = c.ShouldBindJSON(&req) // optional body

	enableChunking := true
	if req.EnableChunking != nil {
		enableChunking = *req.EnableChunking
	}

	if err := h.orchestrator.TriggerPipeline(videoID, req.ChecklistID, enableChunking, req.Mode); err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to trigger pipeline: "+err.Error())
		return
	}

	mode := req.Mode
	if mode == "" {
		mode = "auto"
	}

	RespondSuccess(c, gin.H{
		"message":         "pipeline started successfully",
		"video_id":        videoID,
		"enable_chunking": enableChunking,
		"mode":            mode,
		"status":          "running",
	})
}

// GetStatus returns the current status and job progress of the pipeline for a video.
// GET /api/videos/:id/pipeline
func (h *PipelineHandler) GetStatus(c *gin.Context) {
	videoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid video ID")
		return
	}

	status, err := h.orchestrator.GetStatus(c.Request.Context(), videoID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to get pipeline status: "+err.Error())
		return
	}

	RespondSuccess(c, status)
}

// GetEvents returns the list of extracted raw events for timeline review.
// GET /api/videos/:id/events
func (h *PipelineHandler) GetEvents(c *gin.Context) {
	videoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid video ID")
		return
	}

	includeDuplicates := c.Query("include_duplicates") == "true"
	events, err := h.rawEventRepo.ListByVideoID(c.Request.Context(), videoID, !includeDuplicates)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to list events: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"events": events})
}

// CancelVideo aborts an in-progress pipeline execution.
// POST /api/videos/:id/cancel
// POST /api/videos/:id/stop
func (h *PipelineHandler) CancelVideo(c *gin.Context) {
	videoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid video ID")
		return
	}

	if err := h.orchestrator.CancelPipeline(videoID); err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to cancel pipeline: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"message":  "pipeline cancelled successfully",
		"video_id": videoID,
		"status":   "cancelled",
	})
}

// ResetPipeline wipes all intermediate pipeline data for a video and resets it to 'uploaded' status.
// DELETE /api/videos/:id/pipeline
func (h *PipelineHandler) ResetPipeline(c *gin.Context) {
	videoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid video ID")
		return
	}

	if err := h.orchestrator.ResetPipeline(c.Request.Context(), videoID); err != nil {
		if err.Error() == "video not found: "+videoID.String() {
			RespondError(c, http.StatusNotFound, "video not found")
			return
		}
		RespondError(c, http.StatusInternalServerError, "failed to reset pipeline: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"message":  "pipeline reset successfully — video returned to 'uploaded' status",
		"video_id": videoID,
		"status":   "uploaded",
	})
}

// DeleteEvents removes all extracted events and mappings for a video, resetting status to chunked.
// DELETE /api/videos/:id/events
func (h *PipelineHandler) DeleteEvents(c *gin.Context) {
	videoID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid video ID")
		return
	}

	if err := h.orchestrator.DeleteEventsByVideoID(c.Request.Context(), videoID); err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to delete events: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"message":  "events and mappings deleted successfully — video status reset to 'chunked'",
		"video_id": videoID,
		"status":   "chunked",
	})
}

