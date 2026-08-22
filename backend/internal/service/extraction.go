package service

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/ai"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// ExtractionService handles Phase 1: Video Understanding & Event Extraction.
type ExtractionService struct {
	rawEventRepo        *repository.RawEventRepository
	chunkRepo           *repository.ChunkRepository
	videoRepo           *repository.VideoRepository
	storage             BlobStorage
	aiVideo             ai.VideoAnalysisProvider
	maxConcurrentChunks int
}

// NewExtractionService creates a new ExtractionService.
func NewExtractionService(
	rawEventRepo *repository.RawEventRepository,
	chunkRepo *repository.ChunkRepository,
	videoRepo *repository.VideoRepository,
	storage BlobStorage,
	aiVideo ai.VideoAnalysisProvider,
	maxConcurrentChunks int,
) *ExtractionService {
	if maxConcurrentChunks <= 0 {
		maxConcurrentChunks = 3
	}
	return &ExtractionService{
		rawEventRepo:        rawEventRepo,
		chunkRepo:           chunkRepo,
		videoRepo:           videoRepo,
		storage:             storage,
		aiVideo:             aiVideo,
		maxConcurrentChunks: maxConcurrentChunks,
	}
}

// RawEventJSONItem represents a single parsed item from Gemini output.
type RawEventJSONItem struct {
	TimestampSec float64 `json:"timestamp_sec"`
	EventType    string  `json:"event_type"`
	EventKey     string  `json:"event_key"`
	Description  string  `json:"description"`
	Confidence   float64 `json:"confidence"`
	DurationSec  float64 `json:"duration_sec"`
}

// ExtractEventsForVideo processes all chunks (if present) or the full raw video directly, and stores raw events.
func (s *ExtractionService) ExtractEventsForVideo(ctx context.Context, videoID uuid.UUID) ([]model.RawEvent, error) {
	video, err := s.videoRepo.GetByID(ctx, videoID)
	if err != nil {
		return nil, fmt.Errorf("failed to get video: %w", err)
	}
	if video == nil {
		return nil, fmt.Errorf("video not found: %s", videoID)
	}

	chunks, err := s.chunkRepo.ListByVideoID(ctx, videoID)
	if err != nil {
		return nil, fmt.Errorf("failed to list chunks: %w", err)
	}

	// Create pipeline job tracking
	jobID := uuid.New()
	startTime := time.Now()
	job := &model.PipelineJob{
		ID:        jobID,
		VideoID:   videoID,
		Step:      "event_extraction",
		Status:    "running",
		StartedAt: &startTime,
		CreatedAt: startTime,
	}
	_ = s.chunkRepo.CreateJob(ctx, job)
	_ = s.videoRepo.UpdateStatus(ctx, videoID, "extracting", nil)

	// Clean up any previously extracted events for re-runs
	_ = s.rawEventRepo.DeleteByVideoID(ctx, videoID)

	var allEvents []model.RawEvent

	// If no chunks were created, analyze the raw video directly (without chunking)
	if len(chunks) == 0 {
		log.Printf("No chunks present for video %s — extracting directly from original full video", videoID)
		events, err := s.processRawVideo(ctx, video)
		if err != nil {
			errMsg := fmt.Sprintf("direct raw video extraction failed: %v", err)
			_ = s.chunkRepo.UpdateJob(ctx, jobID, "error", &errMsg)
			_ = s.videoRepo.UpdateStatus(ctx, videoID, "error", nil)
			return nil, fmt.Errorf("%s", errMsg)
		}
		allEvents = events
	} else {
		// Process chunks concurrently with worker pool
		sem := make(chan struct{}, s.maxConcurrentChunks)
		var wg sync.WaitGroup
		var mu sync.Mutex
		var extractionErrors []error

		for _, ch := range chunks {
			wg.Add(1)
			go func(chunk model.VideoChunk) {
				defer wg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()

				events, err := s.processChunk(ctx, video, chunk)
				mu.Lock()
				defer mu.Unlock()
				if err != nil {
					log.Printf("Error extracting chunk %d (%s): %v", chunk.ChunkIndex, chunk.ID, err)
					extractionErrors = append(extractionErrors, fmt.Errorf("chunk %d error: %w", chunk.ChunkIndex, err))
				} else {
					allEvents = append(allEvents, events...)
				}
			}(ch)
		}

		wg.Wait()

		if len(extractionErrors) > 0 {
			errMsg := fmt.Sprintf("%d chunks failed during extraction: %v", len(extractionErrors), extractionErrors[0])
			_ = s.chunkRepo.UpdateJob(ctx, jobID, "error", &errMsg)
			_ = s.videoRepo.UpdateStatus(ctx, videoID, "error", nil)
			return nil, fmt.Errorf("%s", errMsg)
		}
	}

	_ = s.videoRepo.UpdateStatus(ctx, videoID, "extracted", nil)
	_ = s.chunkRepo.UpdateJob(ctx, jobID, "completed", nil)

	log.Printf("Successfully extracted %d raw events for video %s", len(allEvents), videoID)
	return allEvents, nil
}

// processRawVideo downloads the raw video file directly from storage and analyzes it in one pass with Gemini.
func (s *ExtractionService) processRawVideo(ctx context.Context, video *model.Video) ([]model.RawEvent, error) {
	if video.BlobURL == nil || *video.BlobURL == "" {
		return nil, fmt.Errorf("video blob_url is missing")
	}

	tempDir, err := os.MkdirTemp("", fmt.Sprintf("extract-raw-%s-*", video.ID.String()))
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tempDir)

	blobPath := extractBlobPath(video.BlobURL, video.TeacherID, video.ID)
	reader, err := s.storage.Download(ctx, blobPath)
	if err != nil {
		return nil, fmt.Errorf("failed to download raw video %s: %w", blobPath, err)
	}
	defer reader.Close()

	localVideoPath := filepath.Join(tempDir, "video.mp4")
	localFile, err := os.Create(localVideoPath)
	if err != nil {
		return nil, err
	}
	if _, err := io.Copy(localFile, reader); err != nil {
		localFile.Close()
		return nil, err
	}
	localFile.Close()

	// Call Gemini Video Analysis on full video
	rawOutput, err := s.aiVideo.AnalyzeVideoChunk(ctx, localVideoPath, VideoEventExtractionPrompt)
	if err != nil {
		return nil, fmt.Errorf("gemini analysis on raw video failed: %w", err)
	}

	// Parse JSON
	var items []RawEventJSONItem
	if err := ai.UnmarshalJSONFlexible(rawOutput, &items); err != nil {
		return nil, fmt.Errorf("failed to parse gemini event json: %w (raw: %s)", err, rawOutput)
	}

	var events []model.RawEvent
	now := time.Now()

	for _, item := range items {
		confidence := item.Confidence
		duration := item.DurationSec

		events = append(events, model.RawEvent{
			ID:           uuid.New(),
			VideoID:      video.ID,
			TeacherID:    video.TeacherID,
			ChunkID:      nil, // Direct raw video mode
			TimestampSec: item.TimestampSec,
			EventType:    item.EventType,
			EventKey:     item.EventKey,
			Description:  item.Description,
			Confidence:   &confidence,
			DurationSec:  &duration,
			CreatedAt:    now,
		})
	}

	if err := s.rawEventRepo.CreateBatch(ctx, events); err != nil {
		return nil, fmt.Errorf("failed to store raw events in db: %w", err)
	}

	return events, nil
}

// processChunk downloads, sends to Gemini, parses and saves events for one chunk.
func (s *ExtractionService) processChunk(ctx context.Context, video *model.Video, chunk model.VideoChunk) ([]model.RawEvent, error) {
	if chunk.BlobPath == nil {
		return nil, fmt.Errorf("chunk blob_path is nil")
	}

	tempDir, err := os.MkdirTemp("", fmt.Sprintf("extract-chunk-%s-*", chunk.ID.String()))
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(tempDir)

	// Download chunk
	reader, err := s.storage.Download(ctx, *chunk.BlobPath)
	if err != nil {
		return nil, fmt.Errorf("failed to download chunk %s: %w", *chunk.BlobPath, err)
	}
	defer reader.Close()

	localChunkPath := filepath.Join(tempDir, "chunk.mp4")
	localFile, err := os.Create(localChunkPath)
	if err != nil {
		return nil, err
	}
	if _, err := io.Copy(localFile, reader); err != nil {
		localFile.Close()
		return nil, err
	}
	localFile.Close()

	// Call Gemini Video Analysis
	rawOutput, err := s.aiVideo.AnalyzeVideoChunk(ctx, localChunkPath, VideoEventExtractionPrompt)
	if err != nil {
		_ = s.chunkRepo.UpdateChunkStatus(ctx, chunk.ID, "error", nil)
		return nil, fmt.Errorf("gemini analysis failed: %w", err)
	}

	// Persist raw Gemini output in chunk record for audit and re-parsing
	_ = s.chunkRepo.UpdateChunkStatus(ctx, chunk.ID, "processed", &rawOutput)

	// Parse JSON
	var items []RawEventJSONItem
	if err := ai.UnmarshalJSONFlexible(rawOutput, &items); err != nil {
		return nil, fmt.Errorf("failed to parse gemini event json: %w (raw: %s)", err, rawOutput)
	}

	var events []model.RawEvent
	chunkID := chunk.ID
	now := time.Now()

	for _, item := range items {
		// Calculate global video timestamp: chunk start offset + item relative seconds
		globalTimestamp := float64(chunk.ChunkStartSec) + item.TimestampSec
		confidence := item.Confidence
		duration := item.DurationSec

		events = append(events, model.RawEvent{
			ID:           uuid.New(),
			VideoID:      video.ID,
			TeacherID:    video.TeacherID,
			ChunkID:      &chunkID,
			TimestampSec: globalTimestamp,
			EventType:    item.EventType,
			EventKey:     item.EventKey,
			Description:  item.Description,
			Confidence:   &confidence,
			DurationSec:  &duration,
			CreatedAt:    now,
		})
	}

	if err := s.rawEventRepo.CreateBatch(ctx, events); err != nil {
		return nil, fmt.Errorf("failed to store raw events in db: %w", err)
	}

	return events, nil
}
