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
	ID          uuid.UUID  `json:"id" db:"id"`
	TeacherID   string     `json:"teacher_id" db:"teacher_id"`
	Title       string     `json:"title" db:"title"`
	BlobURL     *string    `json:"blob_url,omitempty" db:"blob_url"`
	DurationSec *int       `json:"duration_sec,omitempty" db:"duration_sec"`
	FileSize    *int64     `json:"file_size,omitempty" db:"file_size"`
	Status      string     `json:"status" db:"status"`
	ErrorMsg    *string    `json:"error_msg,omitempty" db:"error_msg"`
	FailedStep  *string    `json:"failed_step,omitempty" db:"failed_step"`
	UploadedAt     time.Time  `json:"uploaded_at" db:"uploaded_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
	UserID         *uuid.UUID `json:"user_id,omitempty" db:"user_id"`
	ProcessingMode *string    `json:"processing_mode,omitempty" db:"processing_mode"`
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
	Code          *string    `json:"code,omitempty" db:"code"`
	Quote         *string    `json:"quote,omitempty" db:"quote"`
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
	TimestampStr string  `json:"timestamp_str,omitempty"`
	Confidence   float64 `json:"confidence"`
	DurationSec  float64 `json:"duration_sec"`
	Code         string  `json:"code,omitempty"`
	Quote        string  `json:"quote,omitempty"`
	Context      string  `json:"context,omitempty"`
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

// CodebookEntry represents a single observation code definition in a video's codebook.
type CodebookEntry struct {
	ID                 uuid.UUID `json:"id" db:"id"`
	VideoID            uuid.UUID `json:"video_id" db:"video_id"`
	Code               string    `json:"code" db:"code"`
	Definition         string    `json:"definition" db:"definition"`
	InclusionCriteria  string    `json:"inclusion_criteria" db:"inclusion_criteria"`
	ExclusionCriteria  string    `json:"exclusion_criteria" db:"exclusion_criteria"`
	Example            string    `json:"example" db:"example"`
	Category           string    `json:"category" db:"category"`
	Theme              string    `json:"theme" db:"theme"`
	SortOrder          int       `json:"sort_order" db:"sort_order"`
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time `json:"updated_at" db:"updated_at"`
}

// APIKey represents an AI provider credential stored in the database vault.
type APIKey struct {
	ID         uuid.UUID `json:"id" db:"id"`
	Provider   string    `json:"provider" db:"provider"` // gemini | openrouter | anthropic | openai
	Label      string    `json:"label" db:"label"`
	KeySecret  string    `json:"key_secret" db:"key_secret"`
	IsDefault  bool      `json:"is_default" db:"is_default"`
	Status     string    `json:"status" db:"status"` // active | rate_limited | disabled
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

// APIKeyResponse masks the secret key for client safety.
type APIKeyResponse struct {
	ID        uuid.UUID `json:"id"`
	Provider  string    `json:"provider"`
	Label     string    `json:"label"`
	MaskedKey string    `json:"masked_key"`
	IsDefault bool      `json:"is_default"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// AIModelInfo represents an AI model in the catalog.
type AIModelInfo struct {
	ID                 string    `json:"id" db:"id"`
	Provider           string    `json:"provider" db:"provider"`
	DisplayName        string    `json:"display_name" db:"display_name"`
	ContextTokens      int       `json:"context_tokens" db:"context_tokens"`
	SupportsMultimodal bool      `json:"supports_multimodal" db:"supports_multimodal"`
	SupportsReasoning  bool      `json:"supports_reasoning" db:"supports_reasoning"`
	IsActive           bool      `json:"is_active" db:"is_active"`
	SortOrder          int       `json:"sort_order" db:"sort_order"`
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
}

// FlowConfig represents routing rules for a pipeline flow.
type FlowConfig struct {
	FlowKey         string     `json:"flow_key" db:"flow_key"`
	ModelID         string     `json:"model_id" db:"model_id"`
	APIKeyID        *uuid.UUID `json:"api_key_id,omitempty" db:"api_key_id"`
	Temperature     float64    `json:"temperature" db:"temperature"`
	FallbackModelID *string    `json:"fallback_model_id,omitempty" db:"fallback_model_id"`
	UpdatedAt       time.Time  `json:"updated_at" db:"updated_at"`
}

// FlowConfigResponse includes nested model & key details for UI presentation.
type FlowConfigResponse struct {
	FlowKey         string           `json:"flow_key"`
	ModelID         string           `json:"model_id"`
	ModelInfo       *AIModelInfo     `json:"model_info,omitempty"`
	APIKeyID        *uuid.UUID       `json:"api_key_id,omitempty"`
	APIKeyInfo      *APIKeyResponse  `json:"api_key_info,omitempty"`
	Temperature     float64          `json:"temperature"`
	FallbackModelID *string          `json:"fallback_model_id,omitempty"`
	UpdatedAt       time.Time        `json:"updated_at"`
}

// AIFlowsSettingsResponse returns the complete state for the AI Studio page.
type AIFlowsSettingsResponse struct {
	Flows     []FlowConfigResponse `json:"flows"`
	Models    []AIModelInfo        `json:"models"`
	APIKeys   []APIKeyResponse     `json:"api_keys"`
}

// UpdateFlowConfigRequestItem is one item in a bulk update request.
type UpdateFlowConfigRequestItem struct {
	FlowKey         string     `json:"flow_key" binding:"required"`
	ModelID         string     `json:"model_id" binding:"required"`
	APIKeyID        *uuid.UUID `json:"api_key_id"`
	Temperature     float64    `json:"temperature"`
	FallbackModelID *string    `json:"fallback_model_id"`
}

// UpdateFlowConfigsRequest is the payload for PUT /settings/ai-flows.
type UpdateFlowConfigsRequest struct {
	Flows []UpdateFlowConfigRequestItem `json:"flows" binding:"required"`
}

// CreateAPIKeyRequest is the payload for POST /settings/api-keys.
type CreateAPIKeyRequest struct {
	Provider  string `json:"provider" binding:"required"`
	Label     string `json:"label" binding:"required"`
	KeySecret string `json:"key_secret" binding:"required"`
	IsDefault bool   `json:"is_default"`
}

// UpdateAPIKeyRequest is the payload for PUT /settings/api-keys/:id.
type UpdateAPIKeyRequest struct {
	Label     string  `json:"label" binding:"required"`
	KeySecret *string `json:"key_secret"` // Optional: only overwrites if provided and non-empty
	IsDefault bool    `json:"is_default"`
	Status    string  `json:"status"`
}

// TestPingRequest is the payload for POST /settings/test-ping.
type TestPingRequest struct {
	Provider  string     `json:"provider" binding:"required"`
	ModelID   string     `json:"model_id" binding:"required"`
	APIKeyID  *uuid.UUID `json:"api_key_id"`
	KeySecret *string    `json:"key_secret"`
}

// TestPingResponse is the result of testing connection latency.
type TestPingResponse struct {
	Success   bool   `json:"success"`
	LatencyMs int64  `json:"latency_ms"`
	Message   string `json:"message"`
}

// CreateAIModelRequest is the payload for POST /settings/models.
type CreateAIModelRequest struct {
	ID                 string `json:"id" binding:"required"`
	Provider           string `json:"provider" binding:"required"`
	DisplayName        string `json:"display_name" binding:"required"`
	ContextTokens      int    `json:"context_tokens"`
	SupportsMultimodal bool   `json:"supports_multimodal"`
	SupportsReasoning  bool   `json:"supports_reasoning"`
	IsActive           bool   `json:"is_active"`
	SortOrder          int    `json:"sort_order"`
}

// UpdateAIModelRequest is the payload for PUT /settings/models/:id.
type UpdateAIModelRequest struct {
	DisplayName        string `json:"display_name" binding:"required"`
	ContextTokens      int    `json:"context_tokens"`
	SupportsMultimodal bool   `json:"supports_multimodal"`
	SupportsReasoning  bool   `json:"supports_reasoning"`
	IsActive           bool   `json:"is_active"`
	SortOrder          int    `json:"sort_order"`
}

// TelegramSubscriber represents an active recipient of pipeline notifications.
type TelegramSubscriber struct {
	ID        uuid.UUID `json:"id" db:"id"`
	ChatID    int64     `json:"chat_id" db:"chat_id"`
	ChatType  string    `json:"chat_type" db:"chat_type"` // 'private', 'group', 'supergroup'
	Username  string    `json:"username" db:"username"`
	FirstName string    `json:"first_name" db:"first_name"`
	IsActive  bool      `json:"is_active" db:"is_active"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}
