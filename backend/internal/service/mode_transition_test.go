package service

import (
	"testing"
)

func TestModeTransitionDetection(t *testing.T) {
	fullMode := "full"
	chunkMode := "chunk"

	tests := []struct {
		name           string
		currentMode    *string
		enableChunking bool
		requestedMode  string
		expectedAction string // "resume" or "restart"
	}{
		{
			name:           "Full to Chunk with Resume forces Restart",
			currentMode:    &fullMode,
			enableChunking: true,
			requestedMode:  "resume",
			expectedAction: "restart",
		},
		{
			name:           "Chunk to Full with Resume forces Restart",
			currentMode:    &chunkMode,
			enableChunking: false,
			requestedMode:  "resume",
			expectedAction: "restart",
		},
		{
			name:           "Same Chunk mode with Resume keeps Resume",
			currentMode:    &chunkMode,
			enableChunking: true,
			requestedMode:  "resume",
			expectedAction: "resume",
		},
		{
			name:           "Same Full mode with Resume keeps Resume",
			currentMode:    &fullMode,
			enableChunking: false,
			requestedMode:  "resume",
			expectedAction: "resume",
		},
		{
			name:           "Initial run with nil mode keeps Resume",
			currentMode:    nil,
			enableChunking: true,
			requestedMode:  "resume",
			expectedAction: "resume",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			targetProcessingMode := "chunk"
			if !tt.enableChunking {
				targetProcessingMode = "full"
			}

			current := ""
			if tt.currentMode != nil {
				current = *tt.currentMode
			}

			isModeChanged := current != "" && current != targetProcessingMode
			effectiveMode := tt.requestedMode
			if isModeChanged && effectiveMode == "resume" {
				effectiveMode = "restart"
			}

			if effectiveMode != tt.expectedAction {
				t.Errorf("got %s, want %s", effectiveMode, tt.expectedAction)
			}
		})
	}
}
