package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// ChunkingService handles video chunking using FFmpeg.
type ChunkingService struct {
	chunkRepo        *repository.ChunkRepository
	videoRepo        *repository.VideoRepository
	storage          BlobStorage
	ffmpegPath       string
	chunkDurationSec int
	chunkOverlapSec  int
}

// NewChunkingService creates a new ChunkingService.
func NewChunkingService(
	chunkRepo *repository.ChunkRepository,
	videoRepo *repository.VideoRepository,
	storage BlobStorage,
	ffmpegPath string,
	chunkDurationSec, chunkOverlapSec int,
) *ChunkingService {
	if chunkDurationSec <= 0 {
		chunkDurationSec = 600 // 10 minutes
	}
	if chunkOverlapSec < 0 {
		chunkOverlapSec = 30 // 30 seconds
	}
	if ffmpegPath == "" {
		ffmpegPath = "ffmpeg"
	}
	return &ChunkingService{
		chunkRepo:        chunkRepo,
		videoRepo:        videoRepo,
		storage:          storage,
		ffmpegPath:       ffmpegPath,
		chunkDurationSec: chunkDurationSec,
		chunkOverlapSec:  chunkOverlapSec,
	}
}

// ChunkInterval represents the time boundaries of a chunk.
type ChunkInterval struct {
	Index    int
	StartSec int
	EndSec   int
}

// CalculateChunks generates chunk intervals for a given total duration.
func (s *ChunkingService) CalculateChunks(totalDurationSec int) []ChunkInterval {
	if totalDurationSec <= 0 {
		return []ChunkInterval{{Index: 0, StartSec: 0, EndSec: s.chunkDurationSec}}
	}

	if totalDurationSec <= s.chunkDurationSec {
		return []ChunkInterval{{Index: 0, StartSec: 0, EndSec: totalDurationSec}}
	}

	var intervals []ChunkInterval
	step := s.chunkDurationSec - s.chunkOverlapSec
	if step <= 0 {
		step = s.chunkDurationSec
	}

	index := 0
	start := 0
	for start < totalDurationSec {
		end := start + s.chunkDurationSec
		if end > totalDurationSec {
			end = totalDurationSec
		}

		intervals = append(intervals, ChunkInterval{
			Index:    index,
			StartSec: start,
			EndSec:   end,
		})

		if end >= totalDurationSec {
			break
		}

		start += step
		index++
	}

	return intervals
}

// GetVideoDurationSec probes the video file to get its duration in seconds.
func (s *ChunkingService) GetVideoDurationSec(ctx context.Context, filePath string) (int, error) {
	// Try ffprobe first
	ffprobePath := "ffprobe"
	if s.ffmpegPath != "ffmpeg" {
		ffprobePath = filepath.Join(filepath.Dir(s.ffmpegPath), "ffprobe")
	}

	cmd := exec.CommandContext(ctx, ffprobePath,
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		filePath,
	)
	var out bytes.Buffer
	cmd.Stdout = &out

	if err := cmd.Run(); err == nil {
		durationStr := strings.TrimSpace(out.String())
		if secFloat, err := strconv.ParseFloat(durationStr, 64); err == nil && secFloat > 0 {
			return int(secFloat), nil
		}
	}

	// Fallback to ffmpeg -i parsing
	cmd = exec.CommandContext(ctx, s.ffmpegPath, "-i", filePath)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	_ = cmd.Run()

	output := stderr.String()
	// Parse "Duration: 00:45:30.12"
	if idx := strings.Index(output, "Duration: "); idx != -1 {
		durStr := output[idx+10 : idx+18]
		parts := strings.Split(durStr, ":")
		if len(parts) == 3 {
			h, _ := strconv.Atoi(parts[0])
			m, _ := strconv.Atoi(parts[1])
			sec, _ := strconv.Atoi(parts[2])
			return h*3600 + m*60 + sec, nil
		}
	}

	// If both ffprobe and ffmpeg output parsing fail
	return 0, fmt.Errorf("unable to determine video duration (ffprobe/ffmpeg output: %s)", strings.TrimSpace(output))
}

// ProcessVideoChunks splits a video into chunks (if enabled) or prepares a single full-video chunk, and uploads them.
func (s *ChunkingService) ProcessVideoChunks(ctx context.Context, videoID uuid.UUID, enableChunking bool) ([]model.VideoChunk, error) {
	video, err := s.videoRepo.GetByID(ctx, videoID)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch video: %w", err)
	}
	if video == nil {
		return nil, fmt.Errorf("video not found: %s", videoID)
	}

	// Create pipeline job tracking
	jobID := uuid.New()
	startTime := time.Now()
	job := &model.PipelineJob{
		ID:        jobID,
		VideoID:   videoID,
		Step:      "chunking",
		Status:    "running",
		StartedAt: &startTime,
		CreatedAt: startTime,
	}
	_ = s.chunkRepo.CreateJob(ctx, job)

	// Update video status to chunking
	_ = s.videoRepo.UpdateStatus(ctx, videoID, "chunking", nil)

	// Clean up any previously created chunks for re-runs
	_ = s.chunkRepo.DeleteByVideoID(ctx, videoID)

	// Setup working temp directory
	tempDir, err := os.MkdirTemp("", fmt.Sprintf("chunking-%s-*", videoID.String()))
	if err != nil {
		errMsg := err.Error()
		_ = s.chunkRepo.UpdateJob(ctx, jobID, "error", &errMsg)
		_ = s.videoRepo.UpdateStatus(ctx, videoID, "error", nil)
		return nil, fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tempDir)

	// Download original video from BlobStorage
	if video.BlobURL == nil {
		errMsg := "video blob_url is missing"
		_ = s.chunkRepo.UpdateJob(ctx, jobID, "error", &errMsg)
		_ = s.videoRepo.UpdateStatus(ctx, videoID, "error", nil)
		return nil, fmt.Errorf("%s", errMsg)
	}

	// Extract blobPath relative to container (preserves exact extension/case from BlobURL)
	blobPath := extractBlobPath(video.BlobURL, video.TeacherID, video.ID)

	reader, err := s.storage.Download(ctx, blobPath)
	if err != nil {
		errMsg := fmt.Sprintf("failed to download video: %v", err)
		_ = s.chunkRepo.UpdateJob(ctx, jobID, "error", &errMsg)
		_ = s.videoRepo.UpdateStatus(ctx, videoID, "error", nil)
		return nil, fmt.Errorf("%s", errMsg)
	}
	defer reader.Close()

	localInputPath := filepath.Join(tempDir, "input.mp4")
	localInputFile, err := os.Create(localInputPath)
	if err != nil {
		errMsg := err.Error()
		_ = s.chunkRepo.UpdateJob(ctx, jobID, "error", &errMsg)
		return nil, fmt.Errorf("failed to create input file: %w", err)
	}

	if _, err := io.Copy(localInputFile, reader); err != nil {
		localInputFile.Close()
		errMsg := err.Error()
		_ = s.chunkRepo.UpdateJob(ctx, jobID, "error", &errMsg)
		return nil, fmt.Errorf("failed to save input video locally: %w", err)
	}
	localInputFile.Close()

	// Probe duration
	totalDurationSec, err := s.GetVideoDurationSec(ctx, localInputPath)
	if err != nil {
		errMsg := fmt.Sprintf("failed to probe video duration: %v (ensure ffmpeg/ffprobe is installed)", err)
		_ = s.chunkRepo.UpdateJob(ctx, jobID, "error", &errMsg)
		_ = s.videoRepo.UpdateStatus(ctx, videoID, "error", nil)
		return nil, fmt.Errorf("%s", errMsg)
	}

	var intervals []ChunkInterval
	if enableChunking {
		intervals = s.CalculateChunks(totalDurationSec)
		log.Printf("Video %s (duration %ds) will be split into %d chunks (chunking enabled)", videoID, totalDurationSec, len(intervals))
	} else {
		intervals = []ChunkInterval{{Index: 0, StartSec: 0, EndSec: totalDurationSec}}
		log.Printf("Video %s (duration %ds) will be processed as 1 full video (chunking disabled)", videoID, totalDurationSec)
	}

	// Check if ffmpeg is available when multi-chunking is needed
	if enableChunking && len(intervals) > 1 {
		if _, err := exec.LookPath(s.ffmpegPath); err != nil {
			errMsg := fmt.Sprintf("ffmpeg executable not found in PATH (%s) — FFmpeg is required for multi-segment video chunking", s.ffmpegPath)
			_ = s.chunkRepo.UpdateJob(ctx, jobID, "error", &errMsg)
			_ = s.videoRepo.UpdateStatus(ctx, videoID, "error", nil)
			return nil, fmt.Errorf("%s", errMsg)
		}
	}

	var createdChunks []model.VideoChunk
	for _, interval := range intervals {
		chunkID := uuid.New()
		chunkOutPath := filepath.Join(tempDir, fmt.Sprintf("chunk_%d.mp4", interval.Index))

		if enableChunking && len(intervals) > 1 {
			// FFmpeg slice command with frame-accurate seeking (-ss after -i)
			duration := interval.EndSec - interval.StartSec
			cmd := exec.CommandContext(ctx, s.ffmpegPath,
				"-y",
				"-i", localInputPath,
				"-ss", strconv.Itoa(interval.StartSec),
				"-t", strconv.Itoa(duration),
				"-c:v", "libx264",
				"-preset", "fast",
				"-crf", "23",
				"-c:a", "aac",
				"-reset_timestamps", "1",
				"-avoid_negative_ts", "make_zero",
				chunkOutPath,
			)

			var errBuf bytes.Buffer
			cmd.Stderr = &errBuf
			if err := cmd.Run(); err != nil {
				errMsg := fmt.Sprintf("ffmpeg chunk %d failed: %v, log: %s", interval.Index, err, errBuf.String())
				_ = s.chunkRepo.UpdateJob(ctx, jobID, "error", &errMsg)
				_ = s.videoRepo.UpdateStatus(ctx, videoID, "error", nil)
				return nil, fmt.Errorf("%s", errMsg)
			}
		} else {
			// Single full video mode: copy input file directly as chunk 0
			inputData, err := os.ReadFile(localInputPath)
			if err != nil {
				return nil, fmt.Errorf("failed to read input file for full video chunk: %w", err)
			}
			if err := os.WriteFile(chunkOutPath, inputData, 0644); err != nil {
				return nil, fmt.Errorf("failed to write full video chunk file: %w", err)
			}
		}

		// Upload chunk to storage
		chunkFile, err := os.Open(chunkOutPath)
		if err != nil {
			errMsg := err.Error()
			_ = s.chunkRepo.UpdateJob(ctx, jobID, "error", &errMsg)
			return nil, fmt.Errorf("failed to open chunk file: %w", err)
		}

		chunkBlobPath := fmt.Sprintf("chunks/%s/chunk_%d.mp4", videoID.String(), interval.Index)
		_, err = s.storage.Upload(ctx, chunkBlobPath, chunkFile)
		chunkFile.Close()
		if err != nil {
			errMsg := fmt.Sprintf("failed to upload chunk %d: %v", interval.Index, err)
			_ = s.chunkRepo.UpdateJob(ctx, jobID, "error", &errMsg)
			return nil, fmt.Errorf("%s", errMsg)
		}

		// Save record in DB
		chunkModel := model.VideoChunk{
			ID:            chunkID,
			VideoID:       videoID,
			ChunkIndex:    interval.Index,
			ChunkStartSec: interval.StartSec,
			ChunkEndSec:   interval.EndSec,
			BlobPath:      &chunkBlobPath,
			Status:        "uploaded",
			CreatedAt:     time.Now(),
		}

		if err := s.chunkRepo.CreateChunk(ctx, &chunkModel); err != nil {
			errMsg := fmt.Sprintf("failed to persist chunk record %d: %v", interval.Index, err)
			_ = s.chunkRepo.UpdateJob(ctx, jobID, "error", &errMsg)
			return nil, fmt.Errorf("%s", errMsg)
		}

		createdChunks = append(createdChunks, chunkModel)
	}

	// Update video record
	_ = s.videoRepo.UpdateStatus(ctx, videoID, "chunked", &totalDurationSec)
	_ = s.chunkRepo.UpdateJob(ctx, jobID, "completed", nil)

	log.Printf("Successfully created %d chunks for video %s", len(createdChunks), videoID)
	return createdChunks, nil
}

// extractBlobPath resolves the relative blob path from a full or relative BlobURL.
func extractBlobPath(blobURL *string, teacherID string, videoID uuid.UUID) string {
	if blobURL != nil && *blobURL != "" {
		u := *blobURL
		if idx := strings.Index(u, "raw/"); idx != -1 {
			return u[idx:]
		}
	}
	return fmt.Sprintf("raw/%s/%s.mp4", teacherID, videoID.String())
}
