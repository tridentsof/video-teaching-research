package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
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

// repairTruncatedJSONArray attempts to salvage a truncated JSON array by
// removing the incomplete trailing element and closing the array bracket.
// Returns the repaired JSON string and true if repair was applied, or the
// original string and false if repair was not applicable.
func repairTruncatedJSONArray(jsonStr string) (string, bool) {
	trimmed := strings.TrimSpace(jsonStr)
	if !strings.HasPrefix(trimmed, "[") {
		return jsonStr, false
	}

	// Already a valid-looking array (ends with ']')
	if strings.HasSuffix(trimmed, "]") {
		return jsonStr, false
	}

	// Find the last complete JSON object boundary "},\n  {" or just "}"
	lastCompleteObj := strings.LastIndex(trimmed, "}")
	if lastCompleteObj <= 0 {
		return jsonStr, false
	}

	// Take everything up to and including the last complete '}'
	candidate := strings.TrimSpace(trimmed[:lastCompleteObj+1])

	// Remove any trailing comma after the last complete object
	candidate = strings.TrimRight(candidate, " \t\n\r,")

	// Close the array
	candidate += "\n]"

	return candidate, true
}

// UnmarshalJSONFlexible unwraps markdown code fences before parsing into the target struct.
// If the initial parse fails and the content looks like a truncated JSON array,
// it attempts to auto-repair by removing the incomplete trailing element.
func UnmarshalJSONFlexible(raw string, target interface{}) error {
	cleanJSON := ExtractJSONFromMarkdown(raw)
	err := json.Unmarshal([]byte(cleanJSON), target)
	if err == nil {
		return nil
	}

	// Attempt auto-repair for truncated JSON arrays
	if repaired, ok := repairTruncatedJSONArray(cleanJSON); ok {
		if repairErr := json.Unmarshal([]byte(repaired), target); repairErr == nil {
			log.Printf("[AI JSON Repair] Successfully repaired truncated JSON array (original length: %d, repaired length: %d)", len(cleanJSON), len(repaired))
			return nil
		}
	}

	return fmt.Errorf("failed to unmarshal JSON: %w (content: %s)", err, raw)
}
