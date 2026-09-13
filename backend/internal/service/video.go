package service

import (
	"context"
	"fmt"
	"io"
	"log"
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
	FileSize    *int64
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
	uploadJobID := uuid.New()
	startTime := time.Now()
	ext := strings.ToLower(filepath.Ext(req.Filename))
	if ext == "" {
		ext = ".mp4"
	}

	// 1. Pre-create video in database with status 'uploading'
	video := &model.Video{
		ID:          videoID,
		TeacherID:   strings.TrimSpace(req.TeacherID),
		Title:       strings.TrimSpace(req.Title),
		DurationSec: req.DurationSec,
		FileSize:    req.FileSize,
		BlobURL:     nil,
		Status:      "uploading",
		UploadedAt:  startTime,
		UpdatedAt:   startTime,
		UserID:      req.UserID,
	}

	if err := s.repo.Create(ctx, video); err != nil {
		return nil, fmt.Errorf("failed to initialize video record in database: %w", err)
	}

	// 2. Pre-create upload pipeline job with status 'running'
	if s.chunkRepo != nil {
		_ = s.chunkRepo.CreateJob(ctx, &model.PipelineJob{
			ID:        uploadJobID,
			VideoID:   videoID,
			Step:      "upload",
			Status:    "running",
			StartedAt: &startTime,
			CreatedAt: startTime,
		})
	}

	// 3. Stream upload file to blob storage
	blobPath := fmt.Sprintf("raw/%s/%s%s", req.TeacherID, videoID.String(), ext)
	blobURL, err := s.storage.Upload(ctx, blobPath, req.Reader)
	if err != nil {
		errMsg := err.Error()
		failedStep := "upload"
		dbCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		defer cancel()
		_ = s.repo.UpdateStatusWithError(dbCtx, videoID, "failed", &failedStep, &errMsg, nil)
		if s.chunkRepo != nil {
			_ = s.chunkRepo.UpdateJob(dbCtx, uploadJobID, "failed", &errMsg)
		}
		return nil, fmt.Errorf("failed to store video file: %w", err)
	}

	// 4. Update video and job records on successful upload
	dbCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := s.repo.UpdateBlobDetails(dbCtx, videoID, blobURL, req.DurationSec, "uploaded"); err != nil {
		errMsg := err.Error()
		failedStep := "upload"
		_ = s.repo.UpdateStatusWithError(dbCtx, videoID, "failed", &failedStep, &errMsg, nil)
		if s.chunkRepo != nil {
			_ = s.chunkRepo.UpdateJob(dbCtx, uploadJobID, "failed", &errMsg)
		}
		return nil, fmt.Errorf("failed to finalize video record: %w", err)
	}

	if s.chunkRepo != nil {
		_ = s.chunkRepo.UpdateJob(dbCtx, uploadJobID, "completed", nil)
	}

	video.BlobURL = &blobURL
	video.Status = "uploaded"
	return video, nil
}

// List returns all videos.
func (s *VideoService) List(ctx context.Context) ([]model.Video, error) {
	_ = s.repo.CleanStuckUploadingVideos(ctx)
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

// UpdateMetadata updates the teacher_id and title of an existing video.
func (s *VideoService) UpdateMetadata(ctx context.Context, id uuid.UUID, teacherID, title string) (*model.Video, error) {
	teacherID = strings.TrimSpace(teacherID)
	title = strings.TrimSpace(title)
	if teacherID == "" {
		return nil, fmt.Errorf("teacher_id is required")
	}

	video, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if video == nil {
		return nil, fmt.Errorf("video not found")
	}

	runningStatuses := map[string]bool{
		"uploading":         true,
		"chunking":          true,
		"extracting":        true,
		"merging":           true,
		"mapping":           true,
		"statistics":        true,
		"report_generating": true,
	}
	if runningStatuses[video.Status] {
		return nil, fmt.Errorf("cannot update video metadata while pipeline is actively processing (current status: %s)", video.Status)
	}

	if err := s.repo.UpdateMetadata(ctx, id, teacherID, title); err != nil {
		return nil, fmt.Errorf("failed to update video: %w", err)
	}

	return s.repo.GetByID(ctx, id)
}

// Delete removes a video and all associated data (chunks, events, mappings, reports, codebook).
// Also cleans up blob storage files for the video and its chunks.
func (s *VideoService) Delete(ctx context.Context, id uuid.UUID) error {
	video, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if video == nil {
		return fmt.Errorf("video not found")
	}

	// Block deletion while pipeline is actively processing
	runningStatuses := map[string]bool{
		"uploading":         true,
		"chunking":          true,
		"extracting":        true,
		"merging":           true,
		"mapping":           true,
		"statistics":        true,
		"report_generating": true,
	}
	if runningStatuses[video.Status] {
		return fmt.Errorf("cannot delete video while pipeline is actively processing (current status: %s)", video.Status)
	}

	// 1. Clean up chunk blob files
	if s.chunkRepo != nil {
		chunks, err := s.chunkRepo.ListByVideoID(ctx, id)
		if err == nil {
			for _, chunk := range chunks {
				if chunk.BlobPath != nil && *chunk.BlobPath != "" {
					if delErr := s.storage.Delete(ctx, *chunk.BlobPath); delErr != nil {
						log.Printf("[VideoService.Delete] Warning: failed to delete chunk blob %s: %v", *chunk.BlobPath, delErr)
					}
				}
			}
		}
	}

	// 2. Clean up raw video blob file
	blobPath := extractBlobPath(video.BlobURL, video.TeacherID, video.ID)
	if blobPath != "" {
		if delErr := s.storage.Delete(ctx, blobPath); delErr != nil {
			log.Printf("[VideoService.Delete] Warning: failed to delete video blob %s: %v", blobPath, delErr)
		}
	}

	// 3. Delete video from DB (CASCADE handles child records)
	if err := s.repo.Delete(ctx, id); err != nil {
		return fmt.Errorf("failed to delete video: %w", err)
	}

	log.Printf("[VideoService.Delete] Video %s and all associated data deleted successfully", id)
	return nil
}

