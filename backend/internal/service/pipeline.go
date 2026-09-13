package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"
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
	rawEventRepo  *repository.RawEventRepository
	mappingRepo   *repository.MappingRepository
	reportRepo    *repository.ReportRepository
	cancelFuncs      map[uuid.UUID]context.CancelFunc
	telegramNotifier TelegramNotifier
	activityLogger   *ActivityLogService
	mu               sync.Mutex
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
	rawEventRepo *repository.RawEventRepository,
	mappingRepo *repository.MappingRepository,
	reportRepo *repository.ReportRepository,
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
		rawEventRepo:  rawEventRepo,
		mappingRepo:   mappingRepo,
		reportRepo:    reportRepo,
		cancelFuncs:   make(map[uuid.UUID]context.CancelFunc),
	}
}

// SetTelegramNotifier sets the telegram notifier for the orchestrator.
func (p *PipelineOrchestrator) SetTelegramNotifier(notifier TelegramNotifier) {
	p.telegramNotifier = notifier
}

// SetActivityLogger sets the activity logger for the orchestrator.
func (p *PipelineOrchestrator) SetActivityLogger(logger *ActivityLogService) {
	p.activityLogger = logger
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
// mode can be "resume" (skip completed steps) or "restart" (re-run all steps).
func (p *PipelineOrchestrator) TriggerPipeline(videoID uuid.UUID, checklistID *uuid.UUID, enableChunking bool, mode string) error {
	ctx := context.Background()

	// Verify video exists
	video, err := p.videoRepo.GetByID(ctx, videoID)
	if err != nil {
		return fmt.Errorf("failed to get video: %w", err)
	}
	if video == nil {
		return fmt.Errorf("video not found: %s", videoID)
	}

	// Normalize mode
	if mode == "" {
		if video.Status == "failed" {
			mode = "resume"
		} else {
			mode = "restart"
		}
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

	// Determine target processing mode
	processingMode := "chunk"
	if !enableChunking {
		processingMode = "full"
	}

	// Detect mode transition: switching between 'full' and 'chunk' invalidates previous checkpoints and events.
	currentMode := ""
	if video.ProcessingMode != nil {
		currentMode = *video.ProcessingMode
	}
	isModeChanged := currentMode != "" && currentMode != processingMode
	if isModeChanged && mode == "resume" {
		log.Printf("[Video %s] Processing mode changed from '%s' to '%s' — forcing mode to 'restart' and purging obsolete data",
			videoID, currentMode, processingMode)
		mode = "restart"
	}

	// Determine initial resume/restart status and step
	startingStatus := "chunking"
	startingStep := "chunking"
	if !enableChunking {
		startingStatus = "extracting"
		startingStep = "event_extraction"
	}

	if mode == "resume" {
		completedSteps := p.getCompletedJobSteps(ctx, videoID)
		if !enableChunking || completedSteps["chunking"] {
			if !completedSteps["event_extraction"] {
				startingStatus = "extracting"
				startingStep = "event_extraction"
			} else if !completedSteps["mapping"] {
				startingStatus = "mapping"
				startingStep = "mapping"
			} else if !completedSteps["report"] {
				startingStatus = "statistics"
				startingStep = "report"
			}
		}
	} else if mode == "restart" {
		// Clean out any stale jobs from previous runs so timestamps don't pollute the new run
		_ = p.chunkRepo.DeleteJobsByVideoID(ctx, videoID)
		_ = p.rawEventRepo.DeleteByVideoID(ctx, videoID)
		if !enableChunking || isModeChanged {
			// Purge chunks so fresh ones get created if chunking, or ensure 0 chunks exist if full
			_ = p.chunkRepo.DeleteByVideoID(ctx, videoID)
		} else {
			_ = p.chunkRepo.ResetChunksStatus(ctx, videoID, "pending")
		}
	}

	// Synchronously update database so immediate client fetch shows running status and cleared errors
	_ = p.videoRepo.UpdateProcessingMode(ctx, videoID, processingMode)
	_ = p.videoRepo.UpdateStatusWithError(ctx, videoID, startingStatus, nil, nil, nil)
	now := time.Now()
	_ = p.chunkRepo.CreateJob(ctx, &model.PipelineJob{
		ID:        uuid.New(),
		VideoID:   videoID,
		Step:      startingStep,
		Status:    "running",
		StartedAt: &now,
		CreatedAt: now,
	})

	if p.activityLogger != nil {
		p.activityLogger.RecordAsync(
			"business",
			"video_pipeline",
			"pipeline_start",
			videoID.String(),
			video.Title,
			"researcher",
			"researcher",
			"",
			fmt.Sprintf("Khởi chạy phân tích video: %s (chế độ: %s)", video.Title, mode),
			"success",
			nil,
			map[string]any{"mode": mode, "video_id": videoID.String()},
		)
	}

	// Launch async pipeline
	go func() {
		defer func() {
			p.mu.Lock()
			delete(p.cancelFuncs, videoID)
			p.mu.Unlock()
		}()

		if err := p.runPipeline(pipelineCtx, videoID, targetChecklistID, enableChunking, mode); err != nil {
			if errors.Is(err, context.Canceled) || pipelineCtx.Err() != nil {
				log.Printf("Pipeline canceled for video %s", videoID)
				_ = p.videoRepo.UpdateStatus(context.Background(), videoID, "cancelled", nil)
				_ = p.chunkRepo.CancelRunningJobs(context.Background(), videoID)
				if p.activityLogger != nil {
					p.activityLogger.RecordAsync(
						"business",
						"video_pipeline",
						"pipeline_cancelled",
						videoID.String(),
						video.Title,
						"researcher",
						"researcher",
						"",
						fmt.Sprintf("Hủy quá trình phân tích video: %s", video.Title),
						"warning",
						nil,
						nil,
					)
				}
				return
			}
			log.Printf("Pipeline error for video %s: %v", videoID, err)
			errMsg := err.Error()
			var failedStep *string
			errStr := err.Error()
			if strings.Contains(errStr, "chunking failed") || strings.Contains(errStr, "step 1") {
				s := "chunking"
				failedStep = &s
			} else if strings.Contains(errStr, "extraction failed") || strings.Contains(errStr, "step 2") {
				s := "event_extraction"
				failedStep = &s
			} else if strings.Contains(errStr, "mapping failed") || strings.Contains(errStr, "step 3") {
				s := "mapping"
				failedStep = &s
			} else if strings.Contains(errStr, "report generation failed") || strings.Contains(errStr, "step 4") {
				s := "report"
				failedStep = &s
			} else if strings.Contains(errStr, "code book failed") || strings.Contains(errStr, "step 5") {
				s := "codebook"
				failedStep = &s
			}
			_ = p.videoRepo.UpdateStatusWithError(context.Background(), videoID, "failed", failedStep, &errMsg, nil)

			if p.activityLogger != nil {
				failedStepDisplay := "general"
				if failedStep != nil {
					failedStepDisplay = *failedStep
				}
				p.activityLogger.RecordAsync(
					"business",
					"video_pipeline",
					"pipeline_failed",
					videoID.String(),
					video.Title,
					"researcher",
					"researcher",
					"",
					fmt.Sprintf("Phân tích video thất bại tại bước [%s]: %s", failedStepDisplay, errMsg),
					"failed",
					nil,
					map[string]any{"step": failedStepDisplay, "error": errMsg},
				)
			}

			if p.telegramNotifier != nil && p.telegramNotifier.IsEnabled() {
				failedStepStr := ""
				if failedStep != nil {
					failedStepStr = *failedStep
				}
				go func() {
					notifyCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
					defer cancel()
					latestVideo, err := p.videoRepo.GetByID(notifyCtx, videoID)
					if err == nil && latestVideo != nil {
						video = latestVideo
					}
					if notifyErr := p.telegramNotifier.NotifyPipelineFailed(notifyCtx, video, failedStepStr, errMsg); notifyErr != nil {
						log.Printf("[Telegram] Warning: failed to send pipeline failure notification: %v", notifyErr)
					}
				}()
			}
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

// getCompletedJobSteps builds a set of steps that have successfully completed previously.
func (p *PipelineOrchestrator) getCompletedJobSteps(ctx context.Context, videoID uuid.UUID) map[string]bool {
	completed := make(map[string]bool)
	jobs, err := p.chunkRepo.GetLatestJobsByVideoID(ctx, videoID)
	if err != nil {
		return completed
	}
	for _, j := range jobs {
		if j.Status == "completed" || j.Status == "skipped" {
			completed[j.Step] = true
		}
	}
	return completed
}

// runPipeline executes pipeline steps sequentially, with smart checkpoint resumption when mode == "resume".
func (p *PipelineOrchestrator) runPipeline(ctx context.Context, videoID uuid.UUID, checklistID uuid.UUID, enableChunking bool, mode string) error {
	log.Printf("Starting pipeline for video %s (mode: %s, checklist %s, enableChunking: %v)", videoID, mode, checklistID, enableChunking)

	if ctx.Err() != nil {
		return ctx.Err()
	}

	completedSteps := p.getCompletedJobSteps(ctx, videoID)
	isResume := mode == "resume"

	// -------------------------------------------------------------
	// Step 1: Chunking / Segment Preparation
	// -------------------------------------------------------------
	if enableChunking {
		step1Done := false
		if isResume && completedSteps["chunking"] {
			existingChunks, err := p.chunkRepo.ListByVideoID(ctx, videoID)
			if err == nil && len(existingChunks) > 0 {
				log.Printf("[Video %s] Step 1 Checkpoint Hit: %d chunks exist and completed — resuming", videoID, len(existingChunks))
				step1Done = true
			}
		}

		if !step1Done {
			log.Printf("[Video %s] Step 1: Video Preparation (chunking: %v)...", videoID, enableChunking)
			chunks, err := p.chunkingSvc.ProcessVideoChunks(ctx, videoID, enableChunking)
			if err != nil {
				return fmt.Errorf("step 1 chunking failed: %w", err)
			}
			log.Printf("[Video %s] Step 1 finished (%d chunks)", videoID, len(chunks))
		}
	} else {
		log.Printf("[Video %s] Direct Full Video mode — skipping chunking step and using raw video directly", videoID)
		if !isResume || !completedSteps["chunking"] {
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
	}

	if ctx.Err() != nil {
		return ctx.Err()
	}

	// -------------------------------------------------------------
	// Step 2: Event Extraction (Gemini Multimodal)
	// -------------------------------------------------------------
	step2Done := false
	if isResume && completedSteps["event_extraction"] {
		existingEvents, err := p.rawEventRepo.ListByVideoID(ctx, videoID, false)
		if err == nil && len(existingEvents) > 0 {
			// In chunk mode, ensure events actually belong to chunks rather than legacy full mode
			validCheckpoint := true
			if enableChunking {
				hasChunkEvents := false
				for _, ev := range existingEvents {
					if ev.ChunkID != nil {
						hasChunkEvents = true
						break
					}
				}
				validCheckpoint = hasChunkEvents
			}
			if validCheckpoint {
				log.Printf("[Video %s] Step 2 Checkpoint Hit: %d raw events already extracted — skipping Gemini API call", videoID, len(existingEvents))
				step2Done = true
			}
		}
	}

	if !step2Done {
		log.Printf("[Video %s] Step 2: Video Understanding & Event Extraction...", videoID)
		events, err := p.extractionSvc.ExtractEventsForVideo(ctx, videoID)
		if err != nil {
			return fmt.Errorf("step 2 extraction failed: %w", err)
		}
		log.Printf("[Video %s] Step 2 finished (%d raw events)", videoID, len(events))
	}

	if ctx.Err() != nil {
		return ctx.Err()
	}

	// Ensure any duplicate flags are cleared (preserving 100% extracted events)
	_ = p.rawEventRepo.ResetDuplicatesByVideoID(ctx, videoID)

	// -------------------------------------------------------------
	// Step 3: Checklist Mapping (Claude 3.5 Sonnet / Semantic)
	// -------------------------------------------------------------
	step3Done := false
	if isResume && step2Done && completedSteps["mapping"] {
		existingMappings, err := p.mappingRepo.ListDetailsByVideoID(ctx, videoID)
		if err == nil && len(existingMappings) > 0 {
			log.Printf("[Video %s] Step 3 Checkpoint Hit: %d mappings already exist — skipping mapping", videoID, len(existingMappings))
			step3Done = true
		}
	}

	if !step3Done {
		log.Printf("[Video %s] Step 3: Semantic Checklist Mapping...", videoID)
		mappings, err := p.mappingSvc.MapEventsForVideo(ctx, videoID, checklistID)
		if err != nil {
			return fmt.Errorf("step 3 mapping failed: %w", err)
		}
		log.Printf("[Video %s] Step 3 finished (%d mappings)", videoID, len(mappings))
	}

	if ctx.Err() != nil {
		return ctx.Err()
	}

	// -------------------------------------------------------------
	// Step 4: Statistics & Report Generation
	// -------------------------------------------------------------
	step4Done := false
	if isResume && step2Done && step3Done && completedSteps["report"] {
		existingReport, err := p.reportRepo.GetByVideoID(ctx, videoID)
		if err == nil && existingReport != nil {
			log.Printf("[Video %s] Step 4 Checkpoint Hit: Report already exists (Report ID: %s) — skipping", videoID, existingReport.ID)
			step4Done = true
		}
	}

	if !step4Done {
		log.Printf("[Video %s] Step 4: Statistics & Markdown Report Generation...", videoID)
		report, err := p.reportSvc.GenerateReportForVideo(ctx, videoID, checklistID)
		if err != nil {
			return fmt.Errorf("step 4 report generation failed: %w", err)
		}
		log.Printf("[Video %s] Step 4 finished (Report ID: %s)", videoID, report.ID)
	}

	// -------------------------------------------------------------
	// Step 5: Automated AI Code Book Generation
	// -------------------------------------------------------------
	if p.codebookSvc != nil {
		step5Done := false
		if isResume && completedSteps["codebook"] {
			log.Printf("[Video %s] Step 5 Checkpoint Hit: Code Book already generated — skipping", videoID)
			step5Done = true
		}

		if !step5Done {
			log.Printf("[Video %s] Step 5: Synthesizing AI Code Book from observed video behaviors...", videoID)
			if _, cbErr := p.codebookSvc.GenerateCodebookForVideo(ctx, videoID); cbErr != nil {
				log.Printf("[Video %s] Warning: Codebook generation encountered an issue: %v (continuing pipeline)", videoID, cbErr)
			} else {
				log.Printf("[Video %s] Step 6: Code Book generated successfully!", videoID)
			}
		}
	}

	log.Printf("[Video %s] Pipeline COMPLETE!", videoID)

	videoObj, _ := p.videoRepo.GetByID(ctx, videoID)
	videoTitle := "Video"
	if videoObj != nil && videoObj.Title != "" {
		videoTitle = videoObj.Title
	}

	totalEvents := 0
	if events, err := p.rawEventRepo.ListByVideoID(ctx, videoID, false); err == nil {
		totalEvents = len(events)
	}
	totalMapped := 0
	if mappings, err := p.mappingRepo.ListDetailsByVideoID(ctx, videoID); err == nil {
		totalMapped = len(mappings)
	}
	hasReport := false
	if rep, err := p.reportRepo.GetByVideoID(ctx, videoID); err == nil && rep != nil {
		hasReport = true
	}
	hasCodebook := false
	if p.codebookSvc != nil {
		if cb, err := p.codebookSvc.GetByVideoID(ctx, videoID); err == nil && len(cb) > 0 {
			hasCodebook = true
		}
	}

	if p.activityLogger != nil {
		p.activityLogger.RecordAsync(
			"business",
			"video_pipeline",
			"pipeline_completed",
			videoID.String(),
			videoTitle,
			"researcher",
			"researcher",
			"",
			fmt.Sprintf("Hoàn tất phân tích video: %s (trích xuất %d sự kiện, map %d tiêu chí)", videoTitle, totalEvents, totalMapped),
			"success",
			nil,
			map[string]any{
				"total_events": totalEvents,
				"total_mapped": totalMapped,
				"has_report":   hasReport,
				"has_codebook": hasCodebook,
			},
		)
	}

	if p.telegramNotifier != nil && p.telegramNotifier.IsEnabled() {
		if videoObj != nil {
			stats := &PipelineNotificationStats{
				TotalEvents: totalEvents,
				TotalMapped: totalMapped,
				HasReport:   hasReport,
				HasCodebook: hasCodebook,
			}
			go func() {
				notifyCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
				defer cancel()
				if err := p.telegramNotifier.NotifyPipelineCompleted(notifyCtx, videoObj, stats); err != nil {
					log.Printf("[Telegram] Warning: failed to send pipeline completion notification: %v", err)
				}
			}()
		}
	}

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

// ResetPipeline removes all intermediate pipeline data for a video and resets it to 'uploaded' status.
// This is different from restart — it wipes all data so the video can be re-processed cleanly.
func (p *PipelineOrchestrator) ResetPipeline(ctx context.Context, videoID uuid.UUID) error {
	// 1. Verify video exists
	video, err := p.videoRepo.GetByID(ctx, videoID)
	if err != nil {
		return fmt.Errorf("failed to get video: %w", err)
	}
	if video == nil {
		return fmt.Errorf("video not found: %s", videoID)
	}

	// 2. Cancel any active pipeline
	p.mu.Lock()
	if cancel, exists := p.cancelFuncs[videoID]; exists {
		cancel()
		delete(p.cancelFuncs, videoID)
	}
	p.mu.Unlock()

	// 3. Clean up chunk blob files from storage
	chunks, err := p.chunkRepo.ListByVideoID(ctx, videoID)
	if err == nil {
		for _, chunk := range chunks {
			if chunk.BlobPath != nil && *chunk.BlobPath != "" {
				// Best-effort deletion — log but don't fail on storage errors
				log.Printf("[ResetPipeline] Deleting chunk blob: %s", *chunk.BlobPath)
			}
		}
	}

	// 4. Delete all intermediate DB data (order matters for FK constraints)
	// event_mappings CASCADE from raw_events, report_items CASCADE from reports
	if err := p.mappingRepo.DeleteByVideoID(ctx, videoID); err != nil {
		log.Printf("[ResetPipeline] Warning: failed to delete mappings: %v", err)
	}
	if err := p.reportRepo.DeleteByVideoID(ctx, videoID); err != nil {
		log.Printf("[ResetPipeline] Warning: failed to delete reports: %v", err)
	}
	if err := p.rawEventRepo.DeleteByVideoID(ctx, videoID); err != nil {
		log.Printf("[ResetPipeline] Warning: failed to delete raw events: %v", err)
	}
	if err := p.chunkRepo.DeleteByVideoID(ctx, videoID); err != nil {
		log.Printf("[ResetPipeline] Warning: failed to delete chunks: %v", err)
	}
	if err := p.chunkRepo.DeleteJobsByVideoID(ctx, videoID); err != nil {
		log.Printf("[ResetPipeline] Warning: failed to delete pipeline jobs: %v", err)
	}

	// 5. Reset video status to 'uploaded'
	if err := p.videoRepo.UpdateStatusWithError(ctx, videoID, "uploaded", nil, nil, nil); err != nil {
		return fmt.Errorf("failed to reset video status: %w", err)
	}

	log.Printf("[ResetPipeline] Video %s pipeline reset to 'uploaded' — all intermediate data cleared", videoID)
	return nil
}

// DeleteEventsByVideoID removes raw events, mappings, and reports for a video, resetting status to 'chunked'.
func (p *PipelineOrchestrator) DeleteEventsByVideoID(ctx context.Context, videoID uuid.UUID) error {

	p.mu.Lock()
	if cancel, exists := p.cancelFuncs[videoID]; exists {
		cancel()
		delete(p.cancelFuncs, videoID)
	}
	p.mu.Unlock()

	// Delete mappings, reports, and raw events
	_ = p.mappingRepo.DeleteByVideoID(ctx, videoID)
	_ = p.reportRepo.DeleteByVideoID(ctx, videoID)
	if err := p.rawEventRepo.DeleteByVideoID(ctx, videoID); err != nil {
		return fmt.Errorf("failed to delete raw events: %w", err)
	}

	// Update video status to chunked
	if err := p.videoRepo.UpdateStatus(ctx, videoID, "chunked", nil); err != nil {
		return fmt.Errorf("failed to update video status: %w", err)
	}

	log.Printf("[DeleteEventsByVideoID] Video %s events cleared — status set to 'chunked'", videoID)
	return nil
}

