package ai

import (
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

func TestProviderInterfaces(t *testing.T) {
	var _ VideoAnalysisProvider = (*GeminiDirectProvider)(nil)
	var _ TextCompletionProvider = (*GeminiDirectProvider)(nil)
	var _ TextCompletionProvider = (*OpenRouterProvider)(nil)
}

