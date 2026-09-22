package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// GeminiDirectProvider implements VideoAnalysisProvider and TextCompletionProvider using Google Gemini API.
type GeminiDirectProvider struct {
	apiKey     string
	model      string
	httpClient *http.Client
}

// NewGeminiDirectProvider creates a new GeminiDirectProvider with optimized transport settings.
func NewGeminiDirectProvider(apiKey string, model string) *GeminiDirectProvider {
	if model == "" {
		model = "gemini-3.7-flash"
	}

	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   10,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   30 * time.Second, // Increased from Go's 10s default to prevent TLS handshake timeout
		ExpectContinueTimeout: 2 * time.Second,
		ResponseHeaderTimeout: 10 * time.Minute,
	}

	return &GeminiDirectProvider{
		apiKey: apiKey,
		model:  model,
		httpClient: &http.Client{
			Transport: transport,
			Timeout:   10 * time.Minute, // video processing can take a few minutes
		},
	}
}

// GeminiFile represents an uploaded file metadata in Gemini.
type GeminiFile struct {
	Name        string `json:"name"` // e.g. "files/abc123xyz"
	DisplayName string `json:"displayName"`
	MimeType    string `json:"mimeType"`
	SizeBytes   string `json:"sizeBytes"`
	URI         string `json:"uri"`
	State       string `json:"state"` // PROCESSING, ACTIVE, FAILED
}

type fileUploadResponse struct {
	File GeminiFile `json:"file"`
}

type geminiThinkingConfig struct {
	ThinkingBudget *int `json:"thinkingBudget,omitempty"`
}

type geminiConfig struct {
	Temperature      float64               `json:"temperature,omitempty"`
	MaxOutputTokens  int                   `json:"maxOutputTokens,omitempty"`
	ResponseMimeType string                `json:"responseMimeType,omitempty"`
	ThinkingConfig   *geminiThinkingConfig `json:"thinkingConfig,omitempty"`
}

type geminiGenerateContentRequest struct {
	SystemInstruction *geminiContent  `json:"system_instruction,omitempty"`
	Contents          []geminiContent `json:"contents"`
	GenerationConfig  *geminiConfig   `json:"generationConfig,omitempty"`
}

type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

type geminiPart struct {
	Text     string          `json:"text,omitempty"`
	FileData *geminiFileData `json:"fileData,omitempty"`
}

type geminiFileData struct {
	MimeType string `json:"mimeType"`
	FileURI  string `json:"fileUri"`
}

type geminiCandidatePart struct {
	Text    string `json:"text"`
	Thought bool   `json:"thought,omitempty"`
}

type geminiGenerateContentResponse struct {
	Candidates []struct {
		Content struct {
			Parts []geminiCandidatePart `json:"parts"`
		} `json:"content"`
		FinishReason string `json:"finishReason,omitempty"`
	} `json:"candidates"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// extractCandidateText extracts all non-thought text parts from a Gemini / Vertex candidate.
// It joins all parts where thought is false. If no non-thought parts exist, it falls back to all parts.
func extractCandidateText(parts []geminiCandidatePart) string {
	var nonThought strings.Builder
	for _, p := range parts {
		if !p.Thought && p.Text != "" {
			nonThought.WriteString(p.Text)
		}
	}
	if nonThought.Len() > 0 {
		return nonThought.String()
	}
	for _, p := range parts {
		if p.Text != "" {
			nonThought.WriteString(p.Text)
		}
	}
	return nonThought.String()
}

// uploadFileToGemini uploads a local video file using Gemini Resumable File Upload API with retries.
func (g *GeminiDirectProvider) uploadFileToGemini(ctx context.Context, filePath string) (*GeminiFile, error) {
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat file %s: %w", filePath, err)
	}

	ext := strings.ToLower(filepath.Ext(filePath))
	mimeType := mime.TypeByExtension(ext)
	if mimeType == "" {
		switch ext {
		case ".m4a":
			mimeType = "audio/m4a"
		case ".mp3":
			mimeType = "audio/mp3"
		case ".wav":
			mimeType = "audio/wav"
		case ".ogg":
			mimeType = "audio/ogg"
		case ".aac":
			mimeType = "audio/aac"
		case ".flac":
			mimeType = "audio/flac"
		case ".webm":
			mimeType = "audio/webm"
		case ".mp4":
			mimeType = "video/mp4"
		default:
			mimeType = "audio/mp3"
		}
	}
	displayName := filepath.Base(filePath)
	log.Printf("[Gemini uploadFileToGemini] Uploading %s (size: %d bytes, mime: %s)", displayName, fileInfo.Size(), mimeType)

	const maxRetries = 3
	initURL := fmt.Sprintf("https://generativelanguage.googleapis.com/upload/v1beta/files?key=%s", g.apiKey)
	metadata := map[string]interface{}{
		"file": map[string]string{
			"display_name": displayName,
		},
	}
	metadataBytes, _ := json.Marshal(metadata)

	// Step 1: Initiate resumable upload with retry
	var uploadURL string
	backoff := 2 * time.Second

	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
				backoff *= 2
			}
		}

		initReq, err := http.NewRequestWithContext(ctx, "POST", initURL, bytes.NewReader(metadataBytes))
		if err != nil {
			return nil, err
		}
		initReq.Header.Set("X-Goog-Upload-Protocol", "resumable")
		initReq.Header.Set("X-Goog-Upload-Command", "start")
		initReq.Header.Set("X-Goog-Upload-Header-Content-Length", fmt.Sprintf("%d", fileInfo.Size()))
		initReq.Header.Set("X-Goog-Upload-Header-Content-Type", mimeType)
		initReq.Header.Set("Content-Type", "application/json")

		initResp, err := g.httpClient.Do(initReq)
		if err != nil {
			log.Printf("[Gemini Upload Init] attempt %d/%d failed: %v (retrying...)", attempt+1, maxRetries+1, err)
			if attempt == maxRetries {
				return nil, fmt.Errorf("failed to initiate upload after %d attempts: %w", maxRetries+1, err)
			}
			continue
		}

		if initResp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(initResp.Body)
			initResp.Body.Close()
			log.Printf("[Gemini Upload Init] attempt %d/%d HTTP %d: %s (retrying...)", attempt+1, maxRetries+1, initResp.StatusCode, string(body))
			if attempt == maxRetries {
				return nil, fmt.Errorf("upload initiate failed (%d): %s", initResp.StatusCode, string(body))
			}
			continue
		}

		uploadURL = initResp.Header.Get("X-Goog-Upload-URL")
		if uploadURL == "" {
			uploadURL = initResp.Header.Get("Location")
		}
		initResp.Body.Close()

		if uploadURL != "" {
			break
		}
		if attempt == maxRetries {
			return nil, fmt.Errorf("upload URL not returned in headers")
		}
	}

	// Step 2: Upload bytes with retry
	backoff = 2 * time.Second
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(backoff):
				backoff *= 2
			}
		}

		file, err := os.Open(filePath)
		if err != nil {
			return nil, fmt.Errorf("failed to open file %s: %w", filePath, err)
		}

		uploadReq, err := http.NewRequestWithContext(ctx, "POST", uploadURL, file)
		if err != nil {
			file.Close()
			return nil, err
		}
		uploadReq.Header.Set("Content-Length", fmt.Sprintf("%d", fileInfo.Size()))
		uploadReq.Header.Set("X-Goog-Upload-Offset", "0")
		uploadReq.Header.Set("X-Goog-Upload-Command", "upload, finalize")

		uploadResp, err := g.httpClient.Do(uploadReq)
		file.Close()

		if err != nil {
			log.Printf("[Gemini Upload Bytes] attempt %d/%d failed: %v (retrying...)", attempt+1, maxRetries+1, err)
			if attempt == maxRetries {
				return nil, fmt.Errorf("failed to stream upload after %d attempts: %w", maxRetries+1, err)
			}
			continue
		}

		if uploadResp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(uploadResp.Body)
			uploadResp.Body.Close()
			log.Printf("[Gemini Upload Bytes] attempt %d/%d HTTP %d: %s (retrying...)", attempt+1, maxRetries+1, uploadResp.StatusCode, string(body))
			if attempt == maxRetries {
				return nil, fmt.Errorf("upload bytes failed (%d): %s", uploadResp.StatusCode, string(body))
			}
			continue
		}

		var uploadResult fileUploadResponse
		if err := json.NewDecoder(uploadResp.Body).Decode(&uploadResult); err != nil {
			uploadResp.Body.Close()
			return nil, fmt.Errorf("failed to decode upload response: %w", err)
		}
		uploadResp.Body.Close()

		return &uploadResult.File, nil
	}

	return nil, fmt.Errorf("exhausted retries uploading file to gemini")
}

// waitForFileActive polls until the uploaded video/audio is processed and ACTIVE.
func (g *GeminiDirectProvider) waitForFileActive(ctx context.Context, fileName string) error {
	getURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/%s?key=%s", fileName, g.apiKey)
	maxWaitDuration := 5 * time.Minute
	deadline := time.Now().Add(maxWaitDuration)
	pollCount := 0

	for {
		if time.Now().After(deadline) {
			return fmt.Errorf("timed out waiting for gemini file %s to become ACTIVE (exceeded %v)", fileName, maxWaitDuration)
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		req, err := http.NewRequestWithContext(ctx, "GET", getURL, nil)
		if err != nil {
			return err
		}

		resp, err := g.httpClient.Do(req)
		if err != nil {
			log.Printf("[Gemini File Status] transient status check error: %v (retrying in 2s...)", err)
			time.Sleep(2 * time.Second)
			continue
		}

		var fileStatus GeminiFile
		if err := json.NewDecoder(resp.Body).Decode(&fileStatus); err != nil {
			resp.Body.Close()
			log.Printf("[Gemini File Status] decode error: %v (retrying in 2s...)", err)
			time.Sleep(2 * time.Second)
			continue
		}
		resp.Body.Close()

		pollCount++
		log.Printf("[Gemini File Status] poll #%d: file %s is %s", pollCount, fileName, fileStatus.State)

		switch fileStatus.State {
		case "ACTIVE":
			return nil
		case "FAILED":
			return fmt.Errorf("gemini processing failed for file %s", fileName)
		case "PROCESSING":
			time.Sleep(2 * time.Second)
		default:
			time.Sleep(2 * time.Second)
		}
	}
}

// deleteGeminiFile cleans up the temporary file from Gemini storage.
func (g *GeminiDirectProvider) deleteGeminiFile(ctx context.Context, fileName string) {
	deleteURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/%s?key=%s", fileName, g.apiKey)
	req, err := http.NewRequestWithContext(ctx, "DELETE", deleteURL, nil)
	if err == nil {
		resp, err := g.httpClient.Do(req)
		if err == nil {
			_ = resp.Body.Close()
		}
	}
}

// AnalyzeVideoChunk uploads the chunk to Gemini and extracts events using Gemini with retry backoff.
func (g *GeminiDirectProvider) AnalyzeVideoChunk(ctx context.Context, videoFilePath string, prompt string) (string, error) {
	if g.apiKey == "" {
		return "", fmt.Errorf("gemini API key is not configured")
	}

	analysisStart := time.Now()

	// 1. Upload video to Gemini File API
	geminiFile, err := g.uploadFileToGemini(ctx, videoFilePath)
	if err != nil {
		return "", fmt.Errorf("failed to upload to gemini: %w", err)
	}
	defer g.deleteGeminiFile(context.Background(), geminiFile.Name)

	// 2. Wait for file to become ACTIVE
	if err := g.waitForFileActive(ctx, geminiFile.Name); err != nil {
		return "", fmt.Errorf("error waiting for video processing: %w", err)
	}

	// 3. Generate content with prompt and exponential backoff retry
	generateURL := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		g.model, g.apiKey,
	)

	reqBody := geminiGenerateContentRequest{
		Contents: []geminiContent{
			{
				Parts: []geminiPart{
					{
						FileData: &geminiFileData{
							MimeType: "video/mp4",
							FileURI:  geminiFile.URI,
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
		req.Header.Set("Content-Type", "application/json")

		resp, err := g.httpClient.Do(req)
		if err != nil {
			log.Printf("[Gemini AnalyzeVideo] attempt %d/%d network error: %v (retrying...)", attempt+1, maxRetries+1, err)
			if attempt == maxRetries {
				return "", fmt.Errorf("gemini generateContent call failed after %d attempts: %w", maxRetries+1, err)
			}
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			log.Printf("[Gemini AnalyzeVideo] read body error: %v (retrying...)", err)
			if attempt == maxRetries {
				return "", fmt.Errorf("failed to read gemini response: %w", err)
			}
			continue
		}

		if resp.StatusCode != http.StatusOK {
			decision := ExtractGeminiRetryInfo(resp.StatusCode, resp.Header, body, backoff)
			if decision.IsPermanentQuota {
				return "", fmt.Errorf("gemini permanent quota exceeded: %s", decision.Reason)
			}
			if !decision.ShouldRetry {
				return "", fmt.Errorf("gemini error (%d): %s", resp.StatusCode, string(body))
			}
			if attempt == maxRetries {
				return "", fmt.Errorf("gemini failed after %d retries (%d): %s", maxRetries+1, resp.StatusCode, string(body))
			}
			log.Printf("[Gemini AnalyzeVideo] %s (attempt %d/%d)", decision.Reason, attempt+1, maxRetries+1)
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(decision.Delay):
			}
			backoff = decision.Delay * 2
			continue
		}

		var genResp geminiGenerateContentResponse
		if err := json.Unmarshal(body, &genResp); err != nil {
			return "", fmt.Errorf("failed to decode gemini response: %w", err)
		}

		if genResp.Error != nil {
			return "", fmt.Errorf("gemini API error (%d): %s", genResp.Error.Code, genResp.Error.Message)
		}

		if len(genResp.Candidates) == 0 || len(genResp.Candidates[0].Content.Parts) == 0 {
			finishReason := ""
			if len(genResp.Candidates) > 0 {
				finishReason = genResp.Candidates[0].FinishReason
			}
			return "", fmt.Errorf("gemini returned empty response (finishReason: %s)", finishReason)
		}

		log.Printf("[Gemini AnalyzeVideo] chunk (%s) processed successfully in %v", filepath.Base(videoFilePath), time.Since(analysisStart))
		return extractCandidateText(genResp.Candidates[0].Content.Parts), nil
	}

	return "", fmt.Errorf("exhausted retries for gemini video analysis")
}

// TranscribeAudio uploads an audio file (mp3/m4a/wav/ogg) to Gemini and executes multimodal audio transcription with retry backoff.
func (g *GeminiDirectProvider) TranscribeAudio(ctx context.Context, audioFilePath string, prompt string) (string, error) {
	if g.apiKey == "" {
		return "", fmt.Errorf("gemini API key is not configured")
	}

	analysisStart := time.Now()

	// 1. Upload audio to Gemini File API
	log.Printf("[Gemini TranscribeAudio] Step 1: Uploading audio file %s to Google File API...", filepath.Base(audioFilePath))
	geminiFile, err := g.uploadFileToGemini(ctx, audioFilePath)
	if err != nil {
		return "", fmt.Errorf("failed to upload audio to gemini: %w", err)
	}
	defer g.deleteGeminiFile(context.Background(), geminiFile.Name)

	// 2. Wait for file to become ACTIVE
	log.Printf("[Gemini TranscribeAudio] Step 2: Audio uploaded as %s (URI: %s), waiting for ACTIVE status...", geminiFile.Name, geminiFile.URI)
	if err := g.waitForFileActive(ctx, geminiFile.Name); err != nil {
		return "", fmt.Errorf("error waiting for audio file processing: %w", err)
	}

	// 3. Try dedicated speech-to-text model gemini-3.5-transcribe via Interactions API first
	log.Printf("[Gemini TranscribeAudio] Step 3: Attempting specialized audio transcription using gemini-3.5-transcribe (Interactions API)...")
	transcriptText, interErr := g.transcribeWithInteractionsAPI(ctx, geminiFile.URI)
	if interErr == nil && strings.TrimSpace(transcriptText) != "" {
		log.Printf("[Gemini TranscribeAudio] gemini-3.5-transcribe completed successfully in %v (%d chars)",
			time.Since(analysisStart), len(transcriptText))

		respJSON := map[string]interface{}{
			"language":           "vi",
			"raw_transcript":     transcriptText,
			"qa_pairs":           []interface{}{},
		}
		formattedBytes, _ := json.Marshal(respJSON)
		return string(formattedBytes), nil
	}

	if interErr != nil {
		log.Printf("[Gemini TranscribeAudio] Note: gemini-3.5-transcribe Interactions API skipped/failed (%v). Falling back to multimodal generateContent cascade...", interErr)
	}

	// Fallback: Generate content with audio parts and candidate model cascading
	preferredModel := g.model
	if preferredModel == "" || preferredModel == "gemini-2.5-flash" || preferredModel == "gemini-3.5-transcribe-preview" {
		preferredModel = "gemini-3.6-flash"
	}
	candidateModels := []string{preferredModel}
	for _, m := range []string{"gemini-3.6-flash", "gemini-flash-latest", "gemini-3.5-flash"} {
		found := false
		for _, cm := range candidateModels {
			if cm == m {
				found = true
				break
			}
		}
		if !found {
			candidateModels = append(candidateModels, m)
		}
	}
	modelIndex := 0

	mimeType := geminiFile.MimeType
	if mimeType == "" {
		ext := strings.ToLower(filepath.Ext(audioFilePath))
		switch ext {
		case ".m4a":
			mimeType = "audio/m4a"
		case ".wav":
			mimeType = "audio/wav"
		default:
			mimeType = "audio/mp3"
		}
	}

	log.Printf("[Gemini TranscribeAudio] Step 3b: Calling multimodal fallback model %s...", candidateModels[modelIndex])

	reqBody := geminiGenerateContentRequest{
		Contents: []geminiContent{
			{
				Parts: []geminiPart{
					{
						FileData: &geminiFileData{
							MimeType: mimeType,
							FileURI:  geminiFile.URI,
						},
					},
					{
						Text: prompt,
					},
				},
			},
		},
		GenerationConfig: &geminiConfig{
			MaxOutputTokens:  8192,
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

		currentModel := candidateModels[modelIndex]
		generateURL := fmt.Sprintf(
			"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
			currentModel, g.apiKey,
		)

		req, err := http.NewRequestWithContext(ctx, "POST", generateURL, bytes.NewReader(bodyBytes))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := g.httpClient.Do(req)
		if err != nil {
			log.Printf("[Gemini TranscribeAudio] attempt %d/%d (model %s) network error: %v (retrying...)", attempt+1, maxRetries+1, currentModel, err)
			if attempt == maxRetries {
				return "", fmt.Errorf("transcribe request failed after %d retries: %w", maxRetries+1, err)
			}
			continue
		}

		respBody, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			return "", fmt.Errorf("failed to read response: %w", readErr)
		}

		if resp.StatusCode != http.StatusOK {
			log.Printf("[Gemini TranscribeAudio] attempt %d/%d (model %s) HTTP %d: %s", attempt+1, maxRetries+1, currentModel, resp.StatusCode, string(respBody))
			// If 503 (model overloaded / high demand), 429 (rate limit), or 404 (model not found / deprecated)
			// dynamically switch immediately to next candidate model
			if (resp.StatusCode == 503 || resp.StatusCode == 429 || resp.StatusCode == 404) && modelIndex+1 < len(candidateModels) {
				modelIndex++
				log.Printf("[Gemini TranscribeAudio] model %s error (%d), switching immediately to fallback candidate model %s...", currentModel, resp.StatusCode, candidateModels[modelIndex])
				continue
			}

			if resp.StatusCode == 429 || resp.StatusCode >= 500 {
				if attempt == maxRetries {
					return "", fmt.Errorf("gemini API error (%d): %s", resp.StatusCode, string(respBody))
				}
				continue
			}
			return "", fmt.Errorf("gemini API error (%d): %s", resp.StatusCode, string(respBody))
		}

		var genResp geminiGenerateContentResponse
		if err := json.Unmarshal(respBody, &genResp); err != nil {
			return "", fmt.Errorf("failed to parse response: %w", err)
		}

		if genResp.Error != nil {
			return "", fmt.Errorf("gemini API error (%d): %s", genResp.Error.Code, genResp.Error.Message)
		}

		if len(genResp.Candidates) == 0 || len(genResp.Candidates[0].Content.Parts) == 0 {
			finishReason := ""
			if len(genResp.Candidates) > 0 {
				finishReason = genResp.Candidates[0].FinishReason
			}
			return "", fmt.Errorf("gemini returned empty response (finishReason: %s)", finishReason)
		}

		log.Printf("[Gemini TranscribeAudio] file (%s) transcribed successfully in %v", filepath.Base(audioFilePath), time.Since(analysisStart))
		return extractCandidateText(genResp.Candidates[0].Content.Parts), nil
	}

	return "", fmt.Errorf("exhausted retries for gemini audio transcription")
}

// transcribeWithInteractionsAPI uses Google's dedicated speech-to-text model gemini-3.5-transcribe
// via the official Interactions API (/v1beta/interactions).
func (g *GeminiDirectProvider) transcribeWithInteractionsAPI(ctx context.Context, fileURI string) (string, error) {
	interactionsURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/interactions?key=%s", g.apiKey)

	reqPayload := map[string]interface{}{
		"model": "gemini-3.5-transcribe",
		"input": []map[string]string{
			{
				"type": "audio",
				"uri":  fileURI,
			},
		},
	}

	bodyBytes, err := json.Marshal(reqPayload)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", interactionsURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := g.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("interactions api request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read interactions response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("interactions api returned HTTP %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		Status string `json:"status"`
		Steps  []struct {
			Content []struct {
				Text string `json:"text"`
			} `json:"content"`
		} `json:"steps"`
	}

	if err := json.Unmarshal(respBody, &result); err != nil {
		return "", fmt.Errorf("failed to parse interactions response: %w", err)
	}

	for _, step := range result.Steps {
		for _, c := range step.Content {
			if strings.TrimSpace(c.Text) != "" {
				return c.Text, nil
			}
		}
	}

	return "", fmt.Errorf("no transcript text found in interactions response")
}

// CompleteText sends a prompt to Gemini for text generation / reasoning.
func (g *GeminiDirectProvider) CompleteText(ctx context.Context, model string, systemPrompt, userPrompt string) (string, error) {
	return g.completeTextInternal(ctx, model, systemPrompt, userPrompt, false)
}

// CompleteJSON calls CompleteText with JSON enforcement and parses the response into target.
func (g *GeminiDirectProvider) CompleteJSON(ctx context.Context, model string, systemPrompt, userPrompt string, target interface{}) error {
	rawText, err := g.completeTextInternal(ctx, model, systemPrompt, userPrompt, true)
	if err != nil {
		return err
	}
	return UnmarshalJSONFlexible(rawText, target)
}

func (g *GeminiDirectProvider) completeTextInternal(ctx context.Context, model string, systemPrompt, userPrompt string, isJSON bool) (string, error) {
	if g.apiKey == "" {
		return "", fmt.Errorf("gemini API key is not configured")
	}
	if model == "" {
		model = g.model
	}

	generateURL := fmt.Sprintf(
		"https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s",
		model, g.apiKey,
	)

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
				Parts: []geminiPart{
					{
						Text: userPrompt,
					},
				},
			},
		},
		GenerationConfig: cfg,
	}

	if systemPrompt != "" {
		reqBody.SystemInstruction = &geminiContent{
			Parts: []geminiPart{
				{
					Text: systemPrompt,
				},
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
		req.Header.Set("Content-Type", "application/json")

		resp, err := g.httpClient.Do(req)
		if err != nil {
			if attempt == maxRetries {
				return "", fmt.Errorf("gemini text completion failed after %d retries: %w", maxRetries, err)
			}
			log.Printf("Gemini transient network error: %v (retrying...)", err)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			return "", fmt.Errorf("failed to read gemini response: %w", err)
		}

		if resp.StatusCode != http.StatusOK {
			decision := ExtractGeminiRetryInfo(resp.StatusCode, resp.Header, body, backoff)
			if decision.IsPermanentQuota {
				return "", fmt.Errorf("gemini permanent quota exceeded: %s", decision.Reason)
			}
			if !decision.ShouldRetry {
				return "", fmt.Errorf("gemini error (%d): %s", resp.StatusCode, string(body))
			}
			if attempt == maxRetries {
				return "", fmt.Errorf("gemini text completion failed after %d retries: %s", maxRetries+1, string(body))
			}
			log.Printf("[Gemini CompleteText] %s (attempt %d/%d)", decision.Reason, attempt+1, maxRetries+1)
			select {
			case <-ctx.Done():
				return "", ctx.Err()
			case <-time.After(decision.Delay):
			}
			backoff = decision.Delay * 2
			continue
		}

		var genResp geminiGenerateContentResponse
		if err := json.Unmarshal(body, &genResp); err != nil {
			return "", fmt.Errorf("failed to decode gemini response: %w", err)
		}

		if genResp.Error != nil {
			return "", fmt.Errorf("gemini API error (%d): %s", genResp.Error.Code, genResp.Error.Message)
		}

		if len(genResp.Candidates) == 0 || len(genResp.Candidates[0].Content.Parts) == 0 {
			return "", fmt.Errorf("gemini returned empty response")
		}

		return extractCandidateText(genResp.Candidates[0].Content.Parts), nil
	}

	return "", fmt.Errorf("exhausted retries for gemini text completion")
}


