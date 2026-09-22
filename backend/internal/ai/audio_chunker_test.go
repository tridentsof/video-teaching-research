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

func TestModelRequiresAudioChunking(t *testing.T) {
	tests := []struct {
		model    string
		expected bool
	}{
		// Dedicated short-context speech models must chunk
		{"gemini-3.5-transcribe-preview", true},
		{"gemini-3.5-transcribe", true},
		{"", true}, // safe fallback

		// Multimodal Flash and Pro models support 1M+ tokens and skip chunking
		{"gemini-2.5-flash", false},
		{"gemini-3.6-flash", false},
		{"gemini-1.5-flash", false},
		{"gemini-flash-latest", false},
		{"gemini-1.5-pro", false},
		{"gemini-2.5-pro", false},
	}

	for _, tt := range tests {
		t.Run(tt.model, func(t *testing.T) {
			result := ModelRequiresAudioChunking(tt.model)
			if result != tt.expected {
				t.Errorf("ModelRequiresAudioChunking(%q) = %v, want %v", tt.model, result, tt.expected)
			}
		})
	}
}

func TestReconcileOverlapText(t *testing.T) {
	tests := []struct {
		name     string
		prev     string
		next     string
		expected string
	}{
		{
			name:     "No overlap",
			prev:     "[09:50] Giáo viên: Chúng tôi đã kết thúc phần 1.",
			next:     "[10:05] Phỏng vấn viên: Tiếp theo câu hỏi số 2.",
			expected: "[10:05] Phỏng vấn viên: Tiếp theo câu hỏi số 2.",
		},
		{
			name:     "Overlap 4 words stripped from next",
			prev:     "[09:55] Thầy giáo: chúng tôi đã chuẩn bị bài rất kỹ.",
			next:     "bài rất kỹ. Và học sinh cũng rất tích cực tham gia.",
			expected: "Và học sinh cũng rất tích cực tham gia.",
		},
		{
			name:     "Overlap with leading timestamp preserved",
			prev:     "[09:55] Thầy giáo: chúng tôi đã chuẩn bị bài rất kỹ.",
			next:     "[10:00] bài rất kỹ. Và các em học sinh rất vui.",
			expected: "[10:00] Và các em học sinh rất vui.",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ReconcileOverlapText(tt.prev, tt.next)
			if strings.TrimSpace(result) != strings.TrimSpace(tt.expected) {
				t.Errorf("got %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestFindOptimalSplitPoint(t *testing.T) {
	silences := []SilenceInterval{
		{Start: 120.0, End: 121.0, Duration: 1.0},
		{Start: 588.0, End: 589.2, Duration: 1.2}, // within [600-45, 600+45] = [555, 645]
		{Start: 800.0, End: 801.0, Duration: 1.0},
	}

	// 1. Target 600s should match silence at 588s -> mid = 589s
	cut, found := findOptimalSplitPoint(600, 45, silences)
	if !found {
		t.Fatalf("expected to find silence split point near 600s")
	}
	if cut < 588 || cut > 590 {
		t.Errorf("expected cut near 588-590, got %d", cut)
	}

	// 2. Target 300s (no silence within 45s) -> fallback to 300s
	cut2, found2 := findOptimalSplitPoint(300, 45, silences)
	if found2 {
		t.Errorf("expected not to find silence near 300s, but found at %d", cut2)
	}
	if cut2 != 300 {
		t.Errorf("expected fallback to 300, got %d", cut2)
	}
}

