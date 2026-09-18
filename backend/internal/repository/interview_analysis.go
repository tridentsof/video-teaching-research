package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/video-teaching-research/backend/internal/model"
)

// InterviewAnalysisRepository handles database persistence for post-interview qualitative analysis.
type InterviewAnalysisRepository struct {
	db *DB
}

// NewInterviewAnalysisRepository creates a new instance of InterviewAnalysisRepository.
func NewInterviewAnalysisRepository(db *DB) *InterviewAnalysisRepository {
	return &InterviewAnalysisRepository{db: db}
}

// --- Interview Responses ---

// CreateResponse inserts a new interview response row.
func (r *InterviewAnalysisRepository) CreateResponse(ctx context.Context, resp *model.InterviewResponse) error {
	if resp.ID == uuid.Nil {
		resp.ID = uuid.New()
	}
	now := time.Now()
	resp.CreatedAt = now
	resp.UpdatedAt = now

	query := `
		INSERT INTO interview_responses (
			id, analysis_run_id, teacher_id, question_id, question_text,
			audio_blob_path, audio_filename, audio_duration_sec, language,
			raw_transcript, transcript_status, response_text, recorded_at, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
		)
	`
	_, err := r.db.Pool.Exec(ctx, query,
		resp.ID, resp.AnalysisRunID, resp.TeacherID, resp.QuestionID, resp.QuestionText,
		resp.AudioBlobPath, resp.AudioFilename, resp.AudioDurationSec, resp.Language,
		resp.RawTranscript, resp.TranscriptStatus, resp.ResponseText, resp.RecordedAt, resp.CreatedAt, resp.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert interview response: %w", err)
	}
	return nil
}

// GetResponseByID fetches a single response by its ID.
func (r *InterviewAnalysisRepository) GetResponseByID(ctx context.Context, id uuid.UUID) (*model.InterviewResponse, error) {
	query := `
		SELECT id, analysis_run_id, teacher_id, question_id, question_text,
		       audio_blob_path, audio_filename, audio_duration_sec, language,
		       raw_transcript, transcript_status, response_text, recorded_at, created_at, updated_at
		FROM interview_responses
		WHERE id = $1
	`
	var resp model.InterviewResponse
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&resp.ID, &resp.AnalysisRunID, &resp.TeacherID, &resp.QuestionID, &resp.QuestionText,
		&resp.AudioBlobPath, &resp.AudioFilename, &resp.AudioDurationSec, &resp.Language,
		&resp.RawTranscript, &resp.TranscriptStatus, &resp.ResponseText, &resp.RecordedAt, &resp.CreatedAt, &resp.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to query interview response: %w", err)
	}
	return &resp, nil
}

// ListResponsesByTeacher returns all responses for a given teacher in an analysis run.
func (r *InterviewAnalysisRepository) ListResponsesByTeacher(ctx context.Context, runID uuid.UUID, teacherID string) ([]model.InterviewResponse, error) {
	query := `
		SELECT id, analysis_run_id, teacher_id, question_id, question_text,
		       audio_blob_path, audio_filename, audio_duration_sec, language,
		       raw_transcript, transcript_status, response_text, recorded_at, created_at, updated_at
		FROM interview_responses
		WHERE analysis_run_id = $1 AND teacher_id = $2
		ORDER BY created_at ASC
	`
	rows, err := r.db.Pool.Query(ctx, query, runID, teacherID)
	if err != nil {
		return nil, fmt.Errorf("failed to list responses for teacher %s: %w", teacherID, err)
	}
	defer rows.Close()

	var list []model.InterviewResponse
	for rows.Next() {
		var resp model.InterviewResponse
		if err := rows.Scan(
			&resp.ID, &resp.AnalysisRunID, &resp.TeacherID, &resp.QuestionID, &resp.QuestionText,
			&resp.AudioBlobPath, &resp.AudioFilename, &resp.AudioDurationSec, &resp.Language,
			&resp.RawTranscript, &resp.TranscriptStatus, &resp.ResponseText, &resp.RecordedAt, &resp.CreatedAt, &resp.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan interview response: %w", err)
		}
		list = append(list, resp)
	}
	return list, nil
}

// ListResponsesByRun returns all responses across all teachers for a run.
func (r *InterviewAnalysisRepository) ListResponsesByRun(ctx context.Context, runID uuid.UUID) ([]model.InterviewResponse, error) {
	query := `
		SELECT id, analysis_run_id, teacher_id, question_id, question_text,
		       audio_blob_path, audio_filename, audio_duration_sec, language,
		       raw_transcript, transcript_status, response_text, recorded_at, created_at, updated_at
		FROM interview_responses
		WHERE analysis_run_id = $1
		ORDER BY teacher_id ASC, created_at ASC
	`
	rows, err := r.db.Pool.Query(ctx, query, runID)
	if err != nil {
		return nil, fmt.Errorf("failed to list responses for run: %w", err)
	}
	defer rows.Close()

	var list []model.InterviewResponse
	for rows.Next() {
		var resp model.InterviewResponse
		if err := rows.Scan(
			&resp.ID, &resp.AnalysisRunID, &resp.TeacherID, &resp.QuestionID, &resp.QuestionText,
			&resp.AudioBlobPath, &resp.AudioFilename, &resp.AudioDurationSec, &resp.Language,
			&resp.RawTranscript, &resp.TranscriptStatus, &resp.ResponseText, &resp.RecordedAt, &resp.CreatedAt, &resp.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan interview response: %w", err)
		}
		list = append(list, resp)
	}
	return list, nil
}

// UpdateResponseTranscript updates raw transcript and status.
func (r *InterviewAnalysisRepository) UpdateResponseTranscript(ctx context.Context, id uuid.UUID, rawTranscript string, status string) error {
	query := `
		UPDATE interview_responses
		SET raw_transcript = $1, transcript_status = $2, updated_at = NOW()
		WHERE id = $3
	`
	_, err := r.db.Pool.Exec(ctx, query, rawTranscript, status, id)
	return err
}

// FinalizeResponse updates the finalized response text and marks transcript_status as 'finalized'.
func (r *InterviewAnalysisRepository) FinalizeResponse(ctx context.Context, id uuid.UUID, responseText string) error {
	query := `
		UPDATE interview_responses
		SET response_text = $1, transcript_status = 'finalized', updated_at = NOW()
		WHERE id = $2
	`
	_, err := r.db.Pool.Exec(ctx, query, responseText, id)
	return err
}

// DeleteResponse deletes an interview response by ID.
func (r *InterviewAnalysisRepository) DeleteResponse(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM interview_responses WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	return err
}

// --- Meaning Units ---

// SaveMeaningUnits inserts meaning units for a response, replacing any existing ones.
func (r *InterviewAnalysisRepository) SaveMeaningUnits(ctx context.Context, responseID uuid.UUID, units []model.MeaningUnit) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin tx for meaning units: %w", err)
	}
	defer tx.Rollback(ctx)

	// Clear existing units for this response
	_, err = tx.Exec(ctx, `DELETE FROM meaning_units WHERE response_id = $1`, responseID)
	if err != nil {
		return fmt.Errorf("failed to clear old meaning units: %w", err)
	}

	for _, u := range units {
		if u.ID == uuid.Nil {
			u.ID = uuid.New()
		}
		now := time.Now()
		_, err := tx.Exec(ctx, `
			INSERT INTO meaning_units (
				id, response_id, teacher_id, unit_text, unit_index,
				initial_code, category, is_ai_generated, is_user_edited, created_at, updated_at
			) VALUES (
				$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
			)
		`, u.ID, responseID, u.TeacherID, u.UnitText, u.UnitIndex,
			u.InitialCode, u.Category, u.IsAIGenerated, u.IsUserEdited, now, now)
		if err != nil {
			return fmt.Errorf("failed to insert meaning unit: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// ListMeaningUnitsByTeacher fetches meaning units by teacher ID across all their responses.
func (r *InterviewAnalysisRepository) ListMeaningUnitsByTeacher(ctx context.Context, teacherID string) ([]model.MeaningUnit, error) {
	query := `
		SELECT id, response_id, teacher_id, unit_text, unit_index,
		       initial_code, category, is_ai_generated, is_user_edited, created_at, updated_at
		FROM meaning_units
		WHERE teacher_id = $1
		ORDER BY unit_index ASC, created_at ASC
	`
	rows, err := r.db.Pool.Query(ctx, query, teacherID)
	if err != nil {
		return nil, fmt.Errorf("failed to list meaning units for teacher %s: %w", teacherID, err)
	}
	defer rows.Close()

	var list []model.MeaningUnit
	for rows.Next() {
		var u model.MeaningUnit
		if err := rows.Scan(
			&u.ID, &u.ResponseID, &u.TeacherID, &u.UnitText, &u.UnitIndex,
			&u.InitialCode, &u.Category, &u.IsAIGenerated, &u.IsUserEdited, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan meaning unit: %w", err)
		}
		list = append(list, u)
	}
	return list, nil
}

// ListMeaningUnitsByRun fetches all meaning units for an entire analysis run.
func (r *InterviewAnalysisRepository) ListMeaningUnitsByRun(ctx context.Context, runID uuid.UUID) ([]model.MeaningUnit, error) {
	query := `
		SELECT m.id, m.response_id, m.teacher_id, m.unit_text, m.unit_index,
		       m.initial_code, m.category, m.is_ai_generated, m.is_user_edited, m.created_at, m.updated_at
		FROM meaning_units m
		JOIN interview_responses r ON m.response_id = r.id
		WHERE r.analysis_run_id = $1
		ORDER BY m.teacher_id ASC, m.unit_index ASC
	`
	rows, err := r.db.Pool.Query(ctx, query, runID)
	if err != nil {
		return nil, fmt.Errorf("failed to list meaning units for run: %w", err)
	}
	defer rows.Close()

	var list []model.MeaningUnit
	for rows.Next() {
		var u model.MeaningUnit
		if err := rows.Scan(
			&u.ID, &u.ResponseID, &u.TeacherID, &u.UnitText, &u.UnitIndex,
			&u.InitialCode, &u.Category, &u.IsAIGenerated, &u.IsUserEdited, &u.CreatedAt, &u.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan meaning unit: %w", err)
		}
		list = append(list, u)
	}
	return list, nil
}

// UpdateMeaningUnit updates text, initial code, or category of a unit.
func (r *InterviewAnalysisRepository) UpdateMeaningUnit(ctx context.Context, id uuid.UUID, dto model.MeaningUnitUpdateDTO) (*model.MeaningUnit, error) {
	query := `
		UPDATE meaning_units
		SET unit_text = COALESCE($1, unit_text),
		    initial_code = COALESCE($2, initial_code),
		    category = COALESCE($3, category),
		    is_user_edited = true,
		    updated_at = NOW()
		WHERE id = $4
		RETURNING id, response_id, teacher_id, unit_text, unit_index,
		          initial_code, category, is_ai_generated, is_user_edited, created_at, updated_at
	`
	var u model.MeaningUnit
	err := r.db.Pool.QueryRow(ctx, query, dto.UnitText, dto.InitialCode, dto.Category, id).Scan(
		&u.ID, &u.ResponseID, &u.TeacherID, &u.UnitText, &u.UnitIndex,
		&u.InitialCode, &u.Category, &u.IsAIGenerated, &u.IsUserEdited, &u.CreatedAt, &u.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update meaning unit: %w", err)
	}
	return &u, nil
}

// CreateMeaningUnit inserts a single meaning unit manually.
func (r *InterviewAnalysisRepository) CreateMeaningUnit(ctx context.Context, u *model.MeaningUnit) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	now := time.Now()
	u.CreatedAt = now
	u.UpdatedAt = now
	u.IsUserEdited = true
	u.IsAIGenerated = false

	query := `
		INSERT INTO meaning_units (
			id, response_id, teacher_id, unit_text, unit_index,
			initial_code, category, is_ai_generated, is_user_edited, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`
	_, err := r.db.Pool.Exec(ctx, query,
		u.ID, u.ResponseID, u.TeacherID, u.UnitText, u.UnitIndex,
		u.InitialCode, u.Category, u.IsAIGenerated, u.IsUserEdited, u.CreatedAt, u.UpdatedAt,
	)
	return err
}

// DeleteMeaningUnit deletes a meaning unit.
func (r *InterviewAnalysisRepository) DeleteMeaningUnit(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM meaning_units WHERE id = $1`, id)
	return err
}

// --- Interview Codes & Categories ---

// SaveInterviewCodes inserts or replaces aggregated interview codes for an analysis run.
func (r *InterviewAnalysisRepository) SaveInterviewCodes(ctx context.Context, runID uuid.UUID, codes []model.InterviewCode) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin tx for interview codes: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `DELETE FROM interview_codes WHERE analysis_run_id = $1`, runID)
	if err != nil {
		return fmt.Errorf("failed to clear old interview codes: %w", err)
	}

	for _, c := range codes {
		if c.ID == uuid.Nil {
			c.ID = uuid.New()
		}
		now := time.Now()
		_, err := tx.Exec(ctx, `
			INSERT INTO interview_codes (
				id, analysis_run_id, code_name, category, frequency, teacher_ids, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, c.ID, runID, c.CodeName, c.Category, c.Frequency, c.TeacherIDs, now)
		if err != nil {
			return fmt.Errorf("failed to insert interview code: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// ListInterviewCodes fetches all aggregated interview codes for an analysis run.
func (r *InterviewAnalysisRepository) ListInterviewCodes(ctx context.Context, runID uuid.UUID) ([]model.InterviewCode, error) {
	query := `
		SELECT id, analysis_run_id, code_name, category, frequency, teacher_ids, created_at
		FROM interview_codes
		WHERE analysis_run_id = $1
		ORDER BY category ASC, frequency DESC, code_name ASC
	`
	rows, err := r.db.Pool.Query(ctx, query, runID)
	if err != nil {
		return nil, fmt.Errorf("failed to list interview codes: %w", err)
	}
	defer rows.Close()

	var list []model.InterviewCode
	for rows.Next() {
		var c model.InterviewCode
		if err := rows.Scan(
			&c.ID, &c.AnalysisRunID, &c.CodeName, &c.Category, &c.Frequency, &c.TeacherIDs, &c.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan interview code: %w", err)
		}
		list = append(list, c)
	}
	return list, nil
}

// --- Triangulation Entries ---

// SaveTriangulationEntries inserts or updates triangulation entries for a run.
func (r *InterviewAnalysisRepository) SaveTriangulationEntries(ctx context.Context, runID uuid.UUID, entries []model.TriangulationEntry) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin tx for triangulation: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `DELETE FROM triangulation_entries WHERE analysis_run_id = $1`, runID)
	if err != nil {
		return fmt.Errorf("failed to clear old triangulation entries: %w", err)
	}

	for _, e := range entries {
		if e.ID == uuid.Nil {
			e.ID = uuid.New()
		}
		now := time.Now()
		_, err := tx.Exec(ctx, `
			INSERT INTO triangulation_entries (
				id, analysis_run_id, observation_finding, interview_evidence,
				teacher_ref, relationship, theme_id, is_ai_generated, is_user_edited, created_at, updated_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`, e.ID, runID, e.ObservationFinding, e.InterviewEvidence,
			e.TeacherRef, e.Relationship, e.ThemeID, e.IsAIGenerated, e.IsUserEdited, now, now)
		if err != nil {
			return fmt.Errorf("failed to insert triangulation entry: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// ListTriangulationEntries returns all triangulation entries for an analysis run.
func (r *InterviewAnalysisRepository) ListTriangulationEntries(ctx context.Context, runID uuid.UUID) ([]model.TriangulationEntry, error) {
	query := `
		SELECT id, analysis_run_id, observation_finding, interview_evidence,
		       teacher_ref, relationship, theme_id, is_ai_generated, is_user_edited, created_at, updated_at
		FROM triangulation_entries
		WHERE analysis_run_id = $1
		ORDER BY created_at ASC
	`
	rows, err := r.db.Pool.Query(ctx, query, runID)
	if err != nil {
		return nil, fmt.Errorf("failed to list triangulation entries: %w", err)
	}
	defer rows.Close()

	var list []model.TriangulationEntry
	for rows.Next() {
		var e model.TriangulationEntry
		if err := rows.Scan(
			&e.ID, &e.AnalysisRunID, &e.ObservationFinding, &e.InterviewEvidence,
			&e.TeacherRef, &e.Relationship, &e.ThemeID, &e.IsAIGenerated, &e.IsUserEdited, &e.CreatedAt, &e.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan triangulation entry: %w", err)
		}
		list = append(list, e)
	}
	return list, nil
}

// UpdateTriangulationEntry updates an existing triangulation entry.
func (r *InterviewAnalysisRepository) UpdateTriangulationEntry(ctx context.Context, id uuid.UUID, relationship string, obsFinding string, intEvidence string) (*model.TriangulationEntry, error) {
	query := `
		UPDATE triangulation_entries
		SET relationship = COALESCE(NULLIF($1, ''), relationship),
		    observation_finding = COALESCE(NULLIF($2, ''), observation_finding),
		    interview_evidence = COALESCE(NULLIF($3, ''), interview_evidence),
		    is_user_edited = true,
		    updated_at = NOW()
		WHERE id = $4
		RETURNING id, analysis_run_id, observation_finding, interview_evidence,
		          teacher_ref, relationship, theme_id, is_ai_generated, is_user_edited, created_at, updated_at
	`
	var e model.TriangulationEntry
	err := r.db.Pool.QueryRow(ctx, query, relationship, obsFinding, intEvidence, id).Scan(
		&e.ID, &e.AnalysisRunID, &e.ObservationFinding, &e.InterviewEvidence,
		&e.TeacherRef, &e.Relationship, &e.ThemeID, &e.IsAIGenerated, &e.IsUserEdited, &e.CreatedAt, &e.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to update triangulation entry: %w", err)
	}
	return &e, nil
}

// --- Representative Quotes ---

// SaveRepresentativeQuotes saves representative quotes for an analysis run.
func (r *InterviewAnalysisRepository) SaveRepresentativeQuotes(ctx context.Context, runID uuid.UUID, quotes []model.RepresentativeQuote) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin tx for quotes: %w", err)
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx, `DELETE FROM representative_quotes WHERE analysis_run_id = $1`, runID)
	if err != nil {
		return fmt.Errorf("failed to clear old quotes: %w", err)
	}

	for _, q := range quotes {
		if q.ID == uuid.Nil {
			q.ID = uuid.New()
		}
		now := time.Now()
		_, err := tx.Exec(ctx, `
			INSERT INTO representative_quotes (
				id, analysis_run_id, teacher_id, quote_text, quote_source,
				theme_id, rq_category, relevance_type, is_selected, created_at
			) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`, q.ID, runID, q.TeacherID, q.QuoteText, q.QuoteSource,
			q.ThemeID, q.RQCategory, q.RelevanceType, q.IsSelected, now)
		if err != nil {
			return fmt.Errorf("failed to insert representative quote: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// ListRepresentativeQuotes fetches quotes for an analysis run.
func (r *InterviewAnalysisRepository) ListRepresentativeQuotes(ctx context.Context, runID uuid.UUID) ([]model.RepresentativeQuote, error) {
	query := `
		SELECT id, analysis_run_id, teacher_id, quote_text, quote_source,
		       theme_id, rq_category, relevance_type, is_selected, created_at
		FROM representative_quotes
		WHERE analysis_run_id = $1
		ORDER BY rq_category ASC, teacher_id ASC, created_at ASC
	`
	rows, err := r.db.Pool.Query(ctx, query, runID)
	if err != nil {
		return nil, fmt.Errorf("failed to list representative quotes: %w", err)
	}
	defer rows.Close()

	var list []model.RepresentativeQuote
	for rows.Next() {
		var q model.RepresentativeQuote
		if err := rows.Scan(
			&q.ID, &q.AnalysisRunID, &q.TeacherID, &q.QuoteText, &q.QuoteSource,
			&q.ThemeID, &q.RQCategory, &q.RelevanceType, &q.IsSelected, &q.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan representative quote: %w", err)
		}
		list = append(list, q)
	}
	return list, nil
}

// ToggleQuoteSelection toggles the is_selected flag for a quote.
func (r *InterviewAnalysisRepository) ToggleQuoteSelection(ctx context.Context, id uuid.UUID, isSelected bool) error {
	query := `UPDATE representative_quotes SET is_selected = $1 WHERE id = $2`
	_, err := r.db.Pool.Exec(ctx, query, isSelected, id)
	return err
}
