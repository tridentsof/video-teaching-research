package service

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// ChecklistService handles checklist business logic.
type ChecklistService struct {
	repo *repository.ChecklistRepository
}

// NewChecklistService creates a new ChecklistService.
func NewChecklistService(repo *repository.ChecklistRepository) *ChecklistService {
	return &ChecklistService{repo: repo}
}

// CreateChecklistRequest is the input for creating a new checklist.
type CreateChecklistRequest struct {
	Name    string `json:"name" binding:"required"`
	Version string `json:"version" binding:"required"`
}

// UpdateItemsRequest is the input for bulk-updating checklist items.
type UpdateItemsRequest struct {
	Items []ItemInput `json:"items" binding:"required"`
}

// ItemInput represents a single checklist item in a create/update request.
type ItemInput struct {
	ID      *uuid.UUID `json:"id,omitempty"` // if provided, this is an existing item being updated
	Section string     `json:"section" binding:"required"`
	Text    string     `json:"text" binding:"required"`
	SortOrder int      `json:"sort_order"`
}

// List returns all checklists.
func (s *ChecklistService) List(ctx context.Context) ([]model.Checklist, error) {
	return s.repo.List(ctx)
}

// GetByID returns a checklist with its items.
func (s *ChecklistService) GetByID(ctx context.Context, id uuid.UUID) (*model.Checklist, error) {
	cl, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if cl == nil {
		return nil, fmt.Errorf("checklist not found")
	}
	return cl, nil
}

// Create creates a new checklist.
func (s *ChecklistService) Create(ctx context.Context, req CreateChecklistRequest) (*model.Checklist, error) {
	cl := &model.Checklist{
		ID:        uuid.New(),
		Name:      req.Name,
		Version:   req.Version,
		CreatedAt: time.Now(),
	}

	if err := s.repo.Create(ctx, cl); err != nil {
		return nil, err
	}

	return cl, nil
}

// UpdateItems replaces all items for a checklist.
func (s *ChecklistService) UpdateItems(ctx context.Context, checklistID uuid.UUID, req UpdateItemsRequest) (*model.Checklist, error) {
	// Verify checklist exists
	existing, err := s.repo.GetByID(ctx, checklistID)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, fmt.Errorf("checklist not found")
	}

	// Convert input to model items
	items := make([]model.ChecklistItem, len(req.Items))
	for i, input := range req.Items {
		itemID := uuid.New()
		if input.ID != nil {
			itemID = *input.ID
		}
		items[i] = model.ChecklistItem{
			ID:          itemID,
			ChecklistID: checklistID,
			Section:     input.Section,
			Text:        input.Text,
			SortOrder:   input.SortOrder,
			CreatedAt:   time.Now(),
		}
	}

	if err := s.repo.UpdateItems(ctx, checklistID, items); err != nil {
		return nil, err
	}

	// Return updated checklist
	return s.repo.GetByID(ctx, checklistID)
}

// Delete removes a checklist.
func (s *ChecklistService) Delete(ctx context.Context, id uuid.UUID) error {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if existing == nil {
		return fmt.Errorf("checklist not found")
	}

	return s.repo.Delete(ctx, id)
}
