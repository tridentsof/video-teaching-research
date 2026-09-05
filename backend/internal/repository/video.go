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

// Create inserts a new video record.
func (r *VideoRepository) Create(ctx context.Context, v *model.Video) error {
	query := `
		INSERT INTO videos (id, teacher_id, title, blob_url, duration_sec, status, error_msg, failed_step, uploaded_at, user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.db.Pool.Exec(ctx, query,
		v.ID, v.TeacherID, v.Title, v.BlobURL, v.DurationSec, v.Status, v.ErrorMsg, v.FailedStep, v.UploadedAt, v.UserID,
	)
	if err != nil {
		return fmt.Errorf("failed to insert video: %w", err)
	}
	return nil
}

// List returns all videos ordered by upload date descending.
func (r *VideoRepository) List(ctx context.Context) ([]model.Video, error) {
	query := `
		SELECT id, teacher_id, title, blob_url, duration_sec, status, error_msg, failed_step, uploaded_at, user_id
		FROM videos
		ORDER BY uploaded_at DESC
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
			&v.ID, &v.TeacherID, &v.Title, &v.BlobURL, &v.DurationSec, &v.Status, &v.ErrorMsg, &v.FailedStep, &v.UploadedAt, &v.UserID,
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
		SELECT id, teacher_id, title, blob_url, duration_sec, status, error_msg, failed_step, uploaded_at, user_id
		FROM videos
		WHERE id = $1
	`
	var v model.Video
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&v.ID, &v.TeacherID, &v.Title, &v.BlobURL, &v.DurationSec, &v.Status, &v.ErrorMsg, &v.FailedStep, &v.UploadedAt, &v.UserID,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get video: %w", err)
	}
	return &v, nil
}

// UpdateStatus updates the status and optional duration of a video.
func (r *VideoRepository) UpdateStatus(ctx context.Context, id uuid.UUID, status string, durationSec *int) error {
	query := `UPDATE videos SET status = $1, duration_sec = COALESCE($2, duration_sec) WHERE id = $3`
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
		SET status = $1, failed_step = $2, error_msg = $3, duration_sec = COALESCE($4, duration_sec)
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
		SET blob_url = $1, duration_sec = COALESCE($2, duration_sec), status = $3, error_msg = NULL, failed_step = NULL
		WHERE id = $4
	`
	_, err := r.db.Pool.Exec(ctx, query, blobURL, durationSec, status, id)
	if err != nil {
		return fmt.Errorf("failed to update video blob details: %w", err)
	}
	return nil
}
