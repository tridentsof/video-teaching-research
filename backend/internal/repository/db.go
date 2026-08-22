package repository

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DB holds the PostgreSQL connection pool.
type DB struct {
	Pool *pgxpool.Pool
}

// NewDB creates a new database connection pool from the given connection URL.
func NewDB(ctx context.Context, dbURL string) (*DB, error) {
	if dbURL == "" {
		return nil, fmt.Errorf("database URL is empty")
	}

	config, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		return nil, fmt.Errorf("failed to parse database URL: %w", err)
	}

	// Set reasonable pool defaults
	config.MaxConns = 10
	config.MinConns = 2

	var pool *pgxpool.Pool
	var pingErr error

	// Retry connection up to 5 times with backoff for network/DNS readiness
	for attempt := 1; attempt <= 5; attempt++ {
		pool, err = pgxpool.NewWithConfig(ctx, config)
		if err == nil {
			pingErr = pool.Ping(ctx)
			if pingErr == nil {
				return &DB{Pool: pool}, nil
			}
			pool.Close()
		}
		time.Sleep(time.Duration(attempt) * 500 * time.Millisecond)
	}

	if pingErr != nil {
		return nil, fmt.Errorf("failed to ping database after 5 attempts: %w", pingErr)
	}
	return nil, fmt.Errorf("failed to create connection pool: %w", err)
}

// Close closes the database connection pool.
func (db *DB) Close() {
	if db.Pool != nil {
		db.Pool.Close()
	}
}
