package service

import (
	"context"
	"encoding/json"
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
	repo          *repository.CodebookRepository
	reportRepo    *repository.ReportRepository
	mappingRepo   *repository.MappingRepository
	checklistRepo *repository.ChecklistRepository
	videoRepo     *repository.VideoRepository
	aiText        ai.TextCompletionProvider
	modelName     string
}

// NewCodebookService creates a new CodebookService.
func NewCodebookService(
	repo *repository.CodebookRepository,
	reportRepo *repository.ReportRepository,
	mappingRepo *repository.MappingRepository,
	checklistRepo *repository.ChecklistRepository,
	videoRepo *repository.VideoRepository,
	aiText ai.TextCompletionProvider,
	modelName string,
) *CodebookService {
	if modelName == "" {
		modelName = "gemini-3.7-flash"
	}
	return &CodebookService{
		repo:          repo,
		reportRepo:    reportRepo,
		mappingRepo:   mappingRepo,
		checklistRepo: checklistRepo,
		videoRepo:     videoRepo,
		aiText:        aiText,
		modelName:     modelName,
	}
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

// GenerateCodebookForVideo extracts real observed behaviors from video analysis,
// uses AI (Gemini) to formulate definitions and inclusion/exclusion criteria,
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

	// 2. Gather actual observed behaviors from Report Items or Mapping Details
	type observedBehavior struct {
		Section     string
		Indicator   string
		Count       int
		Occurrences []model.Occurrence
	}
	var observedList []observedBehavior

	if s.reportRepo != nil {
		report, err := s.reportRepo.GetByVideoID(ctx, videoID)
		if err == nil && report != nil && len(report.Items) > 0 {
			for _, item := range report.Items {
				if item.Count > 0 {
					var occs []model.Occurrence
					if item.Occurrences != "" {
						_ = json.Unmarshal([]byte(item.Occurrences), &occs)
					}
					observedList = append(observedList, observedBehavior{
						Section:     item.ChecklistSection,
						Indicator:   item.ChecklistText,
						Count:       item.Count,
						Occurrences: occs,
					})
				}
			}
		}
	}

	// Fallback to mapping details if report items are empty
	if len(observedList) == 0 && s.mappingRepo != nil {
		details, err := s.mappingRepo.ListDetailsByVideoID(ctx, videoID)
		if err == nil && len(details) > 0 {
			groupMap := make(map[string]*observedBehavior)
			for _, d := range details {
				key := d.ChecklistText
				if _, ok := groupMap[key]; !ok {
					groupMap[key] = &observedBehavior{
						Section:   d.ChecklistSection,
						Indicator: d.ChecklistText,
						Count:     0,
					}
				}
				groupMap[key].Count++
				var quote, code string
				if d.Quote != nil {
					quote = *d.Quote
				}
				if d.Code != nil {
					code = *d.Code
				}
				groupMap[key].Occurrences = append(groupMap[key].Occurrences, model.Occurrence{
					TimestampSec: d.TimestampSec,
					TimestampStr: FormatTimestampHHMMSS(d.TimestampSec),
					Quote:        quote,
					Code:         code,
					Context:      d.EventDescription,
				})
			}
			for _, v := range groupMap {
				observedList = append(observedList, *v)
			}
		}
	}

	if len(observedList) == 0 {
		log.Printf("[CodebookService] No observed behaviors found for video %s to generate codebook", videoID)
		return []model.CodebookEntry{}, nil
	}

	// 3. Construct prompt for AI
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Teacher ID: %s\nLesson: %s\n\n", teacherID, videoTitle))
	sb.WriteString("Observed Pedagogical Behaviors from Video Analysis:\n")

	for i, ob := range observedList {
		secName := ob.Section
		if full, ok := SectionTitleMap[ob.Section]; ok {
			secName = full
		}
		sb.WriteString(fmt.Sprintf("\n%d. [Section %s] Indicator: %s (Frequency: %d times)\n", i+1, secName, ob.Indicator, ob.Count))
		sb.WriteString("   Observed Evidence & Quotes:\n")
		// Limit to top 3 evidence quotes per behavior for prompt efficiency
		limit := len(ob.Occurrences)
		if limit > 3 {
			limit = 3
		}
		for j := 0; j < limit; j++ {
			occ := ob.Occurrences[j]
			sb.WriteString(fmt.Sprintf("   - [%s] \"%s\" (Context: %s)\n", occ.TimestampStr, occ.Quote, occ.Context))
		}
	}

	systemPrompt := `You are an expert qualitative educational researcher specializing in classroom observation and qualitative coding frameworks.
Your task is to analyze the actual observed behaviors from an English teaching classroom video and construct a rigorous, standardized Code Book.

For each distinct observed behavior, generate:
1. "code": A concise, clear code label (e.g. "Rule-setting", "Wait-time", "Hand-raising", "Scaffolding Praise", "Digital Poll").
2. "definition": An authoritative definition of this code grounded in how it manifested in this classroom.
3. "inclusion_criteria": Specific and comprehensive criteria for when this code MUST be applied based on the lesson evidence.
4. "exclusion_criteria": Explicit boundaries and criteria for when this code should NOT be applied (differentiating from similar/overlapping behaviors).
5. "example": The best actual quote and timestamp from the lesson evidence (e.g. '[04:12] "Please raise your hand before unmuting."').
6. "category": The specific pedagogical category (e.g. "Turn-taking", "Establishing Rules", "Learner Engagement", "Positive Reinforcement", "Digital Tools").
7. "theme": The overarching qualitative theme (e.g. "Classroom Management", "Pedagogical Interaction", "Instructional Scaffolding", "Technology Integration").
8. "sort_order": An integer 0, 1, 2... representing the order.

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

	if s.aiText == nil {
		return nil, fmt.Errorf("AI text completion provider is not configured")
	}

	log.Printf("[CodebookService] Calling AI to generate codebook for video %s (%d observed behaviors)...", videoID, len(observedList))
	respText, err := s.aiText.CompleteText(ctx, s.modelName, systemPrompt, sb.String())
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

