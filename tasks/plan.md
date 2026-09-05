# Implementation Plan: Teacher Quote & Qualitative Code Integration

## Overview
Bổ sung tính năng trích xuất và hiển thị lời thoại nguyên văn của giáo viên (Verbatim Quote) cùng mã định tính sư phạm 3–5 từ (Qualitative Code) vào từng sự kiện checklist trong báo cáo nghiên cứu giảng dạy.

## Architecture Decisions
- Thêm cột `quote` và `code` vào `raw_events` trong PostgreSQL.
- Mở rộng prompt multimodal Gemini để trích xuất trực tiếp `code` (3-5 từ) và `quote` (lời thoại nguyên văn).
- Mở rộng `Occurrence` struct & Report Generator để hiển thị bảng Markdown 6 cột chi tiết.
- Cập nhật Type và CSS MarkdownRenderer ở Frontend.

## Task List

### Phase 1: Database & AI Prompt
- [ ] Task 1: Tạo file migration `000004_add_quote_and_code_to_raw_events` (up & down)
- [ ] Task 2: Cập nhật `VideoEventExtractionPrompt` trong `backend/internal/service/prompt.go`
- [ ] Task 3: Cập nhật model `RawEvent`, `Occurrence` trong `backend/internal/model/models.go`

### Checkpoint: Foundation
- [ ] DB migration files ready, Go model definitions clean

### Phase 2: Backend Extraction, Repository & Report Pipeline
- [ ] Task 4: Cập nhật `backend/internal/service/extraction.go` để parse và lưu `code`, `quote`
- [ ] Task 5: Cập nhật `backend/internal/repository/raw_event.go` và `backend/internal/repository/mapping.go`
- [ ] Task 6: Cập nhật `backend/internal/service/report.go` để tổng hợp `Code`, `Quote` vào `Occurrences` và sinh bảng Markdown 6 cột

### Checkpoint: Backend Core
- [ ] Backend tests pass (`go test ./...`)

### Phase 3: Frontend Types, Mockup Data & UI
- [ ] Task 7: Cập nhật `frontend/lib/api.ts` types
- [ ] Task 8: Cập nhật fallback mock data trong `frontend/app/reports/[id]/page.tsx`
- [ ] Task 9: Tinh chỉnh CSS trong `frontend/components/MarkdownRenderer.tsx` & `globals.css` cho bảng báo cáo

### Checkpoint: Complete
- [ ] Frontend build succeeds (`npm run build`)
- [ ] End-to-end data flow verified
