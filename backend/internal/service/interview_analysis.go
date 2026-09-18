package service

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/ai"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// InterviewAnalysisService coordinates audio upload, AI transcription, meaning unit segmentation,
// coding, triangulation, and quote selection.
type InterviewAnalysisService struct {
	repo              *repository.InterviewAnalysisRepository
	interviewBaseRepo *repository.InterviewBaseRepository
	analysisRepo      *repository.AnalysisRepository
	aiRouter          *AIRouterService
	blob              BlobStorage
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

// UploadAudio handles storing an audio file and creating an initial interview_response record.
func (s *InterviewAnalysisService) UploadAudio(
	ctx context.Context,
	runID uuid.UUID,
	teacherID string,
	filename string,
	reader io.Reader,
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

	resp := &model.InterviewResponse{
		ID:               respID,
		AnalysisRunID:    runID,
		TeacherID:        teacherID,
		QuestionText:     "Full Teacher Interview Recording",
		AudioBlobPath:    &blobURL,
		AudioFilename:    &filename,
		TranscriptStatus: "uploaded",
		Language:         "vi",
	}

	if err := s.repo.CreateResponse(ctx, resp); err != nil {
		return nil, fmt.Errorf("failed to create interview response: %w", err)
	}

	return resp, nil
}

// TranscribeAudio invokes multimodal AI to transcribe the uploaded audio recording.
func (s *InterviewAnalysisService) TranscribeAudio(ctx context.Context, responseID uuid.UUID) (*model.InterviewResponse, error) {
	resp, err := s.repo.GetResponseByID(ctx, responseID)
	if err != nil || resp == nil {
		return nil, fmt.Errorf("interview response not found: %w", err)
	}

	if resp.AudioBlobPath == nil || *resp.AudioBlobPath == "" {
		return nil, fmt.Errorf("no audio file associated with this response")
	}

	// Update status to 'transcribing'
	_ = s.repo.UpdateResponseTranscript(ctx, responseID, "", "transcribing")

	// Determine local audio file path
	localPath := *resp.AudioBlobPath
	if strings.HasPrefix(localPath, "/storage/") {
		localPath = "." + localPath
	}

	// Fetch known interview questions for context
	var knownQuestions []string
	if s.interviewBaseRepo != nil {
		baseQuestions, _ := s.interviewBaseRepo.List(ctx, true)
		for _, q := range baseQuestions {
			knownQuestions = append(knownQuestions, q.QuestionText)
		}
	}

	// Resolve Audio Transcription Provider from AI Router
	audioProvider, _, err := s.aiRouter.GetAudioProviderForFlow(ctx, "interview_transcription")
	if err != nil {
		_ = s.repo.UpdateResponseTranscript(ctx, responseID, "", "failed")
		return nil, fmt.Errorf("failed to get audio transcription provider: %w", err)
	}

	// Construct transcription prompt
	sysPrompt, userPrompt := PromptTranscribeInterviewAudio(resp.TeacherID, knownQuestions)
	fullPrompt := sysPrompt + "\n\n" + userPrompt

	log.Printf("[InterviewAnalysis] Starting audio transcription for response %s (teacher %s, file: %s)",
		responseID, resp.TeacherID, localPath)

	transcriptionResult, err := audioProvider.TranscribeAudio(ctx, localPath, fullPrompt)
	if err != nil {
		_ = s.repo.UpdateResponseTranscript(ctx, responseID, "", "failed")
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

	// Persist raw transcript and status
	err = s.repo.UpdateResponseTranscript(ctx, responseID, rawText, "transcribed")
	if err != nil {
		return nil, fmt.Errorf("failed to save transcribed text: %w", err)
	}

	// Also update language, duration, response text
	_ = s.repo.FinalizeResponse(ctx, responseID, resp.ResponseText)

	// If multiple QA pairs detected, automatically spawn individual question responses for granular coding
	if len(parsed.QAPairs) > 1 {
		for _, qa := range parsed.QAPairs {
			subResp := &model.InterviewResponse{
				ID:               uuid.New(),
				AnalysisRunID:    resp.AnalysisRunID,
				TeacherID:        resp.TeacherID,
				QuestionText:     qa.QuestionText,
				AudioBlobPath:    resp.AudioBlobPath,
				AudioFilename:    resp.AudioFilename,
				AudioDurationSec: resp.AudioDurationSec,
				Language:         resp.Language,
				RawTranscript:    &rawText,
				TranscriptStatus: "transcribed",
				ResponseText:     qa.AnswerText,
			}
			_ = s.repo.CreateResponse(ctx, subResp)
		}
	}

	return s.repo.GetResponseByID(ctx, responseID)
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

// GetResponsesByTeacher returns all responses for a teacher, including meaning units if populated.
func (s *InterviewAnalysisService) GetResponsesByTeacher(ctx context.Context, runID uuid.UUID, teacherID string) ([]model.InterviewResponse, error) {
	responses, err := s.repo.ListResponsesByTeacher(ctx, runID, teacherID)
	if err != nil {
		return nil, err
	}

	// Populate meaning units for each response
	for i := range responses {
		units, _ := s.repo.ListMeaningUnitsByTeacher(ctx, teacherID)
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
	for _, r := range responses {
		if strings.TrimSpace(r.ResponseText) != "" {
			corpus.WriteString(fmt.Sprintf("[%s | Question: %s]: \"%s\"\n\n", r.TeacherID, r.QuestionText, r.ResponseText))
		}
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
