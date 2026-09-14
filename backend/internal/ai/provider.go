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

// tryRepairAt cuts jsonStr at cutIndex, strips trailing commas/whitespace,
// and computes the necessary closing brackets ('}' and ']') to close all open containers.
func tryRepairAt(jsonStr string, cutIndex int) (string, bool) {
	if cutIndex <= 0 || cutIndex >= len(jsonStr) {
		return jsonStr, false
	}

	candidate := strings.TrimSpace(jsonStr[:cutIndex+1])
	candidate = strings.TrimRight(candidate, " \t\n\r,")
	if len(candidate) == 0 {
		return jsonStr, false
	}

	var stack []byte
	inString := false

	for i := 0; i < len(candidate); i++ {
		c := candidate[i]
		if inString {
			if c == '"' {
				backslashCount := 0
				for j := i - 1; j >= 0 && candidate[j] == '\\'; j-- {
					backslashCount++
				}
				if backslashCount%2 == 0 {
					inString = false
				}
			}
			continue
		}

		switch c {
		case '"':
			inString = true
		case '{':
			stack = append(stack, '}')
		case '[':
			stack = append(stack, ']')
		case '}':
			if len(stack) > 0 && stack[len(stack)-1] == '}' {
				stack = stack[:len(stack)-1]
			}
		case ']':
			if len(stack) > 0 && stack[len(stack)-1] == ']' {
				stack = stack[:len(stack)-1]
			}
		}
	}

	if inString || len(stack) == 0 {
		return jsonStr, false
	}

	var closing strings.Builder
	for i := len(stack) - 1; i >= 0; i-- {
		closing.WriteByte(stack[i])
	}

	return candidate + "\n" + closing.String(), true
}

// repairTruncatedJSON attempts to salvage truncated JSON (either top-level arrays or
// objects containing arrays/nested objects) by cutting at the last complete element
// boundary and closing all unclosed delimiters.
func repairTruncatedJSON(jsonStr string) (string, bool) {
	trimmed := strings.TrimSpace(jsonStr)
	if len(trimmed) == 0 {
		return jsonStr, false
	}

	firstChar := trimmed[0]
	if firstChar != '{' && firstChar != '[' {
		return jsonStr, false
	}

	// If already syntactically valid JSON, no repair is needed.
	var js json.RawMessage
	if err := json.Unmarshal([]byte(trimmed), &js); err == nil {
		return jsonStr, false
	}

	searchPos := len(trimmed)
	for attempts := 0; attempts < 5; attempts++ {
		sub := trimmed[:searchPos]
		lastObj := strings.LastIndex(sub, "}")
		lastArr := strings.LastIndex(sub, "]")
		lastCut := lastObj
		if lastArr > lastCut {
			lastCut = lastArr
		}
		if lastCut <= 0 {
			break
		}

		if repaired, ok := tryRepairAt(trimmed, lastCut); ok {
			var check json.RawMessage
			if err := json.Unmarshal([]byte(repaired), &check); err == nil {
				return repaired, true
			}
		}
		searchPos = lastCut
	}

	return jsonStr, false
}

// repairTruncatedJSONArray attempts to salvage a truncated JSON array by
// removing the incomplete trailing element and closing the array bracket.
// Kept for backward compatibility.
func repairTruncatedJSONArray(jsonStr string) (string, bool) {
	trimmed := strings.TrimSpace(jsonStr)
	if !strings.HasPrefix(trimmed, "[") {
		return jsonStr, false
	}
	return repairTruncatedJSON(jsonStr)
}

// UnmarshalJSONFlexible unwraps markdown code fences before parsing into the target struct.
// If the initial parse fails and the content looks like a truncated JSON array or object,
// it attempts to auto-repair by removing the incomplete trailing element and closing all brackets.
func UnmarshalJSONFlexible(raw string, target interface{}) error {
	cleanJSON := ExtractJSONFromMarkdown(raw)
	err := json.Unmarshal([]byte(cleanJSON), target)
	if err == nil {
		return nil
	}

	// Attempt auto-repair for truncated JSON
	if repaired, ok := repairTruncatedJSON(cleanJSON); ok {
		if repairErr := json.Unmarshal([]byte(repaired), target); repairErr == nil {
			log.Printf("[AI JSON Repair] Successfully repaired truncated JSON (original length: %d, repaired length: %d)", len(cleanJSON), len(repaired))
			return nil
		}
	}

	return fmt.Errorf("failed to unmarshal JSON: %w (content: %s)", err, raw)
}
