package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/video-teaching-research/backend/internal/model"
)

// InterviewBaseRepository handles persistence of standard semi-structured interview base questions.
type InterviewBaseRepository struct {
	db *DB
}

// NewInterviewBaseRepository creates a new instance of InterviewBaseRepository.
func NewInterviewBaseRepository(db *DB) *InterviewBaseRepository {
	return &InterviewBaseRepository{db: db}
}

// List returns all base interview questions ordered by sort_order / question_index.
func (r *InterviewBaseRepository) List(ctx context.Context, onlyActive bool) ([]model.InterviewBaseQuestion, error) {
	query := `
		SELECT id, section, section_title, question_index, question_text, rq_category, is_active, sort_order, created_at, updated_at
		FROM interview_base_questions
	`
	if onlyActive {
		query += ` WHERE is_active = true `
	}
	query += ` ORDER BY sort_order ASC, question_index ASC `

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list base questions: %w", err)
	}
	defer rows.Close()

	var questions []model.InterviewBaseQuestion
	for rows.Next() {
		var q model.InterviewBaseQuestion
		if err := rows.Scan(
			&q.ID, &q.Section, &q.SectionTitle, &q.QuestionIndex, &q.QuestionText,
			&q.RQCategory, &q.IsActive, &q.SortOrder, &q.CreatedAt, &q.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan base question: %w", err)
		}
		questions = append(questions, q)
	}
	return questions, nil
}

// GetByID returns a base question by ID.
func (r *InterviewBaseRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.InterviewBaseQuestion, error) {
	query := `
		SELECT id, section, section_title, question_index, question_text, rq_category, is_active, sort_order, created_at, updated_at
		FROM interview_base_questions
		WHERE id = $1
	`
	var q model.InterviewBaseQuestion
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(
		&q.ID, &q.Section, &q.SectionTitle, &q.QuestionIndex, &q.QuestionText,
		&q.RQCategory, &q.IsActive, &q.SortOrder, &q.CreatedAt, &q.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get base question: %w", err)
	}
	return &q, nil
}

// Create inserts a new base question into the bank.
func (r *InterviewBaseRepository) Create(ctx context.Context, q *model.InterviewBaseQuestion) error {
	if q.ID == uuid.Nil {
		q.ID = uuid.New()
	}
	now := time.Now()
	q.CreatedAt = now
	q.UpdatedAt = now

	query := `
		INSERT INTO interview_base_questions (id, section, section_title, question_index, question_text, rq_category, is_active, sort_order, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`
	_, err := r.db.Pool.Exec(ctx, query,
		q.ID, q.Section, q.SectionTitle, q.QuestionIndex, q.QuestionText,
		q.RQCategory, q.IsActive, q.SortOrder, q.CreatedAt, q.UpdatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to create base question: %w", err)
	}
	return nil
}

// Update modifies an existing base question.
func (r *InterviewBaseRepository) Update(ctx context.Context, q *model.InterviewBaseQuestion) error {
	q.UpdatedAt = time.Now()
	query := `
		UPDATE interview_base_questions
		SET section = $1, section_title = $2, question_index = $3, question_text = $4,
		    rq_category = $5, is_active = $6, sort_order = $7, updated_at = $8
		WHERE id = $9
	`
	res, err := r.db.Pool.Exec(ctx, query,
		q.Section, q.SectionTitle, q.QuestionIndex, q.QuestionText,
		q.RQCategory, q.IsActive, q.SortOrder, q.UpdatedAt, q.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update base question: %w", err)
	}
	if res.RowsAffected() == 0 {
		return fmt.Errorf("base question not found: %s", q.ID)
	}
	return nil
}

// Delete removes a base question by ID.
func (r *InterviewBaseRepository) Delete(ctx context.Context, id uuid.UUID) error {
	query := `DELETE FROM interview_base_questions WHERE id = $1`
	_, err := r.db.Pool.Exec(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete base question: %w", err)
	}
	return nil
}

// ResetToDefaults wipes the current table and restores the canonical 22 questions.
func (r *InterviewBaseRepository) ResetToDefaults(ctx context.Context) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `TRUNCATE TABLE interview_base_questions`); err != nil {
		return fmt.Errorf("failed to truncate interview_base_questions: %w", err)
	}

	seedQuery := `
		INSERT INTO interview_base_questions (section, section_title, question_index, question_text, rq_category, sort_order)
		VALUES
			('Section A', 'Background Information', 1, 'Could you briefly introduce yourself and describe your current teaching position?', 'BACKGROUND', 1),
			('Section A', 'Background Information', 2, 'How many years have you been teaching English?', 'BACKGROUND', 2),
			('Section A', 'Background Information', 3, 'How long have you been teaching online English classes?', 'BACKGROUND', 3),
			('Section A', 'Background Information', 4, 'Which grades or age groups do you currently teach?', 'BACKGROUND', 4),
			('Section A', 'Background Information', 5, 'Which online platforms do you usually use for your English speaking lessons?', 'BACKGROUND', 5),

			('Section B', 'Classroom Management Strategies (RQ1)', 6, 'Could you describe how you usually manage an online English speaking lesson from the beginning to the end?', 'RQ1', 6),
			('Section B', 'Classroom Management Strategies (RQ1)', 7, 'How do you establish classroom rules and routines in your online speaking classes?', 'RQ1', 7),
			('Section B', 'Classroom Management Strategies (RQ1)', 8, 'How do you manage turn-taking during speaking activities?', 'RQ1', 8),
			('Section B', 'Classroom Management Strategies (RQ1)', 9, 'What strategies do you use to maintain learners'' attention and engagement throughout the lesson?', 'RQ1', 9),
			('Section B', 'Classroom Management Strategies (RQ1)', 10, 'How do you support learners when they have difficulty speaking English?', 'RQ1', 10),
			('Section B', 'Classroom Management Strategies (RQ1)', 11, 'How do you use digital tools such as the chat box, breakout rooms, reaction icons, screen sharing, or digital whiteboards during speaking lessons?', 'RQ1', 11),

			('Section C', 'Teachers'' Perceptions (RQ2)', 12, 'In your opinion, what role does classroom management play in promoting speaking participation among primary learners?', 'RQ2', 12),
			('Section C', 'Teachers'' Perceptions (RQ2)', 13, 'Which classroom management strategies do you consider most effective? Why?', 'RQ2', 13),
			('Section C', 'Teachers'' Perceptions (RQ2)', 14, 'How do these strategies influence learners'' confidence and willingness to communicate?', 'RQ2', 14),
			('Section C', 'Teachers'' Perceptions (RQ2)', 15, 'Do different learners respond differently to the same classroom management strategies? Could you explain?', 'RQ2', 15),
			('Section C', 'Teachers'' Perceptions (RQ2)', 16, 'Have your views about classroom management changed since you began teaching online? If yes, how?', 'RQ2', 16),

			('Section D', 'Challenges (RQ3)', 17, 'What challenges do you most frequently encounter when managing online English speaking classes?', 'RQ3', 17),
			('Section D', 'Challenges (RQ3)', 18, 'Which challenges have the greatest impact on learners'' speaking participation?', 'RQ3', 18),
			('Section D', 'Challenges (RQ3)', 19, 'How do you usually deal with learners who are reluctant to participate in speaking activities?', 'RQ3', 19),
			('Section D', 'Challenges (RQ3)', 20, 'How do you deal with technical problems that occur during online speaking lessons?', 'RQ3', 20),
			('Section D', 'Challenges (RQ3)', 21, 'Are there any classroom management challenges that remain difficult to address? Please explain.', 'RQ3', 21),

			('Closing', 'Closing Question', 22, 'Is there anything else you would like to share about your experiences of managing online English speaking classes for primary EFL learners?', 'CLOSING', 22)
	`
	if _, err := tx.Exec(ctx, seedQuery); err != nil {
		return fmt.Errorf("failed to seed canonical questions: %w", err)
	}

	return tx.Commit(ctx)
}
