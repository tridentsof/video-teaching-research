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

type geminiConfig struct {
	Temperature      float64 `json:"temperature,omitempty"`
	MaxOutputTokens  int     `json:"maxOutputTokens,omitempty"`
	ResponseMimeType string  `json:"responseMimeType,omitempty"`
}

type geminiGenerateContentRequest struct {
	SystemInstruction *geminiContent  `json:"system_instruction,omitempty"`
	Contents          []geminiContent `json:"contents"`
	GenerationConfig  *geminiConfig   `json:"generationConfig,omitempty"`
}

type geminiContent struct {
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

type geminiGenerateContentResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
		FinishReason string `json:"finishReason,omitempty"`
	} `json:"candidates"`
	Error *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// uploadFileToGemini uploads a local video file using Gemini Resumable File Upload API with retries.
func (g *GeminiDirectProvider) uploadFileToGemini(ctx context.Context, filePath string) (*GeminiFile, error) {
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat file %s: %w", filePath, err)
	}

	mimeType := mime.TypeByExtension(filepath.Ext(filePath))
	if mimeType == "" {
		mimeType = "video/mp4"
	}
	displayName := filepath.Base(filePath)

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

// waitForFileActive polls until the uploaded video is processed and ACTIVE.
func (g *GeminiDirectProvider) waitForFileActive(ctx context.Context, fileName string) error {
	getURL := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/%s?key=%s", fileName, g.apiKey)
	maxWaitDuration := 10 * time.Minute
	deadline := time.Now().Add(maxWaitDuration)

	for {
		if time.Now().After(deadline) {
			return fmt.Errorf("timed out waiting for gemini video file %s to become ACTIVE (exceeded %v)", fileName, maxWaitDuration)
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

		switch fileStatus.State {
		case "ACTIVE":
			return nil
		case "FAILED":
			return fmt.Errorf("gemini video processing failed for file %s", fileName)
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

		if resp.StatusCode == http.StatusTooManyRequests || (resp.StatusCode >= 500 && resp.StatusCode <= 599) {
			log.Printf("[Gemini AnalyzeVideo] rate limit or server error %d: %s, retrying in %v...", resp.StatusCode, string(body), backoff)
			if attempt == maxRetries {
				return "", fmt.Errorf("gemini failed with status %d: %s", resp.StatusCode, string(body))
			}
			continue
		}

		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("gemini error (%d): %s", resp.StatusCode, string(body))
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

		return genResp.Candidates[0].Content.Parts[0].Text, nil
	}

	return "", fmt.Errorf("exhausted retries for gemini video analysis")
}

// CompleteText sends a prompt to Gemini for text generation / reasoning.
func (g *GeminiDirectProvider) CompleteText(ctx context.Context, model string, systemPrompt, userPrompt string) (string, error) {
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
		GenerationConfig: &geminiConfig{
			Temperature: 0.1,
		},
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

		if resp.StatusCode == http.StatusTooManyRequests || (resp.StatusCode >= 500 && resp.StatusCode <= 599) {
			if attempt == maxRetries {
				return "", fmt.Errorf("gemini failed with status %d: %s", resp.StatusCode, string(body))
			}
			log.Printf("Gemini rate limit or server error %d, retrying in %v...", resp.StatusCode, backoff)
			continue
		}

		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("gemini error (%d): %s", resp.StatusCode, string(body))
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

		return genResp.Candidates[0].Content.Parts[0].Text, nil
	}

	return "", fmt.Errorf("exhausted retries for gemini text completion")
}

// CompleteJSON calls CompleteText and parses the response into target.
func (g *GeminiDirectProvider) CompleteJSON(ctx context.Context, model string, systemPrompt, userPrompt string, target interface{}) error {
	rawText, err := g.CompleteText(ctx, model, systemPrompt, userPrompt)
	if err != nil {
		return err
	}
	return UnmarshalJSONFlexible(rawText, target)
}

