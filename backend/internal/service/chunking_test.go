package service

import (
	"testing"
)

func TestCalculateChunks(t *testing.T) {
	svc := NewChunkingService(nil, nil, nil, "ffmpeg", 600, 30)

	tests := []struct {
		name          string
		totalDuration int
		expectedCount int
		expectedStart []int
		expectedEnd   []int
	}{
		{
			name:          "Under 10 minutes",
			totalDuration: 450,
			expectedCount: 1,
			expectedStart: []int{0},
			expectedEnd:   []int{450},
		},
		{
			name:          "Exactly 10 minutes",
			totalDuration: 600,
			expectedCount: 1,
			expectedStart: []int{0},
			expectedEnd:   []int{600},
		},
		{
			name:          "30 minutes (1800 seconds)",
			totalDuration: 1800,
			// Step is 600 - 30 = 570
			// Chunk 0: [0, 600]
			// Chunk 1: [570, 1170]
			// Chunk 2: [1140, 1740]
			// Chunk 3: [1710, 1800]
			expectedCount: 4,
			expectedStart: []int{0, 570, 1140, 1710},
			expectedEnd:   []int{600, 1170, 1740, 1800},
		},
		{
			name:          "60 minutes (3600 seconds)",
			totalDuration: 3600,
			// 0, 570, 1140, 1710, 2280, 2850, 3420 -> 7 chunks
			expectedCount: 7,
			expectedStart: []int{0, 570, 1140, 1710, 2280, 2850, 3420},
			expectedEnd:   []int{600, 1170, 1740, 2310, 2880, 3450, 3600},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			chunks := svc.CalculateChunks(tt.totalDuration)
			if len(chunks) != tt.expectedCount {
				t.Fatalf("expected %d chunks, got %d", tt.expectedCount, len(chunks))
			}

			for i, ch := range chunks {
				if ch.StartSec != tt.expectedStart[i] {
					t.Errorf("chunk %d start: expected %d, got %d", i, tt.expectedStart[i], ch.StartSec)
				}
				if ch.EndSec != tt.expectedEnd[i] {
					t.Errorf("chunk %d end: expected %d, got %d", i, tt.expectedEnd[i], ch.EndSec)
				}
			}
		})
	}
}

func TestExtractBlobPath(t *testing.T) {
	vid := "a37c4b80-79dc-46a7-a10e-066b45ad1962"
	parsedUUID := "a37c4b80-79dc-46a7-a10e-066b45ad1962"

	azureURL := "https://vtrdevstorage.blob.core.windows.net/videos/raw/T01/" + vid + ".MP4"
	p1 := extractBlobPath(&azureURL, "T01", [16]byte{0xa3, 0x7c, 0x4b, 0x80, 0x79, 0xdc, 0x46, 0xa7, 0xa1, 0x0e, 0x06, 0x6b, 0x45, 0xad, 0x19, 0x62})
	if p1 != "raw/T01/"+vid+".MP4" {
		t.Errorf("expected raw/T01/%s.MP4, got %s", vid, p1)
	}

	localURL := "http://localhost:8000/storage/raw/T02/" + vid + ".mov"
	p2 := extractBlobPath(&localURL, "T02", [16]byte{0xa3, 0x7c, 0x4b, 0x80, 0x79, 0xdc, 0x46, 0xa7, 0xa1, 0x0e, 0x06, 0x6b, 0x45, 0xad, 0x19, 0x62})
	if p2 != "raw/T02/"+vid+".mov" {
		t.Errorf("expected raw/T02/%s.mov, got %s", vid, p2)
	}

	var nilURL *string
	p3 := extractBlobPath(nilURL, "T01", [16]byte{0xa3, 0x7c, 0x4b, 0x80, 0x79, 0xdc, 0x46, 0xa7, 0xa1, 0x0e, 0x06, 0x6b, 0x45, 0xad, 0x19, 0x62})
	if p3 != "raw/T01/"+parsedUUID+".mp4" {
		t.Errorf("expected raw/T01/%s.mp4, got %s", parsedUUID, p3)
	}
}
