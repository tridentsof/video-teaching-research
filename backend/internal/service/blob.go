package service

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"

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

// Upload uploads a stream to Azure Blob Storage with automatic local caching and fallback.
func (a *AzureBlobStorage) Upload(ctx context.Context, blobPath string, reader io.Reader) (string, error) {
	// 1. Buffer file to local storage first for resilience and fast local FFmpeg access
	localPath := filepath.Join("./storage", blobPath)
	if err := os.MkdirAll(filepath.Dir(localPath), 0755); err == nil {
		if out, err := os.Create(localPath); err == nil {
			if _, err := io.Copy(out, reader); err == nil {
				_ = out.Close()

				// 2. Upload from local file to Azure Blob using UploadFile (supports seeking & robust chunking)
				if f, err := os.Open(localPath); err == nil {
					defer f.Close()
					_, uploadErr := a.client.UploadFile(ctx, a.containerName, blobPath, f, &azblob.UploadFileOptions{
						BlockSize:   8 * 1024 * 1024,
						Concurrency: 3,
					})
					if uploadErr == nil {
						return a.GetURL(blobPath), nil
					}
					// If Azure fails (e.g. network timeout / invalid key), log and use local storage fallback safely
					log.Printf("WARNING: Azure Blob Upload failed for %s (%v) — using local storage fallback", blobPath, uploadErr)
					return fmt.Sprintf("/storage/%s", blobPath), nil
				}
			} else {
				_ = out.Close()
			}
		}
	}

	// 3. Fallback direct stream upload if local disk buffer failed
	_, err := a.client.UploadStream(ctx, a.containerName, blobPath, reader, nil)
	if err != nil {
		return "", fmt.Errorf("failed to upload blob %s: %w", blobPath, err)
	}
	return a.GetURL(blobPath), nil
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

// Delete removes a blob from Azure Blob Storage.
func (a *AzureBlobStorage) Delete(ctx context.Context, blobPath string) error {
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
	return filepath.Join(l.baseDir, blobPath)
}
