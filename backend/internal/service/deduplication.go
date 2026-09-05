package service

import (
	"context"
	"fmt"
	"log"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// DeduplicationService handles merging and deduplication of overlapping raw events across chunk boundaries.
type DeduplicationService struct {
	rawEventRepo *repository.RawEventRepository
	chunkRepo    *repository.ChunkRepository
	videoRepo    *repository.VideoRepository
	toleranceSec float64 // default 5.0s
}

// NewDeduplicationService creates a new DeduplicationService.
func NewDeduplicationService(
	rawEventRepo *repository.RawEventRepository,
	chunkRepo *repository.ChunkRepository,
	videoRepo *repository.VideoRepository,
	toleranceSec float64,
) *DeduplicationService {
	if toleranceSec <= 0 {
		toleranceSec = 5.0 // 5 seconds timestamp tolerance
	}
	return &DeduplicationService{
		rawEventRepo: rawEventRepo,
		chunkRepo:    chunkRepo,
		videoRepo:    videoRepo,
		toleranceSec: toleranceSec,
	}
}

// DeduplicateEvents identifies duplicates in memory given an event slice.
func (s *DeduplicationService) DeduplicateEvents(events []model.RawEvent) ([]model.RawEvent, map[uuid.UUID]uuid.UUID) {
	// Map from duplicate event ID -> original event ID
	duplicates := make(map[uuid.UUID]uuid.UUID)

	n := len(events)
	for i := 0; i < n; i++ {
		if events[i].IsDuplicateOf != nil {
			continue
		}

		for j := i + 1; j < n; j++ {
			if events[j].IsDuplicateOf != nil {
				continue
			}

			// Since sorted by timestamp, if delta exceeds tolerance, break
			delta := events[j].TimestampSec - events[i].TimestampSec
			if delta > s.toleranceSec {
				break
			}

			// Check if from different chunks (overlap region)
			differentChunks := false
			if events[i].ChunkID != nil && events[j].ChunkID != nil {
				differentChunks = *events[i].ChunkID != *events[j].ChunkID
			}

			// Match criteria: same event_key or normalized equivalent
			sameKey := strings.EqualFold(strings.TrimSpace(events[i].EventKey), strings.TrimSpace(events[j].EventKey))
			sameType := strings.EqualFold(events[i].EventType, events[j].EventType)

			if differentChunks && sameKey && sameType {
				origID := events[i].ID
				events[j].IsDuplicateOf = &origID
				duplicates[events[j].ID] = origID
			}
		}
	}

	return events, duplicates
}

// MergeAndDeduplicate processes all raw events for a video and updates duplicate flags in DB.
func (s *DeduplicationService) MergeAndDeduplicate(ctx context.Context, videoID uuid.UUID) (int, error) {
	video, err := s.videoRepo.GetByID(ctx, videoID)
	if err != nil {
		return 0, fmt.Errorf("failed to get video: %w", err)
	}
	if video == nil {
		return 0, fmt.Errorf("video not found: %s", videoID)
	}

	// Create pipeline job
	jobID := uuid.New()
	startTime := time.Now()
	job := &model.PipelineJob{
		ID:        jobID,
		VideoID:   videoID,
		Step:      "event_merge",
		Status:    "running",
		StartedAt: &startTime,
		CreatedAt: startTime,
	}
	_ = s.chunkRepo.CreateJob(ctx, job)
	_ = s.videoRepo.UpdateStatus(ctx, videoID, "merging", nil)

	events, err := s.rawEventRepo.ListByVideoID(ctx, videoID, false)
	if err != nil {
		errMsg := err.Error()
		failedStep := "event_merge"
		_ = s.chunkRepo.UpdateJob(ctx, jobID, "failed", &errMsg)
		_ = s.videoRepo.UpdateStatusWithError(ctx, videoID, "failed", &failedStep, &errMsg, nil)
		return 0, fmt.Errorf("failed to fetch raw events: %w", err)
	}

	_, duplicates := s.DeduplicateEvents(events)

	for dupID, origID := range duplicates {
		if err := s.rawEventRepo.MarkDuplicate(ctx, dupID, origID); err != nil {
			log.Printf("Warning: failed to mark duplicate %s in db: %v", dupID, err)
		}
	}

	_ = s.videoRepo.UpdateStatus(ctx, videoID, "review_pending", nil)
	_ = s.chunkRepo.UpdateJob(ctx, jobID, "completed", nil)

	log.Printf("Deduplication completed for video %s: marked %d duplicate events out of %d total",
		videoID, len(duplicates), len(events))

	return len(duplicates), nil
}

// Helper to calculate absolute diff
func abs(f float64) float64 {
	return math.Abs(f)
}
