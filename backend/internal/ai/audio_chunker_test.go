package ai

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestOffsetTimestampsInText(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		offsetSec int
		expected  string
	}{
		{
			name:      "Zero offset",
			input:     "[01:23] Giáo viên: Xin chào",
			offsetSec: 0,
			expected:  "[01:23] Giáo viên: Xin chào",
		},
		{
			name:      "Offset 10 minutes (600s)",
			input:     "[01:23] Người phỏng vấn: Xin chào\n[02:45] Giáo viên: Chào bạn",
			offsetSec: 600,
			expected:  "[11:23] Người phỏng vấn: Xin chào\n[12:45] Giáo viên: Chào bạn",
		},
		{
			name:      "Offset crossing into hour mark",
			input:     "[55:00] Kết thúc phần 1",
			offsetSec: 600, // + 10 mins = 65 mins = 01:05:00
			expected:  "[01:05:00] Kết thúc phần 1",
		},
		{
			name:      "Parenthesis timestamp format (MM:SS)",
			input:     "(02:15) Phỏng vấn viên hỏi",
			offsetSec: 120, // + 2 mins = 04:15
			expected:  "(04:15) Phỏng vấn viên hỏi",
		},
		{
			name:      "Already has hour format [01:10:05]",
			input:     "[01:10:05] Thầy giáo trả lời",
			offsetSec: 300, // + 5 mins = 01:15:05
			expected:  "[01:15:05] Thầy giáo trả lời",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := OffsetTimestampsInText(tt.input, tt.offsetSec)
			if result != tt.expected {
				t.Errorf("got %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestMergeSegmentTranscriptionResults_Plain(t *testing.T) {
	seg1 := "[00:10] Người phỏng vấn: Câu 1\n[01:00] Giáo viên: Trả lời 1"
	seg2 := "[00:15] Người phỏng vấn: Câu 2\n[01:30] Giáo viên: Trả lời 2"

	segments := []AudioSegment{
		{Index: 0, OffsetSec: 0, DurationSec: 600},
		{Index: 1, OffsetSec: 600, DurationSec: 507},
	}

	merged := MergeSegmentTranscriptionResults([]string{seg1, seg2}, segments)

	expectedSeg2 := "[10:15] Người phỏng vấn: Câu 2\n[11:30] Giáo viên: Trả lời 2"
	if !strings.Contains(merged, "[00:10]") {
		t.Errorf("expected seg1 to remain, got %s", merged)
	}
	if !strings.Contains(merged, expectedSeg2) {
		t.Errorf("expected seg2 offset to 10:15 / 11:30, got %s", merged)
	}
}

func TestMergeSegmentTranscriptionResults_JSON(t *testing.T) {
	json1 := `{
		"language": "vi",
		"audio_duration_sec": 600.0,
		"raw_transcript": "[00:10] Người phỏng vấn: Câu 1\n[01:00] Giáo viên: Trả lời 1",
		"qa_pairs": [
			{"question_text": "Câu 1", "answer_text": "Trả lời 1"}
		]
	}`

	json2 := `{
		"language": "vi",
		"audio_duration_sec": 507.0,
		"raw_transcript": "[00:15] Người phỏng vấn: Câu 2\n[01:30] Giáo viên: Trả lời 2",
		"qa_pairs": [
			{"question_text": "Câu 2", "answer_text": "Trả lời 2"}
		]
	}`

	segments := []AudioSegment{
		{Index: 0, OffsetSec: 0, DurationSec: 600},
		{Index: 1, OffsetSec: 600, DurationSec: 507},
	}

	merged := MergeSegmentTranscriptionResults([]string{json1, json2}, segments)

	var parsed struct {
		Language         string                   `json:"language"`
		AudioDurationSec float64                  `json:"audio_duration_sec"`
		RawTranscript    string                   `json:"raw_transcript"`
		QAPairs          []map[string]interface{} `json:"qa_pairs"`
	}

	if err := json.Unmarshal([]byte(merged), &parsed); err != nil {
		t.Fatalf("failed to parse merged JSON: %v, raw: %s", err, merged)
	}

	if parsed.AudioDurationSec != 1107.0 {
		t.Errorf("expected duration 1107, got %f", parsed.AudioDurationSec)
	}
	if len(parsed.QAPairs) != 2 {
		t.Errorf("expected 2 QA pairs, got %d", len(parsed.QAPairs))
	}
	if !strings.Contains(parsed.RawTranscript, "[10:15]") {
		t.Errorf("expected RawTranscript to contain offset [10:15], got: %s", parsed.RawTranscript)
	}
}
