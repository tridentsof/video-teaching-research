package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/video-teaching-research/backend/internal/model"
)

// ActivityLogRepository handles database operations for activity_logs.
type ActivityLogRepository struct {
	db *DB
}

// NewActivityLogRepository creates a new ActivityLogRepository.
func NewActivityLogRepository(db *DB) *ActivityLogRepository {
	return &ActivityLogRepository{db: db}
}

// EnsureTable ensures the activity_logs table and its indexes exist.
func (r *ActivityLogRepository) EnsureTable(ctx context.Context) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}
	query := `
	CREATE TABLE IF NOT EXISTS activity_logs (
		id             VARCHAR(64) PRIMARY KEY,
		category       VARCHAR(32) NOT NULL DEFAULT 'business',
		module         VARCHAR(64) NOT NULL DEFAULT 'general',
		action         VARCHAR(64) NOT NULL DEFAULT 'action',
		target_id      VARCHAR(128),
		target_title   TEXT,
		actor_username VARCHAR(128) NOT NULL DEFAULT 'system',
		actor_role     VARCHAR(64) DEFAULT 'researcher',
		client_ip      VARCHAR(64),
		summary        TEXT NOT NULL,
		status         VARCHAR(32) NOT NULL DEFAULT 'success',
		diff_json      TEXT,
		metadata_json  TEXT,
		created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_activity_logs_category ON activity_logs(category);
	CREATE INDEX IF NOT EXISTS idx_activity_logs_module ON activity_logs(module);
	CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
	`
	_, err := r.db.Pool.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to ensure activity_logs table: %w", err)
	}
	return nil
}

// Create inserts a new activity log entry.
func (r *ActivityLogRepository) Create(ctx context.Context, item *model.ActivityLog) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database not connected")
	}

	if item.ID == "" {
		item.ID = fmt.Sprintf("act_%d", time.Now().UnixNano())
	}
	if item.CreatedAt.IsZero() {
		item.CreatedAt = time.Now()
	}

	query := `
		INSERT INTO activity_logs (
			id, category, module, action, target_id, target_title,
			actor_username, actor_role, client_ip, summary, status,
			diff_json, metadata_json, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
	`
	_, err := r.db.Pool.Exec(ctx, query,
		item.ID,
		item.Category,
		item.Module,
		item.Action,
		item.TargetID,
		item.TargetTitle,
		item.ActorUsername,
		item.ActorRole,
		item.ClientIP,
		item.Summary,
		item.Status,
		item.DiffJSON,
		item.MetadataJSON,
		item.CreatedAt,
	)
	if err != nil {
		return fmt.Errorf("failed to insert activity log: %w", err)
	}
	return nil
}

// List queries activity logs with optional category & module filters.
func (r *ActivityLogRepository) List(ctx context.Context, category, module string, limit, offset int) ([]model.ActivityLog, int, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, 0, fmt.Errorf("database not connected")
	}

	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}

	whereClause := "WHERE 1=1"
	args := []any{}
	idx := 1

	if category != "" && category != "all" {
		whereClause += fmt.Sprintf(" AND category = $%d", idx)
		args = append(args, category)
		idx++
	}
	if module != "" && module != "all" {
		whereClause += fmt.Sprintf(" AND module = $%d", idx)
		args = append(args, module)
		idx++
	}

	// Count total matching
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM activity_logs %s", whereClause)
	var total int
	err := r.db.Pool.QueryRow(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to count activity logs: %w", err)
	}

	// Query rows
	query := fmt.Sprintf(`
		SELECT id, category, module, action, COALESCE(target_id, ''), COALESCE(target_title, ''),
		       actor_username, COALESCE(actor_role, ''), COALESCE(client_ip, ''), summary,
		       status, COALESCE(diff_json, ''), COALESCE(metadata_json, ''), created_at
		FROM activity_logs
		%s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, idx, idx+1)

	args = append(args, limit, offset)

	rows, err := r.db.Pool.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to list activity logs: %w", err)
	}
	defer rows.Close()

	logs := make([]model.ActivityLog, 0)
	for rows.Next() {
		var l model.ActivityLog
		err := rows.Scan(
			&l.ID,
			&l.Category,
			&l.Module,
			&l.Action,
			&l.TargetID,
			&l.TargetTitle,
			&l.ActorUsername,
			&l.ActorRole,
			&l.ClientIP,
			&l.Summary,
			&l.Status,
			&l.DiffJSON,
			&l.MetadataJSON,
			&l.CreatedAt,
		)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to scan activity log row: %w", err)
		}
		logs = append(logs, l)
	}

	return logs, total, nil
}
