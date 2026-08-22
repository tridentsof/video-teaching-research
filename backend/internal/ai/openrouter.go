package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// OpenRouterProvider implements TextCompletionProvider using OpenRouter API.
type OpenRouterProvider struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
}

// NewOpenRouterProvider creates a new OpenRouterProvider.
func NewOpenRouterProvider(apiKey string) *OpenRouterProvider {
	return &OpenRouterProvider{
		apiKey:  apiKey,
		baseURL: "https://openrouter.ai/api/v1",
		httpClient: &http.Client{
			Timeout: 3 * time.Minute,
		},
	}
}

type openRouterMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openRouterChatRequest struct {
	Model       string              `json:"model"`
	Messages    []openRouterMessage `json:"messages"`
	Temperature float64             `json:"temperature"`
}

type openRouterChatResponse struct {
	Choices []struct {
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
	} `json:"error,omitempty"`
}

// CompleteText sends a completion request to OpenRouter with automatic retries on rate limit / transient errors.
func (o *OpenRouterProvider) CompleteText(ctx context.Context, model string, systemPrompt, userPrompt string) (string, error) {
	if o.apiKey == "" {
		return "", fmt.Errorf("openRouter API key is not configured")
	}
	if model == "" {
		model = "anthropic/claude-3.5-sonnet"
	}

	var messages []openRouterMessage
	if systemPrompt != "" {
		messages = append(messages, openRouterMessage{
			Role:    "system",
			Content: systemPrompt,
		})
	}
	messages = append(messages, openRouterMessage{
		Role:    "user",
		Content: userPrompt,
	})

	reqBody := openRouterChatRequest{
		Model:       model,
		Messages:    messages,
		Temperature: 0.1, // low temperature for precise classification and mapping
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	maxRetries := 3
	backoff := 2 * time.Second

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(backoff):
				backoff *= 2
			}
		}

		req, err := http.NewRequestWithContext(ctx, "POST", fmt.Sprintf("%s/chat/completions", o.baseURL), bytes.NewReader(bodyBytes))
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", o.apiKey))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("HTTP-Referer", "https://github.com/video-teaching-research")
		req.Header.Set("X-Title", "Video Teaching Research Platform")

		resp, err := o.httpClient.Do(req)
		if err != nil {
			if attempt == maxRetries {
				return "", fmt.Errorf("openRouter request failed after %d retries: %w", maxRetries, err)
			}
			log.Printf("OpenRouter transient network error: %v (retrying...)", err)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return "", fmt.Errorf("failed to read response: %w", err)
		}

		if resp.StatusCode == http.StatusTooManyRequests || (resp.StatusCode >= 500 && resp.StatusCode <= 599) {
			if attempt == maxRetries {
				return "", fmt.Errorf("openRouter failed with status %d: %s", resp.StatusCode, string(body))
			}
			log.Printf("OpenRouter rate limit or server error %d, retrying in %v...", resp.StatusCode, backoff)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("openRouter error (%d): %s", resp.StatusCode, string(body))
		}

		var chatResp openRouterChatResponse
		if err := json.Unmarshal(body, &chatResp); err != nil {
			return "", fmt.Errorf("failed to decode openRouter response: %w", err)
		}

		if chatResp.Error != nil {
			return "", fmt.Errorf("openRouter API error: %s", chatResp.Error.Message)
		}

		if len(chatResp.Choices) == 0 {
			return "", fmt.Errorf("openRouter returned empty choices")
		}

		return chatResp.Choices[0].Message.Content, nil
	}

	return "", fmt.Errorf("exhausted retries for openRouter call")
}

// CompleteJSON calls CompleteText and parses the response into target.
func (o *OpenRouterProvider) CompleteJSON(ctx context.Context, model string, systemPrompt, userPrompt string, target interface{}) error {
	rawText, err := o.CompleteText(ctx, model, systemPrompt, userPrompt)
	if err != nil {
		return err
	}
	return UnmarshalJSONFlexible(rawText, target)
}
