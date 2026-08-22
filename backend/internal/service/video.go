package service

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// VideoService handles video uploads, storage, and retrieval.
type VideoService struct {
	repo      *repository.VideoRepository
	chunkRepo *repository.ChunkRepository
	storage   BlobStorage
}

// NewVideoService creates a new VideoService.
func NewVideoService(repo *repository.VideoRepository, chunkRepo *repository.ChunkRepository, storage BlobStorage) *VideoService {
	return &VideoService{
		repo:      repo,
		chunkRepo: chunkRepo,
		storage:   storage,
	}
}

// UploadVideoRequest contains metadata for video upload.
type UploadVideoRequest struct {
	TeacherID   string
	Title       string
	Filename    string
	DurationSec *int
	Reader      io.Reader
	UserID      *uuid.UUID
}

// Upload processes and stores an uploaded video.
func (s *VideoService) Upload(ctx context.Context, req UploadVideoRequest) (*model.Video, error) {
	if req.TeacherID == "" {
		return nil, fmt.Errorf("teacher_id is required")
	}
	if req.Title == "" {
		req.Title = req.Filename
	}

	videoID := uuid.New()
	startTime := time.Now()
	ext := strings.ToLower(filepath.Ext(req.Filename))
	if ext == "" {
		ext = ".mp4"
	}

	blobPath := fmt.Sprintf("raw/%s/%s%s", req.TeacherID, videoID.String(), ext)
	blobURL, err := s.storage.Upload(ctx, blobPath, req.Reader)
	if err != nil {
		if s.chunkRepo != nil {
			now := time.Now()
			errMsg := err.Error()
			_ = s.chunkRepo.CreateJob(ctx, &model.PipelineJob{
				ID:         uuid.New(),
				VideoID:    videoID,
				Step:       "upload",
				Status:     "error",
				StartedAt:  &startTime,
				FinishedAt: &now,
				ErrorMsg:   &errMsg,
				CreatedAt:  now,
			})
		}
		return nil, fmt.Errorf("failed to store video file: %w", err)
	}

	now := time.Now()
	video := &model.Video{
		ID:          videoID,
		TeacherID:   strings.TrimSpace(req.TeacherID),
		Title:       strings.TrimSpace(req.Title),
		DurationSec: req.DurationSec,
		BlobURL:     &blobURL,
		Status:      "uploaded",
		UploadedAt:  now,
		UserID:      req.UserID,
	}

	if err := s.repo.Create(ctx, video); err != nil {
		return nil, fmt.Errorf("failed to save video record: %w", err)
	}

	// Record explicit completed upload step in pipeline_jobs
	if s.chunkRepo != nil {
		finishedTime := time.Now()
		_ = s.chunkRepo.CreateJob(ctx, &model.PipelineJob{
			ID:         uuid.New(),
			VideoID:    videoID,
			Step:       "upload",
			Status:     "completed",
			StartedAt:  &startTime,
			FinishedAt: &finishedTime,
			CreatedAt:  finishedTime,
		})
	}

	return video, nil
}

// List returns all videos.
func (s *VideoService) List(ctx context.Context) ([]model.Video, error) {
	return s.repo.List(ctx)
}

// GetByID returns a single video by ID.
func (s *VideoService) GetByID(ctx context.Context, id uuid.UUID) (*model.Video, error) {
	v, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if v == nil {
		return nil, fmt.Errorf("video not found")
	}
	return v, nil
}

// GetStorage returns the underlying blob storage.
func (s *VideoService) GetStorage() BlobStorage {
	return s.storage
}
