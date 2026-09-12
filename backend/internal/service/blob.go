package service

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob"
)

// BlobStorage defines the interface for video and chunk file storage.
type BlobStorage interface {
	Upload(ctx context.Context, blobPath string, reader io.Reader) (string, error)
	Download(ctx context.Context, blobPath string) (io.ReadCloser, error)
	Delete(ctx context.Context, blobPath string) error
	GetURL(blobPath string) string
}

// AzureBlobStorage implements BlobStorage using Azure Blob Storage.
type AzureBlobStorage struct {
	client        *azblob.Client
	accountName   string
	containerName string
}

// NewAzureBlobStorage creates a new AzureBlobStorage client.
func NewAzureBlobStorage(accountName, accountKey, containerName string) (*AzureBlobStorage, error) {
	if accountName == "" || accountKey == "" {
		return nil, fmt.Errorf("azure storage account and key are required")
	}

	cred, err := azblob.NewSharedKeyCredential(accountName, accountKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create azure credential: %w", err)
	}

	serviceURL := fmt.Sprintf("https://%s.blob.core.windows.net/", accountName)
	client, err := azblob.NewClientWithSharedKeyCredential(serviceURL, cred, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create azure blob client: %w", err)
	}

	return &AzureBlobStorage{
		client:        client,
		accountName:   accountName,
		containerName: containerName,
	}, nil
}

// Upload uploads a stream to local disk immediately and syncs to Azure Blob Storage in the background.
func (a *AzureBlobStorage) Upload(ctx context.Context, blobPath string, reader io.Reader) (string, error) {
	// 1. Buffer file to local storage first for resilience and fast local FFmpeg access
	localPath := filepath.Join("./storage", blobPath)
	if err := os.MkdirAll(filepath.Dir(localPath), 0755); err != nil {
		return "", fmt.Errorf("failed to create local storage directory: %w", err)
	}

	out, err := os.Create(localPath)
	if err != nil {
		return "", fmt.Errorf("failed to create local file: %w", err)
	}

	if _, err := io.Copy(out, reader); err != nil {
		_ = out.Close()
		_ = os.Remove(localPath)
		return "", fmt.Errorf("failed to write uploaded file to disk: %w", err)
	}
	_ = out.Close()

	// 2. Asynchronously upload to Azure Blob Storage in background so HTTP response is instant
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()

		f, err := os.Open(localPath)
		if err != nil {
			log.Printf("[AzureBlobStorage] Failed to open local file %s for Azure background upload: %v", localPath, err)
			return
		}
		defer f.Close()

		_, uploadErr := a.client.UploadFile(bgCtx, a.containerName, blobPath, f, &azblob.UploadFileOptions{
			BlockSize:   8 * 1024 * 1024,
			Concurrency: 3,
		})
		if uploadErr != nil {
			log.Printf("WARNING: Azure Blob background sync failed for %s (%v) — local storage copy retained", blobPath, uploadErr)
		} else {
			log.Printf("[AzureBlobStorage] Successfully synced %s to Azure Blob Storage", blobPath)
		}
	}()

	return fmt.Sprintf("/storage/%s", blobPath), nil
}

// Download downloads a blob from Azure Blob Storage or reads directly from local cache if present.
func (a *AzureBlobStorage) Download(ctx context.Context, blobPath string) (io.ReadCloser, error) {
	// Check if local copy already exists on disk
	localPath := filepath.Join("./storage", blobPath)
	if f, err := os.Open(localPath); err == nil {
		return f, nil
	}

	resp, err := a.client.DownloadStream(ctx, a.containerName, blobPath, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to download blob %s: %w", blobPath, err)
	}
	return resp.Body, nil
}

// Delete removes a blob from Azure Blob Storage and cleans up local cache.
func (a *AzureBlobStorage) Delete(ctx context.Context, blobPath string) error {
	localPath := filepath.Join("./storage", blobPath)
	_ = os.Remove(localPath)

	_, err := a.client.DeleteBlob(ctx, a.containerName, blobPath, nil)
	if err != nil {
		return fmt.Errorf("failed to delete blob %s: %w", blobPath, err)
	}
	return nil
}

// GetURL returns the public/direct URL for the blob.
func (a *AzureBlobStorage) GetURL(blobPath string) string {
	return fmt.Sprintf("https://%s.blob.core.windows.net/%s/%s", a.accountName, a.containerName, blobPath)
}

// LocalBlobStorage implements BlobStorage using local filesystem (for local dev/testing fallback).
type LocalBlobStorage struct {
	baseDir string
	baseURL string
}

// NewLocalBlobStorage creates a local filesystem-backed BlobStorage.
func NewLocalBlobStorage(baseDir, baseURL string) (*LocalBlobStorage, error) {
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create local storage directory: %w", err)
	}
	return &LocalBlobStorage{
		baseDir: baseDir,
		baseURL: baseURL,
	}, nil
}

// Upload saves the stream to a local file.
func (l *LocalBlobStorage) Upload(ctx context.Context, blobPath string, reader io.Reader) (string, error) {
	fullPath := filepath.Join(l.baseDir, blobPath)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return "", fmt.Errorf("failed to create dir: %w", err)
	}

	out, err := os.Create(fullPath)
	if err != nil {
		return "", fmt.Errorf("failed to create file: %w", err)
	}
	defer out.Close()

	if _, err := io.Copy(out, reader); err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}

	return l.GetURL(blobPath), nil
}

// Download reads the file from local filesystem.
func (l *LocalBlobStorage) Download(ctx context.Context, blobPath string) (io.ReadCloser, error) {
	fullPath := filepath.Join(l.baseDir, blobPath)
	return os.Open(fullPath)
}

// Delete removes the file from local filesystem.
func (l *LocalBlobStorage) Delete(ctx context.Context, blobPath string) error {
	fullPath := filepath.Join(l.baseDir, blobPath)
	return os.Remove(fullPath)
}

// GetURL returns a file URL or relative path URL.
func (l *LocalBlobStorage) GetURL(blobPath string) string {
	if l.baseURL != "" {
		return fmt.Sprintf("%s/storage/%s", l.baseURL, blobPath)
	}
	return fmt.Sprintf("/storage/%s", blobPath)
}
