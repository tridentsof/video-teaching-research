package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
)

// AudioSegment represents a sliced segment of an audio file for batch transcription.
type AudioSegment struct {
	Index       int
	FilePath    string
	OffsetSec   int
	DurationSec int
}

// MaxSingleAudioDurationSec is the threshold above which audio will be batched/split.
// Dedicated speech-to-text models like gemini-3.5-transcribe-preview have a hard limit
// of 22,500 tokens (~900 seconds / 15 minutes).
// We set threshold to 750s (~12.5m) and segment duration to 600s (10m) for a robust safety buffer.
const (
	MaxSingleAudioDurationSec = 750
	AudioChunkDurationSec     = 600
)

// ProbeAudioDurationSec uses ffprobe or ffmpeg to determine the audio duration in seconds.
func ProbeAudioDurationSec(ctx context.Context, filePath string) (int, error) {
	// 1. Try ffprobe
	cmd := exec.CommandContext(ctx, "ffprobe",
		"-v", "error",
		"-show_entries", "format=duration",
		"-of", "default=noprint_wrappers=1:nokey=1",
		filePath,
	)
	var out bytes.Buffer
	cmd.Stdout = &out
	if err := cmd.Run(); err == nil {
		durationStr := strings.TrimSpace(out.String())
		if secFloat, err := strconv.ParseFloat(durationStr, 64); err == nil && secFloat > 0 {
			return int(secFloat), nil
		}
	}

	// 2. Fallback to ffmpeg -i parsing
	cmd = exec.CommandContext(ctx, "ffmpeg", "-i", filePath)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	_ = cmd.Run()

	output := stderr.String()
	if idx := strings.Index(output, "Duration: "); idx != -1 {
		durStr := output[idx+10 : idx+18]
		parts := strings.Split(durStr, ":")
		if len(parts) == 3 {
			h, _ := strconv.Atoi(parts[0])
			m, _ := strconv.Atoi(parts[1])
			sec, _ := strconv.Atoi(parts[2])
			return h*3600 + m*60 + sec, nil
		}
	}

	return 0, fmt.Errorf("unable to determine audio duration for %s", filePath)
}

// SplitAudioFile splits an audio file into chunks of chunkDurationSec using FFmpeg.
// It returns the slice of AudioSegment and a cleanup function to remove temporary chunk files.
func SplitAudioFile(ctx context.Context, inputFilePath string, totalDurationSec int, chunkDurationSec int) ([]AudioSegment, func(), error) {
	if chunkDurationSec <= 0 {
		chunkDurationSec = AudioChunkDurationSec
	}

	ext := filepath.Ext(inputFilePath)
	if ext == "" {
		ext = ".mp3"
	}

	var segments []AudioSegment
	var tempFiles []string

	cleanup := func() {
		for _, f := range tempFiles {
			_ = os.Remove(f)
		}
	}

	start := 0
	index := 0
	for start < totalDurationSec {
		dur := chunkDurationSec
		if start+dur > totalDurationSec {
			dur = totalDurationSec - start
		}

		tmpFile, err := os.CreateTemp("", fmt.Sprintf("audio_seg_%d_*%s", index, ext))
		if err != nil {
			cleanup()
			return nil, nil, fmt.Errorf("failed to create temp file for audio segment %d: %w", index, err)
		}
		tmpPath := tmpFile.Name()
		tmpFile.Close()
		tempFiles = append(tempFiles, tmpPath)

		// Slicing with FFmpeg:
		// Attempt stream copy first (-c copy) for instantaneous splitting.
		// If stream copy fails, fallback to re-encoding.
		cmd := exec.CommandContext(ctx, "ffmpeg",
			"-y",
			"-ss", strconv.Itoa(start),
			"-t", strconv.Itoa(dur),
			"-i", inputFilePath,
			"-vn",
			"-c", "copy",
			tmpPath,
		)
		var errBuf bytes.Buffer
		cmd.Stderr = &errBuf
		if err := cmd.Run(); err != nil {
			log.Printf("[AudioChunker] FFmpeg stream copy chunk %d failed (%v), falling back to re-encode...", index, err)
			fallbackCmd := exec.CommandContext(ctx, "ffmpeg",
				"-y",
				"-ss", strconv.Itoa(start),
				"-t", strconv.Itoa(dur),
				"-i", inputFilePath,
				"-vn",
				"-acodec", "libmp3lame",
				"-ab", "128k",
				tmpPath,
			)
			if fbErr := fallbackCmd.Run(); fbErr != nil {
				cleanup()
				return nil, nil, fmt.Errorf("ffmpeg failed to slice audio chunk %d [%d-%d]: %w", index, start, start+dur, fbErr)
			}
		}

		segments = append(segments, AudioSegment{
			Index:       index,
			FilePath:    tmpPath,
			OffsetSec:   start,
			DurationSec: dur,
		})

		start += dur
		index++
	}

	return segments, cleanup, nil
}

// timestampRegex matches [MM:SS], [HH:MM:SS], (MM:SS), (HH:MM:SS)
var timestampRegex = regexp.MustCompile(`([\[\(])(?:(\d{1,2}):)?(\d{1,2}):(\d{2})([\]\)])`)

// OffsetTimestampsInText adjusts all timestamps in text by adding offsetSec.
func OffsetTimestampsInText(text string, offsetSec int) string {
	if offsetSec <= 0 || strings.TrimSpace(text) == "" {
		return text
	}

	return timestampRegex.ReplaceAllStringFunc(text, func(m string) string {
		submatches := timestampRegex.FindStringSubmatch(m)
		if len(submatches) < 6 {
			return m
		}
		openParen := submatches[1]
		closeParen := submatches[5]

		var totalSec int
		if submatches[2] != "" {
			// HH:MM:SS
			h, _ := strconv.Atoi(submatches[2])
			m, _ := strconv.Atoi(submatches[3])
			s, _ := strconv.Atoi(submatches[4])
			totalSec = h*3600 + m*60 + s
		} else {
			// MM:SS
			m, _ := strconv.Atoi(submatches[3])
			s, _ := strconv.Atoi(submatches[4])
			totalSec = m*60 + s
		}

		newTotalSec := totalSec + offsetSec
		newH := newTotalSec / 3600
		newM := (newTotalSec % 3600) / 60
		newS := newTotalSec % 60

		if newH > 0 {
			return fmt.Sprintf("%s%02d:%02d:%02d%s", openParen, newH, newM, newS, closeParen)
		}
		return fmt.Sprintf("%s%02d:%02d%s", openParen, newM, newS, closeParen)
	})
}

type segmentJSONResult struct {
	Language         string                   `json:"language"`
	AudioDurationSec float64                  `json:"audio_duration_sec"`
	RawTranscript    string                   `json:"raw_transcript"`
	QAPairs          []map[string]interface{} `json:"qa_pairs"`
}

// MergeSegmentTranscriptionResults combines transcription outputs from multiple segments.
func MergeSegmentTranscriptionResults(segmentOutputs []string, segments []AudioSegment) string {
	if len(segmentOutputs) == 0 {
		return ""
	}
	if len(segmentOutputs) == 1 {
		return segmentOutputs[0]
	}

	var combinedRaw strings.Builder
	var combinedQAPairs []map[string]interface{}
	totalDuration := 0.0
	hasJSON := false
	detectedLanguage := "vi"

	for i, rawOutput := range segmentOutputs {
		offset := 0
		if i < len(segments) {
			offset = segments[i].OffsetSec
			totalDuration += float64(segments[i].DurationSec)
		}

		cleanedJSON := ExtractJSONFromMarkdown(rawOutput)
		var parsed segmentJSONResult
		if err := json.Unmarshal([]byte(cleanedJSON), &parsed); err == nil && (strings.TrimSpace(parsed.RawTranscript) != "" || len(parsed.QAPairs) > 0) {
			hasJSON = true
			if parsed.Language != "" {
				detectedLanguage = parsed.Language
			}

			adjustedTranscript := OffsetTimestampsInText(parsed.RawTranscript, offset)
			if combinedRaw.Len() > 0 && adjustedTranscript != "" {
				combinedRaw.WriteString("\n\n")
			}
			combinedRaw.WriteString(adjustedTranscript)

			if len(parsed.QAPairs) > 0 {
				combinedQAPairs = append(combinedQAPairs, parsed.QAPairs...)
			}
		} else {
			// Plain text transcript
			adjustedText := OffsetTimestampsInText(rawOutput, offset)
			if combinedRaw.Len() > 0 && strings.TrimSpace(adjustedText) != "" {
				combinedRaw.WriteString("\n\n")
			}
			combinedRaw.WriteString(strings.TrimSpace(adjustedText))
		}
	}

	if hasJSON || len(combinedQAPairs) > 0 {
		resp := map[string]interface{}{
			"language":           detectedLanguage,
			"audio_duration_sec": totalDuration,
			"raw_transcript":     combinedRaw.String(),
			"qa_pairs":           combinedQAPairs,
		}
		if combinedQAPairs == nil {
			resp["qa_pairs"] = []interface{}{}
		}
		marshaled, err := json.Marshal(resp)
		if err == nil {
			return string(marshaled)
		}
	}

	return combinedRaw.String()
}
