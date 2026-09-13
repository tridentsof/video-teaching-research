package service

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// ActivityLogService provides application-level activity logging operations.
type ActivityLogService struct {
	repo *repository.ActivityLogRepository
}

// NewActivityLogService creates a new ActivityLogService.
func NewActivityLogService(repo *repository.ActivityLogRepository) *ActivityLogService {
	return &ActivityLogService{repo: repo}
}

// Record saves a new activity log entry synchronously.
func (s *ActivityLogService) Record(
	ctx context.Context,
	category string,
	module string,
	action string,
	targetID string,
	targetTitle string,
	username string,
	role string,
	clientIP string,
	summary string,
	status string,
	diff any,
	metadata any,
) error {
	if s == nil || s.repo == nil {
		return nil
	}

	if username == "" {
		username = "system"
	}
	if role == "" {
		role = "researcher"
	}
	if status == "" {
		status = "success"
	}

	diffStr := ""
	if diff != nil {
		switch v := diff.(type) {
		case string:
			diffStr = v
		default:
			if b, err := json.Marshal(v); err == nil {
				diffStr = string(b)
			}
		}
	}

	metadataStr := ""
	if metadata != nil {
		switch v := metadata.(type) {
		case string:
			metadataStr = v
		default:
			if b, err := json.Marshal(v); err == nil {
				metadataStr = string(b)
			}
		}
	}

	item := &model.ActivityLog{
		Category:      category,
		Module:        module,
		Action:        action,
		TargetID:      targetID,
		TargetTitle:   targetTitle,
		ActorUsername: username,
		ActorRole:     role,
		ClientIP:      clientIP,
		Summary:       summary,
		Status:        status,
		DiffJSON:      diffStr,
		MetadataJSON:  metadataStr,
		CreatedAt:     time.Now(),
	}

	return s.repo.Create(ctx, item)
}

// RecordAsync records an activity log in a background goroutine so callers aren't blocked.
func (s *ActivityLogService) RecordAsync(
	category string,
	module string,
	action string,
	targetID string,
	targetTitle string,
	username string,
	role string,
	clientIP string,
	summary string,
	status string,
	diff any,
	metadata any,
) {
	if s == nil || s.repo == nil {
		return
	}

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := s.Record(ctx, category, module, action, targetID, targetTitle, username, role, clientIP, summary, status, diff, metadata); err != nil {
			log.Printf("[ActivityLog] Warning: failed to write log: %v", err)
		}
	}()
}

// List returns logs and total count with filtering.
func (s *ActivityLogService) List(ctx context.Context, category, module string, limit, offset int) ([]model.ActivityLog, int, error) {
	if s == nil || s.repo == nil {
		return []model.ActivityLog{}, 0, nil
	}
	return s.repo.List(ctx, category, module, limit, offset)
}
