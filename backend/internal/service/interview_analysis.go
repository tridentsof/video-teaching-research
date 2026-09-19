package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/ai"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// InterviewAnalysisService coordinates audio upload, AI transcription, meaning unit segmentation,
// coding, triangulation, and quote selection.
type InterviewAnalysisService struct {
	repo                 *repository.InterviewAnalysisRepository
	interviewBaseRepo    *repository.InterviewBaseRepository
	analysisRepo         *repository.AnalysisRepository
	aiRouter             *AIRouterService
	blob                 BlobStorage
	telegramNotifier     TelegramNotifier
	activeTranscriptions sync.Map // map[uuid.UUID]context.CancelFunc
}

// NewInterviewAnalysisService creates a new InterviewAnalysisService instance.
func NewInterviewAnalysisService(
	repo *repository.InterviewAnalysisRepository,
	interviewBaseRepo *repository.InterviewBaseRepository,
	analysisRepo *repository.AnalysisRepository,
	aiRouter *AIRouterService,
	blob BlobStorage,
) *InterviewAnalysisService {
	return &InterviewAnalysisService{
		repo:              repo,
		interviewBaseRepo: interviewBaseRepo,
		analysisRepo:      analysisRepo,
		aiRouter:          aiRouter,
		blob:              blob,
	}
}

// SetTelegramNotifier sets the telegram notifier for interview analysis alerts.
func (s *InterviewAnalysisService) SetTelegramNotifier(notifier TelegramNotifier) {
	s.telegramNotifier = notifier
}

// UploadAudio handles storing an audio file and creating an initial interview_response record.
func (s *InterviewAnalysisService) UploadAudio(
	ctx context.Context,
	runID uuid.UUID,
	teacherID string,
	filename string,
	reader io.Reader,
	overwriteMode string,
) (*model.InterviewResponse, error) {
	if teacherID == "" {
		return nil, fmt.Errorf("teacher_id is required")
	}

	respID := uuid.New()
	ext := strings.ToLower(filepath.Ext(filename))
	if ext == "" {
		ext = ".mp3"
	}

	blobPath := fmt.Sprintf("interviews/%s_%s%s", teacherID, respID.String()[:8], ext)

	// Store audio through BlobStorage
	var blobURL string
	var err error
	if s.blob != nil {
		blobURL, err = s.blob.Upload(ctx, blobPath, reader)
		if err != nil {
			return nil, fmt.Errorf("failed to upload audio file: %w", err)
		}
	} else {
		// Fallback: save directly to ./storage/interviews
		localPath := filepath.Join("./storage", blobPath)
		if err := os.MkdirAll(filepath.Dir(localPath), 0755); err != nil {
			return nil, fmt.Errorf("failed to create storage directory: %w", err)
		}
		out, err := os.Create(localPath)
		if err != nil {
			return nil, fmt.Errorf("failed to create audio file: %w", err)
		}
		defer out.Close()
		if _, err := io.Copy(out, reader); err != nil {
			return nil, fmt.Errorf("failed to write audio file: %w", err)
		}
		blobURL = "/storage/" + blobPath
	}

	existingResponses, err := s.repo.ListResponsesByTeacher(ctx, runID, teacherID)

	// Mode: Replace audio only without touching transcripts, meaning units or quotes
	if overwriteMode == "replace_audio" && err == nil && len(existingResponses) > 0 {
		for _, old := range existingResponses {
			if old.QuestionText == "Full Teacher Interview Recording" || old.AudioBlobPath != nil {
				if err := s.repo.UpdateResponseAudio(ctx, old.ID, blobURL, filename); err != nil {
					return nil, fmt.Errorf("failed to update audio file for response: %w", err)
				}
				oldCopy := old
				oldCopy.AudioBlobPath = &blobURL
				oldCopy.AudioFilename = &filename
				return &oldCopy, nil
			}
		}
	}

	// Mode: Full reset (default) - clean up old responses & quotes for this teacher
	if err == nil {
		for _, old := range existingResponses {
			if old.TranscriptStatus == "transcribing" {
				log.Printf("[InterviewAnalysis] Cancelling in-flight transcription for old response %s (teacher %s)", old.ID, teacherID)
				_ = s.CancelTranscription(ctx, old.ID)
			}
			// Delete existing recordings to avoid duplicate or mixed Q&A responses (cascades to meaning_units)
			_ = s.repo.DeleteResponse(ctx, old.ID)
		}
		// Also clean up representative quotes for this teacher in this run
		_ = s.repo.DeleteRepresentativeQuotesByTeacher(ctx, runID, teacherID)
	}

	resp := &model.InterviewResponse{
		ID:               respID,
		AnalysisRunID:    runID,
		TeacherID:        teacherID,
		QuestionText:     "Full Teacher Interview Recording",
		AudioBlobPath:    &blobURL,
		AudioFilename:    &filename,
		TranscriptStatus: "uploaded",
		Language:         "",
	}

	if err := s.repo.CreateResponse(ctx, resp); err != nil {
		return nil, fmt.Errorf("failed to create interview response: %w", err)
	}

	return resp, nil
}

// TranscribeAudio invokes multimodal AI to transcribe the uploaded audio recording.
func (s *InterviewAnalysisService) TranscribeAudio(ctx context.Context, responseID uuid.UUID) (*model.InterviewResponse, error) {
	transcribeStart := time.Now()

	resp, err := s.repo.GetResponseByID(ctx, responseID)
	if err != nil || resp == nil {
		return nil, fmt.Errorf("interview response not found: %w", err)
	}

	if resp.AudioBlobPath == nil || *resp.AudioBlobPath == "" {
		return nil, fmt.Errorf("no audio file associated with this response")
	}

	// Guard against concurrent transcribe calls on the same response
	if resp.TranscriptStatus == "transcribing" {
		if _, isRunning := s.activeTranscriptions.Load(responseID); isRunning {
			return nil, fmt.Errorf("transcription is already in progress for this response")
		}
	}

	// Register active cancellation context
	transcribeCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	s.activeTranscriptions.Store(responseID, cancel)
	defer s.activeTranscriptions.Delete(responseID)

	// Update status to 'transcribing'
	_ = s.repo.UpdateResponseTranscript(transcribeCtx, responseID, "", "transcribing")

	// Determine local audio file path
	localPath := *resp.AudioBlobPath
	if strings.HasPrefix(localPath, "/storage/") {
		localPath = "." + localPath
	}

	// Fetch known interview questions for context
	var knownQuestions []string
	if s.interviewBaseRepo != nil {
		baseQuestions, _ := s.interviewBaseRepo.List(transcribeCtx, true)
		for _, q := range baseQuestions {
			knownQuestions = append(knownQuestions, q.QuestionText)
		}
	}

	// Resolve Audio Transcription Provider from AI Router
	audioProvider, _, err := s.aiRouter.GetAudioProviderForFlow(transcribeCtx, "interview_transcription")
	if err != nil {
		_ = s.repo.UpdateResponseTranscript(context.Background(), responseID, "", "failed")
		return nil, fmt.Errorf("failed to get audio transcription provider: %w", err)
	}

	// Construct transcription prompt
	sysPrompt, userPrompt := PromptTranscribeInterviewAudio(resp.TeacherID, knownQuestions)
	fullPrompt := sysPrompt + "\n\n" + userPrompt

	log.Printf("[InterviewAnalysis] Starting audio transcription for response %s (teacher %s, file: %s)",
		responseID, resp.TeacherID, localPath)

	transcriptionResult, err := audioProvider.TranscribeAudio(transcribeCtx, localPath, fullPrompt)
	if err != nil {
		if errors.Is(err, context.Canceled) || errors.Is(transcribeCtx.Err(), context.Canceled) || strings.Contains(strings.ToLower(err.Error()), "cancel") {
			log.Printf("[InterviewAnalysis] Transcription cancelled for response %s", responseID)
			_ = s.repo.ResetTranscriptionStatus(context.Background(), responseID)
			return nil, fmt.Errorf("transcription cancelled")
		}
		_ = s.repo.UpdateResponseTranscript(context.Background(), responseID, "", "failed")
		return nil, fmt.Errorf("audio transcription failed: %w", err)
	}

	// Parse JSON output from transcription
	cleanedJSON := ai.ExtractJSONFromMarkdown(transcriptionResult)
	var parsed struct {
		Language         string  `json:"language"`
		AudioDurationSec float64 `json:"audio_duration_sec"`
		RawTranscript    string  `json:"raw_transcript"`
		QAPairs          []struct {
			QuestionText string `json:"question_text"`
			AnswerText   string `json:"answer_text"`
		} `json:"qa_pairs"`
	}

	if err := json.Unmarshal([]byte(cleanedJSON), &parsed); err != nil {
		log.Printf("[InterviewAnalysis] Warning: failed to parse structured JSON from transcription, saving raw output: %v", err)
		parsed.RawTranscript = transcriptionResult
		parsed.Language = "vi"
	}

	rawText := parsed.RawTranscript
	if rawText == "" {
		rawText = transcriptionResult
	}

	// Build default response_text from QA pairs or raw transcript
	var responseTextBuilder strings.Builder
	if len(parsed.QAPairs) > 0 {
		for i, qa := range parsed.QAPairs {
			responseTextBuilder.WriteString(fmt.Sprintf("Q%d: %s\nA: %s\n\n", i+1, qa.QuestionText, qa.AnswerText))
		}
	} else {
		responseTextBuilder.WriteString(rawText)
	}

	resp.RawTranscript = &rawText
	resp.TranscriptStatus = "transcribed"
	resp.Language = parsed.Language
	resp.AudioDurationSec = parsed.AudioDurationSec
	resp.ResponseText = strings.TrimSpace(responseTextBuilder.String())

	// Persist transcription result (language, duration, raw transcript, response text, status)
	err = s.repo.SaveTranscriptionResult(ctx, responseID, rawText, resp.ResponseText, resp.Language, resp.AudioDurationSec, "transcribed")
	if err != nil {
		return nil, fmt.Errorf("failed to save transcribed text: %w", err)
	}

	// Step 1: Dispatch Telegram notification IMMEDIATELY after audio transcription completes (~10s)
	if s.telegramNotifier != nil && s.telegramNotifier.IsEnabled() {
		go func() {
			notifyCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()

			audioName := "Recording"
			if resp.AudioFilename != nil && strings.TrimSpace(*resp.AudioFilename) != "" {
				audioName = *resp.AudioFilename
			}

			previewSnippet := strings.TrimSpace(rawText)
			runeSnippet := []rune(previewSnippet)
			if len(runeSnippet) > 280 {
				previewSnippet = string(runeSnippet[:280]) + "..."
			}

			stats := &InterviewTranscribeNotificationStats{
				TeacherID:        resp.TeacherID,
				AudioFilename:    audioName,
				AudioDurationSec: resp.AudioDurationSec,
				Language:         resp.Language,
				TranscriptLength: len([]rune(rawText)),
				PreviewSnippet:   previewSnippet,
				Duration:         time.Since(transcribeStart),
			}

			if notifyErr := s.telegramNotifier.NotifyInterviewTranscribed(notifyCtx, resp, stats); notifyErr != nil {
				log.Printf("[InterviewAnalysis] Warning: failed to send telegram transcription notification: %v", notifyErr)
			} else {
				log.Printf("[InterviewAnalysis] Telegram notification sent for teacher %s interview transcription", resp.TeacherID)
			}
		}()
	}

	// Step 2: Automatically align and split transcript into structured Q&A cards using interview_analysis model
	if _, alignErr := s.AlignAndSplitQA(ctx, resp.AnalysisRunID, resp.TeacherID, rawText); alignErr != nil {
		log.Printf("[InterviewAnalysis] Notice: auto Q&A alignment after transcription had notice: %v", alignErr)
	}

	return s.repo.GetResponseByID(ctx, responseID)
}

// CancelTranscription cancels an in-flight transcription and resets the response status to 'uploaded'.
func (s *InterviewAnalysisService) CancelTranscription(ctx context.Context, responseID uuid.UUID) error {
	if cancelVal, ok := s.activeTranscriptions.Load(responseID); ok {
		if cancel, ok := cancelVal.(context.CancelFunc); ok {
			log.Printf("[InterviewAnalysis] Actively cancelling transcription for response %s", responseID)
			cancel()
		}
	}
	return s.repo.ResetTranscriptionStatus(ctx, responseID)
}

// FinalizeResponse updates reviewed response text and changes status to 'finalized'.
func (s *InterviewAnalysisService) FinalizeResponse(ctx context.Context, responseID uuid.UUID, responseText string) (*model.InterviewResponse, error) {
	if strings.TrimSpace(responseText) == "" {
		return nil, fmt.Errorf("response text cannot be empty")
	}

	if err := s.repo.FinalizeResponse(ctx, responseID, strings.TrimSpace(responseText)); err != nil {
		return nil, fmt.Errorf("failed to finalize response: %w", err)
	}

	return s.repo.GetResponseByID(ctx, responseID)
}

// CreateManualResponse allows creating an interview response directly (e.g. typing or pasting).
func (s *InterviewAnalysisService) CreateManualResponse(ctx context.Context, resp *model.InterviewResponse) (*model.InterviewResponse, error) {
	if resp.TeacherID == "" {
		return nil, fmt.Errorf("teacher_id is required")
	}
	if resp.ResponseText == "" {
		return nil, fmt.Errorf("response_text is required")
	}
	resp.TranscriptStatus = "finalized"
	if resp.QuestionText == "" {
		resp.QuestionText = "Interview Question"
	}
	if err := s.repo.CreateResponse(ctx, resp); err != nil {
		return nil, err
	}
	return s.repo.GetResponseByID(ctx, resp.ID)
}

// AlignAndSplitQA uses the AI model configured at node "interview_analysis" to semantically
// align a teacher's verbatim transcript with their planned interview questions, producing structured Q&A cards.
func (s *InterviewAnalysisService) AlignAndSplitQA(ctx context.Context, runID uuid.UUID, teacherID string, rawTranscript string) ([]model.InterviewResponse, error) {
	alignStart := time.Now()
	if teacherID == "" {
		return nil, fmt.Errorf("teacher_id is required")
	}

	// Resolve runID if not provided
	if runID == uuid.Nil {
		existingList, _ := s.repo.ListResponsesByTeacher(ctx, uuid.Nil, teacherID)
		for i := range existingList {
			if existingList[i].AnalysisRunID != uuid.Nil {
				runID = existingList[i].AnalysisRunID
				break
			}
		}
	}
	if runID == uuid.Nil && s.analysisRepo != nil {
		if latest, err := s.analysisRepo.GetLatestRun(ctx); err == nil && latest != nil {
			runID = latest.ID
		}
	}

	// 1. Gather planned questions for this teacher
	var alignQuestions []QuestionForAlignment
	if s.analysisRepo != nil {
		_, questions, err := s.analysisRepo.GetTeacherAnalysis(ctx, runID, teacherID)
		if err == nil && len(questions) > 0 {
			for _, q := range questions {
				rqCat := ""
				if q.RQCategory != nil {
					rqCat = *q.RQCategory
				}
				alignQuestions = append(alignQuestions, QuestionForAlignment{
					ID:           q.ID.String(),
					QuestionText: q.QuestionText,
					Type:         q.Type,
					RQCategory:   rqCat,
				})
			}
		}
	}

	// Fallback to base questions bank if no teacher-specific questions found
	if len(alignQuestions) == 0 && s.interviewBaseRepo != nil {
		baseQuestions, err := s.interviewBaseRepo.List(ctx, true)
		if err == nil && len(baseQuestions) > 0 {
			for _, bq := range baseQuestions {
				alignQuestions = append(alignQuestions, QuestionForAlignment{
					ID:           bq.ID.String(),
					QuestionText: bq.QuestionText,
					Type:         "base",
					RQCategory:   bq.RQCategory,
				})
			}
		}
	}

	if len(alignQuestions) == 0 {
		return nil, fmt.Errorf("no interview questions found for teacher %s or in base question bank", teacherID)
	}

	// 2. Resolve raw transcript if not passed directly
	transcript := strings.TrimSpace(rawTranscript)
	existingList, _ := s.repo.ListResponsesByTeacher(ctx, runID, teacherID)
	var parentResp *model.InterviewResponse
	for i := range existingList {
		if existingList[i].QuestionText == "Full Teacher Interview Recording" || (existingList[i].AudioBlobPath != nil && *existingList[i].AudioBlobPath != "") {
			parentResp = &existingList[i]
			break
		}
	}

	if transcript == "" {
		if parentResp != nil {
			if parentResp.RawTranscript != nil && strings.TrimSpace(*parentResp.RawTranscript) != "" {
				transcript = *parentResp.RawTranscript
			} else if strings.TrimSpace(parentResp.ResponseText) != "" {
				transcript = parentResp.ResponseText
			}
		}
	}

	if transcript == "" {
		return nil, fmt.Errorf("transcript text is empty for teacher %s", teacherID)
	}

	// 3. Resolve AI provider for "interview_analysis" flow
	textProvider, modelName, err := s.aiRouter.GetTextProviderForFlow(ctx, "interview_analysis")
	if err != nil {
		return nil, fmt.Errorf("failed to get AI text provider for interview_analysis flow: %w", err)
	}

	sysPrompt, userPrompt := PromptAlignAndSplitQA(teacherID, alignQuestions, transcript)

	log.Printf("[InterviewAnalysis] Aligning Q&A for teacher %s (run %s) using model %s", teacherID, runID, modelName)

	aiResult, err := textProvider.CompleteText(ctx, modelName, sysPrompt, userPrompt)
	if err != nil {
		return nil, fmt.Errorf("AI alignment failed: %w", err)
	}

	cleanedJSON := ai.ExtractJSONFromMarkdown(aiResult)
	var parsed struct {
		AlignedQA []struct {
			QuestionID   string `json:"question_id"`
			QuestionText string `json:"question_text"`
			AnswerText   string `json:"answer_text"`
		} `json:"aligned_qa"`
	}

	if err := json.Unmarshal([]byte(cleanedJSON), &parsed); err != nil {
		log.Printf("[InterviewAnalysis] Warning: failed to parse AI alignment JSON: %v (raw: %s)", err, aiResult)
		return nil, fmt.Errorf("failed to parse AI alignment result: %w", err)
	}

	// 4. Persist aligned sub-responses into interview_responses
	_ = s.repo.DeleteSubResponsesByTeacher(ctx, runID, teacherID)

	for _, qa := range parsed.AlignedQA {
		ans := strings.TrimSpace(qa.AnswerText)
		if ans == "" {
			continue
		}

		var qID *uuid.UUID
		if parsedUUID, err := uuid.Parse(qa.QuestionID); err == nil && parsedUUID != uuid.Nil {
			qID = &parsedUUID
		}

		subResp := &model.InterviewResponse{
			ID:               uuid.New(),
			AnalysisRunID:    runID,
			TeacherID:        teacherID,
			QuestionID:       qID,
			QuestionText:     qa.QuestionText,
			ResponseText:     ans,
			TranscriptStatus: "transcribed",
			RawTranscript:    &transcript,
		}
		if parentResp != nil {
			subResp.AudioBlobPath = parentResp.AudioBlobPath
			subResp.AudioFilename = parentResp.AudioFilename
			subResp.AudioDurationSec = parentResp.AudioDurationSec
			subResp.Language = parentResp.Language
		}

		if err := s.repo.CreateResponse(ctx, subResp); err != nil {
			log.Printf("[InterviewAnalysis] Error creating aligned response card: %v", err)
		}
	}

	// Update parent raw transcript if needed
	if parentResp != nil && (parentResp.RawTranscript == nil || *parentResp.RawTranscript != transcript) {
		_ = s.repo.UpdateResponseTranscript(ctx, parentResp.ID, transcript, "transcribed")
	}

	alignedCards, getErr := s.GetResponsesByTeacher(ctx, runID, teacherID)
	if getErr != nil {
		return nil, getErr
	}

	// Dispatch Step 2 Telegram notification for Q&A alignment completion
	if s.telegramNotifier != nil && s.telegramNotifier.IsEnabled() && len(alignedCards) > 0 {
		go func() {
			notifyCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()

			var qSummary []string
			qaCount := 0
			for _, card := range alignedCards {
				if card.QuestionText != "Full Teacher Interview Recording" && strings.TrimSpace(card.ResponseText) != "" {
					qaCount++
					qSummary = append(qSummary, card.QuestionText)
				}
			}

			stats := &InterviewQAAlignedNotificationStats{
				TeacherID:        teacherID,
				QACount:          qaCount,
				Duration:         time.Since(alignStart),
				QuestionsSummary: qSummary,
			}

			if notifyErr := s.telegramNotifier.NotifyInterviewQAAligned(notifyCtx, teacherID, stats); notifyErr != nil {
				log.Printf("[InterviewAnalysis] Warning: failed to send telegram QA alignment notification: %v", notifyErr)
			} else {
				log.Printf("[InterviewAnalysis] Telegram notification sent for teacher %s QA alignment (%d cards)", teacherID, qaCount)
			}
		}()
	}

	return alignedCards, nil
}

// GetResponsesByTeacher returns all responses for a teacher (or all teachers if teacherID == "all"), including meaning units if populated.
func (s *InterviewAnalysisService) GetResponsesByTeacher(ctx context.Context, runID uuid.UUID, teacherID string) ([]model.InterviewResponse, error) {
	var responses []model.InterviewResponse
	var err error
	if strings.ToLower(strings.TrimSpace(teacherID)) == "all" {
		responses, err = s.repo.ListResponsesByRun(ctx, runID)
	} else {
		responses, err = s.repo.ListResponsesByTeacher(ctx, runID, teacherID)
	}
	if err != nil {
		return nil, err
	}

	// Populate meaning units for each response
	for i := range responses {
		units, _ := s.repo.ListMeaningUnitsByTeacher(ctx, responses[i].TeacherID)
		var matched []model.MeaningUnit
		for _, u := range units {
			if u.ResponseID == responses[i].ID {
				matched = append(matched, u)
			}
		}
		responses[i].MeaningUnits = matched
	}

	return responses, nil
}

// DeleteResponse deletes an interview response.
func (s *InterviewAnalysisService) DeleteResponse(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteResponse(ctx, id)
}

// SegmentMeaningUnits uses AI to segment an interview response into distinct meaning units.
func (s *InterviewAnalysisService) SegmentMeaningUnits(ctx context.Context, responseID uuid.UUID) ([]model.MeaningUnit, error) {
	resp, err := s.repo.GetResponseByID(ctx, responseID)
	if err != nil || resp == nil {
		return nil, fmt.Errorf("interview response not found: %w", err)
	}

	textToSegment := resp.ResponseText
	if strings.TrimSpace(textToSegment) == "" && resp.RawTranscript != nil {
		textToSegment = *resp.RawTranscript
	}
	if strings.TrimSpace(textToSegment) == "" {
		return nil, fmt.Errorf("response text is empty, nothing to segment")
	}

	textProvider, modelName, err := s.aiRouter.GetTextProviderForFlow(ctx, "interview_analysis")
	if err != nil {
		return nil, fmt.Errorf("failed to get text provider for interview analysis: %w", err)
	}

	sysPrompt, userPrompt := PromptSegmentMeaningUnits(resp.TeacherID, resp.QuestionText, textToSegment)
	aiResponse, err := textProvider.CompleteText(ctx, modelName, sysPrompt, userPrompt)
	if err != nil {
		return nil, fmt.Errorf("AI meaning unit segmentation failed: %w", err)
	}

	cleanedJSON := ai.ExtractJSONFromMarkdown(aiResponse)
	var parsed struct {
		MeaningUnits []struct {
			UnitIndex int    `json:"unit_index"`
			UnitText  string `json:"unit_text"`
		} `json:"meaning_units"`
	}

	if err := json.Unmarshal([]byte(cleanedJSON), &parsed); err != nil {
		return nil, fmt.Errorf("failed to parse AI meaning units response: %w", err)
	}

	var units []model.MeaningUnit
	for i, u := range parsed.MeaningUnits {
		idx := u.UnitIndex
		if idx <= 0 {
			idx = i + 1
		}
		units = append(units, model.MeaningUnit{
			ID:            uuid.New(),
			ResponseID:    resp.ID,
			TeacherID:     resp.TeacherID,
			UnitText:      strings.TrimSpace(u.UnitText),
			UnitIndex:     idx,
			IsAIGenerated: true,
			IsUserEdited:  false,
		})
	}

	if err := s.repo.SaveMeaningUnits(ctx, resp.ID, units); err != nil {
		return nil, fmt.Errorf("failed to save meaning units: %w", err)
	}

	return units, nil
}

// GetMeaningUnitsByTeacher returns all meaning units for a teacher.
func (s *InterviewAnalysisService) GetMeaningUnitsByTeacher(ctx context.Context, teacherID string) ([]model.MeaningUnit, error) {
	return s.repo.ListMeaningUnitsByTeacher(ctx, teacherID)
}

// UpdateMeaningUnit updates a meaning unit's text, initial code, or category.
func (s *InterviewAnalysisService) UpdateMeaningUnit(ctx context.Context, id uuid.UUID, dto model.MeaningUnitUpdateDTO) (*model.MeaningUnit, error) {
	return s.repo.UpdateMeaningUnit(ctx, id, dto)
}

// CreateMeaningUnit creates a single meaning unit manually.
func (s *InterviewAnalysisService) CreateMeaningUnit(ctx context.Context, dto model.CreateMeaningUnitDTO) (*model.MeaningUnit, error) {
	u := &model.MeaningUnit{
		ID:          uuid.New(),
		ResponseID:  dto.ResponseID,
		TeacherID:   dto.TeacherID,
		UnitText:    dto.UnitText,
		UnitIndex:   dto.UnitIndex,
		InitialCode: dto.InitialCode,
		Category:    dto.Category,
	}
	if err := s.repo.CreateMeaningUnit(ctx, u); err != nil {
		return nil, err
	}
	return u, nil
}

// DeleteMeaningUnit deletes a meaning unit.
func (s *InterviewAnalysisService) DeleteMeaningUnit(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteMeaningUnit(ctx, id)
}

// GenerateInitialCodes uses AI to assign initial codes and categories to teacher's meaning units.
func (s *InterviewAnalysisService) GenerateInitialCodes(ctx context.Context, runID uuid.UUID, teacherID string) ([]model.MeaningUnit, []model.InterviewCode, error) {
	units, err := s.repo.ListMeaningUnitsByTeacher(ctx, teacherID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to list meaning units: %w", err)
	}
	if len(units) == 0 {
		return nil, nil, fmt.Errorf("no meaning units found for teacher %s. Please segment responses first", teacherID)
	}

	var unitTexts []string
	for _, u := range units {
		unitTexts = append(unitTexts, u.UnitText)
	}

	textProvider, modelName, err := s.aiRouter.GetTextProviderForFlow(ctx, "interview_analysis")
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get text provider: %w", err)
	}

	sysPrompt, userPrompt := PromptGenerateInitialCodes(teacherID, unitTexts)
	aiResponse, err := textProvider.CompleteText(ctx, modelName, sysPrompt, userPrompt)
	if err != nil {
		return nil, nil, fmt.Errorf("AI initial coding failed: %w", err)
	}

	cleanedJSON := ai.ExtractJSONFromMarkdown(aiResponse)
	var parsed struct {
		CodedUnits []struct {
			UnitIndex   int    `json:"unit_index"`
			InitialCode string `json:"initial_code"`
			Category    string `json:"category"`
		} `json:"coded_units"`
	}

	if err := json.Unmarshal([]byte(cleanedJSON), &parsed); err != nil {
		return nil, nil, fmt.Errorf("failed to parse AI coding response: %w", err)
	}

	// Update each unit with its code and category
	codeFreqMap := make(map[string]struct {
		Category string
		Teachers map[string]bool
		Count    int
	})

	for _, coded := range parsed.CodedUnits {
		idx := coded.UnitIndex - 1
		if idx >= 0 && idx < len(units) {
			code := strings.TrimSpace(coded.InitialCode)
			cat := strings.TrimSpace(coded.Category)
			units[idx].InitialCode = &code
			units[idx].Category = &cat
			_, _ = s.repo.UpdateMeaningUnit(ctx, units[idx].ID, model.MeaningUnitUpdateDTO{
				InitialCode: &code,
				Category:    &cat,
			})

			entry := codeFreqMap[code]
			if entry.Teachers == nil {
				entry.Teachers = make(map[string]bool)
			}
			entry.Category = cat
			entry.Teachers[teacherID] = true
			entry.Count++
			codeFreqMap[code] = entry
		}
	}

	// Aggregate codes across all teachers for this run
	allUnits, _ := s.repo.ListMeaningUnitsByRun(ctx, runID)
	aggMap := make(map[string]*model.InterviewCode)
	for _, u := range allUnits {
		if u.InitialCode != nil && *u.InitialCode != "" {
			cName := *u.InitialCode
			cat := "General"
			if u.Category != nil && *u.Category != "" {
				cat = *u.Category
			}
			if existing, ok := aggMap[cName]; ok {
				existing.Frequency++
				hasTeacher := false
				for _, tid := range existing.TeacherIDs {
					if tid == u.TeacherID {
						hasTeacher = true
						break
					}
				}
				if !hasTeacher {
					existing.TeacherIDs = append(existing.TeacherIDs, u.TeacherID)
				}
			} else {
				aggMap[cName] = &model.InterviewCode{
					ID:            uuid.New(),
					AnalysisRunID: runID,
					CodeName:      cName,
					Category:      cat,
					Frequency:     1,
					TeacherIDs:    []string{u.TeacherID},
				}
			}
		}
	}

	var aggregatedCodes []model.InterviewCode
	for _, c := range aggMap {
		aggregatedCodes = append(aggregatedCodes, *c)
	}
	_ = s.repo.SaveInterviewCodes(ctx, runID, aggregatedCodes)

	return units, aggregatedCodes, nil
}

// GetCodes returns all aggregated codes for a run.
func (s *InterviewAnalysisService) GetCodes(ctx context.Context, runID uuid.UUID) ([]model.InterviewCode, error) {
	return s.repo.ListInterviewCodes(ctx, runID)
}

// RunTriangulation runs qualitative cross-referencing between observation data and interview responses.
func (s *InterviewAnalysisService) RunTriangulation(ctx context.Context, runID uuid.UUID) ([]model.TriangulationEntry, error) {
	// Gather observation themes and checklist items from existing run
	var obsFindings []string
	if s.analysisRepo != nil {
		themes, _ := s.analysisRepo.GetThemesByRunID(ctx, runID)
		for _, th := range themes {
			desc := ""
			if th.Description != nil {
				desc = *th.Description
			}
			obsFindings = append(obsFindings, fmt.Sprintf("Theme [%s]: %s", th.Name, desc))
		}
	}
	if len(obsFindings) == 0 {
		obsFindings = append(obsFindings,
			"Observed frequent non-verbal cueing (clapping, hand signals) to regain student attention during transitions.",
			"Observed physical movement around perimeter of classroom to monitor off-task pupils.",
			"Observed immediate verbal praise and sticker rewards for active responses.",
		)
	}

	// Gather interview responses
	responses, err := s.repo.ListResponsesByRun(ctx, runID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch interview responses: %w", err)
	}
	var intEvidence []string
	for _, r := range responses {
		if strings.TrimSpace(r.ResponseText) != "" {
			intEvidence = append(intEvidence, fmt.Sprintf("[%s]: \"%s\"", r.TeacherID, r.ResponseText))
		}
	}
	if len(intEvidence) == 0 {
		return nil, fmt.Errorf("no finalized interview responses available for triangulation")
	}

	textProvider, modelName, err := s.aiRouter.GetTextProviderForFlow(ctx, "interview_analysis")
	if err != nil {
		return nil, fmt.Errorf("failed to get text provider: %w", err)
	}

	sysPrompt, userPrompt := PromptTriangulateObservationInterview(obsFindings, intEvidence)
	aiResponse, err := textProvider.CompleteText(ctx, modelName, sysPrompt, userPrompt)
	if err != nil {
		return nil, fmt.Errorf("AI triangulation failed: %w", err)
	}

	cleanedJSON := ai.ExtractJSONFromMarkdown(aiResponse)
	var parsed struct {
		TriangulationEntries []struct {
			ObservationFinding string `json:"observation_finding"`
			InterviewEvidence  string `json:"interview_evidence"`
			TeacherRef         string `json:"teacher_ref"`
			Relationship       string `json:"relationship"`
		} `json:"triangulation_entries"`
	}

	if err := json.Unmarshal([]byte(cleanedJSON), &parsed); err != nil {
		return nil, fmt.Errorf("failed to parse AI triangulation output: %w", err)
	}

	var entries []model.TriangulationEntry
	for _, raw := range parsed.TriangulationEntries {
		tRef := raw.TeacherRef
		rel := raw.Relationship
		if rel == "" {
			rel = "confirms"
		}
		entries = append(entries, model.TriangulationEntry{
			ID:                 uuid.New(),
			AnalysisRunID:      runID,
			ObservationFinding: raw.ObservationFinding,
			InterviewEvidence:  raw.InterviewEvidence,
			TeacherRef:         &tRef,
			Relationship:       rel,
			IsAIGenerated:      true,
			IsUserEdited:       false,
		})
	}

	if err := s.repo.SaveTriangulationEntries(ctx, runID, entries); err != nil {
		return nil, fmt.Errorf("failed to save triangulation entries: %w", err)
	}

	return entries, nil
}

// GetTriangulation returns triangulation entries for a run.
func (s *InterviewAnalysisService) GetTriangulation(ctx context.Context, runID uuid.UUID) ([]model.TriangulationEntry, error) {
	return s.repo.ListTriangulationEntries(ctx, runID)
}

// UpdateTriangulationEntry updates an entry.
func (s *InterviewAnalysisService) UpdateTriangulationEntry(ctx context.Context, id uuid.UUID, rel string, obs string, intev string) (*model.TriangulationEntry, error) {
	return s.repo.UpdateTriangulationEntry(ctx, id, rel, obs, intev)
}

// GetPerTeacherComparison aggregates 2 video observations vs interview data for a specific teacher.
func (s *InterviewAnalysisService) GetPerTeacherComparison(ctx context.Context, runID uuid.UUID, teacherID string) (map[string]interface{}, error) {
	responses, err := s.repo.ListResponsesByTeacher(ctx, runID, teacherID)
	if err != nil {
		return nil, err
	}

	units, _ := s.repo.ListMeaningUnitsByTeacher(ctx, teacherID)

	// Fetch all triangulation entries referencing this teacher
	allTri, _ := s.repo.ListTriangulationEntries(ctx, runID)
	var teacherTri []model.TriangulationEntry
	for _, t := range allTri {
		if t.TeacherRef != nil && *t.TeacherRef == teacherID {
			teacherTri = append(teacherTri, t)
		}
	}

	return map[string]interface{}{
		"teacher_id":    teacherID,
		"responses":     responses,
		"meaning_units": units,
		"triangulation": teacherTri,
	}, nil
}

// SelectRepresentativeQuotes invokes AI to select golden quotes for the thesis.
func (s *InterviewAnalysisService) SelectRepresentativeQuotes(ctx context.Context, runID uuid.UUID) ([]model.RepresentativeQuote, error) {
	responses, err := s.repo.ListResponsesByRun(ctx, runID)
	if err != nil {
		return nil, fmt.Errorf("failed to list responses: %w", err)
	}

	var corpus strings.Builder
	hasQuestionCards := false
	for _, r := range responses {
		if r.QuestionID != nil && strings.TrimSpace(r.ResponseText) != "" {
			hasQuestionCards = true
			break
		}
	}

	for _, r := range responses {
		if strings.TrimSpace(r.ResponseText) == "" {
			continue
		}
		if hasQuestionCards && r.QuestionID == nil {
			continue
		}
		corpus.WriteString(fmt.Sprintf("[%s | Question: %s]: \"%s\"\n\n", r.TeacherID, r.QuestionText, r.ResponseText))
	}
	if corpus.Len() == 0 {
		return nil, fmt.Errorf("no responses available to select quotes from")
	}

	textProvider, modelName, err := s.aiRouter.GetTextProviderForFlow(ctx, "interview_analysis")
	if err != nil {
		return nil, fmt.Errorf("failed to get text provider: %w", err)
	}

	sysPrompt, userPrompt := PromptSelectRepresentativeQuotes(corpus.String())
	aiResponse, err := textProvider.CompleteText(ctx, modelName, sysPrompt, userPrompt)
	if err != nil {
		return nil, fmt.Errorf("AI quote selection failed: %w", err)
	}

	cleanedJSON := ai.ExtractJSONFromMarkdown(aiResponse)
	var parsed struct {
		Quotes []struct {
			TeacherID     string `json:"teacher_id"`
			QuoteText     string `json:"quote_text"`
			QuoteSource   string `json:"quote_source"`
			RQCategory    string `json:"rq_category"`
			RelevanceType string `json:"relevance_type"`
		} `json:"quotes"`
	}

	if err := json.Unmarshal([]byte(cleanedJSON), &parsed); err != nil {
		log.Printf("[InterviewAnalysis] Quote selection JSON parse error: %v | Raw: %s", err, aiResponse)
		return nil, fmt.Errorf("failed to parse AI quote selection output: %w", err)
	}

	var quotes []model.RepresentativeQuote
	for _, q := range parsed.Quotes {
		qSrc := q.QuoteSource
		quotes = append(quotes, model.RepresentativeQuote{
			ID:            uuid.New(),
			AnalysisRunID: runID,
			TeacherID:     q.TeacherID,
			QuoteText:     q.QuoteText,
			QuoteSource:   &qSrc,
			RQCategory:    q.RQCategory,
			RelevanceType: q.RelevanceType,
			IsSelected:    true,
		})
	}

	if err := s.repo.SaveRepresentativeQuotes(ctx, runID, quotes); err != nil {
		return nil, fmt.Errorf("failed to save quotes: %w", err)
	}

	return quotes, nil
}

// GetRepresentativeQuotes returns quotes for a run.
func (s *InterviewAnalysisService) GetRepresentativeQuotes(ctx context.Context, runID uuid.UUID) ([]model.RepresentativeQuote, error) {
	return s.repo.ListRepresentativeQuotes(ctx, runID)
}

// ToggleQuoteSelection toggles quote inclusion.
func (s *InterviewAnalysisService) ToggleQuoteSelection(ctx context.Context, id uuid.UUID, isSelected bool) error {
	return s.repo.ToggleQuoteSelection(ctx, id, isSelected)
}
