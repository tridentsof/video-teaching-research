package model

// LessonTrendPoint represents aggregated pedagogical strategy counts for one video/lesson.
type LessonTrendPoint struct {
	Lesson       string  `json:"lesson"`
	VideoID      string  `json:"video_id"`
	TeacherID    string  `json:"teacher_id"`
	Scaffolding  float64 `json:"scaffolding"`
	WaitTime     float64 `json:"waitTime"`
	Praise       float64 `json:"praise"`
	Agency       float64 `json:"agency"`
}

// TeacherQuadrantPoint represents a teacher's position on Agency vs Scaffolding.
type TeacherQuadrantPoint struct {
	ID          string  `json:"id"`
	Label       string  `json:"label"`
	Agency      float64 `json:"agency"`
	Scaffolding float64 `json:"scaffolding"`
	TotalEvents int     `json:"total_events"`
}

// RadarDimensionPoint represents normalized scores across sections A-E for the corpus.
type RadarDimensionPoint struct {
	Key   string  `json:"key"`
	Label string  `json:"label"`
	Score float64 `json:"score"`
	Count int     `json:"count"`
}

// TemporalBinPoint represents distribution across 5-minute intervals (0-45m).
type TemporalBinPoint struct {
	Bin          string  `json:"bin"`
	Warmup       int     `json:"warmup"`
	Scaffolding  int     `json:"scaffolding"`
	StudentTurns int     `json:"studentTurns"`
	Praise       int     `json:"praise"`
}

// OutlierEvidencePoint represents a real qualitative citation extracted from data.
type OutlierEvidencePoint struct {
	TeacherID    string `json:"teacher_id"`
	Lesson       string `json:"lesson"`
	TimestampStr string `json:"timestamp_str"`
	Quote        string `json:"quote"`
	Context      string `json:"context"`
}

// PedagogicalAnalyticsResponse represents the full real-data payload for /analytics.
type PedagogicalAnalyticsResponse struct {
	TotalEvents      int                    `json:"total_events"`
	TotalVideos      int                    `json:"total_videos"`
	TotalHours       float64                `json:"total_hours"`
	AvgWaitTime      float64                `json:"avg_wait_time"`
	ScaffoldingRatio float64                `json:"scaffolding_ratio"`
	AIConfidence     float64                `json:"ai_confidence"`
	Lessons          []LessonTrendPoint     `json:"lessons"`
	Teachers         []TeacherQuadrantPoint `json:"teachers"`
	Radar            []RadarDimensionPoint  `json:"radar"`
	TemporalStream   []TemporalBinPoint     `json:"temporal_stream"`
	OutlierEvidence  OutlierEvidencePoint   `json:"outlier_evidence"`
}

// QualitativeEvidenceItem represents a single qualitative citation/excerpt
type QualitativeEvidenceItem struct {
	VideoID      string  `json:"video_id"`
	TeacherID    string  `json:"teacher_id"`
	Lesson       string  `json:"lesson"`
	TimestampSec float64 `json:"timestamp_sec"`
	TimestampStr string  `json:"timestamp_str"`
	Quote        string  `json:"quote"`
	Context      string  `json:"context"`
	Confidence   float64 `json:"confidence"`
}

// CoverageMatrixCell represents presence in one lesson or teacher
type CoverageMatrixCell struct {
	Key     string `json:"key"`     // e.g. "T01-L1" or "T01"
	Present bool   `json:"present"` // true if code/pattern appeared
	Count   int    `json:"count"`   // occurrences
}

// CoverageMatrixRow represents a recurring pattern/code row
type CoverageMatrixRow struct {
	PatternID       string                    `json:"pattern_id"`
	Code            string                    `json:"code"`
	Description     string                    `json:"description"`
	Category        string                    `json:"category"`
	Theme           string                    `json:"theme"`
	LessonCells     []CoverageMatrixCell      `json:"lesson_cells"`
	TeacherCells    []CoverageMatrixCell      `json:"teacher_cells"`
	BreadthLessons  int                       `json:"breadth_lessons"` // e.g. 22
	TotalLessons    int                       `json:"total_lessons"`   // 24
	BreadthTeachers int                       `json:"breadth_teachers"`// e.g. 11
	TotalTeachers   int                       `json:"total_teachers"`  // 12
	Evidence        []QualitativeEvidenceItem `json:"evidence"`
}

// ThematicCode represents a code in the hierarchy map
type ThematicCode struct {
	ID            string                    `json:"id"`
	Code          string                    `json:"code"`
	Name          string                    `json:"name"`
	EvidenceCount int                       `json:"evidence_count"`
	SampleQuotes  []QualitativeEvidenceItem `json:"sample_quotes"` // 2-3 key exemplary quotes
}

// ThematicCategory represents a behavior category in the hierarchy map
type ThematicCategory struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	NameVi        string         `json:"name_vi,omitempty"`
	Description   string         `json:"description"`
	DescriptionVi string         `json:"description_vi,omitempty"`
	Codes         []ThematicCode `json:"codes"`
}

// ThematicTheme represents an overarching theme in the hierarchy map
type ThematicTheme struct {
	ID               string             `json:"id"`
	Name             string             `json:"name"`
	NameVi           string             `json:"name_vi,omitempty"`
	Description      string             `json:"description"`
	DescriptionVi    string             `json:"description_vi,omitempty"`
	ReasoningTrace   string             `json:"reasoning_trace"`
	ReasoningTraceVi string             `json:"reasoning_trace_vi,omitempty"`
	Status           string             `json:"status"` // draft | confirmed
	Categories       []ThematicCategory `json:"categories"`
}

// RQ1EnactmentRow represents an enactment row for RQ1 with 5-stage traceability:
// Analytical Dimension -> Recurring Pattern -> Observed Enactment -> Representative Lesson -> Timestamp/Context
type RQ1EnactmentRow struct {
	Dimension              string                    `json:"dimension"`
	DimensionVi            string                    `json:"dimension_vi,omitempty"`
	RecurringPattern       string                    `json:"recurring_pattern"`
	RecurringPatternVi     string                    `json:"recurring_pattern_vi,omitempty"`
	ObservedEnactment      string                    `json:"observed_enactment"`
	ObservedEnactmentVi    string                    `json:"observed_enactment_vi,omitempty"`
	StrategyName           string                    `json:"strategy_name,omitempty"`
	StrategyNameVi         string                    `json:"strategy_name_vi,omitempty"`
	StrategySubtext        string                    `json:"strategy_subtext,omitempty"`
	StrategySubtextVi      string                    `json:"strategy_subtext_vi,omitempty"`
	ObservedEnactments     []string                  `json:"observed_enactments,omitempty"`
	ObservedEnactmentsVi   []string                  `json:"observed_enactments_vi,omitempty"`
	RepresentativeLessons  []string                  `json:"representative_lessons"`
	RepresentativeTeachers []string                  `json:"representative_teachers"`
	TimestampContext       string                    `json:"timestamp_context,omitempty"`
	DirectQuotes           []QualitativeEvidenceItem `json:"direct_quotes"`
}

// QualitativeAnalyticsResponse represents the complete qualitative payload for /analytics
type QualitativeAnalyticsResponse struct {
	AnalysisRunID     string              `json:"analysis_run_id"`
	RunStatus         string              `json:"run_status"`
	TriggeredAt       string              `json:"triggered_at"`
	TotalLessons      int                 `json:"total_lessons"`
	TotalTeachers     int                 `json:"total_teachers"`
	LessonsList       []string            `json:"lessons_list"` // ["T01-L1", "T01-L2", ...]
	TeachersList      []string            `json:"teachers_list"` // ["T01", "T02", ...]
	CoverageMatrix    []CoverageMatrixRow `json:"coverage_matrix"`
	ThematicHierarchy []ThematicTheme     `json:"thematic_hierarchy"`
	RQ1EnactmentMap   []RQ1EnactmentRow   `json:"rq1_enactment_map"`
}

