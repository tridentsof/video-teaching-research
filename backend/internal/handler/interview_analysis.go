package handler

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/service"
)

// InterviewAnalysisHandler handles HTTP endpoints for the Post-Interview Analysis phase.
type InterviewAnalysisHandler struct {
	svc *service.InterviewAnalysisService
}

// NewInterviewAnalysisHandler creates a new InterviewAnalysisHandler instance.
func NewInterviewAnalysisHandler(svc *service.InterviewAnalysisService) *InterviewAnalysisHandler {
	return &InterviewAnalysisHandler{svc: svc}
}

// UploadAudio handles uploading teacher interview audio recording.
// POST /api/interview-analysis/upload-audio
func (h *InterviewAnalysisHandler) UploadAudio(c *gin.Context) {
	teacherID := strings.TrimSpace(c.PostForm("teacher_id"))
	if teacherID == "" {
		RespondError(c, http.StatusBadRequest, "teacher_id is required")
		return
	}

	runIDStr := strings.TrimSpace(c.PostForm("analysis_run_id"))
	var runID uuid.UUID
	var err error
	if runIDStr != "" {
		runID, err = uuid.Parse(runIDStr)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid analysis_run_id")
			return
		}
	}

	fileHeader, err := c.FormFile("audio_file")
	if err != nil {
		RespondError(c, http.StatusBadRequest, "audio_file is required: "+err.Error())
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to open uploaded audio file: "+err.Error())
		return
	}
	defer file.Close()

	overwriteMode := strings.TrimSpace(c.PostForm("overwrite_mode"))

	resp, err := h.svc.UploadAudio(c.Request.Context(), runID, teacherID, fileHeader.Filename, file, overwriteMode)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to upload audio: "+err.Error())
		return
	}

	RespondCreated(c, resp)
}

// TranscribeAudio triggers AI transcription on an uploaded interview response.
// POST /api/interview-analysis/responses/:id/transcribe
func (h *InterviewAnalysisHandler) TranscribeAudio(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid response ID")
		return
	}

	resp, err := h.svc.TranscribeAudio(c.Request.Context(), id)
	if err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(c.Request.Context().Err(), context.Canceled) || strings.Contains(strings.ToLower(err.Error()), "cancel") {
			RespondSuccess(c, gin.H{"message": "transcription cancelled", "transcript_status": "uploaded"})
			return
		}
		RespondError(c, http.StatusInternalServerError, "transcription failed: "+err.Error())
		return
	}

	RespondSuccess(c, resp)
}

// CancelTranscription cancels an in-flight audio transcription.
// POST /api/interview-analysis/responses/:id/cancel-transcribe
func (h *InterviewAnalysisHandler) CancelTranscription(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid response ID")
		return
	}

	if err := h.svc.CancelTranscription(c.Request.Context(), id); err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to cancel transcription: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"message": "transcription cancelled", "id": id})
}

// FinalizeResponse updates the reviewed response text and marks it finalized.
// PUT /api/interview-analysis/responses/:id/finalize
func (h *InterviewAnalysisHandler) FinalizeResponse(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid response ID")
		return
	}

	var dto model.FinalizeResponseDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	resp, err := h.svc.FinalizeResponse(c.Request.Context(), id, dto.ResponseText)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to finalize response: "+err.Error())
		return
	}

	RespondSuccess(c, resp)
}

// CreateManualResponse allows direct pasting/typing of a response.
// POST /api/interview-analysis/responses
func (h *InterviewAnalysisHandler) CreateManualResponse(c *gin.Context) {
	var input model.InterviewResponse
	if err := c.ShouldBindJSON(&input); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	resp, err := h.svc.CreateManualResponse(c.Request.Context(), &input)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to create response: "+err.Error())
		return
	}

	RespondCreated(c, resp)
}

// AlignAndSplitQA triggers semantic alignment between planned interview questions and teacher transcript.
// POST /api/interview-analysis/responses/align-qa
func (h *InterviewAnalysisHandler) AlignAndSplitQA(c *gin.Context) {
	var input struct {
		AnalysisRunID string `json:"analysis_run_id"`
		TeacherID     string `json:"teacher_id" binding:"required"`
		RawTranscript string `json:"raw_transcript"`
	}

	if err := c.ShouldBindJSON(&input); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	var runID uuid.UUID
	if strings.TrimSpace(input.AnalysisRunID) != "" {
		var err error
		runID, err = uuid.Parse(input.AnalysisRunID)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid analysis_run_id")
			return
		}
	}

	// Use 5-minute timeout with detached background context so client-side / proxy timeout doesn't abort ongoing AI alignment
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	responses, err := h.svc.AlignAndSplitQA(ctx, runID, input.TeacherID, input.RawTranscript)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to align and split Q&A: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"responses": responses})
}

// GetResponsesByTeacher returns all interview responses for a teacher.
// GET /api/interview-analysis/responses/:teacher_id
func (h *InterviewAnalysisHandler) GetResponsesByTeacher(c *gin.Context) {
	teacherID := c.Param("teacher_id")
	runIDStr := c.Query("run_id")
	var runID uuid.UUID
	if runIDStr != "" {
		var err error
		runID, err = uuid.Parse(runIDStr)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid run_id")
			return
		}
	}

	responses, err := h.svc.GetResponsesByTeacher(c.Request.Context(), runID, teacherID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to get responses: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"responses": responses})
}

// DeleteResponse deletes an interview response.
// DELETE /api/interview-analysis/responses/:id
func (h *InterviewAnalysisHandler) DeleteResponse(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid response ID")
		return
	}

	if err := h.svc.DeleteResponse(c.Request.Context(), id); err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to delete response: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"deleted": true})
}

// SegmentMeaningUnits uses AI to segment a response into meaning units.
// POST /api/interview-analysis/responses/:id/segment
func (h *InterviewAnalysisHandler) SegmentMeaningUnits(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid response ID")
		return
	}

	units, err := h.svc.SegmentMeaningUnits(c.Request.Context(), id)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to segment meaning units: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"meaning_units": units})
}

// GetMeaningUnits returns meaning units for a teacher.
// GET /api/interview-analysis/meaning-units/:teacher_id
func (h *InterviewAnalysisHandler) GetMeaningUnits(c *gin.Context) {
	teacherID := c.Param("teacher_id")
	units, err := h.svc.GetMeaningUnitsByTeacher(c.Request.Context(), teacherID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to get meaning units: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"meaning_units": units})
}

// UpdateMeaningUnit updates a meaning unit.
// PUT /api/interview-analysis/meaning-units/:id
func (h *InterviewAnalysisHandler) UpdateMeaningUnit(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid meaning unit ID")
		return
	}

	var dto model.MeaningUnitUpdateDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	u, err := h.svc.UpdateMeaningUnit(c.Request.Context(), id, dto)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to update meaning unit: "+err.Error())
		return
	}

	RespondSuccess(c, u)
}

// CreateMeaningUnit creates a single meaning unit manually.
// POST /api/interview-analysis/meaning-units
func (h *InterviewAnalysisHandler) CreateMeaningUnit(c *gin.Context) {
	var dto model.CreateMeaningUnitDTO
	if err := c.ShouldBindJSON(&dto); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	u, err := h.svc.CreateMeaningUnit(c.Request.Context(), dto)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to create meaning unit: "+err.Error())
		return
	}

	RespondCreated(c, u)
}

// DeleteMeaningUnit deletes a meaning unit.
// DELETE /api/interview-analysis/meaning-units/:id
func (h *InterviewAnalysisHandler) DeleteMeaningUnit(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid meaning unit ID")
		return
	}

	if err := h.svc.DeleteMeaningUnit(c.Request.Context(), id); err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to delete meaning unit: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"deleted": true})
}

// GenerateInitialCodes runs AI coding for a teacher's meaning units.
// POST /api/interview-analysis/codes/generate
func (h *InterviewAnalysisHandler) GenerateInitialCodes(c *gin.Context) {
	var input struct {
		AnalysisRunID string `json:"analysis_run_id"`
		TeacherID     string `json:"teacher_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	var runID uuid.UUID
	if input.AnalysisRunID != "" {
		var err error
		runID, err = uuid.Parse(input.AnalysisRunID)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid analysis_run_id")
			return
		}
	}

	units, codes, err := h.svc.GenerateInitialCodes(c.Request.Context(), runID, input.TeacherID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to generate codes: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{
		"meaning_units": units,
		"codes":         codes,
	})
}

// GetCodes returns all aggregated codes for a run.
// GET /api/interview-analysis/codes
func (h *InterviewAnalysisHandler) GetCodes(c *gin.Context) {
	runIDStr := c.Query("run_id")
	var runID uuid.UUID
	if runIDStr != "" {
		var err error
		runID, err = uuid.Parse(runIDStr)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid run_id")
			return
		}
	}

	codes, err := h.svc.GetCodes(c.Request.Context(), runID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to get codes: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"codes": codes})
}

// RunTriangulation runs AI observation-interview triangulation.
// POST /api/interview-analysis/triangulate
func (h *InterviewAnalysisHandler) RunTriangulation(c *gin.Context) {
	var input struct {
		AnalysisRunID string `json:"analysis_run_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	runID, err := uuid.Parse(input.AnalysisRunID)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid analysis_run_id")
		return
	}

	entries, err := h.svc.RunTriangulation(c.Request.Context(), runID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "triangulation failed: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"triangulation_entries": entries})
}

// GetTriangulation returns triangulation entries for a run.
// GET /api/interview-analysis/triangulation
func (h *InterviewAnalysisHandler) GetTriangulation(c *gin.Context) {
	runIDStr := c.Query("run_id")
	var runID uuid.UUID
	if runIDStr != "" {
		var err error
		runID, err = uuid.Parse(runIDStr)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid run_id")
			return
		}
	}

	entries, err := h.svc.GetTriangulation(c.Request.Context(), runID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to get triangulation: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"triangulation_entries": entries})
}

// UpdateTriangulationEntry updates an entry.
// PUT /api/interview-analysis/triangulation/:id
func (h *InterviewAnalysisHandler) UpdateTriangulationEntry(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid ID")
		return
	}

	var input struct {
		Relationship       string `json:"relationship"`
		ObservationFinding string `json:"observation_finding"`
		InterviewEvidence  string `json:"interview_evidence"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	entry, err := h.svc.UpdateTriangulationEntry(c.Request.Context(), id, input.Relationship, input.ObservationFinding, input.InterviewEvidence)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to update triangulation entry: "+err.Error())
		return
	}

	RespondSuccess(c, entry)
}

// GetPerTeacherComparison aggregates 2 video observations vs interview data for a teacher.
// GET /api/interview-analysis/teacher-comparison/:teacher_id
func (h *InterviewAnalysisHandler) GetPerTeacherComparison(c *gin.Context) {
	teacherID := c.Param("teacher_id")
	runIDStr := c.Query("run_id")
	var runID uuid.UUID
	if runIDStr != "" {
		var err error
		runID, err = uuid.Parse(runIDStr)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid run_id")
			return
		}
	}

	data, err := h.svc.GetPerTeacherComparison(c.Request.Context(), runID, teacherID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to get teacher comparison: "+err.Error())
		return
	}

	RespondSuccess(c, data)
}

// SelectRepresentativeQuotes triggers AI quote selection.
// POST /api/interview-analysis/quotes/select
func (h *InterviewAnalysisHandler) SelectRepresentativeQuotes(c *gin.Context) {
	var input struct {
		AnalysisRunID string `json:"analysis_run_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	runID, err := uuid.Parse(input.AnalysisRunID)
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid analysis_run_id")
		return
	}

	quotes, err := h.svc.SelectRepresentativeQuotes(c.Request.Context(), runID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "quote selection failed: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"quotes": quotes})
}

// GetRepresentativeQuotes returns quotes for a run.
// GET /api/interview-analysis/quotes
func (h *InterviewAnalysisHandler) GetRepresentativeQuotes(c *gin.Context) {
	runIDStr := c.Query("run_id")
	var runID uuid.UUID
	if runIDStr != "" {
		var err error
		runID, err = uuid.Parse(runIDStr)
		if err != nil {
			RespondError(c, http.StatusBadRequest, "invalid run_id")
			return
		}
	}

	quotes, err := h.svc.GetRepresentativeQuotes(c.Request.Context(), runID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to get quotes: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"quotes": quotes})
}

// ToggleQuoteSelection toggles quote inclusion.
// PUT /api/interview-analysis/quotes/:id/toggle
func (h *InterviewAnalysisHandler) ToggleQuoteSelection(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid ID")
		return
	}

	var input struct {
		IsSelected bool `json:"is_selected"`
	}
	if err := c.ShouldBindJSON(&input); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if err := h.svc.ToggleQuoteSelection(c.Request.Context(), id, input.IsSelected); err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to toggle quote: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"toggled": true, "is_selected": input.IsSelected})
}
