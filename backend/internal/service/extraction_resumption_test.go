package service

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
)

type mockVideoProviderWithRetries struct {
	calls        int32
	failAttempts int32
	returnJSON   string
}

func (m *mockVideoProviderWithRetries) AnalyzeVideoChunk(ctx context.Context, videoFilePath string, prompt string) (string, error) {
	current := atomic.AddInt32(&m.calls, 1)
	if current <= m.failAttempts {
		return "", errors.New("429 Too Many Requests: Resource has been exhausted")
	}
	return m.returnJSON, nil
}

func TestMockVideoProvider_RetrySucceeds(t *testing.T) {
	mockProvider := &mockVideoProviderWithRetries{
		failAttempts: 2,
		returnJSON:   `[{"timestamp_sec": 10.0, "event_type": "visual", "event_key": "write_on_board", "description": "Teacher writes", "confidence": 0.95}]`,
	}

	maxRetries := 3
	var rawOutput string
	var lastErr error

	ctx := context.Background()
	for attempt := 1; attempt <= maxRetries; attempt++ {
		out, err := mockProvider.AnalyzeVideoChunk(ctx, "test.mp4", "prompt")
		if err == nil {
			rawOutput = out
			lastErr = nil
			break
		}
		lastErr = err
	}

	if lastErr != nil {
		t.Fatalf("expected retry to succeed on 3rd attempt, got err: %v", lastErr)
	}
	if rawOutput != mockProvider.returnJSON {
		t.Fatalf("unexpected output: %s", rawOutput)
	}
	if mockProvider.calls != 3 {
		t.Fatalf("expected 3 calls, got %d", mockProvider.calls)
	}
}

func TestMockVideoProvider_ExceedsMaxRetries(t *testing.T) {
	mockProvider := &mockVideoProviderWithRetries{
		failAttempts: 5,
		returnJSON:   `[]`,
	}

	maxRetries := 3
	var lastErr error

	ctx := context.Background()
	for attempt := 1; attempt <= maxRetries; attempt++ {
		_, err := mockProvider.AnalyzeVideoChunk(ctx, "test.mp4", "prompt")
		if err == nil {
			lastErr = nil
			break
		}
		lastErr = err
	}

	if lastErr == nil {
		t.Fatalf("expected error after exceeding max retries, got nil")
	}
	if mockProvider.calls != 3 {
		t.Fatalf("expected exactly 3 calls before failing, got %d", mockProvider.calls)
	}
}

func TestChunkClassification_PreserveProcessedChunks(t *testing.T) {
	chunk1ID := uuid.New()
	chunk2ID := uuid.New()

	chunks := []model.VideoChunk{
		{
			ID:         chunk1ID,
			ChunkIndex: 0,
			Status:     "processed",
		},
		{
			ID:         chunk2ID,
			ChunkIndex: 1,
			Status:     "error",
		},
	}

	existingEvents := []model.RawEvent{
		{
			ID:           uuid.New(),
			ChunkID:      &chunk1ID,
			TimestampSec: 15.0,
			EventType:    "visual",
			EventKey:     "teacher_explains",
		},
	}

	eventsByChunk := make(map[uuid.UUID][]model.RawEvent)
	for _, e := range existingEvents {
		if e.ChunkID != nil {
			eventsByChunk[*e.ChunkID] = append(eventsByChunk[*e.ChunkID], e)
		}
	}

	var allEvents []model.RawEvent
	var chunksToProcess []model.VideoChunk

	for _, ch := range chunks {
		if ch.Status == "processed" && len(eventsByChunk[ch.ID]) > 0 {
			allEvents = append(allEvents, eventsByChunk[ch.ID]...)
		} else {
			chunksToProcess = append(chunksToProcess, ch)
		}
	}

	if len(allEvents) != 1 {
		t.Fatalf("expected 1 preserved event from chunk 1, got %d", len(allEvents))
	}
	if len(chunksToProcess) != 1 {
		t.Fatalf("expected 1 chunk to process, got %d", len(chunksToProcess))
	}
	if chunksToProcess[0].ID != chunk2ID {
		t.Fatalf("expected chunk2 to be processed, got %v", chunksToProcess[0].ID)
	}
}
