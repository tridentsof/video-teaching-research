package service

import (
	"testing"

	"github.com/google/uuid"
	"github.com/video-teaching-research/backend/internal/model"
)

func TestDeduplicateEvents(t *testing.T) {
	svc := NewDeduplicationService(nil, nil, nil, 5.0)

	chunk1ID := uuid.New()
	chunk2ID := uuid.New()

	event1ID := uuid.New()
	event2ID := uuid.New()
	event3ID := uuid.New()
	event4ID := uuid.New()

	events := []model.RawEvent{
		{
			ID:           event1ID,
			ChunkID:      &chunk1ID,
			TimestampSec: 580.0,
			EventType:    "visual",
			EventKey:     "teacher_points_to_board",
			Description:  "Teacher points at slide word",
		},
		{
			ID:           event2ID,
			ChunkID:      &chunk2ID,
			TimestampSec: 581.5, // within 5s from chunk 2 overlap
			EventType:    "visual",
			EventKey:     "teacher_points_to_board", // exact match
			Description:  "Teacher points to the board slide",
		},
		{
			ID:           event3ID,
			ChunkID:      &chunk2ID,
			TimestampSec: 582.0,
			EventType:    "audio",
			EventKey:     "student_answers", // different key & type
			Description:  "Student answers question",
		},
		{
			ID:           event4ID,
			ChunkID:      &chunk2ID,
			TimestampSec: 620.0, // outside tolerance
			EventType:    "visual",
			EventKey:     "teacher_points_to_board",
			Description:  "Teacher points to board again later",
		},
	}

	deduped, duplicates := svc.DeduplicateEvents(events)

	if len(duplicates) != 1 {
		t.Fatalf("expected 1 duplicate, got %d", len(duplicates))
	}

	if duplicates[event2ID] != event1ID {
		t.Errorf("expected event2 to be duplicate of event1, got %v", duplicates[event2ID])
	}

	if deduped[1].IsDuplicateOf == nil || *deduped[1].IsDuplicateOf != event1ID {
		t.Errorf("deduped[1].IsDuplicateOf not set correctly")
	}

	if deduped[2].IsDuplicateOf != nil {
		t.Errorf("event3 should not be marked as duplicate")
	}

	if deduped[3].IsDuplicateOf != nil {
		t.Errorf("event4 should not be marked as duplicate (occurred later)")
	}
}
