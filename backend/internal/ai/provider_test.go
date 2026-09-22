package ai

import (
	"encoding/json"
	"testing"
)

func TestExtractJSONFromMarkdown(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Clean JSON object",
			input:    `{"key": "value"}`,
			expected: `{"key": "value"}`,
		},
		{
			name:     "Markdown fenced json block",
			input:    "Here is the result:\n```json\n{\"events\": [1, 2, 3]}\n```\nHope that helps!",
			expected: `{"events": [1, 2, 3]}`,
		},
		{
			name:     "Markdown generic block",
			input:    "```\n[{\"id\": 1}]\n```",
			expected: `[{"id": 1}]`,
		},
		{
			name:     "Text with embedded JSON array",
			input:    "Sure! The extracted events are: [{\"name\": \"test\"}] thank you.",
			expected: `[{"name": "test"}]`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ExtractJSONFromMarkdown(tt.input)
			if result != tt.expected {
				t.Errorf("expected %q, got %q", tt.expected, result)
			}
		})
	}
}

func TestRepairTruncatedJSONArray(t *testing.T) {
	tests := []struct {
		name           string
		input          string
		expectRepaired bool
		expectValid    bool // if repaired, should it parse as valid JSON?
	}{
		{
			name:           "Valid complete array - no repair needed",
			input:          `[{"id": 1}, {"id": 2}]`,
			expectRepaired: false,
		},
		{
			name:           "Not an array - no repair",
			input:          `{"id": 1}`,
			expectRepaired: false,
		},
		{
			name:           "Truncated mid-value",
			input:          `[{"id": 1, "name": "a"}, {"id": 2, "name":`,
			expectRepaired: true,
			expectValid:    true,
		},
		{
			name:           "Truncated after comma between objects",
			input:          `[{"id": 1}, {"id": 2},`,
			expectRepaired: true,
			expectValid:    true,
		},
		{
			name:           "Truncated mid-key in second object",
			input:          `[{"timestamp_sec": 4.5, "event_type": "audio"}, {"timestamp_sec": 8.5, "confidence": 0.96, "duration_sec":`,
			expectRepaired: true,
			expectValid:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repaired, ok := repairTruncatedJSONArray(tt.input)
			if ok != tt.expectRepaired {
				t.Errorf("expected repaired=%v, got %v", tt.expectRepaired, ok)
			}
			if tt.expectRepaired && tt.expectValid {
				var result []map[string]interface{}
				if err := json.Unmarshal([]byte(repaired), &result); err != nil {
					t.Errorf("repaired JSON should be valid, got parse error: %v\nrepaired: %s", err, repaired)
				}
				if len(result) == 0 {
					t.Error("repaired JSON array should have at least one element")
				}
			}
		})
	}
}

func TestUnmarshalJSONFlexible_TruncatedArray(t *testing.T) {
	// Simulates exact Gemini truncated output from the user's error
	truncatedInput := "```json\n" + `[
  {
    "timestamp_sec": 4.5,
    "event_type": "audio",
    "event_key": "teacher_nominates_student",
    "confidence": 0.98,
    "duration_sec": 3.8
  },
  {
    "timestamp_sec": 8.5,
    "event_type": "audio",
    "event_key": "student_answers_question",
    "confidence": 0.96,
    "duration_sec":` // truncated mid-value

	type Event struct {
		TimestampSec float64 `json:"timestamp_sec"`
		EventType    string  `json:"event_type"`
		EventKey     string  `json:"event_key"`
		Confidence   float64 `json:"confidence"`
		DurationSec  float64 `json:"duration_sec"`
	}

	var events []Event
	err := UnmarshalJSONFlexible(truncatedInput, &events)
	if err != nil {
		t.Fatalf("expected auto-repair to succeed, got error: %v", err)
	}
	if len(events) != 1 {
		t.Errorf("expected 1 salvaged event, got %d", len(events))
	}
	if len(events) > 0 && events[0].EventKey != "teacher_nominates_student" {
		t.Errorf("expected first event key 'teacher_nominates_student', got %q", events[0].EventKey)
	}
}

func TestUnmarshalJSONFlexible_TruncatedObjectWithArray(t *testing.T) {
	// Simulates the exact truncated output from the user's checklist mapping error
	truncatedInput := `{
  "matches": [
    {
      "event_id": "a8cdb29a-1c90-40f7-8ceb-89b71b702e54",
      "checklist_item_id": "1c0059fc-149c-4ed1-a165-84799a248429",
      "match_score": 0.85,
      "match_method": "semantic"
    },
    {
      "event_id": "fc6af514-2b2f-4697-9eae-303eb2c306e2",
      "checklist_item_id": "82c368ed-27b6-4fba-8241-f0789ae09cac",
      "match_score": 0.85,
      "match_method": "semantic"
    },
    {
      "event`

	type Match struct {
		EventID         string  `json:"event_id"`
		ChecklistItemID string  `json:"checklist_item_id"`
		MatchScore      float64 `json:"match_score"`
		MatchMethod     string  `json:"match_method"`
	}
	type Response struct {
		Matches []Match `json:"matches"`
	}

	var resp Response
	err := UnmarshalJSONFlexible(truncatedInput, &resp)
	if err != nil {
		t.Fatalf("expected auto-repair to succeed on truncated object with array, got error: %v", err)
	}
	if len(resp.Matches) != 2 {
		t.Fatalf("expected 2 salvaged matches, got %d", len(resp.Matches))
	}
	if resp.Matches[0].EventID != "a8cdb29a-1c90-40f7-8ceb-89b71b702e54" {
		t.Errorf("unexpected first match event_id: %s", resp.Matches[0].EventID)
	}
	if resp.Matches[1].EventID != "fc6af514-2b2f-4697-9eae-303eb2c306e2" {
		t.Errorf("unexpected second match event_id: %s", resp.Matches[1].EventID)
	}
}

func TestProviderInterfaces(t *testing.T) {
	var _ VideoAnalysisProvider = (*GeminiDirectProvider)(nil)
	var _ TextCompletionProvider = (*GeminiDirectProvider)(nil)
	var _ TextCompletionProvider = (*OpenRouterProvider)(nil)
}

func TestExtractCandidateText(t *testing.T) {
	t.Run("Filters out thought parts and joins non-thought parts", func(t *testing.T) {
		parts := []geminiCandidatePart{
			{Text: "Let me think about how to map this.", Thought: true},
			{Text: `{"aligned_qa": [`, Thought: false},
			{Text: `{"question_id": "123"}]}`, Thought: false},
		}
		res := extractCandidateText(parts)
		expected := `{"aligned_qa": [{"question_id": "123"}]}`
		if res != expected {
			t.Errorf("expected %q, got %q", expected, res)
		}
	})

	t.Run("Fallback to thought parts if all parts are thoughts", func(t *testing.T) {
		parts := []geminiCandidatePart{
			{Text: "Thinking part 1. ", Thought: true},
			{Text: "Thinking part 2.", Thought: true},
		}
		res := extractCandidateText(parts)
		expected := "Thinking part 1. Thinking part 2."
		if res != expected {
			t.Errorf("expected %q, got %q", expected, res)
		}
	})

	t.Run("Single non-thought part", func(t *testing.T) {
		parts := []geminiCandidatePart{
			{Text: "Hello world", Thought: false},
		}
		res := extractCandidateText(parts)
		if res != "Hello world" {
			t.Errorf("expected %q, got %q", "Hello world", res)
		}
	})
}


