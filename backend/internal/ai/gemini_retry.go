package ai

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

// GeminiRPCError mirrors Google Generative Language API error payload.
type GeminiRPCError struct {
	Error struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
		Details []struct {
			Type       string            `json:"@type"`
			Reason     string            `json:"reason"`
			Metadata   map[string]string `json:"metadata"`
			RetryDelay string            `json:"retryDelay"`
			Violations []struct {
				Subject     string `json:"subject"`
				Description string `json:"description"`
			} `json:"violations"`
		} `json:"details"`
	} `json:"error"`
}

// RetryDecision contains the outcome of analyzing a Gemini API error response.
type RetryDecision struct {
	ShouldRetry      bool
	Delay            time.Duration
	IsPermanentQuota bool
	Reason           string
}

// ExtractGeminiRetryInfo analyzes the HTTP response, headers, and body to decide retry strategy.
func ExtractGeminiRetryInfo(statusCode int, header http.Header, body []byte, defaultBackoff time.Duration) RetryDecision {
	// If it's a 2xx status, no retry needed
	if statusCode >= 200 && statusCode < 300 {
		return RetryDecision{ShouldRetry: false}
	}

	// Parse JSON error body if present
	var rpcErr GeminiRPCError
	hasParsedBody := false
	if len(body) > 0 {
		if err := json.Unmarshal(body, &rpcErr); err == nil && rpcErr.Error.Code != 0 {
			hasParsedBody = true
		}
	}

	errMsg := ""
	if hasParsedBody {
		errMsg = rpcErr.Error.Message
	} else if len(body) > 0 {
		errMsg = string(body)
	}

	// 1. Check for permanent / daily quota exhaustion (Fail-Fast)
	if statusCode == http.StatusTooManyRequests || strings.Contains(errMsg, "RESOURCE_EXHAUSTED") {
		lowerMsg := strings.ToLower(errMsg)
		isDailyLimit := strings.Contains(lowerMsg, "per day") ||
			strings.Contains(lowerMsg, "perday") ||
			strings.Contains(lowerMsg, "daily") ||
			strings.Contains(lowerMsg, "quota per day")

		// Check details metadata for PerDay quota metric
		if hasParsedBody {
			for _, d := range rpcErr.Error.Details {
				for _, v := range d.Metadata {
					lowerV := strings.ToLower(v)
					if strings.Contains(lowerV, "perday") || strings.Contains(lowerV, "per_day") || strings.Contains(lowerV, "daily") {
						isDailyLimit = true
					}
				}
				for _, v := range d.Violations {
					lowerDesc := strings.ToLower(v.Description)
					if strings.Contains(lowerDesc, "per day") || strings.Contains(lowerDesc, "daily") {
						isDailyLimit = true
					}
				}
			}
		}

		if isDailyLimit {
			return RetryDecision{
				ShouldRetry:      false,
				IsPermanentQuota: true,
				Reason:           fmt.Sprintf("Gemini daily quota exhausted (PerDay limit reached): %s", errMsg),
			}
		}
	}

	// 2. Non-retryable client errors (400, 401, 403, 404, etc.)
	if statusCode >= 400 && statusCode < 500 && statusCode != http.StatusTooManyRequests {
		return RetryDecision{
			ShouldRetry:      false,
			IsPermanentQuota: false,
			Reason:           fmt.Sprintf("Non-retryable client error (%d): %s", statusCode, errMsg),
		}
	}

	// 3. For 429 or 5xx, calculate retry delay
	var delay time.Duration

	// Priority A: Check HTTP Retry-After header
	if header != nil {
		if retryAfter := header.Get("Retry-After"); retryAfter != "" {
			if secs, err := strconv.ParseFloat(retryAfter, 64); err == nil && secs > 0 {
				delay = time.Duration(secs * float64(time.Second))
			} else if targetTime, err := http.ParseTime(retryAfter); err == nil {
				delay = time.Until(targetTime)
			}
		}
	}

	// Priority B: Check Google RPC RetryInfo in body
	if delay <= 0 && hasParsedBody {
		for _, d := range rpcErr.Error.Details {
			if d.RetryDelay != "" {
				if parsedDelay, err := time.ParseDuration(d.RetryDelay); err == nil && parsedDelay > 0 {
					delay = parsedDelay
					break
				}
			}
		}
	}

	// Priority C: Default backoff with fallback
	if delay <= 0 {
		if statusCode == http.StatusTooManyRequests {
			// For transient RPM rate limit, start with a reasonable backoff (e.g. max(5s, defaultBackoff))
			if defaultBackoff < 5*time.Second {
				delay = 5 * time.Second
			} else {
				delay = defaultBackoff
			}
		} else {
			// 5xx server errors
			delay = defaultBackoff
		}
	}

	// Sanity bounds on retry delay
	if delay < 1*time.Second {
		delay = 1 * time.Second
	}

	// If Google asks to wait more than 90 seconds, treat it as quota exhaustion to prevent blocking workers
	if delay > 90*time.Second {
		return RetryDecision{
			ShouldRetry:      false,
			IsPermanentQuota: true,
			Delay:            delay,
			Reason:           fmt.Sprintf("Gemini rate limit cooldown too long (%v > 90s), aborting to free resources: %s", delay.Round(time.Second), errMsg),
		}
	}

	reason := fmt.Sprintf("HTTP %d (retrying in %v)", statusCode, delay.Round(100*time.Millisecond))
	if errMsg != "" {
		reason = fmt.Sprintf("HTTP %d: %s (retrying in %v)", statusCode, errMsg, delay.Round(100*time.Millisecond))
	}

	return RetryDecision{
		ShouldRetry:      true,
		Delay:            delay,
		IsPermanentQuota: false,
		Reason:           reason,
	}
}
