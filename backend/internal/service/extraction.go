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
	aiRouter            *AIRouterService
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

// SetAIRouter attaches the dynamic AI router.
func (s *ExtractionService) SetAIRouter(router *AIRouterService) {
	s.aiRouter = router
}

// RawEventJSONItem represents a single parsed item from Gemini output.
type RawEventJSONItem struct {
	TimestampSec float64 `json:"timestamp_sec"`
	EventType    string  `json:"event_type"`
	EventKey     string  `json:"event_key"`
	Code         string  `json:"code"`
	Quote        string  `json:"quote"`
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

	var allEvents []model.RawEvent

	// If no chunks were created, analyze the raw video directly (without chunking)
	if len(chunks) == 0 {
		log.Printf("No chunks present for video %s — extracting directly from original full video", videoID)
		_ = s.rawEventRepo.DeleteByVideoID(ctx, videoID)
		events, err := s.processRawVideo(ctx, video)
		if err != nil {
			errMsg := fmt.Sprintf("direct raw video extraction failed: %v", err)
			failedStep := "event_extraction"
			_ = s.chunkRepo.UpdateJob(ctx, jobID, "failed", &errMsg)
			_ = s.videoRepo.UpdateStatusWithError(ctx, videoID, "failed", &failedStep, &errMsg, nil)
			return nil, fmt.Errorf("%s", errMsg)
		}
		allEvents = events
	} else {
		// Clean up any lingering un-chunked events from a previous full-mode run to prevent event duplication
		if err := s.rawEventRepo.DeleteOrphanRawEventsByVideoID(ctx, videoID); err != nil {
			log.Printf("Warning: failed to delete orphan raw events for video %s: %v", videoID, err)
		}

		// Fetch existing raw events to find which chunks are already successfully processed
		existingEvents, err := s.rawEventRepo.ListByVideoID(ctx, videoID, false)
		if err != nil {
			log.Printf("Warning: failed to fetch existing events for video %s: %v", videoID, err)
		}
		eventsByChunk := make(map[uuid.UUID][]model.RawEvent)
		for _, e := range existingEvents {
			if e.ChunkID != nil {
				eventsByChunk[*e.ChunkID] = append(eventsByChunk[*e.ChunkID], e)
			}
		}

		var chunksToProcess []model.VideoChunk
		for _, ch := range chunks {
			// If chunk is processed and has events in DB, keep existing events and skip AI call
			if ch.Status == "processed" && len(eventsByChunk[ch.ID]) > 0 {
				log.Printf("[Video %s] Chunk %d (%s) already processed with %d events — skipping AI extraction",
					videoID, ch.ChunkIndex, ch.ID, len(eventsByChunk[ch.ID]))
				allEvents = append(allEvents, eventsByChunk[ch.ID]...)
			} else {
				// Clean up any partial/dirty events for this chunk before running
				_ = s.rawEventRepo.DeleteByChunkID(ctx, ch.ID)
				chunksToProcess = append(chunksToProcess, ch)
			}
		}

		log.Printf("[Video %s] Total chunks: %d, already processed: %d, to process: %d",
			videoID, len(chunks), len(chunks)-len(chunksToProcess), len(chunksToProcess))

		if len(chunksToProcess) > 0 {
			// Process chunks concurrently with worker pool
			sem := make(chan struct{}, s.maxConcurrentChunks)
			var wg sync.WaitGroup
			var mu sync.Mutex
			var extractionErrors []error

			for _, ch := range chunksToProcess {
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
				failedStep := "event_extraction"
				_ = s.chunkRepo.UpdateJob(ctx, jobID, "failed", &errMsg)
				_ = s.videoRepo.UpdateStatusWithError(ctx, videoID, "failed", &failedStep, &errMsg, nil)
				return nil, fmt.Errorf("%s", errMsg)
			}
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
	aiVideo := s.aiVideo
	if s.aiRouter != nil {
		rProvider, _, err := s.aiRouter.GetVideoProviderForFlow(ctx, "video_extraction")
		if err != nil {
			return nil, fmt.Errorf("video extraction configuration error: %w", err)
		}
		aiVideo = rProvider
	}
	if aiVideo == nil {
		return nil, fmt.Errorf("no AI video provider configured for flow 'video_extraction'")
	}
	// Call Gemini Video Analysis with retry loop
	var rawOutput string
	maxRetries := 3
	var lastErr error
	for attempt := 1; attempt <= maxRetries; attempt++ {
		if ctx.Err() != nil {
			return nil, ctx.Err()
		}
		rawOutput, err = aiVideo.AnalyzeVideoChunk(ctx, localVideoPath, VideoEventExtractionPrompt)
		if err == nil {
			lastErr = nil
			break
		}
		lastErr = err
		log.Printf("[Video %s] Raw video extraction attempt %d/%d failed: %v", video.ID, attempt, maxRetries, err)
		if attempt < maxRetries {
			backoff := time.Duration(attempt*3) * time.Second
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return nil, ctx.Err()
			}
		}
	}
	if lastErr != nil {
		return nil, fmt.Errorf("gemini analysis failed after %d attempts: %w", maxRetries, lastErr)
	}

	// Parse JSON
	var items []RawEventJSONItem
	if err := ai.UnmarshalJSONFlexible(rawOutput, &items); err != nil {
		return nil, fmt.Errorf("failed to parse gemini event json: %w (raw: %s)", err, rawOutput)
	}

	var events []model.RawEvent
	now := time.Now()

	for _, item := range items {
		globalTimestamp := item.TimestampSec
		confidence := item.Confidence
		duration := item.DurationSec
		var codePtr *string
		if item.Code != "" {
			c := item.Code
			codePtr = &c
		}
		var quotePtr *string
		if item.Quote != "" {
			q := item.Quote
			quotePtr = &q
		}

		events = append(events, model.RawEvent{
			ID:           uuid.New(),
			VideoID:      video.ID,
			TeacherID:    video.TeacherID,
			ChunkID:      nil,
			TimestampSec: globalTimestamp,
			EventType:    item.EventType,
			EventKey:     item.EventKey,
			Code:         codePtr,
			Quote:        quotePtr,
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
	if chunk.BlobPath == nil || *chunk.BlobPath == "" {
		return nil, fmt.Errorf("chunk blob_path is missing for chunk %s", chunk.ID)
	}

	tempDir, err := os.MkdirTemp("", fmt.Sprintf("chunk-%s-*", chunk.ID.String()))
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
	aiVideo := s.aiVideo
	if s.aiRouter != nil {
		rProvider, _, err := s.aiRouter.GetVideoProviderForFlow(ctx, "video_extraction")
		if err != nil {
			_ = s.chunkRepo.UpdateChunkStatus(ctx, chunk.ID, "error", nil)
			return nil, fmt.Errorf("video extraction configuration error: %w", err)
		}
		aiVideo = rProvider
	}
	if aiVideo == nil {
		_ = s.chunkRepo.UpdateChunkStatus(ctx, chunk.ID, "error", nil)
		return nil, fmt.Errorf("no AI video provider configured for flow 'video_extraction'")
	}
	// Call Gemini Video Analysis with retry loop
	var rawOutput string
	maxRetries := 3
	var lastErr error
	for attempt := 1; attempt <= maxRetries; attempt++ {
		if ctx.Err() != nil {
			_ = s.chunkRepo.UpdateChunkStatus(ctx, chunk.ID, "error", nil)
			return nil, ctx.Err()
		}
		rawOutput, err = aiVideo.AnalyzeVideoChunk(ctx, localChunkPath, VideoEventExtractionPrompt)
		if err == nil {
			lastErr = nil
			break
		}
		lastErr = err
		log.Printf("[Video %s] Chunk %d: AI extraction attempt %d/%d failed: %v", video.ID, chunk.ChunkIndex, attempt, maxRetries, err)
		if attempt < maxRetries {
			backoff := time.Duration(attempt*3) * time.Second
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				_ = s.chunkRepo.UpdateChunkStatus(ctx, chunk.ID, "error", nil)
				return nil, ctx.Err()
			}
		}
	}
	if lastErr != nil {
		_ = s.chunkRepo.UpdateChunkStatus(ctx, chunk.ID, "error", nil)
		return nil, fmt.Errorf("gemini analysis failed after %d attempts: %w", maxRetries, lastErr)
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
		var codePtr *string
		if item.Code != "" {
			c := item.Code
			codePtr = &c
		}
		var quotePtr *string
		if item.Quote != "" {
			q := item.Quote
			quotePtr = &q
		}

		events = append(events, model.RawEvent{
			ID:           uuid.New(),
			VideoID:      video.ID,
			TeacherID:    video.TeacherID,
			ChunkID:      &chunkID,
			TimestampSec: globalTimestamp,
			EventType:    item.EventType,
			EventKey:     item.EventKey,
			Code:         codePtr,
			Quote:        quotePtr,
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
