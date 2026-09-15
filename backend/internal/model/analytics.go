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
