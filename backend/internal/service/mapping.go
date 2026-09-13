package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/ai"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// MappingService handles Phase 3: Semantic Checklist Matching.
type MappingService struct {
	mappingRepo   *repository.MappingRepository
	rawEventRepo  *repository.RawEventRepository
	checklistRepo *repository.ChecklistRepository
	chunkRepo     *repository.ChunkRepository
	videoRepo     *repository.VideoRepository
	aiText        ai.TextCompletionProvider
	modelName     string
	aiRouter      *AIRouterService
}

// NewMappingService creates a new MappingService.
func NewMappingService(
	mappingRepo *repository.MappingRepository,
	rawEventRepo *repository.RawEventRepository,
	checklistRepo *repository.ChecklistRepository,
	chunkRepo *repository.ChunkRepository,
	videoRepo *repository.VideoRepository,
	aiText ai.TextCompletionProvider,
	modelName string,
) *MappingService {
	if modelName == "" {
		modelName = "anthropic/claude-3.5-sonnet"
	}
	return &MappingService{
		mappingRepo:   mappingRepo,
		rawEventRepo:  rawEventRepo,
		checklistRepo: checklistRepo,
		chunkRepo:     chunkRepo,
		videoRepo:     videoRepo,
		aiText:        aiText,
		modelName:     modelName,
	}
}

// SetAIRouter attaches the dynamic AI router.
func (s *MappingService) SetAIRouter(router *AIRouterService) {
	s.aiRouter = router
}

type singleMatchOutput struct {
	EventID         string  `json:"event_id"`
	ChecklistItemID string  `json:"checklist_item_id"`
	MatchScore      float64 `json:"match_score"`
	MatchMethod     string  `json:"match_method"` // exact, semantic, contextual
}

type batchMatchResponse struct {
	Matches []singleMatchOutput `json:"matches"`
}

// MapEventsForVideo maps all non-duplicate raw events of a video to the checklist items.
func (s *MappingService) MapEventsForVideo(ctx context.Context, videoID uuid.UUID, checklistID uuid.UUID) ([]model.EventMapping, error) {
	video, err := s.videoRepo.GetByID(ctx, videoID)
	if err != nil {
		return nil, fmt.Errorf("failed to get video: %w", err)
	}
	if video == nil {
		return nil, fmt.Errorf("video not found: %s", videoID)
	}

	checklist, err := s.checklistRepo.GetByID(ctx, checklistID)
	if err != nil {
		return nil, fmt.Errorf("failed to get checklist: %w", err)
	}
	if checklist == nil || len(checklist.Items) == 0 {
		return nil, fmt.Errorf("checklist has no items: %s", checklistID)
	}

	// Create pipeline job
	jobID := uuid.New()
	startTime := time.Now()
	job := &model.PipelineJob{
		ID:        jobID,
		VideoID:   videoID,
		Step:      "mapping",
		Status:    "running",
		StartedAt: &startTime,
		CreatedAt: startTime,
	}
	_ = s.chunkRepo.CreateJob(ctx, job)
	_ = s.videoRepo.UpdateStatus(ctx, videoID, "mapping", nil)

	// Fetch all raw events (deduplication bypassed to capture 100% extracted events)
	events, err := s.rawEventRepo.ListByVideoID(ctx, videoID, false)
	if err != nil {
		errMsg := err.Error()
		failedStep := "mapping"
		_ = s.chunkRepo.UpdateJob(ctx, jobID, "failed", &errMsg)
		_ = s.videoRepo.UpdateStatusWithError(ctx, videoID, "failed", &failedStep, &errMsg, nil)
		return nil, fmt.Errorf("failed to list raw events: %w", err)
	}

	if len(events) == 0 {
		errMsg := "no raw events found to map"
		failedStep := "mapping"
		_ = s.chunkRepo.UpdateJob(ctx, jobID, "failed", &errMsg)
		_ = s.videoRepo.UpdateStatusWithError(ctx, videoID, "failed", &failedStep, &errMsg, nil)
		return nil, fmt.Errorf("%s", errMsg)
	}

	// Clean up previous mappings for this video
	_ = s.mappingRepo.DeleteByVideoID(ctx, videoID)

	// Prepare checklist text for prompt
	var checklistSB strings.Builder
	for _, it := range checklist.Items {
		checklistSB.WriteString(fmt.Sprintf("- ID: %s | Section: %s | Text: %s\n", it.ID.String(), it.Section, it.Text))
	}
	checklistFormatted := checklistSB.String()

	// Batch events in groups of 10
	batchSize := 10
	var allMappings []model.EventMapping
	now := time.Now()

	for i := 0; i < len(events); i += batchSize {
		end := i + batchSize
		if end > len(events) {
			end = len(events)
		}
		batch := events[i:end]

		matches, err := s.processEventBatch(ctx, batch, checklistFormatted)
		if err != nil {
			errMsg := fmt.Sprintf("checklist mapping failed: %v", err)
			failedStep := "mapping"
			_ = s.chunkRepo.UpdateJob(ctx, jobID, "failed", &errMsg)
			_ = s.videoRepo.UpdateStatusWithError(ctx, videoID, "failed", &failedStep, &errMsg, nil)
			return nil, fmt.Errorf("%s", errMsg)
		}

		activeModelName := s.modelName
		if s.aiRouter != nil {
			if _, rModel, err := s.aiRouter.GetTextProviderForFlow(ctx, "checklist_mapping"); err == nil && rModel != "" {
				activeModelName = rModel
			}
		}

		for _, m := range matches {
			rawEvtUUID, err1 := uuid.Parse(m.EventID)
			itemUUID, err2 := uuid.Parse(m.ChecklistItemID)
			if err1 != nil || err2 != nil {
				continue
			}

			modelNameCopy := activeModelName
			allMappings = append(allMappings, model.EventMapping{
				ID:              uuid.New(),
				RawEventID:      rawEvtUUID,
				ChecklistItemID: itemUUID,
				MatchScore:      m.MatchScore,
				MatchMethod:     m.MatchMethod,
				MatchedByModel:  &modelNameCopy,
				CreatedAt:       now,
			})
		}
	}

	if err := s.mappingRepo.CreateBatch(ctx, allMappings); err != nil {
		errMsg := fmt.Sprintf("failed to save mappings: %v", err)
		failedStep := "mapping"
		_ = s.chunkRepo.UpdateJob(ctx, jobID, "failed", &errMsg)
		_ = s.videoRepo.UpdateStatusWithError(ctx, videoID, "failed", &failedStep, &errMsg, nil)
		return nil, fmt.Errorf("%s", errMsg)
	}

	_ = s.videoRepo.UpdateStatus(ctx, videoID, "mapped", nil)
	_ = s.chunkRepo.UpdateJob(ctx, jobID, "completed", nil)

	log.Printf("Successfully mapped %d event-to-checklist relations for video %s", len(allMappings), videoID)
	return allMappings, nil
}

func (s *MappingService) processEventBatch(ctx context.Context, batch []model.RawEvent, checklistFormatted string) ([]singleMatchOutput, error) {
	aiText := s.aiText
	modelName := s.modelName
	if s.aiRouter != nil {
		rProvider, rModel, err := s.aiRouter.GetTextProviderForFlow(ctx, "checklist_mapping")
		if err != nil {
			return nil, fmt.Errorf("checklist_mapping configuration error: %w", err)
		}
		aiText = rProvider
		modelName = rModel
	}

	if aiText == nil {
		return nil, fmt.Errorf("AI text provider not configured for flow 'checklist_mapping'")
	}

	var eventsSB strings.Builder
	for _, e := range batch {
		eventsSB.WriteString(fmt.Sprintf("- Event ID: %s | Timestamp: %.1fs | Type: %s | Key: %s | Description: %s\n",
			e.ID.String(), e.TimestampSec, e.EventType, e.EventKey, e.Description))
	}

	systemPrompt := `You are an expert pedagogical research assistant specializing in classroom observation checklist matching.
Your task is to match raw extracted classroom events to items in an Observation Checklist.

Match methods:
- "exact": The event key or text clearly directly matches the checklist item behavior.
- "semantic": The event description semantically implies or demonstrates the pedagogical behavior of the checklist item.
- "contextual": The event in context of the surrounding lesson interaction satisfies the checklist item.

Only return matches with a match_score >= 0.70.
An event can match 0, 1, or multiple checklist items if applicable.

Return ONLY a JSON object with this exact structure:
{
  "matches": [
    {
      "event_id": "<uuid>",
      "checklist_item_id": "<uuid>",
      "match_score": 0.92,
      "match_method": "semantic"
    }
  ]
}`

	userPrompt := fmt.Sprintf("CHECKLIST ITEMS:\n%s\n\nEVENTS TO MAP:\n%s", checklistFormatted, eventsSB.String())

	var resp batchMatchResponse
	err := aiText.CompleteJSON(ctx, modelName, systemPrompt, userPrompt, &resp)
	if err != nil {
		return nil, err
	}

	return resp.Matches, nil
}

// fallbackRuleBasedMapping matches events by keyword/fuzzy similarity when AI API is unavailable.
func (s *MappingService) fallbackRuleBasedMapping(batch []model.RawEvent, items []model.ChecklistItem) []singleMatchOutput {
	var matches []singleMatchOutput
	for _, evt := range batch {
		evtKeyNorm := strings.ToLower(strings.ReplaceAll(evt.EventKey, "_", " "))
		evtDescNorm := strings.ToLower(evt.Description)

		for _, it := range items {
			itemTextNorm := strings.ToLower(it.Text)
			// Check keyword overlap
			if strings.Contains(itemTextNorm, evtKeyNorm) || strings.Contains(evtDescNorm, itemTextNorm) {
				matches = append(matches, singleMatchOutput{
					EventID:         evt.ID.String(),
					ChecklistItemID: it.ID.String(),
					MatchScore:      0.85,
					MatchMethod:     "exact",
				})
			}
		}
	}
	return matches
}
