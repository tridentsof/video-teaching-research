package handler

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/service"
	"github.com/xuri/excelize/v2"
)

// CodebookHandler handles HTTP endpoints for codebook features.
type CodebookHandler struct {
	svc      *service.CodebookService
	videoSvc *service.VideoService
}

// NewCodebookHandler creates a new CodebookHandler.
func NewCodebookHandler(svc *service.CodebookService, videoSvc *service.VideoService) *CodebookHandler {
	return &CodebookHandler{svc: svc, videoSvc: videoSvc}
}

// GetByVideoID returns all codebook entries for a video.
// GET /api/codebook/video/:video_id
func (h *CodebookHandler) GetByVideoID(c *gin.Context) {
	videoID, err := uuid.Parse(c.Param("video_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid video ID")
		return
	}

	entries, err := h.svc.GetByVideoID(c.Request.Context(), videoID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to get codebook: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"entries": entries})
}

// SaveByVideoID replaces all codebook entries for a video.
// PUT /api/codebook/video/:video_id
func (h *CodebookHandler) SaveByVideoID(c *gin.Context) {
	videoID, err := uuid.Parse(c.Param("video_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid video ID")
		return
	}

	var req struct {
		Entries []model.CodebookEntry `json:"entries"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	result, err := h.svc.SaveByVideoID(c.Request.Context(), videoID, req.Entries)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to save codebook: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"entries": result})
}

// GenerateByVideoID generates or regenerates codebook entries for a video using AI.
// POST /api/codebook/video/:video_id/generate
func (h *CodebookHandler) GenerateByVideoID(c *gin.Context) {
	videoID, err := uuid.Parse(c.Param("video_id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid video ID")
		return
	}

	result, err := h.svc.GenerateCodebookForVideo(c.Request.Context(), videoID)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to generate codebook: "+err.Error())
		return
	}

	RespondSuccess(c, gin.H{"entries": result})
}

// ExportExcel generates a single Excel file where each sheet = one video's codebook.
// GET /api/codebook/export.xlsx
func (h *CodebookHandler) ExportExcel(c *gin.Context) {
	ctx := c.Request.Context()

	// Fetch all videos with report_generated status
	videos, err := h.videoSvc.List(ctx)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to list videos: "+err.Error())
		return
	}

	// Filter to only videos that have reports
	var videoIDs []uuid.UUID
	videoMap := make(map[uuid.UUID]model.Video)
	for _, v := range videos {
		if v.Status == "report_generated" {
			videoIDs = append(videoIDs, v.ID)
			videoMap[v.ID] = v
		}
	}

	// Get codebook entries for all videos
	allEntries, err := h.svc.GetAllForExport(ctx, videoIDs)
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to get codebooks: "+err.Error())
		return
	}

	// Build the Excel workbook
	f := excelize.NewFile()
	defer f.Close()

	// Header style — bold
	headerStyle, _ := f.NewStyle(&excelize.Style{
		Font: &excelize.Font{Bold: true, Size: 11},
		Fill: excelize.Fill{Type: "pattern", Color: []string{"#E8E0D5"}, Pattern: 1},
		Border: []excelize.Border{
			{Type: "left", Color: "CCCCCC", Style: 1},
			{Type: "right", Color: "CCCCCC", Style: 1},
			{Type: "top", Color: "CCCCCC", Style: 1},
			{Type: "bottom", Color: "CCCCCC", Style: 1},
		},
		Alignment: &excelize.Alignment{Vertical: "center", WrapText: true},
	})

	// Data cell style — wrap text
	cellStyle, _ := f.NewStyle(&excelize.Style{
		Border: []excelize.Border{
			{Type: "left", Color: "DDDDDD", Style: 1},
			{Type: "right", Color: "DDDDDD", Style: 1},
			{Type: "top", Color: "DDDDDD", Style: 1},
			{Type: "bottom", Color: "DDDDDD", Style: 1},
		},
		Alignment: &excelize.Alignment{Vertical: "top", WrapText: true},
	})

	// Column headers (matching the image layout)
	headers := []string{"Code", "Definition", "Inclusion Criteria", "Exclusion Criteria", "Example", "Category", "Theme"}
	colWidths := []float64{22, 40, 32, 32, 32, 22, 22}

	sheetCreated := false
	for _, v := range videos {
		if v.Status != "report_generated" {
			continue
		}

		entries := allEntries[v.ID]

		// Sheet name: "T01 — Lesson 1" (max 31 chars for Excel)
		sheetName := fmt.Sprintf("%s — %s", v.TeacherID, v.Title)
		if len(sheetName) > 31 {
			sheetName = sheetName[:31]
		}
		// Remove invalid sheet name chars
		for _, ch := range []string{":", "\\", "/", "?", "*", "[", "]"} {
			sheetName = strings.ReplaceAll(sheetName, ch, "")
		}

		// Create or rename sheet
		if !sheetCreated {
			f.SetSheetName("Sheet1", sheetName)
			sheetCreated = true
		} else {
			f.NewSheet(sheetName)
		}

		// Row 1: video title banner
		f.MergeCell(sheetName, "A1", "G1")
		f.SetCellValue(sheetName, "A1", fmt.Sprintf("Code Book — %s (%s)", v.Title, v.TeacherID))
		titleStyle, _ := f.NewStyle(&excelize.Style{
			Font:      &excelize.Font{Bold: true, Size: 13, Color: "5C3D2E"},
			Fill:      excelize.Fill{Type: "pattern", Color: []string{"#F5EFE6"}, Pattern: 1},
			Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
		})
		f.SetCellStyle(sheetName, "A1", "G1", titleStyle)
		f.SetRowHeight(sheetName, 1, 28)

		// Row 2: column headers
		cols := []string{"A", "B", "C", "D", "E", "F", "G"}
		for i, h := range headers {
			cell := cols[i] + "2"
			f.SetCellValue(sheetName, cell, h)
			f.SetCellStyle(sheetName, cell, cell, headerStyle)
		}
		f.SetRowHeight(sheetName, 2, 22)

		// Set column widths
		for i, col := range cols {
			f.SetColWidth(sheetName, col, col, colWidths[i])
		}

		// Data rows starting from row 3
		for ri, entry := range entries {
			row := ri + 3
			f.SetCellValue(sheetName, fmt.Sprintf("A%d", row), entry.Code)
			f.SetCellValue(sheetName, fmt.Sprintf("B%d", row), entry.Definition)
			f.SetCellValue(sheetName, fmt.Sprintf("C%d", row), entry.InclusionCriteria)
			f.SetCellValue(sheetName, fmt.Sprintf("D%d", row), entry.ExclusionCriteria)
			f.SetCellValue(sheetName, fmt.Sprintf("E%d", row), entry.Example)
			f.SetCellValue(sheetName, fmt.Sprintf("F%d", row), entry.Category)
			f.SetCellValue(sheetName, fmt.Sprintf("G%d", row), entry.Theme)
			rowRef := fmt.Sprintf("A%d", row)
			endRef := fmt.Sprintf("G%d", row)
			f.SetCellStyle(sheetName, rowRef, endRef, cellStyle)
			f.SetRowHeight(sheetName, row, 45)
		}

		// If no entries, show a placeholder row
		if len(entries) == 0 {
			f.MergeCell(sheetName, "A3", "G3")
			f.SetCellValue(sheetName, "A3", "(No codebook entries for this video)")
			emptyStyle, _ := f.NewStyle(&excelize.Style{
				Font:      &excelize.Font{Italic: true, Color: "999999"},
				Alignment: &excelize.Alignment{Horizontal: "center", Vertical: "center"},
			})
			f.SetCellStyle(sheetName, "A3", "G3", emptyStyle)
		}

		// Freeze top 2 rows (header)
		f.SetPanes(sheetName, &excelize.Panes{
			Freeze:      true,
			Split:       false,
			YSplit:      2,
			TopLeftCell: "A3",
			ActivePane:  "bottomLeft",
		})
	}

	// If no sheets were created (no eligible videos), add a placeholder
	if !sheetCreated {
		f.SetCellValue("Sheet1", "A1", "No videos with completed reports found.")
	}

	// Stream the Excel file as a download
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", `attachment; filename="codebook_export.xlsx"`)

	if err := f.Write(c.Writer); err != nil {
		// Headers already set, nothing else we can do
		return
	}
}
