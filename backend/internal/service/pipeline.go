package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// PipelineOrchestrator coordinates the end-to-end video analysis pipeline (Phases 1–5 + Codebook).
type PipelineOrchestrator struct {
	chunkingSvc   *ChunkingService
	extractionSvc *ExtractionService
	dedupSvc      *DeduplicationService
	mappingSvc    *MappingService
	reportSvc     *ReportService
	codebookSvc   *CodebookService
	videoRepo     *repository.VideoRepository
	chunkRepo     *repository.ChunkRepository
	checklistRepo *repository.ChecklistRepository
	cancelFuncs   map[uuid.UUID]context.CancelFunc
	mu            sync.Mutex
}

// NewPipelineOrchestrator creates a new PipelineOrchestrator.
func NewPipelineOrchestrator(
	chunkingSvc *ChunkingService,
	extractionSvc *ExtractionService,
	dedupSvc *DeduplicationService,
	mappingSvc *MappingService,
	reportSvc *ReportService,
	codebookSvc *CodebookService,
	videoRepo *repository.VideoRepository,
	chunkRepo *repository.ChunkRepository,
	checklistRepo *repository.ChecklistRepository,
) *PipelineOrchestrator {
	return &PipelineOrchestrator{
		chunkingSvc:   chunkingSvc,
		extractionSvc: extractionSvc,
		dedupSvc:      dedupSvc,
		mappingSvc:    mappingSvc,
		reportSvc:     reportSvc,
		codebookSvc:   codebookSvc,
		videoRepo:     videoRepo,
		chunkRepo:     chunkRepo,
		checklistRepo: checklistRepo,
		cancelFuncs:   make(map[uuid.UUID]context.CancelFunc),
	}
}

// PipelineStatusSummary represents the aggregated progress of a video pipeline.
type PipelineStatusSummary struct {
	VideoID       uuid.UUID           `json:"video_id"`
	CurrentStatus string              `json:"current_status"`
	FailedStep    *string             `json:"failed_step,omitempty"`
	ErrorMsg      *string             `json:"error_msg,omitempty"`
	Jobs          []model.PipelineJob `json:"jobs"`
}

// TriggerPipeline starts the video analysis pipeline in a background goroutine.
func (p *PipelineOrchestrator) TriggerPipeline(videoID uuid.UUID, checklistID *uuid.UUID, enableChunking bool) error {
	ctx := context.Background()

	// Verify video exists
	video, err := p.videoRepo.GetByID(ctx, videoID)
	if err != nil {
		return fmt.Errorf("failed to get video: %w", err)
	}
	if video == nil {
		return fmt.Errorf("video not found: %s", videoID)
	}

	// Resolve checklist
	var targetChecklistID uuid.UUID
	if checklistID != nil {
		targetChecklistID = *checklistID
	} else {
		// Use default checklist
		checklists, err := p.checklistRepo.List(ctx)
		if err != nil || len(checklists) == 0 {
			return fmt.Errorf("no checklists found in system — please seed a checklist first")
		}
		targetChecklistID = checklists[0].ID
	}

	// Cancel previous active instance if running
	p.mu.Lock()
	if prevCancel, exists := p.cancelFuncs[videoID]; exists {
		prevCancel()
	}
	pipelineCtx, cancel := context.WithCancel(context.Background())
	p.cancelFuncs[videoID] = cancel
	p.mu.Unlock()

	// Launch async pipeline
	go func() {
		defer func() {
			p.mu.Lock()
			delete(p.cancelFuncs, videoID)
			p.mu.Unlock()
		}()

		if err := p.runPipeline(pipelineCtx, videoID, targetChecklistID, enableChunking); err != nil {
			if errors.Is(err, context.Canceled) || pipelineCtx.Err() != nil {
				log.Printf("Pipeline canceled for video %s", videoID)
				_ = p.videoRepo.UpdateStatus(context.Background(), videoID, "cancelled", nil)
				_ = p.chunkRepo.CancelRunningJobs(context.Background(), videoID)
				return
			}
			log.Printf("Pipeline error for video %s: %v", videoID, err)
			errMsg := err.Error()
			_ = p.videoRepo.UpdateStatusWithError(context.Background(), videoID, "failed", nil, &errMsg, nil)
		}
	}()

	return nil
}

// CancelPipeline aborts the active pipeline execution for a video.
func (p *PipelineOrchestrator) CancelPipeline(videoID uuid.UUID) error {
	p.mu.Lock()
	cancel, exists := p.cancelFuncs[videoID]
	if exists {
		cancel()
		delete(p.cancelFuncs, videoID)
	}
	p.mu.Unlock()

	ctx := context.Background()
	_ = p.chunkRepo.CancelRunningJobs(ctx, videoID)
	if err := p.videoRepo.UpdateStatus(ctx, videoID, "cancelled", nil); err != nil {
		return fmt.Errorf("failed to update video status: %w", err)
	}

	log.Printf("Successfully requested cancellation for video pipeline %s", videoID)
	return nil
}

// runPipeline executes all steps sequentially with context cancellation checks.
func (p *PipelineOrchestrator) runPipeline(ctx context.Context, videoID uuid.UUID, checklistID uuid.UUID, enableChunking bool) error {
	log.Printf("Starting pipeline for video %s (checklist %s, enableChunking: %v)", videoID, checklistID, enableChunking)

	if ctx.Err() != nil {
		return ctx.Err()
	}

	if enableChunking {
		// Step 1: Chunking / Segment Preparation (only when chunking is requested)
		log.Printf("[Video %s] Step 1: Video Preparation (chunking: %v)...", videoID, enableChunking)
		chunks, err := p.chunkingSvc.ProcessVideoChunks(ctx, videoID, enableChunking)
		if err != nil {
			return fmt.Errorf("step 1 chunking failed: %w", err)
		}
		log.Printf("[Video %s] Step 1 finished (%d chunks)", videoID, len(chunks))
	} else {
		log.Printf("[Video %s] Direct Full Video mode — skipping chunking step and using raw video directly", videoID)
		// Clean up any previously created chunks for re-runs
		_ = p.chunkRepo.DeleteByVideoID(ctx, videoID)
		now := time.Now()
		_ = p.chunkRepo.CreateJob(ctx, &model.PipelineJob{
			ID:         uuid.New(),
			VideoID:    videoID,
			Step:       "chunking",
			Status:     "skipped",
			StartedAt:  &now,
			FinishedAt: &now,
			CreatedAt:  now,
		})
	}

	if ctx.Err() != nil {
		return ctx.Err()
	}

	// Step 2: Event Extraction (Gemini Multimodal on chunks or raw video directly)
	log.Printf("[Video %s] Step 2: Video Understanding & Event Extraction...", videoID)
	events, err := p.extractionSvc.ExtractEventsForVideo(ctx, videoID)
	if err != nil {
		return fmt.Errorf("step 2 extraction failed: %w", err)
	}
	log.Printf("[Video %s] Step 2 finished (%d raw events)", videoID, len(events))

	if ctx.Err() != nil {
		return ctx.Err()
	}

	// Step 3: Event Merge & Deduplication
	log.Printf("[Video %s] Step 3: Event Merge & Boundary Deduplication...", videoID)
	dupsCount, err := p.dedupSvc.MergeAndDeduplicate(ctx, videoID)
	if err != nil {
		return fmt.Errorf("step 3 deduplication failed: %w", err)
	}
	log.Printf("[Video %s] Step 3 finished (flagged %d duplicates)", videoID, dupsCount)

	if ctx.Err() != nil {
		return ctx.Err()
	}

	// Step 4: Checklist Mapping (Claude 3.5 Sonnet / Semantic)
	log.Printf("[Video %s] Step 4: Semantic Checklist Mapping...", videoID)
	mappings, err := p.mappingSvc.MapEventsForVideo(ctx, videoID, checklistID)
	if err != nil {
		return fmt.Errorf("step 4 mapping failed: %w", err)
	}
	log.Printf("[Video %s] Step 4 finished (%d mappings)", videoID, len(mappings))

	if ctx.Err() != nil {
		return ctx.Err()
	}

	// Step 5: Statistics & Report Generation
	log.Printf("[Video %s] Step 5: Statistics & Markdown Report Generation...", videoID)
	report, err := p.reportSvc.GenerateReportForVideo(ctx, videoID, checklistID)
	if err != nil {
		return fmt.Errorf("step 5 report generation failed: %w", err)
	}
	log.Printf("[Video %s] Report Generated! Report ID: %s", videoID, report.ID)

	// Step 6: Automated AI Code Book Generation
	if p.codebookSvc != nil {
		log.Printf("[Video %s] Step 6: Synthesizing AI Code Book from observed video behaviors...", videoID)
		if _, cbErr := p.codebookSvc.GenerateCodebookForVideo(ctx, videoID); cbErr != nil {
			log.Printf("[Video %s] Warning: Codebook generation encountered an issue: %v (continuing pipeline)", videoID, cbErr)
		} else {
			log.Printf("[Video %s] Step 6: Code Book generated successfully!", videoID)
		}
	}

	log.Printf("[Video %s] Pipeline COMPLETE!", videoID)
	return nil
}

// GetStatus returns the current status and step history of the pipeline for a video.
func (p *PipelineOrchestrator) GetStatus(ctx context.Context, videoID uuid.UUID) (*PipelineStatusSummary, error) {
	video, err := p.videoRepo.GetByID(ctx, videoID)
	if err != nil {
		return nil, fmt.Errorf("failed to get video: %w", err)
	}
	if video == nil {
		return nil, fmt.Errorf("video not found: %s", videoID)
	}

	jobs, err := p.chunkRepo.GetLatestJobsByVideoID(ctx, videoID)
	if err != nil {
		return nil, fmt.Errorf("failed to get pipeline jobs: %w", err)
	}

	return &PipelineStatusSummary{
		VideoID:       videoID,
		CurrentStatus: video.Status,
		FailedStep:    video.FailedStep,
		ErrorMsg:      video.ErrorMsg,
		Jobs:          jobs,
	}, nil
}
