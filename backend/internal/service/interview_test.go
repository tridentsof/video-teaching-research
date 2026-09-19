package service

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"github.com/video-teaching-research/backend/internal/model"
)

func TestSynthesizedCoreQuestionsCoverage(t *testing.T) {
	questions := DefaultSynthesizedCoreQuestions
	if len(questions) < 6 {
		t.Fatalf("expected at least 6 synthesized core questions, got %d", len(questions))
	}

	rqMap := make(map[string]int)
	for _, q := range questions {
		if q.QuestionText == "" {
			t.Errorf("empty question text for question index %d", q.Index)
		}
		if q.RQCategory != "RQ1" && q.RQCategory != "RQ2" && q.RQCategory != "RQ3" {
			t.Errorf("question %d has invalid RQ category: %s", q.Index, q.RQCategory)
		}
		rqMap[q.RQCategory]++
	}

	if rqMap["RQ1"] == 0 {
		t.Errorf("missing RQ1 questions in default synthesis")
	}
	if rqMap["RQ2"] == 0 {
		t.Errorf("missing RQ2 questions in default synthesis")
	}
	if rqMap["RQ3"] == 0 {
		t.Errorf("missing RQ3 questions in default synthesis")
	}

	// Test JSON roundtrip
	data, err := json.Marshal(questions)
	if err != nil {
		t.Fatalf("failed to marshal core questions: %v", err)
	}

	var roundtrip []model.CoreQuestionItem
	if err := json.Unmarshal(data, &roundtrip); err != nil {
		t.Fatalf("failed to unmarshal core questions: %v", err)
	}

	if len(roundtrip) != len(questions) {
		t.Fatalf("roundtrip mismatch: expected %d, got %d", len(questions), len(roundtrip))
	}
}

func TestInterviewBaseService_InputValidation(t *testing.T) {
	svc := NewInterviewBaseService(nil)

	// Missing question text should error
	_, err := svc.CreateBaseQuestion(context.Background(), CreateBaseQuestionInput{
		QuestionText: "   ",
	})
	if err == nil {
		t.Errorf("expected error for empty question text, got nil")
	}
}

func TestPromptAlignAndSplitQA(t *testing.T) {
	questions := []QuestionForAlignment{
		{
			ID:           "b1e95b0b-93fc-4632-9db8-f076c8c4bc62",
			QuestionText: "How do you manage disruptive classroom behaviors?",
			Type:         "core",
			RQCategory:   "RQ1",
		},
		{
			ID:           "e6a6cb9e-5e93-4796-a077-d5d115e21979",
			QuestionText: "Why do you choose sticker rewards over verbal praise?",
			Type:         "dynamic",
			RQCategory:   "RQ2",
		},
	}
	transcript := "Well, whenever students get distracted, I usually call their names gently. For stickers, I found that primary students respond much better to visual rewards than just saying good job."

	sysPrompt, userPrompt := PromptAlignAndSplitQA("T01", questions, transcript)
	if sysPrompt == "" {
		t.Errorf("expected non-empty system prompt")
	}
	if userPrompt == "" {
		t.Errorf("expected non-empty user prompt")
	}
	if !testing.Verbose() {
		// Verify key tokens exist in user prompt
		for _, q := range questions {
			if !strings.Contains(userPrompt, q.ID) {
				t.Errorf("expected user prompt to contain question ID %s", q.ID)
			}
			if !strings.Contains(userPrompt, q.QuestionText) {
				t.Errorf("expected user prompt to contain question text %s", q.QuestionText)
			}
		}
	}
}
