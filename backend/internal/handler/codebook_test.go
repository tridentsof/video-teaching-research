package handler

import (
	"sort"
	"testing"
	"time"

	"github.com/video-teaching-research/backend/internal/model"
)

func TestNaturalCompare(t *testing.T) {
	tests := []struct {
		s1       string
		s2       string
		expected int // -1 for s1 < s2, 0 for equal, 1 for s1 > s2
	}{
		{"T01", "T02", -1},
		{"T02", "T01", 1},
		{"T01", "T01", 0},
		{"T01", "T10", -1},
		{"T2", "T10", -1},
		{"T02", "T10", -1},
		{"T9", "T10", -1},
		{"T09", "T10", -1},
		{"T10", "T11", -1},
		{"Teacher 1", "Teacher 2", -1},
		{"Teacher 2", "Teacher 10", -1},
		{"Cô Lan", "Thầy Minh", -1},
		{"", "T01", -1},
		{"T01", "", 1},
		{"", "", 0},
	}

	for _, tc := range tests {
		got := naturalCompare(tc.s1, tc.s2)
		// normalize to -1, 0, 1
		normGot := 0
		if got < 0 {
			normGot = -1
		} else if got > 0 {
			normGot = 1
		}
		if normGot != tc.expected {
			t.Errorf("naturalCompare(%q, %q) = %d, expected %d", tc.s1, tc.s2, normGot, tc.expected)
		}
	}
}

func TestTeacherSortOrder(t *testing.T) {
	now := time.Now()
	videos := []model.Video{
		{TeacherID: "T10", Title: "Lesson 10", UploadedAt: now},
		{TeacherID: "T02", Title: "Lesson 2", UploadedAt: now.Add(time.Hour)},
		{TeacherID: "T01", Title: "Lesson 1 Part B", UploadedAt: now.Add(2 * time.Hour)},
		{TeacherID: "T01", Title: "Lesson 1 Part A", UploadedAt: now},
		{TeacherID: "T03", Title: "Lesson 3", UploadedAt: now},
	}

	sort.Slice(videos, func(i, j int) bool {
		cmp := naturalCompare(videos[i].TeacherID, videos[j].TeacherID)
		if cmp != 0 {
			return cmp < 0
		}
		if !videos[i].UploadedAt.Equal(videos[j].UploadedAt) {
			return videos[i].UploadedAt.Before(videos[j].UploadedAt)
		}
		return naturalCompare(videos[i].Title, videos[j].Title) < 0
	})

	expectedTeachers := []string{"T01", "T01", "T02", "T03", "T10"}
	for i, v := range videos {
		if v.TeacherID != expectedTeachers[i] {
			t.Errorf("index %d: expected teacher %s, got %s", i, expectedTeachers[i], v.TeacherID)
		}
	}

	// For the two T01 entries, Part A was uploaded earlier so it should be first
	if videos[0].Title != "Lesson 1 Part A" {
		t.Errorf("expected Lesson 1 Part A first, got %s", videos[0].Title)
	}
}
