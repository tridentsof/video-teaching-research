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

// RunAnalysis triggers the Phase 6 Analysis pipeline asynchronously.
// POST /api/analysis/run
func (h *AnalysisHandler) RunAnalysis(c *gin.Context) {
	run, err := h.svc.TriggerAnalysis(c.Request.Context())
	if err != nil {
		if strings.Contains(err.Error(), "already in progress") {
			RespondError(c, http.StatusConflict, err.Error())
			return
		}
		RespondError(c, http.StatusInternalServerError, "failed to trigger analysis: "+err.Error())
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

// GenerateTeacherAnalysis generates analysis and interview questions for a single teacher.
// POST /api/analysis/:run_id/teachers/:teacher_id/generate
func (h *AnalysisHandler) GenerateTeacherAnalysis(c *gin.Context) {
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
			RespondError(c, http.StatusNotFound, "no analysis run found; please run initial thematic analysis first")
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

	teacherID := strings.TrimSpace(c.Param("teacher_id"))
	if teacherID == "" {
		RespondError(c, http.StatusBadRequest, "teacher_id is required")
		return
	}

	ta, questions, err := h.svc.GenerateSingleTeacherAnalysisAndQuestions(c.Request.Context(), runID, teacherID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to generate questions for teacher: "+err.Error())
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
			rqLabel := ""
			if q.RQCategory != nil && *q.RQCategory != "" {
				rqLabel = fmt.Sprintf("[%s] ", *q.RQCategory)
			}
			md.WriteString(fmt.Sprintf("%d. %s%s\n", coreIdx, rqLabel, q.QuestionText))
			coreIdx++
		}
	}
	md.WriteString("\n")

	md.WriteString(fmt.Sprintf("## Participant-specific Follow-up Questions (sinh từ Interaction Log của %s)\n", teacherID))
	dynIdx := 1
	for _, q := range questions {
		if q.Type == "dynamic" {
			rqLabel := ""
			if q.RQCategory != nil && *q.RQCategory != "" {
				rqLabel = fmt.Sprintf("[%s] ", *q.RQCategory)
			}
			md.WriteString(fmt.Sprintf("%d. %s%s\n", dynIdx, rqLabel, q.QuestionText))
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

// GetCoreQuestions returns the core questions and status for an analysis run.
// GET /api/analysis/:run_id/core-questions
func (h *AnalysisHandler) GetCoreQuestions(c *gin.Context) {
	param := c.Param("run_id")
	if param == "default" || param == "latest" {
		latest, err := h.svc.GetLatestRun(c.Request.Context())
		if err != nil || latest == nil {
			RespondSuccess(c, gin.H{
				"core_questions": service.DefaultSynthesizedCoreQuestions,
				"status":         "draft",
			})
			return
		}
		param = latest.ID.String()
	}

	runID, err := uuid.Parse(param)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid analysis run ID")
		return
	}

	questions, status, err := h.svc.GetCoreQuestions(c.Request.Context(), runID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to get core questions: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"core_questions": questions,
		"status":         status,
	})
}

// SynthesizeCoreQuestions triggers AI to re-synthesize core questions based on base questions and discovered themes.
// POST /api/analysis/:run_id/core-questions/synthesize
func (h *AnalysisHandler) SynthesizeCoreQuestions(c *gin.Context) {
	runID, err := uuid.Parse(c.Param("run_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid analysis run ID")
		return
	}

	themes, err := h.svc.GetThemes(c.Request.Context(), runID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to retrieve themes: "+err.Error())
		return
	}

	questions, err := h.svc.SynthesizeCoreQuestions(c.Request.Context(), runID, themes)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to synthesize core questions: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"core_questions": questions,
		"status":         "draft",
	})
}

type approveCoreQuestionsRequest struct {
	Questions []model.CoreQuestionItem `json:"questions"`
}

// ApproveCoreQuestions approves the core questions for a run and synchronizes them across teachers.
// POST /api/analysis/:run_id/core-questions/approve
func (h *AnalysisHandler) ApproveCoreQuestions(c *gin.Context) {
	runID, err := uuid.Parse(c.Param("run_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid analysis run ID")
		return
	}

	var req approveCoreQuestionsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if err := h.svc.ApproveCoreQuestions(c.Request.Context(), runID, req.Questions); err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to approve core questions: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"status":  "approved",
		"message": "Core questions approved and synchronized successfully",
	})
}

// UnapproveCoreQuestions reverts the core questions status to draft.
// POST /api/analysis/:run_id/core-questions/unapprove
func (h *AnalysisHandler) UnapproveCoreQuestions(c *gin.Context) {
	runID, err := uuid.Parse(c.Param("run_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid analysis run ID")
		return
	}

	if err := h.svc.UnapproveCoreQuestions(c.Request.Context(), runID); err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to unapprove core questions: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"status":  "draft",
		"message": "Core questions unlocked and reverted to draft",
	})
}

type updateInterviewQuestionRequest struct {
	QuestionText string  `json:"question_text"`
	RQCategory   *string `json:"rq_category"`
}

// UpdateInterviewQuestion updates an individual question's text or rq_category.
// PUT /api/analysis/questions/:question_id
func (h *AnalysisHandler) UpdateInterviewQuestion(c *gin.Context) {
	qID, err := uuid.Parse(c.Param("question_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid question ID")
		return
	}

	var req updateInterviewQuestionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if err := h.svc.UpdateInterviewQuestion(c.Request.Context(), qID, req.QuestionText, req.RQCategory); err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to update interview question: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"updated": true})
}

