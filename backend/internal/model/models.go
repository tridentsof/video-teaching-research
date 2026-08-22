package model

import (
	"time"

	"github.com/google/uuid"
)

// User represents a system user.
type User struct {
	ID           uuid.UUID `json:"id" db:"id"`
	Username     string    `json:"username" db:"username"`
	PasswordHash string    `json:"-" db:"password_hash"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
}

// Video represents an uploaded video.
type Video struct {
	ID          uuid.UUID `json:"id" db:"id"`
	TeacherID   string    `json:"teacher_id" db:"teacher_id"`
	Title       string    `json:"title" db:"title"`
	BlobURL     *string   `json:"blob_url,omitempty" db:"blob_url"`
	DurationSec *int      `json:"duration_sec,omitempty" db:"duration_sec"`
	Status      string    `json:"status" db:"status"`
	UploadedAt  time.Time `json:"uploaded_at" db:"uploaded_at"`
	UserID      *uuid.UUID `json:"user_id,omitempty" db:"user_id"`
}

// VideoChunk represents a chunk of a video after FFmpeg processing.
type VideoChunk struct {
	ID             uuid.UUID  `json:"id" db:"id"`
	VideoID        uuid.UUID  `json:"video_id" db:"video_id"`
	ChunkIndex     int        `json:"chunk_index" db:"chunk_index"`
	ChunkStartSec  int        `json:"chunk_start_sec" db:"chunk_start_sec"`
	ChunkEndSec    int        `json:"chunk_end_sec" db:"chunk_end_sec"`
	BlobPath       *string    `json:"blob_path,omitempty" db:"blob_path"`
	Status         string     `json:"status" db:"status"`
	GeminiRawOutput *string   `json:"gemini_raw_output,omitempty" db:"gemini_raw_output"`
	ProcessedAt    *time.Time `json:"processed_at,omitempty" db:"processed_at"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
}

// RawEvent represents an extracted event from video analysis.
type RawEvent struct {
	ID            uuid.UUID  `json:"id" db:"id"`
	VideoID       uuid.UUID  `json:"video_id" db:"video_id"`
	TeacherID     string     `json:"teacher_id" db:"teacher_id"`
	ChunkID       *uuid.UUID `json:"chunk_id,omitempty" db:"chunk_id"`
	TimestampSec  float64    `json:"timestamp_sec" db:"timestamp_sec"`
	EventType     string     `json:"event_type" db:"event_type"`
	EventKey      string     `json:"event_key" db:"event_key"`
	Description   string     `json:"description" db:"description"`
	Confidence    *float64   `json:"confidence,omitempty" db:"confidence"`
	DurationSec   *float64   `json:"duration_sec,omitempty" db:"duration_sec"`
	IsDuplicateOf *uuid.UUID `json:"is_duplicate_of,omitempty" db:"is_duplicate_of"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
}

// Checklist represents a checklist version.
type Checklist struct {
	ID        uuid.UUID       `json:"id" db:"id"`
	Name      string          `json:"name" db:"name"`
	Version   string          `json:"version" db:"version"`
	CreatedAt time.Time       `json:"created_at" db:"created_at"`
	Items     []ChecklistItem `json:"items,omitempty"`
}

// ChecklistItem represents a single item within a checklist.
type ChecklistItem struct {
	ID          uuid.UUID `json:"id" db:"id"`
	ChecklistID uuid.UUID `json:"checklist_id" db:"checklist_id"`
	Section     string    `json:"section" db:"section"`
	Text        string    `json:"text" db:"text"`
	SortOrder   int       `json:"sort_order" db:"sort_order"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

// EventMapping represents a mapping between a raw event and a checklist item.
type EventMapping struct {
	ID              uuid.UUID `json:"id" db:"id"`
	RawEventID      uuid.UUID `json:"raw_event_id" db:"raw_event_id"`
	ChecklistItemID uuid.UUID `json:"checklist_item_id" db:"checklist_item_id"`
	MatchScore      float64   `json:"match_score" db:"match_score"`
	MatchMethod     string    `json:"match_method" db:"match_method"`
	MatchedByModel  *string   `json:"matched_by_model,omitempty" db:"matched_by_model"`
	CreatedAt       time.Time `json:"created_at" db:"created_at"`
}

// Report represents a generated markdown report for a video.
type Report struct {
	ID               uuid.UUID    `json:"id" db:"id"`
	VideoID          uuid.UUID    `json:"video_id" db:"video_id"`
	TeacherID        string       `json:"teacher_id" db:"teacher_id"`
	ChecklistID      uuid.UUID    `json:"checklist_id" db:"checklist_id"`
	ChecklistVersion *string      `json:"checklist_version,omitempty" db:"checklist_version"`
	MarkdownContent  string       `json:"markdown_content" db:"markdown_content"`
	GeneratedAt      time.Time    `json:"generated_at" db:"generated_at"`
	Items            []ReportItem `json:"items,omitempty"`
}

// ReportItem represents statistics for a single checklist item in a report.
type ReportItem struct {
	ID               uuid.UUID `json:"id" db:"id"`
	ReportID         uuid.UUID `json:"report_id" db:"report_id"`
	ChecklistItemID  uuid.UUID `json:"checklist_item_id" db:"checklist_item_id"`
	ChecklistSection string    `json:"checklist_section" db:"checklist_section"`
	ChecklistText    string    `json:"checklist_text" db:"checklist_text"`
	Count            int       `json:"count" db:"count"`
	AvgConfidence    *float64  `json:"avg_confidence,omitempty" db:"avg_confidence"`
	AvgDurationSec   *float64  `json:"avg_duration_sec,omitempty" db:"avg_duration_sec"`
	Occurrences      string    `json:"occurrences" db:"occurrences"` // JSON array string
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
}

// Occurrence represents a single occurrence of a checklist item event.
type Occurrence struct {
	TimestampSec float64 `json:"timestamp_sec"`
	Confidence   float64 `json:"confidence"`
	DurationSec  float64 `json:"duration_sec"`
}

// PipelineJob represents a tracking record for a pipeline processing step.
type PipelineJob struct {
	ID         uuid.UUID  `json:"id" db:"id"`
	VideoID    uuid.UUID  `json:"video_id" db:"video_id"`
	Step       string     `json:"step" db:"step"`
	Status     string     `json:"status" db:"status"`
	StartedAt  *time.Time `json:"started_at,omitempty" db:"started_at"`
	FinishedAt *time.Time `json:"finished_at,omitempty" db:"finished_at"`
	ErrorMsg   *string    `json:"error_msg,omitempty" db:"error_msg"`
	CreatedAt  time.Time  `json:"created_at" db:"created_at"`
}

// AnalysisRun represents a Phase 6 analysis execution.
type AnalysisRun struct {
	ID          uuid.UUID  `json:"id" db:"id"`
	TriggeredAt time.Time  `json:"triggered_at" db:"triggered_at"`
	Status      string     `json:"status" db:"status"`
	Config      string     `json:"config" db:"config"` // JSONB string
	ErrorMsg    *string    `json:"error_msg,omitempty" db:"error_msg"`
	CompletedAt *time.Time `json:"completed_at,omitempty" db:"completed_at"`
}

// Pattern represents a detected recurring teaching strategy.
type Pattern struct {
	ID                uuid.UUID  `json:"id" db:"id"`
	AnalysisRunID     uuid.UUID  `json:"analysis_run_id" db:"analysis_run_id"`
	ChecklistItemID   *uuid.UUID `json:"checklist_item_id,omitempty" db:"checklist_item_id"`
	EventKey          *string    `json:"event_key,omitempty" db:"event_key"`
	Description       *string    `json:"description,omitempty" db:"description"`
	FrequencyScore    *float64   `json:"frequency_score,omitempty" db:"frequency_score"`
	ThresholdMethod   *string    `json:"threshold_method,omitempty" db:"threshold_method"`
	IntraTeacherCount int        `json:"intra_teacher_count" db:"intra_teacher_count"`
	CrossTeacherCount int        `json:"cross_teacher_count" db:"cross_teacher_count"`
	CreatedAt         time.Time  `json:"created_at" db:"created_at"`
}

// Category represents a behavior category grouping patterns.
type Category struct {
	ID            uuid.UUID   `json:"id" db:"id"`
	AnalysisRunID uuid.UUID   `json:"analysis_run_id" db:"analysis_run_id"`
	Name          string      `json:"name" db:"name"`
	Description   *string     `json:"description,omitempty" db:"description"`
	PatternIDs    []uuid.UUID `json:"pattern_ids" db:"pattern_ids"`
	CreatedAt     time.Time   `json:"created_at" db:"created_at"`
}

// Theme represents a high-level theme derived from grounded theory analysis.
type Theme struct {
	ID             uuid.UUID   `json:"id" db:"id"`
	AnalysisRunID  uuid.UUID   `json:"analysis_run_id" db:"analysis_run_id"`
	Name           string      `json:"name" db:"name"`
	Description    *string     `json:"description,omitempty" db:"description"`
	ReasoningTrace *string     `json:"reasoning_trace,omitempty" db:"reasoning_trace"`
	CategoryIDs    []uuid.UUID `json:"category_ids" db:"category_ids"`
	Status         string      `json:"status" db:"status"`
	CreatedAt      time.Time   `json:"created_at" db:"created_at"`
}

// TeacherAnalysis represents per-teacher analysis results.
type TeacherAnalysis struct {
	ID              uuid.UUID   `json:"id" db:"id"`
	AnalysisRunID   uuid.UUID   `json:"analysis_run_id" db:"analysis_run_id"`
	TeacherID       string      `json:"teacher_id" db:"teacher_id"`
	ThemeIDs        []uuid.UUID `json:"theme_ids" db:"theme_ids"`
	ContextSummary  *string     `json:"context_summary,omitempty" db:"context_summary"`
	MarkdownContent *string     `json:"markdown_content,omitempty" db:"markdown_content"`
	CreatedAt       time.Time   `json:"created_at" db:"created_at"`
}

// InterviewQuestion represents a generated interview question for a teacher.
type InterviewQuestion struct {
	ID                uuid.UUID `json:"id" db:"id"`
	TeacherAnalysisID uuid.UUID `json:"teacher_analysis_id" db:"teacher_analysis_id"`
	TeacherID         string    `json:"teacher_id" db:"teacher_id"`
	Type              string    `json:"type" db:"type"` // core | dynamic
	QuestionText      string    `json:"question_text" db:"question_text"`
	EvidenceRef       *string   `json:"evidence_ref,omitempty" db:"evidence_ref"`
	SortOrder         int       `json:"sort_order" db:"sort_order"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
}
