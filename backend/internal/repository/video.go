package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/video-teaching-research/backend/internal/model"
)

// VideoRepository handles video database operations.
type VideoRepository struct {
	db *DB
}

// NewVideoRepository creates a new VideoRepository.
func NewVideoRepository(db *DB) *VideoRepository {
	return &VideoRepository{db: db}
}

// EnsureColumns ensures required columns exist on videos table.
func (r *VideoRepository) EnsureColumns(ctx context.Context) error {
	query := `ALTER TABLE videos ADD COLUMN IF NOT EXISTS file_size BIGINT DEFAULT NULL;`
	_, err := r.db.Pool.Exec(ctx, query)
	return err
}

// Create inserts a new video record.
func (r *VideoRepository) Create(ctx context.Context, v *model.Video) error {
	if v.UpdatedAt.IsZero() {
		v.UpdatedAt = v.UploadedAt
	}
	query := `
		INSERT INTO videos (id, teacher_id, title, blob_url, duration_sec, file_size, status, error_msg, failed_step, uploaded_at, updated_at, user_id, processing_mode)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
	`
	_, err := r.db.Pool.Exec(ctx, query,
		v.ID, v.TeacherID, v.Title, v.BlobURL, v.DurationSec, v.FileSize, v.Status, v.ErrorMsg, v.FailedStep, v.UploadedAt, v.UpdatedAt, v.UserID, v.ProcessingMode,
	)
	if err != nil {
		return fmt.Errorf("failed to insert video: %w", err)
	}
	return nil
}

// List returns all videos ordered by updated_at descending, then uploaded_at descending.
func (r *VideoRepository) List(ctx context.Context) ([]model.Video, error) {
	query := `
		SELECT 
			v.id, v.teacher_id, v.title, v.blob_url, v.duration_sec, v.file_size, v.status, v.error_msg, v.failed_step, v.uploaded_at, v.updated_at, v.user_id, v.processing_mode,
			COALESCE(
				pj.total_sec,
				CASE 
					WHEN v.status IN ('report_generated', 'completed', 'failed', 'cancelled') AND v.updated_at > v.uploaded_at 
					THEN ROUND(EXTRACT(EPOCH FROM (v.updated_at - v.uploaded_at)))::int
					ELSE NULL 
				END
			) AS processing_time_sec
		FROM videos v
		LEFT JOIN (
			SELECT video_id, ROUND(SUM(EXTRACT(EPOCH FROM (finished_at - started_at))))::int AS total_sec
			FROM pipeline_jobs
			WHERE started_at IS NOT NULL AND finished_at IS NOT NULL AND finished_at >= started_at
			GROUP BY video_id
		) pj ON pj.video_id = v.id
		ORDER BY v.updated_at DESC, v.uploaded_at DESC
	`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list videos: %w", err)
	}
	defer rows.Close()

	var videos []model.Video
	for rows.Next() {
		var v model.Video
		if err := rows.Scan(
			&v.ID, &v.TeacherID, &v.Title, &v.BlobURL, &v.DurationSec, &v.FileSize, &v.Status, &v.ErrorMsg, &v.FailedStep, &v.UploadedAt, &v.UpdatedAt, &v.UserID, &v.ProcessingMode, &v.ProcessingTimeSec,
		); err != nil {
			return nil, fmt.Errorf("failed to scan video: %w", err)
		}
		videos = append(videos, v)
	}
	return videos, nil
}

// GetByID returns a single video by ID.
func (r *VideoRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Video, error) {
	query := `
		SELECT 
			v.id, v.teacher_id, v.title, v.blob_url, v.duration_sec, v.file_size, v.status, v.error_msg, v.failed_step, v.uploaded_at, v.updated_at, v.user_id, v.processing_mode,
			COALESCE(
				pj.total_sec,
				CASE 
					WHEN v.status IN ('report_generated', 'completed', 'failed', 'cancelled') AND v.updated_at > v.uploaded_at 
					THEN ROUND(EXTRACT(EPOCH FROM (v.updated_at - v.uploaded_at)))::int
					ELSE NULL 
				END
			) AS processing_time_sec
		FROM videos v
		LEFT JOIN (
			SELECT video_id, ROUND(SUM(EXTRACT(EPOCH FROM (finished_at - started_at))))::int AS total_sec
			FROM pipeline_jobs
			WHERE started_at IS NOT NULL AND finished_at IS NOT NULL AND finished_at >= started_at
			GROUP BY video_id
		) pj ON pj.video_id = v.id
		WHERE v.id = $1
	`
	var v model.Video
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&v.ID, &v.TeacherID, &v.Title, &v.BlobURL, &v.DurationSec, &v.FileSize, &v.Status, &v.ErrorMsg, &v.FailedStep, &v.UploadedAt, &v.UpdatedAt, &v.UserID, &v.ProcessingMode, &v.ProcessingTimeSec,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get video: %w", err)
	}
	return &v, nil
}

// UpdateProcessingMode updates the processing_mode ('chunk' or 'full') for a video.
func (r *VideoRepository) UpdateProcessingMode(ctx context.Context, id uuid.UUID, mode string) error {
	query := `UPDATE videos SET processing_mode = $1, updated_at = NOW() WHERE id = $2`
	_, err := r.db.Pool.Exec(ctx, query, mode, id)
	if err != nil {
		return fmt.Errorf("failed to update video processing mode: %w", err)
	}
	return nil
}

// UpdateStatus updates the status and optional duration of a video.
func (r *VideoRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string, durationSec *int) error {
	query := `UPDATE videos SET status = $1, duration_sec = COALESCE($2, duration_sec), updated_at = NOW() WHERE id = $3`
	_, err := r.db.Pool.Exec(ctx, query, status, durationSec, id)
	if err != nil {
		return fmt.Errorf("failed to update video status: %w", err)
	}
	return nil
}

// UpdateStatusWithError updates the video status along with failure step and error message.
func (r *VideoRepository) UpdateStatusWithError(ctx context.Context, id uuid.UUID, status string, failedStep *string, errorMsg *string, durationSec *int) error {
	query := `
		UPDATE videos
		SET status = $1, failed_step = $2, error_msg = $3, duration_sec = COALESCE($4, duration_sec), updated_at = NOW()
		WHERE id = $5
	`
	_, err := r.db.Pool.Exec(ctx, query, status, failedStep, errorMsg, durationSec, id)
	if err != nil {
		return fmt.Errorf("failed to update video status with error: %w", err)
	}
	return nil
}

// UpdateBlobDetails updates the blob_url, duration_sec, and status of a video upon successful upload.
func (r *VideoRepository) UpdateBlobDetails(ctx context.Context, id uuid.UUID, blobURL string, durationSec *int, status string) error {
	query := `
		UPDATE videos
		SET blob_url = $1, duration_sec = COALESCE($2, duration_sec), status = $3, error_msg = NULL, failed_step = NULL, updated_at = NOW()
		WHERE id = $4
	`
	_, err := r.db.Pool.Exec(ctx, query, blobURL, durationSec, status, id)
	if err != nil {
		return fmt.Errorf("failed to update video blob details: %w", err)
	}
	return nil
}

// Touch updates the updated_at timestamp of a video to the current time.
func (r *VideoRepository) Touch(ctx context.Context, id uuid.UUID) error {
	query := `UPDATE videos SET updated_at = NOW() WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to touch video updated_at: %w", err)
	}
	return nil
}

// CleanStuckUploadingVideos marks stale 'uploading' videos older than 5 minutes as failed.
func (r *VideoRepository) CleanStuckUploadingVideos(ctx context.Context) error {
	queryVideos := `
		UPDATE videos
		SET status = 'failed', failed_step = 'upload', error_msg = 'Upload timed out or was interrupted', updated_at = NOW()
		WHERE status = 'uploading' AND uploaded_at < NOW() - INTERVAL '5 minutes'
	`
	if _, err := r.db.Pool.Exec(ctx, queryVideos); err != nil {
		return err
	}

	queryJobs := `
		UPDATE pipeline_jobs
		SET status = 'failed', finished_at = NOW(), error_msg = 'Upload timed out or was interrupted'
		WHERE step = 'upload' AND status = 'running' AND created_at < NOW() - INTERVAL '5 minutes'
	`
	_, _ = r.db.Pool.Exec(ctx, queryJobs)
	return nil
}

// UpdateMetadata updates the teacher_id and title of a video and cascades teacher_id to raw_events and reports.
func (r *VideoRepository) UpdateMetadata(ctx context.Context, id uuid.UUID, teacherID string, title string) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// 1. Update video record
	queryVideo := `
		UPDATE videos
		SET teacher_id = $1, title = CASE WHEN $2 <> '' THEN $2 ELSE title END, updated_at = NOW()
		WHERE id = $3
	`
	tag, err := tx.Exec(ctx, queryVideo, teacherID, title, id)
	if err != nil {
		return fmt.Errorf("failed to update video metadata: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}

	// 2. Cascade update to raw_events
	queryEvents := `UPDATE raw_events SET teacher_id = $1 WHERE video_id = $2`
	if _, err := tx.Exec(ctx, queryEvents, teacherID, id); err != nil {
		return fmt.Errorf("failed to update raw_events teacher_id: %w", err)
	}

	// 3. Cascade update to reports
	queryReports := `UPDATE reports SET teacher_id = $1 WHERE video_id = $2`
	if _, err := tx.Exec(ctx, queryReports, teacherID, id); err != nil {
		return fmt.Errorf("failed to update reports teacher_id: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}
	return nil
}

// Delete removes a video record by ID. Returns pgx.ErrNoRows if video does not exist.
func (r *VideoRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM videos WHERE id = $1`
	tag, err := r.db.Pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete video: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return pgx.ErrNoRows
	}
	return nil
}
