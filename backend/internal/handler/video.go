package handler

import (
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/service"
)

// VideoHandler handles HTTP requests for video management.
type VideoHandler struct {
	svc *service.VideoService
}

// NewVideoHandler creates a new VideoHandler.
func NewVideoHandler(svc *service.VideoService) *VideoHandler {
	return &VideoHandler{svc: svc}
}

// Upload handles multipart video file uploads.
// Max body size: 2GB.
// POST /api/videos/upload
func (h *VideoHandler) Upload(c *gin.Context) {
	// 2GB max upload limit
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, 2<<30)

	teacherID := c.PostForm("teacher_id")
	if teacherID == "" {
		RespondError(c, http.StatusBadRequest, "teacher_id form field is required (e.g. T01)")
		return
	}

	title := c.PostForm("title")
	var durationSecPtr *int
	if durStr := c.PostForm("duration_sec"); durStr != "" {
		if dur, err := strconv.Atoi(durStr); err == nil && dur > 0 {
			durationSecPtr = &dur
		}
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		log.Printf("[VideoHandler.Upload] FormFile parse error: %v", err)
		RespondError(c, http.StatusBadRequest, "file form field is required: "+err.Error())
		return
	}
	defer file.Close()

	var userID *uuid.UUID
	if uidVal, exists := c.Get("user_id"); exists {
		if uid, ok := uidVal.(uuid.UUID); ok {
			userID = &uid
		}
	}

	log.Printf("[VideoHandler.Upload] Receiving upload: teacher=%s, title=%s, filename=%s, size=%d bytes", teacherID, title, header.Filename, header.Size)

	fileSize := header.Size
	video, err := h.svc.Upload(c.Request.Context(), service.UploadVideoRequest{
		TeacherID:   teacherID,
		Title:       title,
		Filename:    header.Filename,
		DurationSec: durationSecPtr,
		FileSize:    &fileSize,
		Reader:      file,
		UserID:      userID,
	})
	if err != nil {
		log.Printf("[VideoHandler.Upload] Storage or DB error: %v", err)
		RespondError(c, http.StatusInternalServerError, "failed to upload video: "+err.Error())
		return
	}

	log.Printf("[VideoHandler.Upload] Video uploaded successfully: id=%s, blob_url=%v", video.ID, video.BlobURL)
	RespondCreated(c, video)
}

// List returns all videos.
// GET /api/videos
func (h *VideoHandler) List(c *gin.Context) {
	videos, err := h.svc.List(c.Request.Context())
	if err != nil {
		RespondError(c, http.StatusInternalServerError, "failed to list videos: "+err.Error())
		return
	}
	if videos == nil {
		videos = []model.Video{} // avoid null JSON
	}
	RespondSuccess(c, gin.H{"videos": videos})
}

// GetByID returns details for a single video.
// GET /api/videos/:id
func (h *VideoHandler) GetByID(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid video ID")
		return
	}

	video, err := h.svc.GetByID(c.Request.Context(), id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			RespondError(c, http.StatusNotFound, "video not found")
			return
		}
		RespondError(c, http.StatusInternalServerError, "failed to get video: "+err.Error())
		return
	}

	RespondSuccess(c, video)
}

// UpdateVideoRequest contains metadata to update a video.
type UpdateVideoRequest struct {
	TeacherID string `json:"teacher_id" binding:"required"`
	Title     string `json:"title"`
}

// Update handles updating a video's teacher_id and title.
// PATCH /api/videos/:id
func (h *VideoHandler) Update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid video ID")
		return
	}

	var req UpdateVideoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "teacher_id is required: "+err.Error())
		return
	}

	video, err := h.svc.UpdateMetadata(c.Request.Context(), id, req.TeacherID, req.Title)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			RespondError(c, http.StatusNotFound, "video not found")
			return
		}
		if strings.Contains(err.Error(), "actively processing") || strings.Contains(err.Error(), "required") {
			RespondError(c, http.StatusBadRequest, err.Error())
			return
		}
		RespondError(c, http.StatusInternalServerError, "failed to update video: "+err.Error())
		return
	}

	RespondSuccess(c, video)
}

// Delete removes a video and all its associated data.
// DELETE /api/videos/:id
func (h *VideoHandler) Delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		RespondError(c, http.StatusBadRequest, "invalid video ID")
		return
	}

	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		if strings.Contains(err.Error(), "not found") {
			RespondError(c, http.StatusNotFound, "video not found")
			return
		}
		if strings.Contains(err.Error(), "cannot delete") || strings.Contains(err.Error(), "actively processing") {
			RespondError(c, http.StatusBadRequest, err.Error())
			return
		}
		RespondError(c, http.StatusInternalServerError, "failed to delete video: "+err.Error())
		return
	}

	c.JSON(http.StatusNoContent, nil)
}

// BulkDeleteRequest contains the list of video IDs to delete.
type BulkDeleteRequest struct {
	VideoIDs []string `json:"video_ids" binding:"required"`
}

// BulkDelete removes multiple videos and returns results for each.
// POST /api/videos/bulk-delete
func (h *VideoHandler) BulkDelete(c *gin.Context) {
	var req BulkDeleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "video_ids is required: "+err.Error())
		return
	}

	type FailItem struct {
		ID    string `json:"id"`
		Error string `json:"error"`
	}

	deleted := make([]string, 0)
	failed := make([]FailItem, 0)

	for _, idStr := range req.VideoIDs {
		id, err := uuid.Parse(idStr)
		if err != nil {
			failed = append(failed, FailItem{ID: idStr, Error: "invalid UUID"})
			continue
		}

		if err := h.svc.Delete(c.Request.Context(), id); err != nil {
			failed = append(failed, FailItem{ID: idStr, Error: err.Error()})
		} else {
			deleted = append(deleted, idStr)
		}
	}

	RespondSuccess(c, gin.H{
		"deleted": deleted,
		"failed":  failed,
		"total":   len(req.VideoIDs),
	})
}

