package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/video-teaching-research/backend/internal/model"
)

// RawEventRepository handles raw_events database queries and mutations.
type RawEventRepository struct {
	db *DB
}

// NewRawEventRepository creates a new RawEventRepository.
func NewRawEventRepository(db *DB) *RawEventRepository {
	return &RawEventRepository{db: db}
}

// CreateBatch inserts multiple raw events in a single batch.
func (r *RawEventRepository) CreateBatch(ctx context.Context, events []model.RawEvent) error {
	if len(events) == 0 {
		return nil
	}

	batch := &pgx.Batch{}
	query := `
		INSERT INTO raw_events (
			id, video_id, teacher_id, chunk_id, timestamp_sec,
			event_type, event_key, code, quote, description, confidence, duration_sec,
			is_duplicate_of, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`
	for _, e := range events {
		batch.Queue(query,
			e.ID, e.VideoID, e.TeacherID, e.ChunkID, e.TimestampSec,
			e.EventType, e.EventKey, e.Code, e.Quote, e.Description, e.Confidence, e.DurationSec,
			e.IsDuplicateOf, e.CreatedAt,
		)
	}

	br := r.db.Pool.SendBatch(ctx, batch)
	defer br.Close()

	for range events {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("failed to batch insert raw event: %w", err)
		}
	}

	return nil
}

// ListByVideoID returns all raw events for a video, optionally excluding duplicates.
func (r *RawEventRepository) ListByVideoID(ctx context.Context, videoID uuid.UUID, excludeDuplicates bool) ([]model.RawEvent, error) {
	query := `
		SELECT id, video_id, teacher_id, chunk_id, timestamp_sec,
		       event_type, event_key, code, quote, description, confidence, duration_sec,
		       is_duplicate_of, created_at
		FROM raw_events
		WHERE video_id = $1
	`
	if excludeDuplicates {
		query += ` AND is_duplicate_of IS NULL`
	}
	query += ` ORDER BY timestamp_sec ASC`

	rows, err := r.db.Pool.Query(ctx, query, videoID)
	if err != nil {
		return nil, fmt.Errorf("failed to list raw events: %w", err)
	}
	defer rows.Close()

	var events []model.RawEvent
	for rows.Next() {
		var e model.RawEvent
		if err := rows.Scan(
			&e.ID, &e.VideoID, &e.TeacherID, &e.ChunkID, &e.TimestampSec,
			&e.EventType, &e.EventKey, &e.Code, &e.Quote, &e.Description, &e.Confidence, &e.DurationSec,
			&e.IsDuplicateOf, &e.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan raw event: %w", err)
		}
		events = append(events, e)
	}
	return events, nil
}

// MarkDuplicate flags an event as duplicate of another event.
func (r *RawEventRepository) MarkDuplicate(ctx context.Context, duplicateID, originalID uuid.UUID) error {
	query := `UPDATE raw_events SET is_duplicate_of = $1 WHERE id = $2`
	_, err := r.db.Pool.Exec(ctx, query, originalID, duplicateID)
	if err != nil {
		return fmt.Errorf("failed to mark duplicate: %w", err)
	}
	return nil
}

// DeleteByVideoID removes all raw events for a video.
func (r *RawEventRepository) DeleteByVideoID(ctx context.Context, videoID uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM raw_events WHERE video_id = $1`, videoID)
	if err != nil {
		return fmt.Errorf("failed to delete raw events: %w", err)
	}
	return nil
}

// DeleteByChunkID removes all raw events for a specific chunk.
func (r *RawEventRepository) DeleteByChunkID(ctx context.Context, chunkID uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM raw_events WHERE chunk_id = $1`, chunkID)
	if err != nil {
		return fmt.Errorf("failed to delete raw events for chunk %s: %w", chunkID, err)
	}
	return nil
}

// DeleteOrphanRawEventsByVideoID removes all raw events where chunk_id IS NULL for a video (e.g. from full mode).
func (r *RawEventRepository) DeleteOrphanRawEventsByVideoID(ctx context.Context, videoID uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM raw_events WHERE video_id = $1 AND chunk_id IS NULL`, videoID)
	if err != nil {
		return fmt.Errorf("failed to delete orphan raw events for video %s: %w", videoID, err)
	}
	return nil
}

// ResetDuplicatesByVideoID clears all is_duplicate_of markers for a video.
func (r *RawEventRepository) ResetDuplicatesByVideoID(ctx context.Context, videoID uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `UPDATE raw_events SET is_duplicate_of = NULL WHERE video_id = $1`, videoID)
	if err != nil {
		return fmt.Errorf("failed to reset duplicates for video %s: %w", videoID, err)
	}
	return nil
}


