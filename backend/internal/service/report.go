package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// ReportService handles Phase 4 (Statistics) & Phase 5 (Markdown Report Generation).
type ReportService struct {
	reportRepo    *repository.ReportRepository
	mappingRepo   *repository.MappingRepository
	checklistRepo *repository.ChecklistRepository
	videoRepo     *repository.VideoRepository
	chunkRepo     *repository.ChunkRepository
}

// NewReportService creates a new ReportService.
func NewReportService(
	reportRepo *repository.ReportRepository,
	mappingRepo *repository.MappingRepository,
	checklistRepo *repository.ChecklistRepository,
	videoRepo *repository.VideoRepository,
	chunkRepo *repository.ChunkRepository,
) *ReportService {
	return &ReportService{
		reportRepo:    reportRepo,
		mappingRepo:   mappingRepo,
		checklistRepo: checklistRepo,
		videoRepo:     videoRepo,
		chunkRepo:     chunkRepo,
	}
}

// FormatTimestampHHMMSS converts float seconds to "HH:MM:SS".
func FormatTimestampHHMMSS(sec float64) string {
	totalSec := int(sec)
	h := totalSec / 3600
	m := (totalSec % 3600) / 60
	s := totalSec % 60
	return fmt.Sprintf("%02d:%02d:%02d", h, m, s)
}

// SectionTitleMap maps section code to full name.
var SectionTitleMap = map[string]string{
	"A": "Section A — Establishing Online Rules and Routines",
	"B": "Section B — Managing Turn-taking and Speaking Participation",
	"C": "Section C — Sustaining Learner Attention and Engagement",
	"D": "Section D — Providing Scaffolding and Positive Reinforcement",
	"E": "Section E — Using Digital Tools to Support Learning and Interaction",
}

// GenerateReportForVideo aggregates statistics and formats markdown report.
func (s *ReportService) GenerateReportForVideo(ctx context.Context, videoID uuid.UUID, checklistID uuid.UUID) (*model.Report, error) {
	video, err := s.videoRepo.GetByID(ctx, videoID)
	if err != nil {
		return nil, fmt.Errorf("failed to get video: %w", err)
	}
	if video == nil {
		return nil, fmt.Errorf("video not found: %s", videoID)
	}

	checklist, err := s.checklistRepo.GetByID(ctx, checklistID)
	if err != nil {
		return nil, fmt.Errorf("failed to get checklist: %w", err)
	}
	if checklist == nil {
		return nil, fmt.Errorf("checklist not found: %s", checklistID)
	}

	// Create pipeline job for statistics & report generation
	jobID := uuid.New()
	startTime := time.Now()
	job := &model.PipelineJob{
		ID:        jobID,
		VideoID:   videoID,
		Step:      "report_generation",
		Status:    "running",
		StartedAt: &startTime,
		CreatedAt: startTime,
	}
	_ = s.chunkRepo.CreateJob(ctx, job)
	_ = s.videoRepo.UpdateStatus(ctx, videoID, "statistics", nil)

	// Fetch mapping details
	details, err := s.mappingRepo.ListDetailsByVideoID(ctx, videoID)
	if err != nil {
		errMsg := err.Error()
		_ = s.chunkRepo.UpdateJob(ctx, jobID, "error", &errMsg)
		_ = s.videoRepo.UpdateStatus(ctx, videoID, "error", nil)
		return nil, fmt.Errorf("failed to fetch mapping details: %w", err)
	}

	// Group details by checklist_item_id
	grouped := make(map[uuid.UUID][]repository.EventMappingDetail)
	for _, d := range details {
		grouped[d.ChecklistItemID] = append(grouped[d.ChecklistItemID], d)
	}

	var reportItems []model.ReportItem
	now := time.Now()

	// Organize items by section for Markdown generation
	sectionOrder := []string{"A", "B", "C", "D", "E"}
	sectionItems := make(map[string][]model.ChecklistItem)
	for _, it := range checklist.Items {
		sectionItems[it.Section] = append(sectionItems[it.Section], it)
	}

	var md strings.Builder
	md.WriteString("# Classroom Analysis Report\n")
	md.WriteString(fmt.Sprintf("**Teacher:** %s | **Video:** %s | **Session date:** %s\n",
		video.TeacherID, video.Title, video.UploadedAt.Format("2006-01-02")))
	md.WriteString(fmt.Sprintf("**Checklist version:** %s | **Generated:** %s\n\n",
		checklist.Version, now.Format("2006-01-02 15:04:05")))
	md.WriteString("---\n\n")

	for _, sec := range sectionOrder {
		items, exists := sectionItems[sec]
		if !exists || len(items) == 0 {
			continue
		}

		secTitle, ok := SectionTitleMap[sec]
		if !ok {
			secTitle = fmt.Sprintf("Section %s", sec)
		}
		md.WriteString(fmt.Sprintf("## %s\n\n", secTitle))

		for _, item := range items {
			evts := grouped[item.ID]
			count := len(evts)

			var totalConf float64
			var totalDur float64
			var occurrences []model.Occurrence

			for _, ev := range evts {
				conf := 0.90
				if ev.Confidence != nil {
					conf = *ev.Confidence
				}
				dur := 3.0
				if ev.DurationSec != nil {
					dur = *ev.DurationSec
				}
				totalConf += conf
				totalDur += dur

				occurrences = append(occurrences, model.Occurrence{
					TimestampSec: ev.TimestampSec,
					Confidence:   conf,
					DurationSec:  dur,
				})
			}

			var avgConf *float64
			var avgDur *float64
			if count > 0 {
				c := totalConf / float64(count)
				d := totalDur / float64(count)
				avgConf = &c
				avgDur = &d
			}

			occJSON, _ := json.Marshal(occurrences)

			repItem := model.ReportItem{
				ID:               uuid.New(),
				ChecklistItemID:  item.ID,
				ChecklistSection: item.Section,
				ChecklistText:    item.Text,
				Count:            count,
				AvgConfidence:    avgConf,
				AvgDurationSec:   avgDur,
				Occurrences:      string(occJSON),
				CreatedAt:        now,
			}
			reportItems = append(reportItems, repItem)

			// Markdown formatting for item
			md.WriteString(fmt.Sprintf("### %s\n", item.Text))
			if count > 0 {
				md.WriteString(fmt.Sprintf("- **Count:** %d | **Avg Confidence:** %.2f | **Avg Duration:** %.1fs\n\n",
					count, *avgConf, *avgDur))
				md.WriteString("| # | Timestamp | Confidence | Duration |\n")
				md.WriteString("|---|-----------|------------|----------|\n")
				for idx, ev := range occurrences {
					md.WriteString(fmt.Sprintf("| %d | %s  | %.2f       | %.0fs       |\n",
						idx+1, FormatTimestampHHMMSS(ev.TimestampSec), ev.Confidence, ev.DurationSec))
				}
				md.WriteString("\n")
			} else {
				md.WriteString("- **Count:** 0 | *No occurrences detected*\n\n")
			}
		}

		md.WriteString("---\n\n")
	}

	reportID := uuid.New()
	reportModel := &model.Report{
		ID:               reportID,
		VideoID:          videoID,
		TeacherID:        video.TeacherID,
		ChecklistID:      checklistID,
		ChecklistVersion: &checklist.Version,
		MarkdownContent:  md.String(),
		GeneratedAt:      now,
		Items:            reportItems,
	}

	if err := s.reportRepo.CreateReport(ctx, reportModel, reportItems); err != nil {
		errMsg := fmt.Sprintf("failed to save report: %v", err)
		_ = s.chunkRepo.UpdateJob(ctx, jobID, "error", &errMsg)
		_ = s.videoRepo.UpdateStatus(ctx, videoID, "error", nil)
		return nil, fmt.Errorf("%s", errMsg)
	}

	_ = s.videoRepo.UpdateStatus(ctx, videoID, "report_generated", nil)
	_ = s.chunkRepo.UpdateJob(ctx, jobID, "completed", nil)

	log.Printf("Successfully generated report %s for video %s", reportID, videoID)
	return reportModel, nil
}

// GetReportByVideoID retrieves the generated report for a video.
func (s *ReportService) GetReportByVideoID(ctx context.Context, videoID uuid.UUID) (*model.Report, error) {
	return s.reportRepo.GetByVideoID(ctx, videoID)
}
