package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/video-teaching-research/backend/internal/model"
)

// ReportRepository handles reports and report_items database operations.
type ReportRepository struct {
	db *DB
}

// NewReportRepository creates a new ReportRepository.
func NewReportRepository(db *DB) *ReportRepository {
	return &ReportRepository{db: db}
}

// CreateReport inserts a new report and its items in a single transaction.
func (r *ReportRepository) CreateReport(ctx context.Context, report *model.Report, items []model.ReportItem) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Delete any existing report for this video
	_, err = tx.Exec(ctx, `DELETE FROM reports WHERE video_id = $1`, report.VideoID)
	if err != nil {
		return fmt.Errorf("failed to delete old report: %w", err)
	}

	// Insert report
	reportQuery := `
		INSERT INTO reports (id, video_id, teacher_id, checklist_id, checklist_version, markdown_content, generated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err = tx.Exec(ctx, reportQuery,
		report.ID, report.VideoID, report.TeacherID, report.ChecklistID,
		report.ChecklistVersion, report.MarkdownContent, report.GeneratedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert report: %w", err)
	}

	// Insert report items
	itemQuery := `
		INSERT INTO report_items (
			id, report_id, checklist_item_id, checklist_section, checklist_text,
			count, avg_confidence, avg_duration_sec, occurrences, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	for _, it := range items {
		_, err = tx.Exec(ctx, itemQuery,
			it.ID, report.ID, it.ChecklistItemID, it.ChecklistSection, it.ChecklistText,
			it.Count, it.AvgConfidence, it.AvgDurationSec, it.Occurrences, it.CreatedAt,
		)
		if err != nil {
			return fmt.Errorf("failed to insert report item: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// GetByVideoID retrieves a report with its item statistics by video ID.
func (r *ReportRepository) GetByVideoID(ctx context.Context, videoID uuid.UUID) (*model.Report, error) {
	reportQuery := `
		SELECT id, video_id, teacher_id, checklist_id, checklist_version, markdown_content, generated_at
		FROM reports
		WHERE video_id = $1
	`
	var rep model.Report
	err := r.db.Pool.QueryRow(ctx, reportQuery, videoID).Scan(
		&rep.ID, &rep.VideoID, &rep.TeacherID, &rep.ChecklistID,
		&rep.ChecklistVersion, &rep.MarkdownContent, &rep.GeneratedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get report: %w", err)
	}

	// Get report items
	itemQuery := `
		SELECT id, report_id, checklist_item_id, checklist_section, checklist_text,
		       count, avg_confidence, avg_duration_sec, occurrences, created_at
		FROM report_items
		WHERE report_id = $1
		ORDER BY checklist_section, checklist_item_id
	`
	rows, err := r.db.Pool.Query(ctx, itemQuery, rep.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to get report items: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var it model.ReportItem
		if err := rows.Scan(
			&it.ID, &it.ReportID, &it.ChecklistItemID, &it.ChecklistSection, &it.ChecklistText,
			&it.Count, &it.AvgConfidence, &it.AvgDurationSec, &it.Occurrences, &it.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan report item: %w", err)
		}
		rep.Items = append(rep.Items, it)
	}

	return &rep, nil
}

// ListAllReportItems retrieves report items across all videos for Phase 6 cross-video aggregation.
func (r *ReportRepository) ListAllReportItems(ctx context.Context) ([]model.ReportItem, error) {
	query := `
		SELECT id, report_id, checklist_item_id, checklist_section, checklist_text,
		       count, avg_confidence, avg_duration_sec, occurrences, created_at
		FROM report_items
		ORDER BY report_id, checklist_section
	`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list all report items: %w", err)
	}
	defer rows.Close()

	var items []model.ReportItem
	for rows.Next() {
		var it model.ReportItem
		if err := rows.Scan(
			&it.ID, &it.ReportID, &it.ChecklistItemID, &it.ChecklistSection, &it.ChecklistText,
			&it.Count, &it.AvgConfidence, &it.AvgDurationSec, &it.Occurrences, &it.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan report item: %w", err)
		}
		items = append(items, it)
	}
	return items, nil
}

// DeleteByVideoID removes the report and its items for a video.
func (r *ReportRepository) DeleteByVideoID(ctx context.Context, videoID uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM reports WHERE video_id = $1`, videoID)
	if err != nil {
		return fmt.Errorf("failed to delete reports for video: %w", err)
	}
	return nil
}
