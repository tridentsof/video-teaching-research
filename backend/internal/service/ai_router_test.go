package service

import (
	"testing"
)

func TestMaskKey(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"", "••••••••"},
		{"short", "••••••••"},
		{"12345678", "••••••••"},
		{"12345678901", "123...01"},
		{"AIzaSyAbc12345Def6789", "AIzaSy...6789"},
	}

	for _, tt := range tests {
		result := MaskKey(tt.input)
		if result != tt.expected {
			t.Errorf("MaskKey(%q) = %q, want %q", tt.input, result, tt.expected)
		}
	}
}

func TestAIRouterService_GetGeminiProvider_Caching(t *testing.T) {
	router := NewAIRouterService(nil, "default-key", "gemini-3.7-flash", "", "")

	p1 := router.getGeminiProvider("test-key", "gemini-3-flash-preview")
	p2 := router.getGeminiProvider("test-key", "gemini-3-flash-preview")
	p3 := router.getGeminiProvider("test-key", "gemini-3.6-flash")

	if p1 != p2 {
		t.Errorf("Expected identical provider instances for same key and model")
	}
	if p1 == p3 {
		t.Errorf("Expected different provider instances for different models with same key")
	}
}
