package service

import (
	"context"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// InterviewBaseService handles business logic for the base interview question bank.
type InterviewBaseService struct {
	repo *repository.InterviewBaseRepository
}

// NewInterviewBaseService creates a new InterviewBaseService.
func NewInterviewBaseService(repo *repository.InterviewBaseRepository) *InterviewBaseService {
	return &InterviewBaseService{repo: repo}
}

// CreateBaseQuestionInput contains payload for creating a new base question.
type CreateBaseQuestionInput struct {
	Section       string `json:"section"`
	SectionTitle  string `json:"section_title"`
	QuestionIndex int    `json:"question_index"`
	QuestionText  string `json:"question_text"`
	RQCategory    string `json:"rq_category"`
	SortOrder     int    `json:"sort_order"`
	IsActive      *bool  `json:"is_active,omitempty"`
}

// UpdateBaseQuestionInput contains payload for updating an existing base question.
type UpdateBaseQuestionInput struct {
	Section       string `json:"section"`
	SectionTitle  string `json:"section_title"`
	QuestionIndex int    `json:"question_index"`
	QuestionText  string `json:"question_text"`
	RQCategory    string `json:"rq_category"`
	SortOrder     int    `json:"sort_order"`
	IsActive      bool   `json:"is_active"`
}

// ListBaseQuestions retrieves all base questions.
func (s *InterviewBaseService) ListBaseQuestions(ctx context.Context, onlyActive bool) ([]model.InterviewBaseQuestion, error) {
	return s.repo.List(ctx, onlyActive)
}

// GetBaseQuestion retrieves a single base question by ID.
func (s *InterviewBaseService) GetBaseQuestion(ctx context.Context, id uuid.UUID) (*model.InterviewBaseQuestion, error) {
	q, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if q == nil {
		return nil, fmt.Errorf("base question not found")
	}
	return q, nil
}

// CreateBaseQuestion creates a new question in the bank.
func (s *InterviewBaseService) CreateBaseQuestion(ctx context.Context, in CreateBaseQuestionInput) (*model.InterviewBaseQuestion, error) {
	qText := strings.TrimSpace(in.QuestionText)
	if qText == "" {
		return nil, fmt.Errorf("question_text is required")
	}
	rq := strings.ToUpper(strings.TrimSpace(in.RQCategory))
	if rq == "" {
		rq = "RQ1"
	}
	section := strings.TrimSpace(in.Section)
	if section == "" {
		section = "Custom"
	}
	secTitle := strings.TrimSpace(in.SectionTitle)
	if secTitle == "" {
		secTitle = "Custom Questions"
	}
	isActive := true
	if in.IsActive != nil {
		isActive = *in.IsActive
	}

	q := &model.InterviewBaseQuestion{
		ID:            uuid.New(),
		Section:       section,
		SectionTitle:  secTitle,
		QuestionIndex: in.QuestionIndex,
		QuestionText:  qText,
		RQCategory:    rq,
		IsActive:      isActive,
		SortOrder:     in.SortOrder,
	}

	if err := s.repo.Create(ctx, q); err != nil {
		return nil, err
	}
	return q, nil
}

// UpdateBaseQuestion updates an existing base question.
func (s *InterviewBaseService) UpdateBaseQuestion(ctx context.Context, id uuid.UUID, in UpdateBaseQuestionInput) (*model.InterviewBaseQuestion, error) {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if existing == nil {
		return nil, fmt.Errorf("base question not found")
	}

	qText := strings.TrimSpace(in.QuestionText)
	if qText != "" {
		existing.QuestionText = qText
	}
	if in.Section != "" {
		existing.Section = strings.TrimSpace(in.Section)
	}
	if in.SectionTitle != "" {
		existing.SectionTitle = strings.TrimSpace(in.SectionTitle)
	}
	if in.RQCategory != "" {
		existing.RQCategory = strings.ToUpper(strings.TrimSpace(in.RQCategory))
	}
	if in.QuestionIndex > 0 {
		existing.QuestionIndex = in.QuestionIndex
	}
	existing.SortOrder = in.SortOrder
	existing.IsActive = in.IsActive

	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

// DeleteBaseQuestion deletes a question by ID.
func (s *InterviewBaseService) DeleteBaseQuestion(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

// ResetToDefaults resets the base questions bank to the default 22 semi-structured questions.
func (s *InterviewBaseService) ResetToDefaults(ctx context.Context) ([]model.InterviewBaseQuestion, error) {
	if err := s.repo.ResetToDefaults(ctx); err != nil {
		return nil, err
	}
	return s.repo.List(ctx, false)
}
