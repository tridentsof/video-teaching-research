package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/video-teaching-research/backend/internal/model"
)

// TelegramSubscriberRepository handles database operations for telegram_subscribers.
type TelegramSubscriberRepository struct {
	db *DB
}

// NewTelegramSubscriberRepository creates a new TelegramSubscriberRepository.
func NewTelegramSubscriberRepository(db *DB) *TelegramSubscriberRepository {
	return &TelegramSubscriberRepository{db: db}
}

// EnsureTable ensures the telegram_subscribers table and its indexes exist.
func (r *TelegramSubscriberRepository) EnsureTable(ctx context.Context) error {
	if r.db == nil || r.db.Pool == nil {
		return nil
	}
	query := `
	CREATE TABLE IF NOT EXISTS telegram_subscribers (
		id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
		chat_id     BIGINT UNIQUE NOT NULL,
		chat_type   VARCHAR(20) NOT NULL DEFAULT 'private',
		username    VARCHAR(100),
		first_name  VARCHAR(150),
		is_active   BOOLEAN NOT NULL DEFAULT TRUE,
		created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
		updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
	);

	CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_active ON telegram_subscribers(is_active);
	CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_chat_id ON telegram_subscribers(chat_id);
	`
	_, err := r.db.Pool.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to ensure telegram_subscribers table: %w", err)
	}
	return nil
}

// UpsertSubscriber registers or updates a subscriber, setting is_active = true.
func (r *TelegramSubscriberRepository) UpsertSubscriber(ctx context.Context, sub *model.TelegramSubscriber) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database not connected")
	}

	if sub.ID == uuid.Nil {
		sub.ID = uuid.New()
	}
	now := time.Now()
	sub.UpdatedAt = now

	query := `
		INSERT INTO telegram_subscribers (id, chat_id, chat_type, username, first_name, is_active, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (chat_id) DO UPDATE SET
			chat_type  = EXCLUDED.chat_type,
			username   = EXCLUDED.username,
			first_name = EXCLUDED.first_name,
			is_active  = EXCLUDED.is_active,
			updated_at = EXCLUDED.updated_at
	`
	_, err := r.db.Pool.Exec(ctx, query,
		sub.ID, sub.ChatID, sub.ChatType, sub.Username, sub.FirstName, sub.IsActive, now, now,
	)
	if err != nil {
		return fmt.Errorf("failed to upsert telegram subscriber: %w", err)
	}
	return nil
}

// DeactivateSubscriber marks a subscriber as inactive (e.g. on /unsubscribe or bot blocked).
func (r *TelegramSubscriberRepository) DeactivateSubscriber(ctx context.Context, chatID int64) error {
	if r.db == nil || r.db.Pool == nil {
		return fmt.Errorf("database not connected")
	}

	query := `
		UPDATE telegram_subscribers
		SET is_active = FALSE, updated_at = NOW()
		WHERE chat_id = $1
	`
	_, err := r.db.Pool.Exec(ctx, query, chatID)
	if err != nil {
		return fmt.Errorf("failed to deactivate telegram subscriber: %w", err)
	}
	return nil
}

// GetByChatID retrieves a subscriber record by their chat ID.
func (r *TelegramSubscriberRepository) GetByChatID(ctx context.Context, chatID int64) (*model.TelegramSubscriber, error) {
	if r.db == nil || r.db.Pool == nil {
		return nil, fmt.Errorf("database not connected")
	}

	query := `
		SELECT id, chat_id, chat_type, COALESCE(username, ''), COALESCE(first_name, ''), is_active, created_at, updated_at
		FROM telegram_subscribers
		WHERE chat_id = $1
	`
	var sub model.TelegramSubscriber
	err := r.db.Pool.QueryRow(ctx, query, chatID).Scan(
		&sub.ID, &sub.ChatID, &sub.ChatType, &sub.Username, &sub.FirstName, &sub.IsActive, &sub.CreatedAt, &sub.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get telegram subscriber: %w", err)
	}
	return &sub, nil
}

// ListActiveSubscribers retrieves all active subscribers who should receive notifications.
func (r *TelegramSubscriberRepository) ListActiveSubscribers(ctx context.Context) ([]model.TelegramSubscriber, error) {
	if r.db == nil || r.db.Pool == nil {
		return []model.TelegramSubscriber{}, nil
	}

	query := `
		SELECT id, chat_id, chat_type, COALESCE(username, ''), COALESCE(first_name, ''), is_active, created_at, updated_at
		FROM telegram_subscribers
		WHERE is_active = TRUE
		ORDER BY created_at ASC
	`
	rows, err := r.db.Pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to list active telegram subscribers: %w", err)
	}
	defer rows.Close()

	var subs []model.TelegramSubscriber
	for rows.Next() {
		var sub model.TelegramSubscriber
		if err := rows.Scan(
			&sub.ID, &sub.ChatID, &sub.ChatType, &sub.Username, &sub.FirstName, &sub.IsActive, &sub.CreatedAt, &sub.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("failed to scan telegram subscriber: %w", err)
		}
		subs = append(subs, sub)
	}

	return subs, nil
}

// CountActive returns the number of active subscribers.
func (r *TelegramSubscriberRepository) CountActive(ctx context.Context) (int, error) {
	if r.db == nil || r.db.Pool == nil {
		return 0, nil
	}

	var count int
	err := r.db.Pool.QueryRow(ctx, `SELECT COUNT(*) FROM telegram_subscribers WHERE is_active = TRUE`).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count active telegram subscribers: %w", err)
	}
	return count, nil
}
