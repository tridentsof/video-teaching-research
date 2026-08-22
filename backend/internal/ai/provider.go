package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

// VideoAnalysisProvider handles direct multimodal video analysis.
type VideoAnalysisProvider interface {
	AnalyzeVideoChunk(ctx context.Context, videoFilePath string, prompt string) (string, error)
}

// TextCompletionProvider handles text/reasoning completion and mapping.
type TextCompletionProvider interface {
	CompleteText(ctx context.Context, model string, systemPrompt, userPrompt string) (string, error)
	CompleteJSON(ctx context.Context, model string, systemPrompt, userPrompt string, target interface{}) error
}

// AIAdapter aggregates both video and text AI capabilities.
type AIAdapter struct {
	Video VideoAnalysisProvider
	Text  TextCompletionProvider
}

// ExtractJSONFromMarkdown removes markdown code block fences (```json ... ```) if present.
func ExtractJSONFromMarkdown(content string) string {
	trimmed := strings.TrimSpace(content)

	// Match ```json ... ``` or ``` ... ```
	re := regexp.MustCompile("(?s)```(?:json)?\\s*(.*?)\\s*```")
	matches := re.FindStringSubmatch(trimmed)
	if len(matches) > 1 {
		return strings.TrimSpace(matches[1])
	}

	// If no code block found, find first '{' or '[' and last '}' or ']'
	startObj := strings.Index(trimmed, "{")
	startArr := strings.Index(trimmed, "[")

	start := -1
	if startObj != -1 && (startArr == -1 || startObj < startArr) {
		start = startObj
	} else if startArr != -1 {
		start = startArr
	}

	if start != -1 {
		endObj := strings.LastIndex(trimmed, "}")
		endArr := strings.LastIndex(trimmed, "]")
		end := -1
		if endObj != -1 && (endArr == -1 || endObj > endArr) {
			end = endObj + 1
		} else if endArr != -1 {
			end = endArr + 1
		}

		if end > start {
			return trimmed[start:end]
		}
	}

	return trimmed
}

// UnmarshalJSONFlexible unwraps markdown code fences before parsing into the target struct.
func UnmarshalJSONFlexible(raw string, target interface{}) error {
	cleanJSON := ExtractJSONFromMarkdown(raw)
	if err := json.Unmarshal([]byte(cleanJSON), target); err != nil {
		return fmt.Errorf("failed to unmarshal JSON: %w (content: %s)", err, raw)
	}
	return nil
}
