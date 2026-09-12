package handler

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/service"
)


// AnalysisHandler handles HTTP endpoints for Phase 6 analysis and interview questions.
type AnalysisHandler struct {
	svc *service.AnalysisService
}

// NewAnalysisHandler creates a new AnalysisHandler.
func NewAnalysisHandler(svc *service.AnalysisService) *AnalysisHandler {
	return &AnalysisHandler{svc: svc}
}

// RunAnalysis triggers the Phase 6 Analysis pipeline.
// POST /api/analysis/run
func (h *AnalysisHandler) RunAnalysis(c *gin.Context) {
	run, err := h.svc.RunFullAnalysis(c.Request.Context())
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to run analysis: "+err.Error())
		return
	}
	RespondSuccess(c, run)
}

// GetThemes returns all themes for an analysis run.
// GET /api/analysis/:run_id/themes
// GetThemes returns all themes for an analysis run.
// GET /api/analysis/:run_id/themes
func (h *AnalysisHandler) GetThemes(c *gin.Context) {
	param := c.Param("run_id")
	var runID uuid.UUID
	if param == "default" || param == "latest" {
		// Default / latest request before first run
		RespondSuccess(c, gin.H{"themes": []any{}})
		return
	}

	var err error
	runID, err = uuid.Parse(param)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid analysis run ID")
		return
	}

	themes, err := h.svc.GetThemes(c.Request.Context(), runID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to get themes: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"themes": themes})
}

type updateThemeRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Status      string `json:"status"` // draft | confirmed
}

// UpdateTheme updates a theme's name, description, or status.
// PUT /api/analysis/themes/:id
func (h *AnalysisHandler) UpdateTheme(c *gin.Context) {
	themeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid theme ID")
		return
	}

	var req updateThemeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	if err := h.svc.UpdateTheme(c.Request.Context(), themeID, req.Name, req.Description, req.Status); err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to update theme: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"message": "theme updated successfully"})
}

type mergeThemesRequest struct {
	TargetThemeID uuid.UUID `json:"target_theme_id" binding:"required"`
	SourceThemeID uuid.UUID `json:"source_theme_id" binding:"required"`
}

// MergeThemes combines two themes into one.
// POST /api/analysis/themes/merge
func (h *AnalysisHandler) MergeThemes(c *gin.Context) {
	var req mergeThemesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "target_theme_id and source_theme_id are required")
		return
	}

	if err := h.svc.MergeThemes(c.Request.Context(), req.TargetThemeID, req.SourceThemeID); err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to merge themes: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"message": "themes merged successfully"})
}

// ConfirmTheme locks the theme status as confirmed.
// PUT /api/analysis/themes/:id/confirm
func (h *AnalysisHandler) ConfirmTheme(c *gin.Context) {
	themeID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid theme ID")
		return
	}

	if err := h.svc.UpdateTheme(c.Request.Context(), themeID, "", "", "confirmed"); err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to confirm theme: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"message": "theme confirmed successfully"})
}

// GetLatestRun returns the most recent analysis run if one exists.
// GET /api/analysis/latest
func (h *AnalysisHandler) GetLatestRun(c *gin.Context) {
	run, err := h.svc.GetLatestRun(c.Request.Context())
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to get latest analysis run: "+err.Error())
		return
	}
	if run == nil {
		RespondSuccess(c, gin.H{"run": nil})
		return
	}
	RespondSuccess(c, gin.H{"run": run})
}

// ListRuns returns all analysis runs.
// GET /api/analysis/runs
func (h *AnalysisHandler) ListRuns(c *gin.Context) {
	runs, err := h.svc.ListRuns(c.Request.Context())
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to list analysis runs: "+err.Error())
		return
	}
	if runs == nil {
		runs = []model.AnalysisRun{}
	}
	RespondSuccess(c, gin.H{"runs": runs})
}

// DeleteRun deletes an analysis run and its related data.
// DELETE /api/analysis/:run_id
func (h *AnalysisHandler) DeleteRun(c *gin.Context) {
	runID, err := uuid.Parse(c.Param("run_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid analysis run ID")
		return
	}

	if err := h.svc.DeleteRun(c.Request.Context(), runID); err != nil {
		if strings.Contains(err.Error(), "not found") {
			RespondError(c, http.StatusNotFound, "analysis run not found")
			return
		}
		RespondError(c, http.StatusInternalServerError, "failed to delete analysis run: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"message": "analysis run deleted successfully"})
}


// GetTeacherAnalysis returns teacher analysis and interview questions.
// GET /api/analysis/:run_id/teachers/:teacher_id
func (h *AnalysisHandler) GetTeacherAnalysis(c *gin.Context) {
	param := c.Param("run_id")
	var runID uuid.UUID
	var err error

	if param == "latest" || param == "default" {
		latestRun, err := h.svc.GetLatestRun(c.Request.Context())
		if err != nil {
			RespondError(c, http.StatusInternalServerError, "failed to query latest analysis run: "+err.Error())
			return
		}
		if latestRun == nil {
			RespondError(c, http.StatusNotFound, "no analysis run found yet")
			return
		}
		runID = latestRun.ID
	} else {
		runID, err = uuid.Parse(param)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid analysis run ID")
			return
		}
	}

	teacherID := c.Param("teacher_id")

	ta, questions, err := h.svc.GetTeacherAnalysisAndQuestions(c.Request.Context(), runID, teacherID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to get teacher analysis: "+err.Error())
		return
	}
	if ta == nil {
		RespondError(c, http.StatusNotFound, "teacher analysis not found")
		return
	}

	RespondSuccess(c, gin.H{
		"run_id":              runID,
		"teacher_analysis":    ta,
		"interview_questions": questions,
	})
}

// ExportInterviewMarkdown downloads the interview questions as a markdown file for the researcher.
// GET /api/analysis/:run_id/teachers/:teacher_id/interview.md
func (h *AnalysisHandler) ExportInterviewMarkdown(c *gin.Context) {
	param := c.Param("run_id")
	var runID uuid.UUID
	var err error

	if param == "latest" || param == "default" {
		latestRun, err := h.svc.GetLatestRun(c.Request.Context())
		if err != nil || latestRun == nil {
			RespondError(c, http.StatusNotFound, "no analysis run found yet")
			return
		}
		runID = latestRun.ID
	} else {
		runID, err = uuid.Parse(param)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid analysis run ID")
			return
		}
	}

	teacherID := c.Param("teacher_id")

	ta, questions, err := h.svc.GetTeacherAnalysisAndQuestions(c.Request.Context(), runID, teacherID)
	if err != nil || ta == nil {
		RespondError(c, http.StatusNotFound, "teacher analysis not found")
		return
	}

	var md strings.Builder
	md.WriteString(fmt.Sprintf("# Interview Questions — %s\n", teacherID))
	md.WriteString(fmt.Sprintf("**Prepared:** %s\n\n", ta.CreatedAt.Format("2006-01-02")))

	md.WriteString("## Core Questions (áp dụng cho tất cả giáo viên)\n")
	coreIdx := 1
	for _, q := range questions {
		if q.Type == "core" {
			md.WriteString(fmt.Sprintf("%d. %s\n", coreIdx, q.QuestionText))
			coreIdx++
		}
	}
	md.WriteString("\n")

	md.WriteString(fmt.Sprintf("## Dynamic Questions (sinh từ data của %s)\n", teacherID))
	dynIdx := 1
	for _, q := range questions {
		if q.Type == "dynamic" {
			md.WriteString(fmt.Sprintf("%d. %s\n", dynIdx, q.QuestionText))
			if q.EvidenceRef != nil && *q.EvidenceRef != "" {
				md.WriteString(fmt.Sprintf("   *(Evidence: %s)*\n", *q.EvidenceRef))
			}
			dynIdx++
		}
	}

	filename := fmt.Sprintf("%s_interview_questions.md", teacherID)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Type", "text/markdown; charset=utf-8")
	c.String(http.StatusOK, md.String())
}
