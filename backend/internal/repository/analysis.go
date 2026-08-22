package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/video-teaching-research/backend/internal/model"
)

// AnalysisRepository handles Phase 6 database operations.
type AnalysisRepository struct {
	db *DB
}

// NewAnalysisRepository creates a new AnalysisRepository.
func NewAnalysisRepository(db *DB) *AnalysisRepository {
	return &AnalysisRepository{db: db}
}

// CreateRun initializes an analysis_runs record.
func (r *AnalysisRepository) CreateRun(ctx context.Context, run *model.AnalysisRun) error {
	query := `
		INSERT INTO analysis_runs (id, triggered_at, status, config, error_msg, completed_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	_, err := r.db.Pool.Exec(ctx, query,
		run.ID, run.TriggeredAt, run.Status, run.Config, run.ErrorMsg, run.CompletedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create analysis run: %w", err)
	}
	return nil
}

// UpdateRunStatus updates the status and optional error message of an analysis run.
func (r *AnalysisRepository) UpdateRunStatus(ctx context.Context, runID uuid.UUID, status string, errorMsg *string) error {
	var completedAt *time.Time
	if status == "completed" || status == "error" {
		now := time.Now()
		completedAt = &now
	}
	query := `
		UPDATE analysis_runs
		SET status = $1, error_msg = $2, completed_at = COALESCE($3, completed_at)
		WHERE id = $4
	`
	_, err := r.db.Pool.Exec(ctx, query, status, errorMsg, completedAt, runID)
	if err != nil {
		return fmt.Errorf("failed to update analysis run: %w", err)
	}
	return nil
}

// GetRun returns an analysis run by ID.
func (r *AnalysisRepository) GetRun(ctx context.Context, runID uuid.UUID) (*model.AnalysisRun, error) {
	query := `
		SELECT id, triggered_at, status, config, error_msg, completed_at
		FROM analysis_runs
		WHERE id = $1
	`
	var run model.AnalysisRun
	err := r.db.Pool.QueryRow(ctx, query, runID).Scan(
		&run.ID, &run.TriggeredAt, &run.Status, &run.Config, &run.ErrorMsg, &run.CompletedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get analysis run: %w", err)
	}
	return &run, nil
}

// GetLatestRun returns the most recent analysis run.
func (r *AnalysisRepository) GetLatestRun(ctx context.Context) (*model.AnalysisRun, error) {
	query := `
		SELECT id, triggered_at, status, config, error_msg, completed_at
		FROM analysis_runs
		ORDER BY triggered_at DESC
		LIMIT 1
	`
	var run model.AnalysisRun
	err := r.db.Pool.QueryRow(ctx, query).Scan(
		&run.ID, &run.TriggeredAt, &run.Status, &run.Config, &run.ErrorMsg, &run.CompletedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get latest analysis run: %w", err)
	}
	return &run, nil
}

// SavePatterns inserts detected recurring patterns.
func (r *AnalysisRepository) SavePatterns(ctx context.Context, patterns []model.Pattern) error {
	if len(patterns) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	query := `
		INSERT INTO patterns (
			id, analysis_run_id, checklist_item_id, event_key, description,
			frequency_score, threshold_method, intra_teacher_count, cross_teacher_count, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	for _, p := range patterns {
		batch.Queue(query,
			p.ID, p.AnalysisRunID, p.ChecklistItemID, p.EventKey, p.Description,
			p.FrequencyScore, p.ThresholdMethod, p.IntraTeacherCount, p.CrossTeacherCount, p.CreatedAt,
		)
	}
	br := r.db.Pool.SendBatch(ctx, batch)
	defer br.Close()

	for range patterns {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("failed to insert pattern: %w", err)
		}
	}
	return nil
}

// SaveCategories inserts categories.
func (r *AnalysisRepository) SaveCategories(ctx context.Context, categories []model.Category) error {
	if len(categories) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	query := `
		INSERT INTO categories (id, analysis_run_id, name, description, pattern_ids, created_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`
	for _, c := range categories {
		batch.Queue(query, c.ID, c.AnalysisRunID, c.Name, c.Description, c.PatternIDs, c.CreatedAt)
	}
	br := r.db.Pool.SendBatch(ctx, batch)
	defer br.Close()

	for range categories {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("failed to insert category: %w", err)
		}
	}
	return nil
}

// SaveThemes inserts themes with reasoning traces.
func (r *AnalysisRepository) SaveThemes(ctx context.Context, themes []model.Theme) error {
	if len(themes) == 0 {
		return nil
	}
	batch := &pgx.Batch{}
	query := `
		INSERT INTO themes (id, analysis_run_id, name, description, reasoning_trace, category_ids, status, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	for _, t := range themes {
		batch.Queue(query, t.ID, t.AnalysisRunID, t.Name, t.Description, t.ReasoningTrace, t.CategoryIDs, t.Status, t.CreatedAt)
	}
	br := r.db.Pool.SendBatch(ctx, batch)
	defer br.Close()

	for range themes {
		if _, err := br.Exec(); err != nil {
			return fmt.Errorf("failed to insert theme: %w", err)
		}
	}
	return nil
}

// GetThemesByRunID returns all themes for an analysis run.
func (r *AnalysisRepository) GetThemesByRunID(ctx context.Context, runID uuid.UUID) ([]model.Theme, error) {
	query := `
		SELECT id, analysis_run_id, name, description, reasoning_trace, category_ids, status, created_at
		FROM themes
		WHERE analysis_run_id = $1
		ORDER BY created_at ASC
	`
	rows, err := r.db.Pool.Query(ctx, query, runID)
	if err != nil {
		return nil, fmt.Errorf("failed to list themes: %w", err)
	}
	defer rows.Close()

	var themes []model.Theme
	for rows.Next() {
		var t model.Theme
		if err := rows.Scan(
			&t.ID, &t.AnalysisRunID, &t.Name, &t.Description, &t.ReasoningTrace, &t.CategoryIDs, &t.Status, &t.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan theme: %w", err)
		}
		themes = append(themes, t)
	}
	return themes, nil
}

// UpdateTheme updates theme name, description, and status.
func (r *AnalysisRepository) UpdateTheme(ctx context.Context, id uuid.UUID, name, description, status string) error {
	query := `UPDATE themes SET name = $1, description = $2, status = $3 WHERE id = $4`
	_, err := r.db.Pool.Exec(ctx, query, name, description, status, id)
	if err != nil {
		return fmt.Errorf("failed to update theme: %w", err)
	}
	return nil
}

// MergeThemes merges sourceTheme into targetTheme and deletes sourceTheme.
func (r *AnalysisRepository) MergeThemes(ctx context.Context, targetID, sourceID uuid.UUID) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Append source category_ids to target theme
	query := `
		UPDATE themes
		SET category_ids = array_cat(category_ids, (SELECT category_ids FROM themes WHERE id = $1))
		WHERE id = $2
	`
	if _, err := tx.Exec(ctx, query, sourceID, targetID); err != nil {
		return fmt.Errorf("failed to merge categories into target theme: %w", err)
	}

	// Delete source theme
	if _, err := tx.Exec(ctx, `DELETE FROM themes WHERE id = $1`, sourceID); err != nil {
		return fmt.Errorf("failed to delete source theme: %w", err)
	}

	return tx.Commit(ctx)
}

// SaveTeacherAnalyses inserts per-teacher analyses and generated interview questions.
func (r *AnalysisRepository) SaveTeacherAnalysis(
	ctx context.Context,
	ta *model.TeacherAnalysis,
	questions []model.InterviewQuestion,
) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	taQuery := `
		INSERT INTO teacher_analyses (id, analysis_run_id, teacher_id, theme_ids, context_summary, markdown_content, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	if _, err := tx.Exec(ctx, taQuery,
		ta.ID, ta.AnalysisRunID, ta.TeacherID, ta.ThemeIDs, ta.ContextSummary, ta.MarkdownContent, ta.CreatedAt,
	); err != nil {
		return fmt.Errorf("failed to insert teacher analysis: %w", err)
	}

	qQuery := `
		INSERT INTO interview_questions (id, teacher_analysis_id, teacher_id, type, question_text, evidence_ref, sort_order, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`
	for _, q := range questions {
		if _, err := tx.Exec(ctx, qQuery,
			q.ID, ta.ID, q.TeacherID, q.Type, q.QuestionText, q.EvidenceRef, q.SortOrder, q.CreatedAt,
		); err != nil {
			return fmt.Errorf("failed to insert interview question: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// GetTeacherAnalysis returns the analysis and questions for a teacher.
func (r *AnalysisRepository) GetTeacherAnalysis(ctx context.Context, runID uuid.UUID, teacherID string) (*model.TeacherAnalysis, []model.InterviewQuestion, error) {
	taQuery := `
		SELECT id, analysis_run_id, teacher_id, theme_ids, context_summary, markdown_content, created_at
		FROM teacher_analyses
		WHERE analysis_run_id = $1 AND teacher_id = $2
	`
	var ta model.TeacherAnalysis
	err := r.db.Pool.QueryRow(ctx, taQuery, runID, teacherID).Scan(
		&ta.ID, &ta.AnalysisRunID, &ta.TeacherID, &ta.ThemeIDs, &ta.ContextSummary, &ta.MarkdownContent, &ta.CreatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil, nil
		}
		return nil, nil, fmt.Errorf("failed to get teacher analysis: %w", err)
	}

	qQuery := `
		SELECT id, teacher_analysis_id, teacher_id, type, question_text, evidence_ref, sort_order, created_at
		FROM interview_questions
		WHERE teacher_analysis_id = $1
		ORDER BY type, sort_order
	`
	rows, err := r.db.Pool.Query(ctx, qQuery, ta.ID)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to get interview questions: %w", err)
	}
	defer rows.Close()

	var questions []model.InterviewQuestion
	for rows.Next() {
		var q model.InterviewQuestion
		if err := rows.Scan(
			&q.ID, &q.TeacherAnalysisID, &q.TeacherID, &q.Type, &q.QuestionText, &q.EvidenceRef, &q.SortOrder, &q.CreatedAt,
		); err != nil {
			return nil, nil, fmt.Errorf("failed to scan interview question: %w", err)
		}
		questions = append(questions, q)
	}

	return &ta, questions, nil
}
