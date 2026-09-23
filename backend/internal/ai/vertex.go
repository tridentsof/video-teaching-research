package ai

import (
	"bytes"
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"crypto"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
)

// VertexAIProvider implements VideoAnalysisProvider and TextCompletionProvider
// using Google Cloud Vertex AI APIs with GCS-based video input.
type VertexAIProvider struct {
	projectID  string
	region     string
	gcsBucket  string
	model      string
	httpClient *http.Client

	// Service Account credentials
	saEmail    string
	saKey      *rsa.PrivateKey
	tokenCache *cachedToken
	tokenMu    sync.Mutex
}

type cachedToken struct {
	accessToken string
	expiresAt   time.Time
}

type serviceAccountJSON struct {
	Type         string `json:"type"`
	ProjectID    string `json:"project_id"`
	ClientEmail  string `json:"client_email"`
	PrivateKey   string `json:"private_key"`
	PrivateKeyID string `json:"private_key_id"`
}

type tokenResponse struct {
	AccessToken string `json:"access_token"`
	ExpiresIn   int    `json:"expires_in"`
	TokenType   string `json:"token_type"`
}

// NewVertexAIProvider creates a new VertexAIProvider from a Service Account JSON string.
func NewVertexAIProvider(saJSON string, projectID, region, gcsBucket, model string) *VertexAIProvider {
	if region == "" {
		region = "us-central1"
	}
	if model == "" {
		model = "gemini-2.0-flash"
	}
	p := &VertexAIProvider{
		projectID: projectID,
		region:    region,
		gcsBucket: gcsBucket,
		model:     model,
		httpClient: &http.Client{
			Timeout: 10 * time.Minute,
		},
	}

	// Parse service account JSON
	var sa serviceAccountJSON
	if err := json.Unmarshal([]byte(saJSON), &sa); err != nil {
		log.Printf("[VertexAI] Warning: failed to parse service account JSON: %v", err)
		return p
	}

	p.saEmail = sa.ClientEmail
	if projectID == "" {
		p.projectID = sa.ProjectID
	}

	// Parse RSA private key from PEM
	block, _ := pem.Decode([]byte(sa.PrivateKey))
	if block != nil {
		key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			log.Printf("[VertexAI] Warning: failed to parse private key: %v", err)
		} else if rsaKey, ok := key.(*rsa.PrivateKey); ok {
			p.saKey = rsaKey
		}
	}

	return p
}

// GetAccessToken returns the current OAuth2 access token, fetching or refreshing it if needed.
func (v *VertexAIProvider) GetAccessToken(ctx context.Context) (string, error) {
	return v.getAccessToken(ctx)
}

// InvalidateTokenCache clears the cached OAuth2 token so the next call forces a fresh fetch.
func (v *VertexAIProvider) InvalidateTokenCache() {
	v.tokenMu.Lock()
	defer v.tokenMu.Unlock()
	v.tokenCache = nil
}

// getAccessToken returns a valid Google OAuth2 access token, refreshing if necessary.
func (v *VertexAIProvider) getAccessToken(ctx context.Context) (string, error) {
	v.tokenMu.Lock()
	defer v.tokenMu.Unlock()

	// Return cached token if still valid (with 5-minute buffer to avoid expired tokens)
	if v.tokenCache != nil && time.Now().Before(v.tokenCache.expiresAt.Add(-5*time.Minute)) {
		return v.tokenCache.accessToken, nil
	}

	if v.saKey == nil || v.saEmail == "" {
		return "", fmt.Errorf("vertex AI service account credentials not configured")
	}

	// Create JWT
	now := time.Now()
	header := map[string]string{
		"alg": "RS256",
		"typ": "JWT",
	}
	claims := map[string]interface{}{
		"iss":   v.saEmail,
		"scope": "https://www.googleapis.com/auth/cloud-platform",
		"aud":   "https://oauth2.googleapis.com/token",
		"iat":   now.Unix(),
		"exp":   now.Add(time.Hour).Unix(),
	}

	headerJSON, _ := json.Marshal(header)
	claimsJSON, _ := json.Marshal(claims)

	headerB64 := base64.RawURLEncoding.EncodeToString(headerJSON)
	claimsB64 := base64.RawURLEncoding.EncodeToString(claimsJSON)
	signingInput := headerB64 + "." + claimsB64

	// Sign with RSA-SHA256
	hashed := sha256.Sum256([]byte(signingInput))
	signature, err := rsa.SignPKCS1v15(rand.Reader, v.saKey, crypto.SHA256, hashed[:])
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}
	signatureB64 := base64.RawURLEncoding.EncodeToString(signature)
	jwt := signingInput + "." + signatureB64

	// Exchange JWT for access token
	form := fmt.Sprintf("grant_type=urn%%3Aietf%%3Aparams%%3Aoauth%%3Agrant-type%%3Ajwt-bearer&assertion=%s", jwt)
	req, err := http.NewRequestWithContext(ctx, "POST", "https://oauth2.googleapis.com/token",
		strings.NewReader(form))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("token exchange failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("token exchange returned %d: %s", resp.StatusCode, string(body))
	}

	var tokenResp tokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return "", fmt.Errorf("failed to parse token response: %w", err)
	}

	v.tokenCache = &cachedToken{
		accessToken: tokenResp.AccessToken,
		expiresAt:   now.Add(time.Duration(tokenResp.ExpiresIn) * time.Second),
	}

	return tokenResp.AccessToken, nil
}

// uploadToGCS uploads a local video file to Google Cloud Storage and returns the gs:// URI.
func (v *VertexAIProvider) uploadToGCS(ctx context.Context, localPath string) (string, error) {
	return v.uploadToGCSWithMimeType(ctx, localPath, "video/mp4")
}

// uploadToGCSWithMimeType uploads any local file (video or audio) to GCS with the appropriate Content-Type.
func (v *VertexAIProvider) uploadToGCSWithMimeType(ctx context.Context, localPath string, contentType string) (string, error) {
	if v.gcsBucket == "" {
		return "", fmt.Errorf("GCS bucket is not configured for Vertex AI provider")
	}

	token, err := v.getAccessToken(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get access token for GCS upload: %w", err)
	}

	fileData, err := os.ReadFile(localPath)
	if err != nil {
		return "", fmt.Errorf("failed to read local file %s: %w", localPath, err)
	}

	if contentType == "" {
		contentType = "application/octet-stream"
	}

	objectName := fmt.Sprintf("vertex-media/%d_%s", time.Now().UnixMilli(), filepath.Base(localPath))
	uploadURL := fmt.Sprintf("https://storage.googleapis.com/upload/storage/v1/b/%s/o?uploadType=media&name=%s",
		v.gcsBucket, objectName)

	req, err := http.NewRequestWithContext(ctx, "POST", uploadURL, bytes.NewReader(fileData))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", contentType)

	resp, err := v.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("GCS upload failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusUnauthorized {
			v.InvalidateTokenCache()
		}
		return "", fmt.Errorf("GCS upload returned %d: %s", resp.StatusCode, string(body))
	}

	gcsURI := fmt.Sprintf("gs://%s/%s", v.gcsBucket, objectName)
	log.Printf("[VertexAI] Uploaded %s to %s (%d bytes, Content-Type: %s)",
		filepath.Base(localPath), gcsURI, len(fileData), contentType)
	return gcsURI, nil
}

// detectAudioMimeType returns the appropriate MIME type based on file extension.
func detectAudioMimeType(filePath string) string {
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".m4a":
		return "audio/mp4"
	case ".mp3":
		return "audio/mp3"
	case ".wav":
		return "audio/wav"
	case ".aac":
		return "audio/aac"
	case ".ogg", ".opus":
		return "audio/ogg"
	case ".flac":
		return "audio/flac"
	case ".webm":
		return "audio/webm"
	default:
		return "audio/mp4"
	}
}

// deleteFromGCS removes a file from GCS after processing.
func (v *VertexAIProvider) deleteFromGCS(ctx context.Context, gcsURI string) {
	if v.gcsBucket == "" {
		return
	}
	objectName := strings.TrimPrefix(gcsURI, fmt.Sprintf("gs://%s/", v.gcsBucket))
	if objectName == gcsURI {
		return
	}

	token, err := v.getAccessToken(ctx)
	if err != nil {
		log.Printf("[VertexAI] Warning: failed to get token for GCS cleanup: %v", err)
		return
	}

	deleteURL := fmt.Sprintf("https://storage.googleapis.com/storage/v1/b/%s/o/%s",
		v.gcsBucket, objectName)

	req, err := http.NewRequestWithContext(ctx, "DELETE", deleteURL, nil)
	if err != nil {
		return
	}
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := v.httpClient.Do(req)
	if err != nil {
		log.Printf("[VertexAI] Warning: GCS cleanup failed for %s: %v", gcsURI, err)
		return
	}
	resp.Body.Close()
	log.Printf("[VertexAI] Cleaned up GCS object: %s", gcsURI)
}

// buildGenerateURL builds the appropriate Vertex AI REST endpoint for the model.
// Models like gemini-3.8-flash and gemini-3.5-transcribe-preview run exclusively on the global endpoint in Vertex AI (Gemini Enterprise Agent Platform).
// When targeting the global location, Google requires the host https://aiplatform.googleapis.com (no regional prefix).
func (v *VertexAIProvider) buildGenerateURL(model string) string {
	region := v.region
	if region == "" {
		region = "us-central1"
	}
	// Models in the gemini-3.8 family and dedicated transcribe models run exclusively on the global endpoint
	if strings.HasPrefix(model, "gemini-3.8") || strings.Contains(model, "transcribe") {
		region = "global"
	}

	if region == "global" {
		return fmt.Sprintf(
			"https://aiplatform.googleapis.com/v1/projects/%s/locations/global/publishers/google/models/%s:generateContent",
			v.projectID, model,
		)
	}

	return fmt.Sprintf(
		"https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent",
		region, v.projectID, region, model,
	)
}

// AnalyzeVideoChunk uploads a video file to GCS and calls Vertex AI Gemini model for extraction.
func (v *VertexAIProvider) AnalyzeVideoChunk(ctx context.Context, videoFilePath string, prompt string) (string, error) {
	if v.saKey == nil {
		return "", fmt.Errorf("vertex AI service account credentials not configured")
	}

	analysisStart := time.Now()
	model := v.model
	if model == "" {
		model = "gemini-2.5-flash"
	}

	// 1. Upload chunk to GCS bucket
	gcsURI, err := v.uploadToGCS(ctx, videoFilePath)
	if err != nil {
		return "", fmt.Errorf("failed to upload video to GCS: %w", err)
	}
	defer v.deleteFromGCS(context.Background(), gcsURI)

	// 2. Call Vertex AI generateContent with GCS file reference
	token, err := v.getAccessToken(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get access token: %w", err)
	}

	generateURL := v.buildGenerateURL(model)

	reqBody := geminiGenerateContentRequest{
		Contents: []geminiContent{
			{
				Role: "user",
				Parts: []geminiPart{
					{
						FileData: &geminiFileData{
							MimeType: "video/mp4",
							FileURI:  gcsURI,
						},
					},
					{
						Text: prompt,
					},
				},
			},
		},
		GenerationConfig: &geminiConfig{
			MaxOutputTokens:  65536,
			ResponseMimeType: "application/json",
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	const maxRetries = 3
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

		req, err := http.NewRequestWithContext(ctx, "POST", generateURL, bytes.NewReader(bodyBytes))
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		resp, err := v.httpClient.Do(req)
		if err != nil {
			if attempt == maxRetries {
				return "", fmt.Errorf("vertex AI request failed after %d retries: %w", maxRetries, err)
			}
			log.Printf("[VertexAI AnalyzeVideo] attempt %d/%d network error: %v (retrying...)", attempt+1, maxRetries+1, err)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			if attempt == maxRetries {
				return "", fmt.Errorf("failed to read vertex AI response: %w", err)
			}
			continue
		}

		if resp.StatusCode == http.StatusUnauthorized {
			v.InvalidateTokenCache()
			if attempt < maxRetries {
				log.Printf("[VertexAI AnalyzeVideo] attempt %d/%d received 401 Unauthorized, refreshing token and retrying...", attempt+1, maxRetries+1)
				if newToken, tErr := v.getAccessToken(ctx); tErr == nil {
					token = newToken
				}
				continue
			}
		}

		if resp.StatusCode == http.StatusTooManyRequests || (resp.StatusCode >= 500 && resp.StatusCode <= 599) {
			if attempt == maxRetries {
				return "", fmt.Errorf("vertex AI failed with status %d: %s", resp.StatusCode, string(body))
			}
			log.Printf("[VertexAI AnalyzeVideo] status %d, retrying in %v...", resp.StatusCode, backoff)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("vertex AI error (%d): %s", resp.StatusCode, string(body))
		}

		var genResp geminiGenerateContentResponse
		if err := json.Unmarshal(body, &genResp); err != nil {
			return "", fmt.Errorf("failed to decode vertex AI response: %w", err)
		}

		if genResp.Error != nil {
			return "", fmt.Errorf("vertex AI API error (%d): %s", genResp.Error.Code, genResp.Error.Message)
		}

		if len(genResp.Candidates) == 0 || len(genResp.Candidates[0].Content.Parts) == 0 {
			finishReason := ""
			if len(genResp.Candidates) > 0 {
				finishReason = genResp.Candidates[0].FinishReason
			}
			return "", fmt.Errorf("vertex AI returned empty response (finishReason: %s)", finishReason)
		}

		log.Printf("[VertexAI AnalyzeVideo] chunk (%s) processed in %v", filepath.Base(videoFilePath), time.Since(analysisStart))
		return extractCandidateText(genResp.Candidates[0].Content.Parts), nil
	}

	return "", fmt.Errorf("exhausted retries for vertex AI video analysis")
}

// CompleteText sends a text completion request to Vertex AI Gemini.
func (v *VertexAIProvider) CompleteText(ctx context.Context, model string, systemPrompt, userPrompt string) (string, error) {
	return v.completeTextInternal(ctx, model, systemPrompt, userPrompt, false)
}

// CompleteJSON calls CompleteText with JSON enforcement and parses the response into target.
func (v *VertexAIProvider) CompleteJSON(ctx context.Context, model string, systemPrompt, userPrompt string, target interface{}) error {
	rawText, err := v.completeTextInternal(ctx, model, systemPrompt, userPrompt, true)
	if err != nil {
		return err
	}
	return UnmarshalJSONFlexible(rawText, target)
}

func (v *VertexAIProvider) completeTextInternal(ctx context.Context, model string, systemPrompt, userPrompt string, isJSON bool) (string, error) {
	if v.saKey == nil {
		return "", fmt.Errorf("vertex AI service account credentials not configured")
	}

	if model == "" {
		model = v.model
	}

	token, err := v.getAccessToken(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get access token: %w", err)
	}

	generateURL := v.buildGenerateURL(model)

	budget := 2048
	cfg := &geminiConfig{
		Temperature:     0.1,
		MaxOutputTokens: 16384,
		ThinkingConfig: &geminiThinkingConfig{
			ThinkingBudget: &budget,
		},
	}
	if isJSON || strings.Contains(strings.ToLower(userPrompt), "json") || strings.Contains(strings.ToLower(systemPrompt), "json") {
		cfg.ResponseMimeType = "application/json"
	}

	reqBody := geminiGenerateContentRequest{
		Contents: []geminiContent{
			{
				Role: "user",
				Parts: []geminiPart{
					{Text: userPrompt},
				},
			},
		},
		GenerationConfig: cfg,
	}

	if systemPrompt != "" {
		reqBody.SystemInstruction = &geminiContent{
			Parts: []geminiPart{
				{Text: systemPrompt},
			},
		}
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

		req, err := http.NewRequestWithContext(ctx, "POST", generateURL, bytes.NewReader(bodyBytes))
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		resp, err := v.httpClient.Do(req)
		if err != nil {
			if attempt == maxRetries {
				return "", fmt.Errorf("vertex AI text completion failed after %d retries: %w", maxRetries, err)
			}
			log.Printf("[VertexAI CompleteText] network error: %v (retrying...)", err)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return "", fmt.Errorf("failed to read vertex AI response: %w", err)
		}

		if resp.StatusCode == http.StatusUnauthorized {
			v.InvalidateTokenCache()
			if attempt < maxRetries {
				log.Printf("[VertexAI CompleteText] attempt %d/%d received 401 Unauthorized, refreshing token and retrying...", attempt+1, maxRetries+1)
				if newToken, tErr := v.getAccessToken(ctx); tErr == nil {
					token = newToken
				}
				continue
			}
		}

		if resp.StatusCode == http.StatusTooManyRequests || (resp.StatusCode >= 500 && resp.StatusCode <= 599) {
			if attempt == maxRetries {
				return "", fmt.Errorf("vertex AI text completion failed with status %d: %s", resp.StatusCode, string(body))
			}
			log.Printf("[VertexAI CompleteText] status %d, retrying in %v...", resp.StatusCode, backoff)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("vertex AI error (%d): %s", resp.StatusCode, string(body))
		}

		var genResp geminiGenerateContentResponse
		if err := json.Unmarshal(body, &genResp); err != nil {
			return "", fmt.Errorf("failed to decode vertex AI response: %w", err)
		}

		if genResp.Error != nil {
			return "", fmt.Errorf("vertex AI API error (%d): %s", genResp.Error.Code, genResp.Error.Message)
		}

		if len(genResp.Candidates) == 0 || len(genResp.Candidates[0].Content.Parts) == 0 {
			return "", fmt.Errorf("vertex AI returned empty response")
		}

		return extractCandidateText(genResp.Candidates[0].Content.Parts), nil
	}

	return "", fmt.Errorf("exhausted retries for vertex AI text completion")
}

// TranscribeAudio uploads an audio file to GCS and transcribes it using Vertex AI.
// For audio exceeding 12.5 minutes (e.g. 18-minute interviews), it automatically batches/slices
// the file into shorter segments (< 10 minutes) and sends them to the configured model,
// stitching the results and timestamps together cleanly without falling back to another model.
func (v *VertexAIProvider) TranscribeAudio(ctx context.Context, audioFilePath string, prompt string) (string, error) {
	if v.saKey == nil {
		return "", fmt.Errorf("vertex AI service account credentials not configured")
	}

	model := v.model
	if model == "" {
		model = "gemini-3.5-transcribe-preview"
	}

	transcribeStart := time.Now()

	// 1. Check if configured model requires audio chunking
	// Multimodal models (Gemini Flash, Pro) have 1M+ token context and ingest audio directly without chunking.
	if !ModelRequiresAudioChunking(model) {
		log.Printf("[VertexAI TranscribeAudio] Model %s supports large multimodal context. Skipping chunking and transcribing in single-pass...", model)
		return v.transcribeSingleAudio(ctx, audioFilePath, prompt, model)
	}

	// 2. Probe audio duration to determine if batch segmenting is required for narrow-context models
	durationSec, err := ProbeAudioDurationSec(ctx, audioFilePath)
	if err == nil && durationSec > MaxSingleAudioDurationSec {
		log.Printf("[VertexAI TranscribeAudio] Audio %s duration is %ds (> %ds limit). Batching into chunks with silence detection using model %s...",
			filepath.Base(audioFilePath), durationSec, MaxSingleAudioDurationSec, model)

		segments, cleanup, splitErr := SplitAudioFile(ctx, audioFilePath, durationSec, AudioChunkDurationSec)
		if splitErr == nil {
			defer cleanup()
			var segOutputs []string
			for _, seg := range segments {
				log.Printf("[VertexAI TranscribeAudio] Transcribing chunk %d/%d (offset: %ds, duration: %ds) with %s...",
					seg.Index+1, len(segments), seg.OffsetSec, seg.DurationSec, model)

				out, segErr := v.transcribeSingleAudio(ctx, seg.FilePath, prompt, model)
				if segErr != nil {
					return "", fmt.Errorf("transcription failed on audio chunk %d: %w", seg.Index+1, segErr)
				}
				segOutputs = append(segOutputs, out)
			}

			merged := MergeSegmentTranscriptionResults(segOutputs, segments)
			log.Printf("[VertexAI TranscribeAudio] Successfully transcribed and merged %d chunks for %s in %v",
				len(segments), filepath.Base(audioFilePath), time.Since(transcribeStart))
			return merged, nil
		}
		log.Printf("[VertexAI TranscribeAudio] Warning: failed to split audio (%v), attempting single-pass transcription...", splitErr)
	}

	// 3. Single-pass transcription for files under the threshold
	return v.transcribeSingleAudio(ctx, audioFilePath, prompt, model)
}

// transcribeSingleAudio handles GCS upload and single generateContent API request for one audio segment.
func (v *VertexAIProvider) transcribeSingleAudio(ctx context.Context, audioFilePath string, prompt string, model string) (string, error) {
	transcribeStart := time.Now()
	mimeType := detectAudioMimeType(audioFilePath)

	// Step 1: Upload to GCS
	gcsURI, err := v.uploadToGCSWithMimeType(ctx, audioFilePath, mimeType)
	if err != nil {
		return "", fmt.Errorf("failed to upload audio to GCS: %w", err)
	}
	defer v.deleteFromGCS(context.Background(), gcsURI)

	// Step 2: Obtain OAuth2 access token
	token, err := v.getAccessToken(ctx)
	if err != nil {
		return "", fmt.Errorf("failed to get access token: %w", err)
	}

	if prompt == "" {
		prompt = "Transcribe this audio recording verbatim in Vietnamese. Include all spoken words accurately."
	}

	reqBody := geminiGenerateContentRequest{
		Contents: []geminiContent{
			{
				Role: "user",
				Parts: []geminiPart{
					{
						FileData: &geminiFileData{
							MimeType: mimeType,
							FileURI:  gcsURI,
						},
					},
					{
						Text: prompt,
					},
				},
			},
		},
		GenerationConfig: &geminiConfig{
			MaxOutputTokens: 65536,
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	generateURL := v.buildGenerateURL(model)
	const maxRetries = 3
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

		req, err := http.NewRequestWithContext(ctx, "POST", generateURL, bytes.NewReader(bodyBytes))
		if err != nil {
			return "", err
		}
		req.Header.Set("Authorization", "Bearer "+token)
		req.Header.Set("Content-Type", "application/json")

		resp, err := v.httpClient.Do(req)
		if err != nil {
			if attempt == maxRetries {
				return "", fmt.Errorf("vertex AI transcribe request failed after %d retries: %w", maxRetries, err)
			}
			log.Printf("[VertexAI TranscribeAudio] attempt %d/%d network error: %v (retrying...)", attempt+1, maxRetries+1, err)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			if attempt == maxRetries {
				return "", fmt.Errorf("failed to read vertex AI response: %w", err)
			}
			continue
		}

		bodyStr := string(body)

		if resp.StatusCode == http.StatusUnauthorized {
			v.InvalidateTokenCache()
			if attempt < maxRetries {
				log.Printf("[VertexAI TranscribeAudio] attempt %d/%d received 401 Unauthorized, refreshing token and retrying...", attempt+1, maxRetries+1)
				if newToken, tErr := v.getAccessToken(ctx); tErr == nil {
					token = newToken
				}
				continue
			}
		}

		if resp.StatusCode == http.StatusTooManyRequests || (resp.StatusCode >= 500 && resp.StatusCode <= 599) {
			if attempt == maxRetries {
				return "", fmt.Errorf("vertex AI transcribe failed with status %d: %s", resp.StatusCode, bodyStr)
			}
			log.Printf("[VertexAI TranscribeAudio] status %d, retrying in %v...", resp.StatusCode, backoff)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("vertex AI transcribe error (%d): %s", resp.StatusCode, bodyStr)
		}

		var genResp geminiGenerateContentResponse
		if err := json.Unmarshal(body, &genResp); err != nil {
			return "", fmt.Errorf("failed to decode vertex AI response: %w", err)
		}

		if genResp.Error != nil {
			return "", fmt.Errorf("vertex AI API error (%d): %s", genResp.Error.Code, genResp.Error.Message)
		}

		if len(genResp.Candidates) == 0 || len(genResp.Candidates[0].Content.Parts) == 0 {
			finishReason := ""
			if len(genResp.Candidates) > 0 {
				finishReason = genResp.Candidates[0].FinishReason
			}
			return "", fmt.Errorf("vertex AI returned empty response (finishReason: %s)", finishReason)
		}

		transcript := extractCandidateText(genResp.Candidates[0].Content.Parts)
		log.Printf("[VertexAI TranscribeAudio] segment (%s) transcribed successfully using model %s in %v (%d chars)",
			filepath.Base(audioFilePath), model, time.Since(transcribeStart), len(transcript))
		return transcript, nil
	}

	return "", fmt.Errorf("exhausted retries for vertex AI audio transcription")
}

// Ensure VertexAIProvider satisfies all interfaces at compile time.
var _ VideoAnalysisProvider = (*VertexAIProvider)(nil)
var _ AudioTranscriptionProvider = (*VertexAIProvider)(nil)
var _ TextCompletionProvider = (*VertexAIProvider)(nil)

// Suppress unused import warnings for crypto packages used in JWT signing.
var _ = big.NewInt
