package repository

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/video-teaching-research/backend/internal/model"
)

// ChecklistRepository handles checklist database operations.
type ChecklistRepository struct {
	db *DB
}

// NewChecklistRepository creates a new ChecklistRepository.
func NewChecklistRepository(db *DB) *ChecklistRepository {
	return &ChecklistRepository{db: db}
}

// List returns all checklists (without items).
func (r *ChecklistRepository) List(ctx context.Context) ([]model.Checklist, error) {
	query := `SELECT id, name, version, created_at FROM checklists ORDER BY created_at DESC`

	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list checklists: %w", err)
	}
	defer rows.Close()

	var checklists []model.Checklist
	for rows.Next() {
		var cl model.Checklist
		if err := rows.Scan(&cl.ID, &cl.Name, &cl.Version, &cl.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan checklist: %w", err)
		}
		checklists = append(checklists, cl)
	}

	return checklists, nil
}

// GetByID returns a checklist with its items.
func (r *ChecklistRepository) GetByID(ctx context.Context, id uuid.UUID) (*model.Checklist, error) {
	// Get checklist
	query := `SELECT id, name, version, created_at FROM checklists WHERE id = $1`
	var cl model.Checklist
	err := r.db.Pool.QueryRow(ctx, query, id).Scan(&cl.ID, &cl.Name, &cl.Version, &cl.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get checklist: %w", err)
	}

	// Get items
	itemQuery := `
		SELECT id, checklist_id, section, text, sort_order, created_at
		FROM checklist_items
		WHERE checklist_id = $1
		ORDER BY section, sort_order
	`
	rows, err := r.db.Pool.Query(ctx, itemQuery, id)
	if err != nil {
		return nil, fmt.Errorf("failed to get checklist items: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var item model.ChecklistItem
		if err := rows.Scan(&item.ID, &item.ChecklistID, &item.Section, &item.Text, &item.SortOrder, &item.CreatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan checklist item: %w", err)
		}
		cl.Items = append(cl.Items, item)
	}

	return &cl, nil
}

// Create inserts a new checklist.
func (r *ChecklistRepository) Create(ctx context.Context, cl *model.Checklist) error {
	query := `INSERT INTO checklists (id, name, version, created_at) VALUES ($1, $2, $3, $4)`
	_, err := r.db.Pool.Exec(ctx, query, cl.ID, cl.Name, cl.Version, cl.CreatedAt)
	if err != nil {
		return fmt.Errorf("failed to create checklist: %w", err)
	}
	return nil
}

// UpdateItems replaces all items for a checklist in a single transaction.
// This handles add, edit, delete, and reorder by replacing the entire item set.
func (r *ChecklistRepository) UpdateItems(ctx context.Context, checklistID uuid.UUID, items []model.ChecklistItem) error {
	tx, err := r.db.Pool.Begin(ctx)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback(ctx)

	// Delete existing items
	_, err = tx.Exec(ctx, `DELETE FROM checklist_items WHERE checklist_id = $1`, checklistID)
	if err != nil {
		return fmt.Errorf("failed to delete existing items: %w", err)
	}

	// Insert new items
	for _, item := range items {
		_, err = tx.Exec(ctx,
			`INSERT INTO checklist_items (id, checklist_id, section, text, sort_order, created_at)
			 VALUES ($1, $2, $3, $4, $5, $6)`,
			item.ID, checklistID, item.Section, item.Text, item.SortOrder, item.CreatedAt,
		)
		if err != nil {
			return fmt.Errorf("failed to insert item: %w", err)
		}
	}

	return tx.Commit(ctx)
}

// Delete removes a checklist and its items (CASCADE).
func (r *ChecklistRepository) Delete(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Pool.Exec(ctx, `DELETE FROM checklists WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete checklist: %w", err)
	}
	return nil
}
