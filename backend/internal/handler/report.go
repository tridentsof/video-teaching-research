package handler

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/service"
)

// ReportHandler handles HTTP requests for reports.
type ReportHandler struct {
	svc *service.ReportService
}

// NewReportHandler creates a new ReportHandler.
func NewReportHandler(svc *service.ReportService) *ReportHandler {
	return &ReportHandler{svc: svc}
}

// GetByVideoID returns the report for a video.
// GET /api/reports/video/:video_id
func (h *ReportHandler) GetByVideoID(c *gin.Context) {
	videoID, err := uuid.Parse(c.Param("video_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid video ID")
		return
	}

	report, err := h.svc.GetReportByVideoID(c.Request.Context(), videoID)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			RespondError(c, http.StatusNotFound, "report not found for this video")
			return
		}
		RespondError(c, http.StatusInternalServerError, "failed to get report: "+err.Error())
		return
	}
	if report == nil {
		RespondError(c, http.StatusNotFound, "report not found for this video")
		return
	}

	RespondSuccess(c, report)
}

// ExportMarkdown downloads the report as a markdown file.
// GET /api/reports/video/:video_id/export.md
func (h *ReportHandler) ExportMarkdown(c *gin.Context) {
	videoID, err := uuid.Parse(c.Param("video_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid video ID")
		return
	}

	report, err := h.svc.GetReportByVideoID(c.Request.Context(), videoID)
	if err != nil || report == nil {
		RespondError(c, http.StatusNotFound, "report not found")
		return
	}

	filename := fmt.Sprintf("report_%s_%s.md", report.TeacherID, videoID.String()[:8])
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Type", "text/markdown; charset=utf-8")
	c.String(http.StatusOK, report.MarkdownContent)
}
