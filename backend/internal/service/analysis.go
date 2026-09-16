package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/ai"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// AnalysisService handles the 7-step Phase 6 Report Analysis pipeline.
type AnalysisService struct {
	analysisRepo      *repository.AnalysisRepository
	reportRepo        *repository.ReportRepository
	rawEventRepo      *repository.RawEventRepository
	checklistRepo     *repository.ChecklistRepository
	videoRepo         *repository.VideoRepository
	interviewBaseRepo *repository.InterviewBaseRepository
	aiText            ai.TextCompletionProvider
	modelName         string
	aiRouter          *AIRouterService
}

// NewAnalysisService creates a new AnalysisService.
func NewAnalysisService(
	analysisRepo *repository.AnalysisRepository,
	reportRepo *repository.ReportRepository,
	rawEventRepo *repository.RawEventRepository,
	checklistRepo *repository.ChecklistRepository,
	videoRepo *repository.VideoRepository,
	aiText ai.TextCompletionProvider,
	modelName string,
) *AnalysisService {
	if modelName == "" {
		modelName = "anthropic/claude-3.5-sonnet"
	}
	return &AnalysisService{
		analysisRepo:  analysisRepo,
		reportRepo:    reportRepo,
		rawEventRepo:  rawEventRepo,
		checklistRepo: checklistRepo,
		videoRepo:     videoRepo,
		aiText:        aiText,
		modelName:     modelName,
	}
}

// SetInterviewBaseRepo attaches the base interview questions repository.
func (s *AnalysisService) SetInterviewBaseRepo(repo *repository.InterviewBaseRepository) {
	s.interviewBaseRepo = repo
}

// SetAIRouter attaches the dynamic AI router.
func (s *AnalysisService) SetAIRouter(router *AIRouterService) {
	s.aiRouter = router
}

// DefaultSynthesizedCoreQuestions is the canonical fallback synthesis of 22 base questions across RQ1-RQ3.
var DefaultSynthesizedCoreQuestions = []model.CoreQuestionItem{
	{
		Index:        1,
		QuestionText: "Could you describe how you usually manage an online English speaking lesson from beginning to end, and how you establish classroom rules and routines?",
		RQCategory:   "RQ1",
		Rationale:    "Synthesizes base questions 6 & 7 on overarching lesson management and establishing routines.",
	},
	{
		Index:        2,
		QuestionText: "How do you manage turn-taking and wait time during speaking activities to ensure young learners have equitable opportunities to participate?",
		RQCategory:   "RQ1",
		Rationale:    "Synthesizes base question 8 on turn-taking with observed wait time scaffolding patterns.",
	},
	{
		Index:        3,
		QuestionText: "How do you leverage digital tools (e.g. chat box, breakout rooms, reactions, screen sharing) to sustain attention and stimulate speaking engagement?",
		RQCategory:   "RQ1",
		Rationale:    "Synthesizes base questions 9 & 11 on attention maintenance and digital tool affordances.",
	},
	{
		Index:        4,
		QuestionText: "In your view, what role does classroom management play in promoting speaking participation and influencing learners' confidence and willingness to communicate?",
		RQCategory:   "RQ2",
		Rationale:    "Synthesizes base questions 12 & 14 on the perceived role of management in fostering speaking confidence.",
	},
	{
		Index:        5,
		QuestionText: "Which classroom management strategies do you consider most effective in your online classes, and how do different learners respond to them?",
		RQCategory:   "RQ2",
		Rationale:    "Synthesizes base questions 13 & 15 on perceived strategy effectiveness and learner differences.",
	},
	{
		Index:        6,
		QuestionText: "What challenges do you most frequently encounter when managing online speaking classes, and which ones have the greatest impact on participation?",
		RQCategory:   "RQ3",
		Rationale:    "Synthesizes base questions 17 & 18 on primary online management hurdles.",
	},
	{
		Index:        7,
		QuestionText: "How do you usually support and manage learners who are reluctant to speak or have difficulty speaking English during live lessons?",
		RQCategory:   "RQ3",
		Rationale:    "Synthesizes base questions 10 & 19 on supporting hesitant learners and managing speaking difficulties.",
	},
	{
		Index:        8,
		QuestionText: "How do you handle technical disruptions and management dilemmas that remain difficult to address in online primary EFL teaching?",
		RQCategory:   "RQ3",
		Rationale:    "Synthesizes base questions 20 & 21 on technical troubleshooting and unresolved management dilemmas.",
	},
}

type aiCategoryItem struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Strategies  []string `json:"strategies"`
}

type aiThemeItem struct {
	Name           string   `json:"name"`
	Description    string   `json:"description"`
	ReasoningTrace string   `json:"reasoning_trace"`
	CategoryNames  []string `json:"category_names"`
}

type aiTeacherAnalysisResponse struct {
	ContextSummary   string `json:"context_summary"`
	MarkdownContent  string `json:"markdown_content"`
	DynamicQuestions []struct {
		QuestionText string `json:"question_text"`
		EvidenceRef  string `json:"evidence_ref"`
		RQCategory   string `json:"rq_category"`
	} `json:"dynamic_questions"`
}

// RunFullAnalysis executes Steps 1 through 7 of the Phase 6 Analysis Pipeline.
func (s *AnalysisService) RunFullAnalysis(ctx context.Context) (*model.AnalysisRun, error) {
	runID := uuid.New()
	startTime := time.Now()

	run := &model.AnalysisRun{
		ID:          runID,
		TriggeredAt: startTime,
		Status:      "aggregating",
		Config:      `{"pipeline": "phase_6_grounded_theory"}`,
	}
	if err := s.analysisRepo.CreateRun(ctx, run); err != nil {
		return nil, fmt.Errorf("failed to create analysis run: %w", err)
	}

	// Step 1: Aggregation & Input Validation
	log.Println("[Phase 6] Step 1: Cross-video Aggregation & Validation...")
	videos, err := s.videoRepo.List(ctx)
	if err != nil || len(videos) == 0 {
		errMsg := "no videos available for analysis"
		_ = s.analysisRepo.UpdateRunStatus(ctx, runID, "error", &errMsg)
		return nil, fmt.Errorf("%s", errMsg)
	}

	reportItems, err := s.reportRepo.ListAllReportItemsWithContext(ctx)
	if err != nil {
		errMsg := fmt.Sprintf("failed to list report items: %v", err)
		_ = s.analysisRepo.UpdateRunStatus(ctx, runID, "error", &errMsg)
		return nil, fmt.Errorf("%s", errMsg)
	}

	if len(reportItems) == 0 {
		errMsg := "no completed video reports found; please process videos through Phase 1–5 pipeline before running Thematic Analysis"
		_ = s.analysisRepo.UpdateRunStatus(ctx, runID, "error", &errMsg)
		return nil, fmt.Errorf("%s", errMsg)
	}

	// Step 2: Recurring Pattern Detection with accurate Cross & Intra Teacher counts
	_ = s.analysisRepo.UpdateRunStatus(ctx, runID, "detecting", nil)
	log.Println("[Phase 6] Step 2: Recurring Pattern Detection...")

	itemTeachers := make(map[string]map[string]bool)
	itemTeacherVideos := make(map[string]map[string]map[uuid.UUID]bool)
	itemTotalCount := make(map[string]int)

	// Also organize report items by teacher for Step 7
	teacherReportItems := make(map[string][]repository.ReportItemContext)
	groupStrategyTotal := make(map[string]int)

	for _, item := range reportItems {
		if item.TeacherID != "" {
			teacherReportItems[item.TeacherID] = append(teacherReportItems[item.TeacherID], item)
		}

		if item.Count > 0 {
			chText := strings.TrimSpace(item.ChecklistText)
			if chText == "" {
				continue
			}
			itemTotalCount[chText] += item.Count
			groupStrategyTotal[chText] += item.Count

			if _, ok := itemTeachers[chText]; !ok {
				itemTeachers[chText] = make(map[string]bool)
			}
			if item.TeacherID != "" {
				itemTeachers[chText][item.TeacherID] = true
			}

			if _, ok := itemTeacherVideos[chText]; !ok {
				itemTeacherVideos[chText] = make(map[string]map[uuid.UUID]bool)
			}
			if item.TeacherID != "" {
				if _, ok := itemTeacherVideos[chText][item.TeacherID]; !ok {
					itemTeacherVideos[chText][item.TeacherID] = make(map[uuid.UUID]bool)
				}
				if item.VideoID != uuid.Nil {
					itemTeacherVideos[chText][item.TeacherID][item.VideoID] = true
				}
			}
		}
	}

	var detectedPatterns []model.Pattern
	now := time.Now()
	for chText, total := range itemTotalCount {
		freqScore := float64(total)
		threshold := "data_distribution_frequency"
		desc := fmt.Sprintf("Recurring teaching strategy: %s (total %d occurrences across corpus)", chText, total)

		crossTeacherCount := len(itemTeachers[chText])
		maxIntraTeacherCount := 1
		for _, vMap := range itemTeacherVideos[chText] {
			if len(vMap) > maxIntraTeacherCount {
				maxIntraTeacherCount = len(vMap)
			}
		}

		p := model.Pattern{
			ID:                uuid.New(),
			AnalysisRunID:     runID,
			Description:       &desc,
			FrequencyScore:    &freqScore,
			ThresholdMethod:   &threshold,
			IntraTeacherCount: maxIntraTeacherCount,
			CrossTeacherCount: crossTeacherCount,
			CreatedAt:         now,
		}
		detectedPatterns = append(detectedPatterns, p)
	}

	if len(detectedPatterns) == 0 {
		errMsg := "no recurring patterns detected in report items"
		_ = s.analysisRepo.UpdateRunStatus(ctx, runID, "error", &errMsg)
		return nil, fmt.Errorf("%s", errMsg)
	}

	if err := s.analysisRepo.SavePatterns(ctx, detectedPatterns); err != nil {
		errMsg := fmt.Sprintf("failed to save patterns: %v", err)
		_ = s.analysisRepo.UpdateRunStatus(ctx, runID, "error", &errMsg)
		return nil, fmt.Errorf("%s", errMsg)
	}

	// Step 3 & 4: Categorize & Grounded Theory Theme Identification (Strict: No Mock Fallback)
	_ = s.analysisRepo.UpdateRunStatus(ctx, runID, "categorizing", nil)
	log.Println("[Phase 6] Step 3 & 4: Categorize & Grounded Theory Themes via AI...")

	categories, themes, err := s.generateCategoriesAndThemes(ctx, runID, detectedPatterns)
	if err != nil {
		errMsg := fmt.Sprintf("thematic analysis AI generation failed: %v", err)
		_ = s.analysisRepo.UpdateRunStatus(ctx, runID, "error", &errMsg)
		return nil, fmt.Errorf("%s", errMsg)
	}

	if err := s.analysisRepo.SaveCategories(ctx, categories); err != nil {
		errMsg := fmt.Sprintf("failed to save categories: %v", err)
		_ = s.analysisRepo.UpdateRunStatus(ctx, runID, "error", &errMsg)
		return nil, fmt.Errorf("%s", errMsg)
	}
	if err := s.analysisRepo.SaveThemes(ctx, themes); err != nil {
		errMsg := fmt.Sprintf("failed to save themes: %v", err)
		_ = s.analysisRepo.UpdateRunStatus(ctx, runID, "error", &errMsg)
		return nil, fmt.Errorf("%s", errMsg)
	}

	// Step 5: Synthesize Core Interview Questions via AI (Step 7A - Flow A)
	_ = s.analysisRepo.UpdateRunStatus(ctx, runID, "synthesizing_core", nil)
	log.Println("[Phase 6] Step 5: Synthesizing Core Interview Questions from 22 Base Questions & Discovered Themes...")
	coreQuestions, err := s.SynthesizeCoreQuestions(ctx, runID, themes)
	if err != nil {
		log.Printf("[Phase 6] Warning: AI Core question synthesis failed, using default synthesized guide: %v", err)
		coreQuestions = DefaultSynthesizedCoreQuestions
		b, _ := json.Marshal(coreQuestions)
		_ = s.analysisRepo.UpdateCoreQuestions(ctx, runID, string(b), "draft")
	}

	// Step 6: Generate Per-Teacher Analysis & Evidence-Cited Follow-up Questions via AI
	_ = s.analysisRepo.UpdateRunStatus(ctx, runID, "generating", nil)
	log.Println("[Phase 6] Step 6: Generating Per-Teacher Analyses & Evidence-Cited Questions via AI...")

	numTeachersWithReports := len(teacherReportItems)
	for tID, tItems := range teacherReportItems {
		log.Printf("[Phase 6] Generating interview questions for teacher %s (%d items)...", tID, len(tItems))
		ta, questions, err := s.generateTeacherAnalysisAndQuestions(
			ctx, runID, tID, themes, tItems, groupStrategyTotal, numTeachersWithReports, coreQuestions,
		)
		if err != nil {
			errMsg := fmt.Sprintf("failed to generate interview analysis for teacher %s: %v", tID, err)
			_ = s.analysisRepo.UpdateRunStatus(ctx, runID, "error", &errMsg)
			return nil, fmt.Errorf("%s", errMsg)
		}

		if err := s.analysisRepo.SaveTeacherAnalysis(ctx, ta, questions); err != nil {
			errMsg := fmt.Sprintf("failed to save teacher analysis for %s: %v", tID, err)
			_ = s.analysisRepo.UpdateRunStatus(ctx, runID, "error", &errMsg)
			return nil, fmt.Errorf("%s", errMsg)
		}
	}

	_ = s.analysisRepo.UpdateRunStatus(ctx, runID, "completed", nil)
	log.Printf("[Phase 6] Analysis Run %s successfully completed!", runID)

	run.Status = "completed"
	run.CoreQuestionsStatus = "draft"
	b, _ := json.Marshal(coreQuestions)
	run.CoreQuestions = string(b)
	return run, nil
}

func (s *AnalysisService) generateCategoriesAndThemes(
	ctx context.Context,
	runID uuid.UUID,
	patterns []model.Pattern,
) ([]model.Category, []model.Theme, error) {
	aiText := s.aiText
	modelName := s.modelName
	if s.aiRouter != nil {
		rProvider, rModel, err := s.aiRouter.GetTextProviderForFlow(ctx, "thematic_analysis")
		if err != nil {
			return nil, nil, fmt.Errorf("thematic_analysis configuration error: %w", err)
		}
		aiText = rProvider
		modelName = rModel
	}

	if aiText == nil {
		return nil, nil, fmt.Errorf("AI text provider not configured for flow 'thematic_analysis'")
	}

	var patternList strings.Builder
	for _, p := range patterns {
		if p.Description != nil {
			patternList.WriteString(fmt.Sprintf("- %s\n", *p.Description))
		}
	}

	systemPrompt := `You are an expert qualitative educational researcher applying Grounded Theory data-driven analysis to classroom observation strategies.

Your task:
1. Cluster recurring strategies into behavior categories (Bottom-up clustering, no pre-fixed taxonomy).
2. Group categories into higher-level overarching Themes.
3. For EACH Theme, provide a clear "reasoning_trace" with grounded evidence explaining why these categories and strategies belong together.

Return ONLY a valid JSON object matching this schema:
{
  "categories": [
    {
      "name": "Pacing & Wait Time Strategies",
      "description": "Strategies controlling classroom interaction tempo",
      "strategies": ["Teacher provides wait time", "Teacher checks understanding"]
    }
  ],
  "themes": [
    {
      "name": "Scaffolding Through Patience and Active Listening",
      "description": "Teachers systematically providing communicative space",
      "reasoning_trace": "Across classroom observations, teachers who provided extended wait times exhibited higher student voluntary responses. Grouping these pacing behaviors highlights intentional pedagogical patience used to support second language production.",
      "category_names": ["Pacing & Wait Time Strategies"]
    }
  ]
}`

	userPrompt := fmt.Sprintf("RECURRING STRATEGIES IDENTIFIED IN CORPUS:\n%s", patternList.String())

	var aiResp struct {
		Categories []aiCategoryItem `json:"categories"`
		Themes     []aiThemeItem    `json:"themes"`
	}

	err := aiText.CompleteJSON(ctx, modelName, systemPrompt, userPrompt, &aiResp)
	if err != nil {
		return nil, nil, fmt.Errorf("AI thematic analysis failed: %w", err)
	}

	if len(aiResp.Categories) == 0 || len(aiResp.Themes) == 0 {
		return nil, nil, fmt.Errorf("AI returned empty categories or themes")
	}

	now := time.Now()
	categoryNameToID := make(map[string]uuid.UUID)
	var categories []model.Category

	for _, c := range aiResp.Categories {
		catID := uuid.New()
		categoryNameToID[c.Name] = catID
		desc := c.Description
		categories = append(categories, model.Category{
			ID:            catID,
			AnalysisRunID: runID,
			Name:          c.Name,
			Description:   &desc,
			CreatedAt:     now,
		})
	}

	var themes []model.Theme
	for _, t := range aiResp.Themes {
		var catIDs []uuid.UUID
		for _, catName := range t.CategoryNames {
			if id, ok := categoryNameToID[catName]; ok {
				catIDs = append(catIDs, id)
			}
		}
		desc := t.Description
		trace := t.ReasoningTrace
		themes = append(themes, model.Theme{
			ID:             uuid.New(),
			AnalysisRunID:  runID,
			Name:           t.Name,
			Description:    &desc,
			ReasoningTrace: &trace,
			CategoryIDs:    catIDs,
			Status:         "draft",
			CreatedAt:      now,
		})
	}

	return categories, themes, nil
}

func (s *AnalysisService) generateTeacherAnalysisAndQuestions(
	ctx context.Context,
	runID uuid.UUID,
	teacherID string,
	themes []model.Theme,
	teacherItems []repository.ReportItemContext,
	groupStrategyTotal map[string]int,
	numTeachers int,
	coreQuestions []model.CoreQuestionItem,
) (*model.TeacherAnalysis, []model.InterviewQuestion, error) {
	aiText := s.aiText
	modelName := s.modelName
	if s.aiRouter != nil {
		rProvider, rModel, err := s.aiRouter.GetTextProviderForFlow(ctx, "interview_generator")
		if err != nil {
			return nil, nil, fmt.Errorf("interview_generator configuration error: %w", err)
		}
		aiText = rProvider
		modelName = rModel
	}

	if aiText == nil {
		return nil, nil, fmt.Errorf("AI text provider not configured for flow 'interview_generator'")
	}

	// Calculate teacher statistics
	videoSet := make(map[uuid.UUID]bool)
	strategyCounts := make(map[string]int)
	strategyTimestamps := make(map[string][]string)
	totalEvents := 0

	for _, it := range teacherItems {
		videoSet[it.VideoID] = true
		chText := strings.TrimSpace(it.ChecklistText)
		if chText == "" || it.Count <= 0 {
			continue
		}
		strategyCounts[chText] += it.Count
		totalEvents += it.Count

		// Parse occurrences timestamps if available
		if it.Occurrences != "" && it.Occurrences != "[]" {
			var occList []model.Occurrence
			if err := json.Unmarshal([]byte(it.Occurrences), &occList); err == nil {
				for _, occ := range occList {
					if len(strategyTimestamps[chText]) < 3 {
						sec := int(occ.TimestampSec)
						strategyTimestamps[chText] = append(strategyTimestamps[chText], fmt.Sprintf("%02d:%02d", sec/60, sec%60))
					}
				}
			}
		}
	}

	type stratSummary struct {
		Text       string
		Count      int
		GroupAvg   float64
		Timestamps []string
	}
	var sortedStrats []stratSummary
	for text, count := range strategyCounts {
		grpAvg := float64(groupStrategyTotal[text])
		if numTeachers > 0 {
			grpAvg = grpAvg / float64(numTeachers)
		}
		sortedStrats = append(sortedStrats, stratSummary{
			Text:       text,
			Count:      count,
			GroupAvg:   grpAvg,
			Timestamps: strategyTimestamps[text],
		})
	}
	sort.Slice(sortedStrats, func(i, j int) bool {
		return sortedStrats[i].Count > sortedStrats[j].Count
	})

	var sbData strings.Builder
	limit := 6
	if len(sortedStrats) < limit {
		limit = len(sortedStrats)
	}
	for i := 0; i < limit; i++ {
		st := sortedStrats[i]
		tsInfo := "None recorded"
		if len(st.Timestamps) > 0 {
			tsInfo = strings.Join(st.Timestamps, ", ")
		}
		pctDiff := ""
		if st.GroupAvg > 0 {
			diff := ((float64(st.Count) - st.GroupAvg) / st.GroupAvg) * 100.0
			if diff >= 0 {
				pctDiff = fmt.Sprintf(" (+%.0f%% vs group avg)", diff)
			} else {
				pctDiff = fmt.Sprintf(" (%.0f%% vs group avg)", diff)
			}
		}
		sbData.WriteString(fmt.Sprintf("- Strategy: \"%s\" | Occurrences: %d%s | Group Avg: %.1f | Timestamps: [%s]\n",
			st.Text, st.Count, pctDiff, st.GroupAvg, tsInfo))
	}

	// Fetch chronological interaction log (raw_events with speech quotes and actions)
	var sbEvents strings.Builder
	rawEvents, err := s.rawEventRepo.ListByTeacherID(ctx, teacherID, true)
	if err == nil && len(rawEvents) > 0 {
		sbEvents.WriteString("CHRONOLOGICAL CLASSROOM INTERACTION LOG (Sample excerpts with quotes & actions):\n")
		eventCount := 0
		for _, ev := range rawEvents {
			if eventCount >= 35 {
				break
			}
			sec := int(ev.TimestampSec)
			timeStr := fmt.Sprintf("%02d:%02d", sec/60, sec%60)
			quoteStr := ""
			if ev.Quote != nil && strings.TrimSpace(*ev.Quote) != "" {
				quoteStr = fmt.Sprintf(" | Spoken: %q", *ev.Quote)
			}
			sbEvents.WriteString(fmt.Sprintf("[%s] [%s] %s%s\n", timeStr, strings.ToUpper(ev.EventType), ev.Description, quoteStr))
			eventCount++
		}
	} else {
		sbEvents.WriteString("No raw interaction events found.\n")
	}

	var themeNames []string
	for _, th := range themes {
		themeNames = append(themeNames, fmt.Sprintf("\"%s\"", th.Name))
	}

	var coreQuestionTexts []string
	for _, cq := range coreQuestions {
		coreQuestionTexts = append(coreQuestionTexts, fmt.Sprintf("%d. [%s] %s", cq.Index, cq.RQCategory, cq.QuestionText))
	}

	systemPrompt := `You are an expert qualitative educational researcher examining online classroom interactions (Primary EFL) based on Grounded Theory.
Your task is to analyze an individual teacher's observed strategies and generate a grounded, evidence-cited interview question guide.

RESEARCH QUESTIONS:
- RQ1: What classroom management strategies do primary EFL teachers use in online English speaking classes?
- RQ2: How do teachers perceive the role/effectiveness of classroom management strategies in promoting learners’ speaking participation?
- RQ3: What challenges do teachers encounter in managing online English speaking classes, and how do they address these challenges?

Requirements:
1. "context_summary": Concise qualitative summary (2-3 sentences) evaluating this teacher's distinctive pedagogical pacing, turn-taking, scaffolding, and speaking support patterns.
2. "markdown_content": Comprehensive markdown report:
# Teaching Strategy Analysis — [TeacherID]
**Videos analyzed:** [N] lessons | **Analysis run:** [Current Date]

## Pedagogical Overview
[Detailed qualitative synthesis of this teacher's instruction style, student engagement pacing, and communicative patterns]

## Key Recurring Strategies & Empirical Evidence
[Breakdown of each primary strategy: Occurrence counts, contextual triggers, and comparison to corpus group average]
3. "dynamic_questions": 3 to 5 participant-specific follow-up interview questions.
CRITICAL GROUNDED THEORY & METHODOLOGICAL RULES FOR FOLLOW-UP QUESTIONS:
- Each question MUST be tagged with exactly one "rq_category": "RQ1", "RQ2", or "RQ3".
  * "RQ1": Probes specific classroom management strategies observed (e.g. wait time, nomination, praise, digital tools).
  * "RQ2": Probes teacher's perception of effectiveness/impact on students' speaking confidence and willingness to communicate.
  * "RQ3": Probes challenges encountered (e.g. reluctant learners, silence, technical friction) and how the teacher tackled them.
- GROUNDED EVIDENCE: Each dynamic question MUST cite concrete empirical evidence in "evidence_ref" (specific video timestamp like "04:32", teacher quote, or occurrences count/percentage vs group average).
- SIGNAL-TO-NOISE FILTER: Keep ONLY questions that provide new, relevant, or clarifying data for RQ1–RQ3. DO NOT generate questions merely because a detail in the video is interesting if it is not related to the research questions.

Format for dynamic questions:
- "question_text": The tailored question addressed directly to the teacher (e.g. "At timestamp 04:32, you waited 6 seconds after asking an open question before prompting the learner. What pedagogical rationale guided this choice?")
- "evidence_ref": Exact evidence citation (e.g. "Timestamp 04:32 | Wait time 6s | Spoken quote: 'Take your time'")
- "rq_category": "RQ1" | "RQ2" | "RQ3"

Return ONLY valid JSON matching this schema:
{
  "context_summary": "...",
  "markdown_content": "...",
  "dynamic_questions": [
    {
      "question_text": "...",
      "evidence_ref": "...",
      "rq_category": "RQ1"
    }
  ]
}`

	userPrompt := fmt.Sprintf(`TEACHER DATA:
Teacher ID: %s
Lessons Analyzed: %d
Total Observed Strategy Events: %d
Grounded Theory Themes in Corpus: [%s]

COMMON CORE QUESTIONS ALREADY DEFINED FOR ALL TEACHERS:
%s

TOP OBSERVED STRATEGIES WITH METRICS & TIMESTAMPS:
%s

%s
Generate the teacher analysis and empirical dynamic interview questions with RQ tagging.`,
		teacherID, len(videoSet), totalEvents, strings.Join(themeNames, ", "),
		strings.Join(coreQuestionTexts, "\n"), sbData.String(), sbEvents.String(),
	)

	var aiResp aiTeacherAnalysisResponse
	if err := aiText.CompleteJSON(ctx, modelName, systemPrompt, userPrompt, &aiResp); err != nil {
		return nil, nil, fmt.Errorf("AI interview generation failed for teacher %s: %w", teacherID, err)
	}

	now := time.Now()
	analysisID := uuid.New()
	var themeIDs []uuid.UUID
	for _, t := range themes {
		themeIDs = append(themeIDs, t.ID)
	}

	contextSummary := strings.TrimSpace(aiResp.ContextSummary)
	if contextSummary == "" {
		contextSummary = fmt.Sprintf("Empirical teaching strategy analysis for Teacher %s.", teacherID)
	}
	markdownContent := strings.TrimSpace(aiResp.MarkdownContent)
	if markdownContent == "" {
		markdownContent = fmt.Sprintf("# Teaching Strategy Analysis — %s\n\nNo qualitative narrative generated.", teacherID)
	}

	ta := &model.TeacherAnalysis{
		ID:              analysisID,
		AnalysisRunID:   runID,
		TeacherID:       teacherID,
		ThemeIDs:        themeIDs,
		ContextSummary:  &contextSummary,
		MarkdownContent: &markdownContent,
		CreatedAt:       now,
	}

	var questions []model.InterviewQuestion
	sortIdx := 1

	// Add Core Questions (from synthesized run core questions)
	for _, cq := range coreQuestions {
		rqVal := cq.RQCategory
		questions = append(questions, model.InterviewQuestion{
			ID:                uuid.New(),
			TeacherAnalysisID: analysisID,
			TeacherID:         teacherID,
			Type:              "core",
			RQCategory:        &rqVal,
			QuestionText:      cq.QuestionText,
			SortOrder:         sortIdx,
			CreatedAt:         now,
		})
		sortIdx++
	}

	// Add Dynamic Questions from AI
	for _, dq := range aiResp.DynamicQuestions {
		qText := strings.TrimSpace(dq.QuestionText)
		evRef := strings.TrimSpace(dq.EvidenceRef)
		if qText == "" {
			continue
		}
		rq := strings.ToUpper(strings.TrimSpace(dq.RQCategory))
		if rq != "RQ1" && rq != "RQ2" && rq != "RQ3" {
			rq = "RQ1"
		}
		var evRefPtr *string
		if evRef != "" {
			evRefPtr = &evRef
		}
		questions = append(questions, model.InterviewQuestion{
			ID:                uuid.New(),
			TeacherAnalysisID: analysisID,
			TeacherID:         teacherID,
			Type:              "dynamic",
			RQCategory:        &rq,
			QuestionText:      qText,
			EvidenceRef:       evRefPtr,
			SortOrder:         sortIdx,
			CreatedAt:         now,
		})
		sortIdx++
	}

	return ta, questions, nil
}

// GetThemes returns all themes for an analysis run.
func (s *AnalysisService) GetThemes(ctx context.Context, runID uuid.UUID) ([]model.Theme, error) {
	return s.analysisRepo.GetThemesByRunID(ctx, runID)
}

// UpdateTheme updates theme metadata or status (confirm/draft).
func (s *AnalysisService) UpdateTheme(ctx context.Context, themeID uuid.UUID, name, description, status string) error {
	return s.analysisRepo.UpdateTheme(ctx, themeID, name, description, status)
}

// MergeThemes merges two themes.
func (s *AnalysisService) MergeThemes(ctx context.Context, targetID, sourceID uuid.UUID) error {
	return s.analysisRepo.MergeThemes(ctx, targetID, sourceID)
}

// GetTeacherAnalysisAndQuestions retrieves analysis markdown and interview questions for a teacher.
func (s *AnalysisService) GetTeacherAnalysisAndQuestions(ctx context.Context, runID uuid.UUID, teacherID string) (*model.TeacherAnalysis, []model.InterviewQuestion, error) {
	return s.analysisRepo.GetTeacherAnalysis(ctx, runID, teacherID)
}

// GetLatestRun retrieves the most recent analysis run.
func (s *AnalysisService) GetLatestRun(ctx context.Context) (*model.AnalysisRun, error) {
	return s.analysisRepo.GetLatestRun(ctx)
}

// ListRuns retrieves all analysis runs.
func (s *AnalysisService) ListRuns(ctx context.Context) ([]model.AnalysisRun, error) {
	return s.analysisRepo.ListRuns(ctx)
}

// DeleteRun deletes an analysis run by ID.
func (s *AnalysisService) DeleteRun(ctx context.Context, runID uuid.UUID) error {
	return s.analysisRepo.DeleteRun(ctx, runID)
}

// SynthesizeCoreQuestions analyzes the 22 base questions, discovered themes, and RQs to synthesize the common Core Questions.
func (s *AnalysisService) SynthesizeCoreQuestions(
	ctx context.Context,
	runID uuid.UUID,
	themes []model.Theme,
) ([]model.CoreQuestionItem, error) {
	aiText := s.aiText
	modelName := s.modelName
	if s.aiRouter != nil {
		rProvider, rModel, err := s.aiRouter.GetTextProviderForFlow(ctx, "interview_generator")
		if err == nil && rProvider != nil {
			aiText = rProvider
			modelName = rModel
		}
	}

	if aiText == nil {
		return DefaultSynthesizedCoreQuestions, nil
	}

	// 1. Fetch base questions from DB or fallback to defaults
	var baseList []model.InterviewBaseQuestion
	if s.interviewBaseRepo != nil {
		baseList, _ = s.interviewBaseRepo.List(ctx, true)
	}

	var sbBase strings.Builder
	if len(baseList) > 0 {
		for _, bq := range baseList {
			sbBase.WriteString(fmt.Sprintf("%d. [%s / %s] %s\n", bq.QuestionIndex, bq.Section, bq.RQCategory, bq.QuestionText))
		}
	} else {
		sbBase.WriteString("1. Could you briefly introduce yourself and describe your current teaching position? (Background)\n")
		sbBase.WriteString("2. How many years have you been teaching English? (Background)\n")
		sbBase.WriteString("3. How long have you been teaching online English classes? (Background)\n")
		sbBase.WriteString("4. Which grades or age groups do you currently teach? (Background)\n")
		sbBase.WriteString("5. Which online platforms do you usually use for your English speaking lessons? (Background)\n")
		sbBase.WriteString("6. Could you describe how you usually manage an online English speaking lesson from the beginning to the end? (RQ1)\n")
		sbBase.WriteString("7. How do you establish classroom rules and routines in your online speaking classes? (RQ1)\n")
		sbBase.WriteString("8. How do you manage turn-taking during speaking activities? (RQ1)\n")
		sbBase.WriteString("9. What strategies do you use to maintain learners' attention and engagement throughout the lesson? (RQ1)\n")
		sbBase.WriteString("10. How do you support learners when they have difficulty speaking English? (RQ1)\n")
		sbBase.WriteString("11. How do you use digital tools such as the chat box, breakout rooms, reaction icons, screen sharing, or digital whiteboards during speaking lessons? (RQ1)\n")
		sbBase.WriteString("12. In your opinion, what role does classroom management play in promoting speaking participation among primary learners? (RQ2)\n")
		sbBase.WriteString("13. Which classroom management strategies do you consider most effective? Why? (RQ2)\n")
		sbBase.WriteString("14. How do these strategies influence learners' confidence and willingness to communicate? (RQ2)\n")
		sbBase.WriteString("15. Do different learners respond differently to the same classroom management strategies? Could you explain? (RQ2)\n")
		sbBase.WriteString("16. Have your views about classroom management changed since you began teaching online? If yes, how? (RQ2)\n")
		sbBase.WriteString("17. What challenges do you most frequently encounter when managing online English speaking classes? (RQ3)\n")
		sbBase.WriteString("18. Which challenges have the greatest impact on learners' speaking participation? (RQ3)\n")
		sbBase.WriteString("19. How do you usually deal with learners who are reluctant to participate in speaking activities? (RQ3)\n")
		sbBase.WriteString("20. How do you deal with technical problems that occur during online speaking lessons? (RQ3)\n")
		sbBase.WriteString("21. Are there any classroom management challenges that remain difficult to address? Please explain. (RQ3)\n")
		sbBase.WriteString("22. Is there anything else you would like to share about your experiences of managing online English speaking classes for primary EFL learners? (Closing)\n")
	}

	var sbThemes strings.Builder
	for _, th := range themes {
		trace := ""
		if th.ReasoningTrace != nil {
			trace = fmt.Sprintf(" — Rationale: %s", *th.ReasoningTrace)
		}
		sbThemes.WriteString(fmt.Sprintf("- Theme: %s%s\n", th.Name, trace))
	}

	systemPrompt := `You are an expert qualitative educational researcher analyzing primary EFL online classrooms.
Your task is to synthesize the 22 canonical semi-structured interview base questions and Grounded Theory themes discovered from 24 classroom observation videos into a concise, high-impact set of Core Interview Questions for teachers.

3 RESEARCH QUESTIONS (RQ1–RQ3):
- RQ1: What classroom management strategies do primary EFL teachers use in online English speaking classes?
- RQ2: How do teachers perceive the role/effectiveness of classroom management strategies in promoting learners’ speaking participation?
- RQ3: What challenges do teachers encounter in managing online English speaking classes, and how do they address these challenges?

CORE QUESTIONS SYNTHESIS METHODOLOGY:
1. Core Questions MUST be directly synthesized from the 22 base questions, NOT invented from scratch.
2. Retain the most vital questions answering RQ1, RQ2, and RQ3.
3. Merge questions that overlap or are conceptually very close if merging does NOT lose a critical dimension of the RQ.
4. Do NOT discard a question merely because it appears similar if it genuinely explores a distinct dimension of the research question.
5. Create a concise set of 6 to 9 Core Questions spanning RQ1, RQ2, and RQ3 that seamlessly incorporates the recurring patterns and themes discovered from the 24 videos.
6. For each question, output:
   - "index": integer (1, 2, ...)
   - "question_text": concise, high-impact interview question in English
   - "rq_category": exactly "RQ1", "RQ2", or "RQ3"
   - "rationale": brief qualitative explanation of which base questions were merged/selected and how it connects with observed classroom themes.

Return ONLY valid JSON:
{
  "core_questions": [
    {
      "index": 1,
      "question_text": "...",
      "rq_category": "RQ1",
      "rationale": "..."
    }
  ]
}`

	userPrompt := fmt.Sprintf(`22 CANONICAL SEMI-STRUCTURED BASE QUESTIONS:
%s

DISCOVERED GROUNDED THEORY THEMES IN CORPUS:
%s

Synthesize the Core Interview Questions based directly on the base questions and discovered themes.`,
		sbBase.String(), sbThemes.String(),
	)

	var aiResp struct {
		CoreQuestions []model.CoreQuestionItem `json:"core_questions"`
	}

	if err := aiText.CompleteJSON(ctx, modelName, systemPrompt, userPrompt, &aiResp); err != nil {
		return nil, fmt.Errorf("AI core question synthesis failed: %w", err)
	}

	if len(aiResp.CoreQuestions) == 0 {
		return DefaultSynthesizedCoreQuestions, nil
	}

	b, _ := json.Marshal(aiResp.CoreQuestions)
	_ = s.analysisRepo.UpdateCoreQuestions(ctx, runID, string(b), "draft")
	return aiResp.CoreQuestions, nil
}

// GetCoreQuestions returns the core questions and approval status for a run.
func (s *AnalysisService) GetCoreQuestions(ctx context.Context, runID uuid.UUID) ([]model.CoreQuestionItem, string, error) {
	run, err := s.analysisRepo.GetRun(ctx, runID)
	if err != nil {
		return nil, "", err
	}
	if run == nil {
		return nil, "", fmt.Errorf("analysis run not found")
	}

	var questions []model.CoreQuestionItem
	if run.CoreQuestions != "" && run.CoreQuestions != "[]" {
		_ = json.Unmarshal([]byte(run.CoreQuestions), &questions)
	}
	if len(questions) == 0 {
		questions = DefaultSynthesizedCoreQuestions
	}

	status := run.CoreQuestionsStatus
	if status == "" {
		status = "draft"
	}
	return questions, status, nil
}

// ApproveCoreQuestions sets the core questions status to approved and re-generates teacher interview guides.
func (s *AnalysisService) ApproveCoreQuestions(ctx context.Context, runID uuid.UUID, approvedQuestions []model.CoreQuestionItem) error {
	if len(approvedQuestions) == 0 {
		approvedQuestions = DefaultSynthesizedCoreQuestions
	}

	b, err := json.Marshal(approvedQuestions)
	if err != nil {
		return fmt.Errorf("failed to encode core questions: %w", err)
	}

	if err := s.analysisRepo.UpdateCoreQuestions(ctx, runID, string(b), "approved"); err != nil {
		return err
	}

	return s.GenerateAllTeacherAnalysesAndQuestions(ctx, runID)
}

// GenerateAllTeacherAnalysesAndQuestions re-generates all teacher interview guides with current core questions.
func (s *AnalysisService) GenerateAllTeacherAnalysesAndQuestions(ctx context.Context, runID uuid.UUID) error {
	run, err := s.analysisRepo.GetRun(ctx, runID)
	if err != nil || run == nil {
		return fmt.Errorf("analysis run not found: %s", runID)
	}

	themes, err := s.analysisRepo.GetThemesByRunID(ctx, runID)
	if err != nil || len(themes) == 0 {
		return fmt.Errorf("no themes found for run %s", runID)
	}

	var coreQuestions []model.CoreQuestionItem
	if run.CoreQuestions != "" && run.CoreQuestions != "[]" {
		_ = json.Unmarshal([]byte(run.CoreQuestions), &coreQuestions)
	}
	if len(coreQuestions) == 0 {
		coreQuestions = DefaultSynthesizedCoreQuestions
	}

	reportItems, err := s.reportRepo.ListAllReportItemsWithContext(ctx)
	if err != nil {
		return fmt.Errorf("failed to list report items: %w", err)
	}

	teacherReportItems := make(map[string][]repository.ReportItemContext)
	groupStrategyTotal := make(map[string]int)
	for _, item := range reportItems {
		if item.TeacherID != "" {
			teacherReportItems[item.TeacherID] = append(teacherReportItems[item.TeacherID], item)
		}
		if item.Count > 0 {
			chText := strings.TrimSpace(item.ChecklistText)
			if chText != "" {
				groupStrategyTotal[chText] += item.Count
			}
		}
	}

	if err := s.analysisRepo.DeleteTeacherAnalysesAndQuestions(ctx, runID); err != nil {
		return fmt.Errorf("failed to clear old teacher analyses: %w", err)
	}

	numTeachers := len(teacherReportItems)
	for tID, tItems := range teacherReportItems {
		ta, questions, err := s.generateTeacherAnalysisAndQuestions(
			ctx, runID, tID, themes, tItems, groupStrategyTotal, numTeachers, coreQuestions,
		)
		if err != nil {
			return fmt.Errorf("failed to generate interview analysis for teacher %s: %w", tID, err)
		}
		if err := s.analysisRepo.SaveTeacherAnalysis(ctx, ta, questions); err != nil {
			return fmt.Errorf("failed to save teacher analysis for %s: %w", tID, err)
		}
	}

	return nil
}

// UpdateInterviewQuestion modifies an individual interview question.
func (s *AnalysisService) UpdateInterviewQuestion(ctx context.Context, qID uuid.UUID, questionText string, rqCategory *string) error {
	return s.analysisRepo.UpdateInterviewQuestion(ctx, qID, questionText, rqCategory)
}

