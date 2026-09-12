package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

// Config holds all configuration for the application.
type Config struct {
	// Server
	Port    string
	GinMode string

	// Database
	DBURL string

	// Azure Blob Storage
	AzureStorageAccount string
	AzureStorageKey     string
	AzureContainerName  string

	// AI — Gemini Direct
	GeminiAPIKey  string
	GeminiModel   string
	CodebookModel string

	// AI — OpenRouter
	OpenRouterAPIKey string
	OpenRouterModel  string

	// Auth
	JWTSecret      string
	JWTExpiryHours int

	// FFmpeg
	FFmpegPath string

	// Pipeline
	MaxConcurrentChunks int
	ChunkDurationSec    int
	ChunkOverlapSec     int

	// Telegram Notification
	TelegramWebhookURL string
	TelegramBotToken    string
	TelegramChatID      string
	AppBaseURL          string
}

// Load reads configuration from .env file and environment variables.
// Environment variables take precedence over .env file values.
func Load() (*Config, error) {
	// Load .env file if it exists (ignore error if not found)
	_ = godotenv.Load()

	cfg := &Config{
		Port:                getEnv("PORT", "8000"),
		GinMode:             getEnv("GIN_MODE", "debug"),
		DBURL:               getEnv("DB_URL", ""),
		AzureStorageAccount: getEnv("AZURE_STORAGE_ACCOUNT", ""),
		AzureStorageKey:     getEnv("AZURE_STORAGE_KEY", ""),
		AzureContainerName:  getEnv("AZURE_CONTAINER_NAME", "videos"),
		GeminiAPIKey:        getEnv("GEMINI_API_KEY", ""),
		GeminiModel:         getEnv("GEMINI_MODEL", "gemini-3.7-flash"),
		CodebookModel:       getEnv("CODEBOOK_MODEL", getEnv("GEMINI_MODEL", "gemini-3.7-flash")),
		OpenRouterAPIKey:    getEnv("OPENROUTER_API_KEY", ""),
		OpenRouterModel:     getEnv("OPENROUTER_MODEL", "anthropic/claude-3.7-sonnet"),
		JWTSecret:           getEnv("JWT_SECRET", ""),
		JWTExpiryHours:      getEnvInt("JWT_EXPIRY_HOURS", 24),
		FFmpegPath:          getEnv("FFMPEG_PATH", "ffmpeg"),
		MaxConcurrentChunks: getEnvInt("MAX_CONCURRENT_CHUNKS", 3),
		ChunkDurationSec:    getEnvInt("CHUNK_DURATION_SEC", 600),
		ChunkOverlapSec:     getEnvInt("CHUNK_OVERLAP_SEC", 30),
		TelegramWebhookURL: getEnv("TELEGRAM_WEBHOOK_URL", ""),
		TelegramBotToken:    getEnv("TELEGRAM_BOT_TOKEN", ""),
		TelegramChatID:      getEnv("TELEGRAM_CHAT_ID", ""),
		AppBaseURL:          getEnv("APP_BASE_URL", "http://localhost:3000"),
	}

	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}

	return cfg, nil
}

// validate checks that required configuration values are present.
func (c *Config) validate() error {
	if c.JWTSecret == "" {
		return fmt.Errorf("JWT_SECRET is required")
	}
	return nil
}

// getEnv reads an environment variable with a fallback default value.
func getEnv(key, defaultVal string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return defaultVal
}

// getEnvInt reads an environment variable as an integer with a fallback default.
func getEnvInt(key string, defaultVal int) int {
	if val, ok := os.LookupEnv(key); ok {
		if intVal, err := strconv.Atoi(val); err == nil {
			return intVal
		}
	}
	return defaultVal
}
