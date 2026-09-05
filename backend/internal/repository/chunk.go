package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
)

// ChunkRepository handles video_chunks and pipeline_jobs database operations.
type ChunkRepository struct {
	db *DB
}

// NewChunkRepository creates a new ChunkRepository.
func NewChunkRepository(db *DB) *ChunkRepository {
	return &ChunkRepository{db: db}
}

// CreateChunk inserts a new video_chunk record.
func (r *ChunkRepository) CreateChunk(ctx context.Context, c *model.VideoChunk) error {
	query := `
		INSERT INTO video_chunks (
			id, video_id, chunk_index, chunk_start_sec, chunk_end_sec,
			blob_path, status, gemini_raw_output, processed_at, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.db.Pool.Exec(ctx, query,
		c.ID, c.VideoID, c.ChunkIndex, c.ChunkStartSec, c.ChunkEndSec,
		c.BlobPath, c.Status, c.GeminiRawOutput, c.ProcessedAt, c.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create video chunk: %w", err)
	}
	return nil
}

// ListByVideoID returns all chunks for a given video, ordered by chunk_index.
func (r *ChunkRepository) ListByVideoID(ctx context.Context, videoID uuid.UUID) ([]model.VideoChunk, error) {
	query := `
		SELECT id, video_id, chunk_index, chunk_start_sec, chunk_end_sec,
		       blob_path, status, gemini_raw_output, processed_at, created_at
		FROM video_chunks
		WHERE video_id = $1
		ORDER BY chunk_index ASC
	`
	rows, err := r.db.Pool.Query(ctx, query, videoID)
	if err != nil {
		return nil, fmt.Errorf("failed to list video chunks: %w", err)
	}
	defer rows.Close()

	var chunks []model.VideoChunk
	for rows.Next() {
		var c model.VideoChunk
		if err := rows.Scan(
			&c.ID, &c.VideoID, &c.ChunkIndex, &c.ChunkStartSec, &c.ChunkEndSec,
			&c.BlobPath, &c.Status, &c.GeminiRawOutput, &c.ProcessedAt, &c.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan video chunk: %w", err)
		}
		chunks = append(chunks, c)
	}
	return chunks, nil
}

// UpdateChunkStatus updates status and optional gemini raw output.
func (r *ChunkRepository) UpdateChunkStatus(ctx context.Context, chunkID uuid.UUID, status string, rawOutput *string) error {
	now := time.Now()
	query := `
		UPDATE video_chunks
		SET status = $1, gemini_raw_output = COALESCE($2, gemini_raw_output), processed_at = $3
		WHERE id = $4
	`
	_, err := r.db.Pool.Exec(ctx, query, status, rawOutput, now, chunkID)
	if err != nil {
		return fmt.Errorf("failed to update chunk status: %w", err)
	}
	return nil
}

// DeleteByVideoID removes existing chunks for a video (e.g. for re-chunking).
func (r *ChunkRepository) DeleteByVideoID(ctx context.Context, videoID uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM video_chunks WHERE video_id = $1`, videoID)
	if err != nil {
		return fmt.Errorf("failed to delete video chunks: %w", err)
	}
	return nil
}

// CreateJob creates a pipeline_job tracking record.
func (r *ChunkRepository) CreateJob(ctx context.Context, job *model.PipelineJob) error {
	query := `
		INSERT INTO pipeline_jobs (id, video_id, step, status, started_at, finished_at, error_msg, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	_, err := r.db.Pool.Exec(ctx, query,
		job.ID, job.VideoID, job.Step, job.Status, job.StartedAt, job.FinishedAt, job.ErrorMsg, job.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create pipeline job: %w", err)
	}
	return nil
}

// UpdateJob updates the status of a pipeline job.
func (r *ChunkRepository) UpdateJob(ctx context.Context, id uuid.UUID, status string, errorMsg *string) error {
	var finishedAt *time.Time
	if status == "completed" || status == "error" || status == "failed" || status == "cancelled" || status == "skipped" {
		now := time.Now()
		finishedAt = &now
	}

	query := `
		UPDATE pipeline_jobs
		SET status = $1, error_msg = $2, finished_at = COALESCE($3, finished_at)
		WHERE id = $4
	`
	_, err := r.db.Pool.Exec(ctx, query, status, errorMsg, finishedAt, id)
	if err != nil {
		return fmt.Errorf("failed to update pipeline job: %w", err)
	}
	return nil
}

// CancelRunningJobs marks any in-progress pipeline jobs for a video as cancelled.
func (r *ChunkRepository) CancelRunningJobs(ctx context.Context, videoID uuid.UUID) error {
	query := `
		UPDATE pipeline_jobs
		SET status = 'cancelled', finished_at = NOW()
		WHERE video_id = $1 AND status = 'running'
	`
	_, err := r.db.Pool.Exec(ctx, query, videoID)
	if err != nil {
		return fmt.Errorf("failed to cancel running pipeline jobs: %w", err)
	}
	return nil
}

// GetLatestJobsByVideoID returns the latest pipeline status for each step of a video.
func (r *ChunkRepository) GetLatestJobsByVideoID(ctx context.Context, videoID uuid.UUID) ([]model.PipelineJob, error) {
	query := `
		SELECT DISTINCT ON (step) id, video_id, step, status, started_at, finished_at, error_msg, created_at
		FROM pipeline_jobs
		WHERE video_id = $1
		ORDER BY step, created_at DESC
	`
	rows, err := r.db.Pool.Query(ctx, query, videoID)
	if err != nil {
		return nil, fmt.Errorf("failed to get pipeline jobs: %w", err)
	}
	defer rows.Close()

	var jobs []model.PipelineJob
	for rows.Next() {
		var j model.PipelineJob
		if err := rows.Scan(
			&j.ID, &j.VideoID, &j.Step, &j.Status, &j.StartedAt, &j.FinishedAt, &j.ErrorMsg, &j.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan pipeline job: %w", err)
		}
		jobs = append(jobs, j)
	}
	return jobs, nil
}
