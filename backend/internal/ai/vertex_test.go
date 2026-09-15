package ai

import (
	"context"
	"testing"
)

// TestVertexAIProviderInterface verifies that VertexAIProvider implements the expected interfaces.
func TestVertexAIProviderInterface(t *testing.T) {
	provider := NewVertexAIProvider("test-key", "my-project", "us-central1", "my-bucket", "gemini-2.0-flash-exp")

	var _ VideoAnalysisProvider = provider
	var _ TextCompletionProvider = provider
}

func TestVertexAIProviderDefaults(t *testing.T) {
	provider := NewVertexAIProvider("", "", "", "", "")

	if provider.region != "us-central1" {
		t.Errorf("expected default region 'us-central1', got %q", provider.region)
	}
	if provider.model != "gemini-2.0-flash" {
		t.Errorf("expected default model 'gemini-2.0-flash', got %q", provider.model)
	}
}

func TestVertexAIProviderCredentialsParse(t *testing.T) {
	// Valid mock Service Account JSON (syntactic)
	mockSAJSON := `{
		"type": "service_account",
		"project_id": "test-gcp-project-456",
		"private_key_id": "abcd1234efgh5678",
		"private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC6...\n-----END PRIVATE KEY-----\n",
		"client_email": "vertex-sa@test-gcp-project-456.iam.gserviceaccount.com",
		"client_id": "1029384756",
		"auth_uri": "https://accounts.google.com/o/oauth2/auth",
		"token_uri": "https://oauth2.googleapis.com/token"
	}`

	provider := NewVertexAIProvider(mockSAJSON, "", "asia-southeast1", "my-video-bucket", "gemini-2.5-pro")

	// projectID should be automatically extracted from SA JSON
	if provider.projectID != "test-gcp-project-456" {
		t.Errorf("expected auto-extracted project_id 'test-gcp-project-456', got %q", provider.projectID)
	}
	if provider.region != "asia-southeast1" {
		t.Errorf("expected region 'asia-southeast1', got %q", provider.region)
	}
	if provider.gcsBucket != "my-video-bucket" {
		t.Errorf("expected GCS bucket 'my-video-bucket', got %q", provider.gcsBucket)
	}
}

func TestVertexAIProviderInvalidCredentials(t *testing.T) {
	provider := NewVertexAIProvider("not-a-valid-json", "test-proj", "us-central1", "test-bucket", "gemini-2.0-flash")

	ctx := context.Background()
	_, err := provider.getAccessToken(ctx)
	if err == nil {
		t.Error("expected error when obtaining token from invalid credentials, got nil")
	}
}

func TestVertexAIBuildGenerateURL(t *testing.T) {
	// 1. Standard regional model
	pRegional := NewVertexAIProvider("", "my-project", "us-central1", "", "gemini-2.5-flash")
	urlRegional := pRegional.buildGenerateURL("gemini-2.5-flash")
	expectedRegional := "https://us-central1-aiplatform.googleapis.com/v1/projects/my-project/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent"
	if urlRegional != expectedRegional {
		t.Errorf("got %q, want %q", urlRegional, expectedRegional)
	}

	// 2. Gemini 3.8 model (auto-routes to global endpoint without regional prefix)
	url38 := pRegional.buildGenerateURL("gemini-3.8-flash")
	expected38 := "https://aiplatform.googleapis.com/v1/projects/my-project/locations/global/publishers/google/models/gemini-3.8-flash:generateContent"
	if url38 != expected38 {
		t.Errorf("got %q, want %q", url38, expected38)
	}

	// 3. Explicit global region
	pGlobal := NewVertexAIProvider("", "my-project", "global", "", "gemini-2.5-pro")
	urlGlobal := pGlobal.buildGenerateURL("gemini-2.5-pro")
	expectedGlobal := "https://aiplatform.googleapis.com/v1/projects/my-project/locations/global/publishers/google/models/gemini-2.5-pro:generateContent"
	if urlGlobal != expectedGlobal {
		t.Errorf("got %q, want %q", urlGlobal, expectedGlobal)
	}
}
