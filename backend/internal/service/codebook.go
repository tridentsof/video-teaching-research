package service

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/ai"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// CodebookService handles codebook business logic and AI generation.
type CodebookService struct {
	repo         *repository.CodebookRepository
	rawEventRepo *repository.RawEventRepository
	videoRepo    *repository.VideoRepository
	aiText       ai.TextCompletionProvider
	modelName    string
	aiRouter     *AIRouterService
}

// NewCodebookService creates a new CodebookService.
func NewCodebookService(
	repo *repository.CodebookRepository,
	rawEventRepo *repository.RawEventRepository,
	videoRepo *repository.VideoRepository,
	aiText ai.TextCompletionProvider,
	modelName string,
) *CodebookService {
	if modelName == "" {
		modelName = "gemini-3.7-flash"
	}
	return &CodebookService{
		repo:         repo,
		rawEventRepo: rawEventRepo,
		videoRepo:    videoRepo,
		aiText:       aiText,
		modelName:    modelName,
	}
}

// SetAIRouter attaches the dynamic AI router.
func (s *CodebookService) SetAIRouter(router *AIRouterService) {
	s.aiRouter = router
}

// GetByVideoID returns all codebook entries for a video.
func (s *CodebookService) GetByVideoID(ctx context.Context, videoID uuid.UUID) ([]model.CodebookEntry, error) {
	entries, err := s.repo.GetByVideoID(ctx, videoID)
	if err != nil {
		return nil, fmt.Errorf("codebook service: get by video: %w", err)
	}
	if entries == nil {
		entries = []model.CodebookEntry{}
	}
	return entries, nil
}

// SaveByVideoID replaces all codebook entries for a video.
func (s *CodebookService) SaveByVideoID(ctx context.Context, videoID uuid.UUID, entries []model.CodebookEntry) ([]model.CodebookEntry, error) {
	result, err := s.repo.ReplaceByVideoID(ctx, videoID, entries)
	if err != nil {
		return nil, fmt.Errorf("codebook service: save: %w", err)
	}
	if result == nil {
		result = []model.CodebookEntry{}
	}
	return result, nil
}

// GetAllForExport returns a map of videoID → entries for all provided video IDs.
// Used by the bulk Excel export endpoint.
func (s *CodebookService) GetAllForExport(ctx context.Context, videoIDs []uuid.UUID) (map[uuid.UUID][]model.CodebookEntry, error) {
	entries, err := s.repo.GetByVideoIDs(ctx, videoIDs)
	if err != nil {
		return nil, fmt.Errorf("codebook service: get all for export: %w", err)
	}
	result := make(map[uuid.UUID][]model.CodebookEntry, len(videoIDs))
	for _, id := range videoIDs {
		result[id] = []model.CodebookEntry{}
	}
	for _, e := range entries {
		result[e.VideoID] = append(result[e.VideoID], e)
	}
	return result, nil
}

// GenerateCodebookForVideo extracts raw observed events directly from video analysis (without deduplication),
// uses AI (Gemini) to synthesize definitions and inclusion/exclusion criteria,
// and saves the resulting Code Book entries into the database.
func (s *CodebookService) GenerateCodebookForVideo(ctx context.Context, videoID uuid.UUID) ([]model.CodebookEntry, error) {
	// 1. Fetch Video info
	var teacherID, videoTitle string
	if s.videoRepo != nil {
		video, err := s.videoRepo.GetByID(ctx, videoID)
		if err == nil && video != nil {
			teacherID = video.TeacherID
			videoTitle = video.Title
		}
	}

	// 2. Fetch all raw events directly from video analysis (including all occurrences without deduplication)
	if s.rawEventRepo == nil {
		return nil, fmt.Errorf("raw event repository is not configured")
	}

	events, err := s.rawEventRepo.ListByVideoID(ctx, videoID, false) // false = include all duplicates / raw events
	if err != nil {
		return nil, fmt.Errorf("codebook service: failed to fetch raw events: %w", err)
	}

	if len(events) == 0 {
		log.Printf("[CodebookService] No raw events found for video %s to generate codebook", videoID)
		return []model.CodebookEntry{}, nil
	}

	// 3. Construct prompt for AI with all raw events
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Teacher ID: %s\nLesson: %s\nTotal Extracted Raw Events: %d\n\n", teacherID, videoTitle, len(events)))
	sb.WriteString("Raw Classroom Observation Events (extracted directly from video):\n")

	for i, ev := range events {
		timeStr := FormatTimestampHHMMSS(ev.TimestampSec)
		var details []string
		details = append(details, fmt.Sprintf("[%s]", timeStr))
		if ev.EventType != "" {
			details = append(details, fmt.Sprintf("Type: %s", ev.EventType))
		}
		if ev.EventKey != "" {
			details = append(details, fmt.Sprintf("Key: %s", ev.EventKey))
		}
		if ev.Code != nil && *ev.Code != "" {
			details = append(details, fmt.Sprintf("Code: %s", *ev.Code))
		}
		if ev.Quote != nil && *ev.Quote != "" {
			details = append(details, fmt.Sprintf("Quote: %q", *ev.Quote))
		}
		sb.WriteString(fmt.Sprintf("%d. %s\n   Description: %s\n", i+1, strings.Join(details, " | "), ev.Description))
	}

	systemPrompt := `You are an expert qualitative educational researcher specializing in classroom observation and qualitative coding frameworks.
Your task is to analyze the complete stream of raw pedagogical events extracted directly from an English teaching classroom video and construct a comprehensive, standardized Code Book.

Analyze all the observed raw events, identify recurring behavioral patterns, instructional strategies, and interaction codes, and generate a standardized qualitative codebook.

For each distinct code/behavior identified from the raw events, generate:
1. "code": A concise, clear qualitative code label (e.g. "Rule-setting", "Wait-time", "Scaffolding Praise", "Concept Checking Question", "Digital Tool Engagement", "Error Correction").
2. "definition": An authoritative qualitative definition of this code grounded in how it manifested in this classroom.
3. "inclusion_criteria": Specific and comprehensive criteria for when this code MUST be applied based on the raw events evidence.
4. "exclusion_criteria": Explicit boundaries and criteria for when this code should NOT be applied (differentiating from similar/overlapping behaviors).
5. "example": The best actual quote and timestamp from the raw events (e.g. '[04:12] "Please raise your hand before unmuting."').
6. "category": The specific pedagogical category (e.g. "Turn-taking", "Establishing Rules", "Learner Engagement", "Positive Reinforcement", "Questioning Techniques", "Classroom Management").
7. "theme": The overarching qualitative theme (e.g. "Classroom Management", "Pedagogical Interaction", "Instructional Scaffolding", "Technology Integration", "Assessment & Feedback").
8. "sort_order": An integer 0, 1, 2... representing the logical order.

Return ONLY a valid JSON array of objects with the exact keys:
[
  {
    "code": "string",
    "definition": "string",
    "inclusion_criteria": "string",
    "exclusion_criteria": "string",
    "example": "string",
    "category": "string",
    "theme": "string",
    "sort_order": 0
  }
]`

	aiText := s.aiText
	modelName := s.modelName
	if s.aiRouter != nil {
		if rProvider, rModel, err := s.aiRouter.GetTextProviderForFlow(ctx, "codebook_generation"); err == nil && rProvider != nil {
			aiText = rProvider
			modelName = rModel
		}
	}

	if aiText == nil {
		return nil, fmt.Errorf("AI text completion provider is not configured")
	}

	log.Printf("[CodebookService] Calling AI (%s) to generate codebook for video %s (%d raw events)...", modelName, videoID, len(events))
	respText, err := aiText.CompleteText(ctx, modelName, systemPrompt, sb.String())
	if err != nil {
		return nil, fmt.Errorf("failed to complete text from AI: %w", err)
	}

	var generatedEntries []model.CodebookEntry
	if err := ai.UnmarshalJSONFlexible(respText, &generatedEntries); err != nil {
		return nil, fmt.Errorf("failed to parse AI codebook response: %w (raw response: %s)", err, respText)
	}

	// Set VideoID on all entries
	for i := range generatedEntries {
		generatedEntries[i].VideoID = videoID
		if generatedEntries[i].SortOrder == 0 && i > 0 {
			generatedEntries[i].SortOrder = i
		}
	}

	// Save into DB
	saved, err := s.repo.ReplaceByVideoID(ctx, videoID, generatedEntries)
	if err != nil {
		return nil, fmt.Errorf("failed to save generated codebook entries: %w", err)
	}

	log.Printf("[CodebookService] Successfully generated and saved %d codebook entries for video %s", len(saved), videoID)
	return saved, nil
}

