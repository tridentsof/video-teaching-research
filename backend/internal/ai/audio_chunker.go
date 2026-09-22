package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
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

// SilenceInterval represents a detected pause or silence in the audio stream.
type SilenceInterval struct {
	Start    float64
	End      float64
	Duration float64
}

// Configuration constants for audio chunking and silence detection.
const (
	MaxSingleAudioDurationSec = 750  // 12.5m: threshold above which narrow-context audio models must be split
	AudioChunkDurationSec     = 600  // 10m: default target chunk length
	DefaultAudioOverlapSec    = 3    // 3s: boundary overlap buffer to guarantee no word loss
	SilenceSearchWindowSec    = 45   // Search +/- 45s around target boundary (e.g. 555s - 645s for 600s)
	SilenceMinDurationSec     = 0.35 // Minimum silence duration in seconds to qualify as a speech pause
	SilenceNoiseFloorDB       = -30  // Noise floor in dB for silence detection
)

// ModelRequiresAudioChunking determines if an AI model requires client-side/pipeline audio chunking.
// Multimodal models (Gemini Flash, Pro) have a context window of 1,000,000+ tokens (~11 hours of audio),
// allowing them to ingest raw full-length recordings directly in a single pass.
// Specialized speech-to-text models like gemini-3.5-transcribe-preview have strict token limits (< 15-20 min)
// and thus require chunking.
func ModelRequiresAudioChunking(modelName string) bool {
	normalized := strings.ToLower(strings.TrimSpace(modelName))
	if normalized == "" {
		return true // Default safe fallback
	}
	// Gemini multimodal long-context models (Flash, Pro) ingest full audio files without chunking
	if strings.Contains(normalized, "flash") || strings.Contains(normalized, "pro") {
		return false
	}
	// Explicit specialized speech models with narrow token context (< 15-20 min)
	if strings.Contains(normalized, "transcribe") {
		return true
	}
	// Default safe fallback: models not explicitly identified as long-context
	return false
}

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

var (
	silenceStartRegex = regexp.MustCompile(`silence_start:\s*([0-9]+(?:\.[0-9]+)?)`)
	silenceEndRegex   = regexp.MustCompile(`silence_end:\s*([0-9]+(?:\.[0-9]+)?)(?:\s*\|\s*silence_duration:\s*([0-9]+(?:\.[0-9]+)?))?`)
)

// DetectSilenceIntervals uses FFmpeg silencedetect filter to find pauses in audio.
func DetectSilenceIntervals(ctx context.Context, inputFilePath string, minDurationSec float64, noiseFloorDB int) ([]SilenceInterval, error) {
	if minDurationSec <= 0 {
		minDurationSec = SilenceMinDurationSec
	}
	if noiseFloorDB == 0 {
		noiseFloorDB = SilenceNoiseFloorDB
	}

	filterArg := fmt.Sprintf("silencedetect=noise=%ddB:d=%.2f", noiseFloorDB, minDurationSec)
	cmd := exec.CommandContext(ctx, "ffmpeg",
		"-i", inputFilePath,
		"-af", filterArg,
		"-f", "null",
		"-",
	)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return nil, fmt.Errorf("ffmpeg silencedetect failed: %w", err)
	}

	var intervals []SilenceInterval
	var currentStart float64 = -1

	lines := strings.Split(stderr.String(), "\n")
	for _, line := range lines {
		if sm := silenceStartRegex.FindStringSubmatch(line); len(sm) > 1 {
			if s, err := strconv.ParseFloat(sm[1], 64); err == nil {
				currentStart = s
			}
		} else if em := silenceEndRegex.FindStringSubmatch(line); len(em) > 1 {
			if endVal, err := strconv.ParseFloat(em[1], 64); err == nil {
				durVal := 0.0
				if len(em) > 2 && em[2] != "" {
					durVal, _ = strconv.ParseFloat(em[2], 64)
				}
				if durVal == 0 && currentStart >= 0 {
					durVal = endVal - currentStart
				}
				st := currentStart
				if st < 0 {
					st = endVal - durVal
				}
				intervals = append(intervals, SilenceInterval{
					Start:    st,
					End:      endVal,
					Duration: durVal,
				})
				currentStart = -1
			}
		}
	}

	return intervals, nil
}

// findOptimalSplitPoint searches for the best silence cut point near targetSec within searchWindowSec.
// If a silence is found, it returns the midpoint of the best silence interval and true.
// Otherwise, it returns targetSec and false.
func findOptimalSplitPoint(targetSec int, searchWindowSec int, silences []SilenceInterval) (int, bool) {
	minBound := float64(targetSec - searchWindowSec)
	maxBound := float64(targetSec + searchWindowSec)

	var bestSilence *SilenceInterval
	bestScore := -1.0

	for i := range silences {
		s := silences[i]
		mid := s.Start + s.Duration/2.0
		if mid >= minBound && mid <= maxBound {
			// Favor longer silence pauses and proximity to targetSec
			dist := math.Abs(mid - float64(targetSec))
			score := s.Duration / (1.0 + dist/60.0)
			if score > bestScore {
				bestScore = score
				bestSilence = &s
			}
		}
	}

	if bestSilence != nil {
		mid := int(math.Round(bestSilence.Start + bestSilence.Duration/2.0))
		return mid, true
	}

	return targetSec, false
}

// SplitAudioFile splits an audio file into chunks of chunkDurationSec using Silence Detection and Overlap.
// It returns the slice of AudioSegment and a cleanup function to remove temporary chunk files.
func SplitAudioFile(ctx context.Context, inputFilePath string, totalDurationSec int, chunkDurationSec int) ([]AudioSegment, func(), error) {
	if chunkDurationSec <= 0 {
		chunkDurationSec = AudioChunkDurationSec
	}

	ext := filepath.Ext(inputFilePath)
	if ext == "" {
		ext = ".mp3"
	}

	// 1. Pre-detect silences across the audio file (very fast, ~0.2s)
	silences, err := DetectSilenceIntervals(ctx, inputFilePath, SilenceMinDurationSec, SilenceNoiseFloorDB)
	if err != nil {
		log.Printf("[AudioChunker] Warning: silence detection failed (%v), falling back to fixed intervals", err)
		silences = nil
	} else {
		log.Printf("[AudioChunker] Detected %d silence pauses in %s", len(silences), filepath.Base(inputFilePath))
	}

	var segments []AudioSegment
	var tempFiles []string

	cleanup := func() {
		for _, f := range tempFiles {
			_ = os.Remove(f)
		}
	}

	currentStart := 0
	index := 0
	overlap := DefaultAudioOverlapSec

	for currentStart < totalDurationSec {
		targetEnd := currentStart + chunkDurationSec
		var cutEnd int
		var nextStart int

		if targetEnd >= totalDurationSec {
			// Final segment reaches total duration
			cutEnd = totalDurationSec
			nextStart = totalDurationSec
		} else {
			// Find optimal silence split point around targetEnd
			silenceCut, found := findOptimalSplitPoint(targetEnd, SilenceSearchWindowSec, silences)
			if found {
				log.Printf("[AudioChunker] Found silence split point for chunk %d at %ds (target: %ds)",
					index, silenceCut, targetEnd)
				// Split cleanly at silence point with small overlap
				cutEnd = silenceCut + overlap
				if cutEnd > totalDurationSec {
					cutEnd = totalDurationSec
				}
				nextStart = silenceCut
			} else {
				log.Printf("[AudioChunker] No silence pause found near %ds for chunk %d, applying fallback with %ds overlap",
					targetEnd, index, overlap)
				cutEnd = targetEnd + overlap
				if cutEnd > totalDurationSec {
					cutEnd = totalDurationSec
				}
				nextStart = targetEnd
			}
		}

		dur := cutEnd - currentStart
		if dur <= 0 {
			break
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
			"-ss", strconv.Itoa(currentStart),
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
				"-ss", strconv.Itoa(currentStart),
				"-t", strconv.Itoa(dur),
				"-i", inputFilePath,
				"-vn",
				"-acodec", "libmp3lame",
				"-ab", "128k",
				tmpPath,
			)
			if fbErr := fallbackCmd.Run(); fbErr != nil {
				cleanup()
				return nil, nil, fmt.Errorf("ffmpeg failed to slice audio chunk %d [%d-%d]: %w", index, currentStart, cutEnd, fbErr)
			}
		}

		segments = append(segments, AudioSegment{
			Index:       index,
			FilePath:    tmpPath,
			OffsetSec:   currentStart,
			DurationSec: dur,
		})

		currentStart = nextStart
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

// ReconcileOverlapText removes duplicate words at the boundary seam of two consecutive chunks.
func ReconcileOverlapText(prevText, nextText string) string {
	prevTrimmed := strings.TrimSpace(prevText)
	nextTrimmed := strings.TrimSpace(nextText)

	if prevTrimmed == "" {
		return nextTrimmed
	}
	if nextTrimmed == "" {
		return ""
	}

	// Check if nextText starts with a timestamp e.g. [10:00]
	leadingPrefix := ""
	textToExamine := nextTrimmed
	if loc := timestampRegex.FindStringIndex(nextTrimmed); loc != nil && loc[0] == 0 {
		leadingPrefix = nextTrimmed[:loc[1]]
		textToExamine = strings.TrimSpace(nextTrimmed[loc[1]:])
	}

	prevWords := strings.Fields(prevTrimmed)
	nextWords := strings.Fields(textToExamine)

	if len(prevWords) == 0 || len(nextWords) == 0 {
		return nextTrimmed
	}

	maxCheck := 20
	if len(prevWords) < maxCheck {
		maxCheck = len(prevWords)
	}
	if len(nextWords) < maxCheck {
		maxCheck = len(nextWords)
	}

	cleanWord := func(s string) string {
		s = strings.Trim(s, ".,!?;:\"'()[]{}<>-–—")
		return strings.ToLower(s)
	}

	bestOverlap := 0
	for k := maxCheck; k >= 2; k-- {
		match := true
		for j := 0; j < k; j++ {
			pw := cleanWord(prevWords[len(prevWords)-k+j])
			nw := cleanWord(nextWords[j])
			if pw == "" || nw == "" || pw != nw {
				match = false
				break
			}
		}
		if match {
			bestOverlap = k
			break
		}
	}

	if bestOverlap >= 2 {
		remainingWords := nextWords[bestOverlap:]
		if len(remainingWords) == 0 {
			return ""
		}
		res := strings.Join(remainingWords, " ")
		if leadingPrefix != "" {
			return leadingPrefix + " " + res
		}
		return res
	}

	return nextTrimmed
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
	var prevSegmentText string

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
			if prevSegmentText != "" {
				adjustedTranscript = ReconcileOverlapText(prevSegmentText, adjustedTranscript)
			}

			if combinedRaw.Len() > 0 && adjustedTranscript != "" {
				combinedRaw.WriteString("\n\n")
			}
			combinedRaw.WriteString(adjustedTranscript)
			prevSegmentText = adjustedTranscript

			if len(parsed.QAPairs) > 0 {
				combinedQAPairs = append(combinedQAPairs, parsed.QAPairs...)
			}
		} else {
			// Plain text transcript
			adjustedText := OffsetTimestampsInText(rawOutput, offset)
			if prevSegmentText != "" {
				adjustedText = ReconcileOverlapText(prevSegmentText, adjustedText)
			}

			if combinedRaw.Len() > 0 && strings.TrimSpace(adjustedText) != "" {
				combinedRaw.WriteString("\n\n")
			}
			combinedRaw.WriteString(strings.TrimSpace(adjustedText))
			prevSegmentText = adjustedText
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
