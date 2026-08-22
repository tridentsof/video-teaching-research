package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/video-teaching-research/backend/internal/model"
)

// MappingRepository handles event_mappings database operations.
type MappingRepository struct {
	db *DB
}

// NewMappingRepository creates a new MappingRepository.
func NewMappingRepository(db *DB) *MappingRepository {
	return &MappingRepository{db: db}
}

// CreateBatch inserts a batch of event_mapping records.
func (r *MappingRepository) CreateBatch(ctx context.Context, mappings []model.EventMapping) error {
	if len(mappings) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	query := `
		INSERT INTO event_mappings (
			id, raw_event_id, checklist_item_id, match_score, match_method, matched_by_model, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	for _, m := range mappings {
		batch.Queue(query,
			m.ID, m.RawEventID, m.ChecklistItemID, m.MatchScore, m.MatchMethod, m.MatchedByModel, m.CreatedAt,
		)
	}

	br := r.db.Pool.SendBatch(ctx, batch)
	defer br.Close()

	for range mappings {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("failed to batch insert event mapping: %w", err)
		}
	}

	return nil
}

// EventMappingDetail joins mapping with raw event and checklist item for UI audit view.
type EventMappingDetail struct {
	MappingID        uuid.UUID `json:"mapping_id"`
	RawEventID      uuid.UUID `json:"raw_event_id"`
	TimestampSec     float64   `json:"timestamp_sec"`
	EventType        string    `json:"event_type"`
	EventKey         string    `json:"event_key"`
	EventDescription string    `json:"event_description"`
	Confidence       *float64  `json:"confidence"`
	DurationSec      *float64  `json:"duration_sec"`
	ChecklistItemID  uuid.UUID `json:"checklist_item_id"`
	ChecklistSection string    `json:"checklist_section"`
	ChecklistText    string    `json:"checklist_text"`
	MatchScore       float64   `json:"match_score"`
	MatchMethod      string    `json:"match_method"`
	MatchedByModel   *string   `json:"matched_by_model"`
}

// ListDetailsByVideoID retrieves all mappings with joined event and checklist item details for a video.
func (r *MappingRepository) ListDetailsByVideoID(ctx context.Context, videoID uuid.UUID) ([]EventMappingDetail, error) {
	query := `
		SELECT
			em.id, em.raw_event_id, re.timestamp_sec, re.event_type, re.event_key, re.description,
			re.confidence, re.duration_sec, em.checklist_item_id, ci.section, ci.text,
			em.match_score, em.match_method, em.matched_by_model
		FROM event_mappings em
		JOIN raw_events re ON em.raw_event_id = re.id
		JOIN checklist_items ci ON em.checklist_item_id = ci.id
		WHERE re.video_id = $1 AND re.is_duplicate_of IS NULL
		ORDER BY re.timestamp_sec ASC
	`
	rows, err := r.db.Pool.Query(ctx, query, videoID)
	if err != nil {
		return nil, fmt.Errorf("failed to list mapping details: %w", err)
	}
	defer rows.Close()

	var details []EventMappingDetail
	for rows.Next() {
		var d EventMappingDetail
		if err := rows.Scan(
			&d.MappingID, &d.RawEventID, &d.TimestampSec, &d.EventType, &d.EventKey, &d.EventDescription,
			&d.Confidence, &d.DurationSec, &d.ChecklistItemID, &d.ChecklistSection, &d.ChecklistText,
			&d.MatchScore, &d.MatchMethod, &d.MatchedByModel,
		); err != nil {
			return nil, fmt.Errorf("failed to scan mapping detail: %w", err)
		}
		details = append(details, d)
	}
	return details, nil
}

// DeleteByVideoID deletes all mappings for events belonging to a video.
func (r *MappingRepository) DeleteByVideoID(ctx context.Context, videoID uuid.UUID) error {
	query := `
		DELETE FROM event_mappings
		WHERE raw_event_id IN (
			SELECT id FROM raw_events WHERE video_id = $1
		)
	`
	_, err := r.db.Pool.Exec(ctx, query, videoID)
	if err != nil {
		return fmt.Errorf("failed to delete video mappings: %w", err)
	}
	return nil
}
