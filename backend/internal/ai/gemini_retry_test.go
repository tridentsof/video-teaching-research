package ai

import (
	"net/http"
	"testing"
	"time"
)

func TestExtractGeminiRetryInfo_RetryAfterHeader(t *testing.T) {
	header := http.Header{}
	header.Set("Retry-After", "14")

	decision := ExtractGeminiRetryInfo(http.StatusTooManyRequests, header, nil, 2*time.Second)

	if !decision.ShouldRetry {
		t.Fatalf("expected ShouldRetry to be true, got false")
	}
	if decision.Delay != 14*time.Second {
		t.Errorf("expected Delay = 14s, got %v", decision.Delay)
	}
	if decision.IsPermanentQuota {
		t.Errorf("expected IsPermanentQuota = false, got true")
	}
}

func TestExtractGeminiRetryInfo_RetryDelayInBody(t *testing.T) {
	body := []byte(`{
		"error": {
			"code": 429,
			"message": "Resource has been exhausted (e.g. check quota).",
			"status": "RESOURCE_EXHAUSTED",
			"details": [
				{
					"@type": "type.googleapis.com/google.rpc.RetryInfo",
					"retryDelay": "8.5s"
				}
			]
		}
	}`)

	decision := ExtractGeminiRetryInfo(http.StatusTooManyRequests, nil, body, 2*time.Second)

	if !decision.ShouldRetry {
		t.Fatalf("expected ShouldRetry to be true, got false")
	}
	expected := time.Duration(8500 * time.Millisecond)
	if decision.Delay != expected {
		t.Errorf("expected Delay = %v, got %v", expected, decision.Delay)
	}
	if decision.IsPermanentQuota {
		t.Errorf("expected IsPermanentQuota = false, got true")
	}
}

func TestExtractGeminiRetryInfo_DailyQuotaFailFast(t *testing.T) {
	body := []byte(`{
		"error": {
			"code": 429,
			"message": "Resource has been exhausted: quota per day exceeded.",
			"status": "RESOURCE_EXHAUSTED",
			"details": [
				{
					"@type": "type.googleapis.com/google.rpc.ErrorInfo",
					"reason": "RATE_LIMIT_EXCEEDED",
					"domain": "googleapis.com",
					"metadata": {
						"quota_limit": "GenerateContentRequestsPerDayPerProjectPerRegion"
					}
				}
			]
		}
	}`)

	decision := ExtractGeminiRetryInfo(http.StatusTooManyRequests, nil, body, 2*time.Second)

	if decision.ShouldRetry {
		t.Fatalf("expected ShouldRetry to be false for daily quota, got true")
	}
	if !decision.IsPermanentQuota {
		t.Errorf("expected IsPermanentQuota = true for daily quota, got false")
	}
}

func TestExtractGeminiRetryInfo_ExcessiveDelayTreatedAsPermanent(t *testing.T) {
	header := http.Header{}
	header.Set("Retry-After", "3600") // 1 hour

	decision := ExtractGeminiRetryInfo(http.StatusTooManyRequests, header, nil, 2*time.Second)

	if decision.ShouldRetry {
		t.Fatalf("expected ShouldRetry to be false for 1 hour wait, got true")
	}
	if !decision.IsPermanentQuota {
		t.Errorf("expected IsPermanentQuota = true for 1 hour wait, got false")
	}
}

func TestExtractGeminiRetryInfo_TransientRPMFallback(t *testing.T) {
	body := []byte(`{
		"error": {
			"code": 429,
			"message": "Resource has been exhausted (e.g. check quota).",
			"status": "RESOURCE_EXHAUSTED"
		}
	}`)

	decision := ExtractGeminiRetryInfo(http.StatusTooManyRequests, nil, body, 2*time.Second)

	if !decision.ShouldRetry {
		t.Fatalf("expected ShouldRetry to be true, got false")
	}
	// For 429, should fallback to at least 5s rather than 2s
	if decision.Delay < 5*time.Second {
		t.Errorf("expected Delay >= 5s, got %v", decision.Delay)
	}
}
