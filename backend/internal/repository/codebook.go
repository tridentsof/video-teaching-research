package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
)

// CodebookRepository handles codebook_entries database operations.
type CodebookRepository struct {
	db *DB
}

// NewCodebookRepository creates a new CodebookRepository.
func NewCodebookRepository(db *DB) *CodebookRepository {
	return &CodebookRepository{db: db}
}

// GetByVideoID returns all codebook entries for a given video, ordered by sort_order.
func (r *CodebookRepository) GetByVideoID(ctx context.Context, videoID uuid.UUID) ([]model.CodebookEntry, error) {
	query := `
		SELECT id, video_id, code, definition, inclusion_criteria, exclusion_criteria,
		       example, category, theme, sort_order, created_at, updated_at
		FROM codebook_entries
		WHERE video_id = $1
		ORDER BY sort_order, created_at
	`
	rows, err := r.db.Pool.Query(ctx, query, videoID)
	if err != nil {
		return nil, fmt.Errorf("failed to query codebook entries: %w", err)
	}
	defer rows.Close()

	var entries []model.CodebookEntry
	for rows.Next() {
		var e model.CodebookEntry
		if err := rows.Scan(
			&e.ID, &e.VideoID, &e.Code, &e.Definition, &e.InclusionCriteria, &e.ExclusionCriteria,
			&e.Example, &e.Category, &e.Theme, &e.SortOrder, &e.CreatedAt, &e.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan codebook entry: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, nil
}

// GetByVideoIDs returns codebook entries for multiple video IDs.
func (r *CodebookRepository) GetByVideoIDs(ctx context.Context, videoIDs []uuid.UUID) ([]model.CodebookEntry, error) {
	if len(videoIDs) == 0 {
		return []model.CodebookEntry{}, nil
	}
	query := `
		SELECT id, video_id, code, definition, inclusion_criteria, exclusion_criteria,
		       example, category, theme, sort_order, created_at, updated_at
		FROM codebook_entries
		WHERE video_id = ANY($1)
		ORDER BY video_id, sort_order, created_at
	`
	rows, err := r.db.Pool.Query(ctx, query, videoIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to query codebook entries: %w", err)
	}
	defer rows.Close()

	var entries []model.CodebookEntry
	for rows.Next() {
		var e model.CodebookEntry
		if err := rows.Scan(
			&e.ID, &e.VideoID, &e.Code, &e.Definition, &e.InclusionCriteria, &e.ExclusionCriteria,
			&e.Example, &e.Category, &e.Theme, &e.SortOrder, &e.CreatedAt, &e.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan codebook entry: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, nil
}

// ReplaceByVideoID replaces all codebook entries for a video in a single transaction.
func (r *CodebookRepository) ReplaceByVideoID(ctx context.Context, videoID uuid.UUID, entries []model.CodebookEntry) ([]model.CodebookEntry, error) {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Delete existing entries
	if _, err := tx.Exec(ctx, `DELETE FROM codebook_entries WHERE video_id = $1`, videoID); err != nil {
		return nil, fmt.Errorf("failed to delete existing codebook entries: %w", err)
	}

	now := time.Now()
	var result []model.CodebookEntry
	for i, e := range entries {
		id := uuid.New()
		_, err := tx.Exec(ctx,
			`INSERT INTO codebook_entries
			 (id, video_id, code, definition, inclusion_criteria, exclusion_criteria,
			  example, category, theme, sort_order, created_at, updated_at)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
			id, videoID, e.Code, e.Definition, e.InclusionCriteria, e.ExclusionCriteria,
			e.Example, e.Category, e.Theme, i, now, now,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to insert codebook entry: %w", err)
		}
		e.ID = id
		e.VideoID = videoID
		e.SortOrder = i
		e.CreatedAt = now
		e.UpdatedAt = now
		result = append(result, e)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}
	return result, nil
}

// DeleteByVideoID removes all codebook entries for a given video.
func (r *CodebookRepository) DeleteByVideoID(ctx context.Context, videoID uuid.UUID) error {
	query := `DELETE FROM codebook_entries WHERE video_id = $1`
	_, err := r.db.Pool.Exec(ctx, query, videoID)
	if err != nil {
		return fmt.Errorf("failed to delete codebook entries: %w", err)
	}
	return nil
}

