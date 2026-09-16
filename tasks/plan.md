# Implementation Plan: Teacher Interview Guide & Teaching Themes Architecture

## Overview
Nâng cấp toàn diện tính năng Teacher Interview Guide & Teaching Themes:
1. Seed & CRUD 22 câu hỏi bán cấu trúc gốc phân theo RQ1-RQ3.
2. Quy trình Cách A: AI đề xuất Core Questions từ 22 câu + Themes của 24 video cho người dùng review & approve.
3. Sinh Participant-specific Follow-up Questions dựa trên Rich Pedagogical Interaction Log (raw_events có timestamp, quote, context) gắn nhãn RQ1, RQ2, RQ3.

## Architecture Decisions
- Migration 000013: Bảng `interview_base_questions`, mở rộng `interview_questions` (`rq_category`), mở rộng `analysis_runs` (`core_questions`, `core_questions_status`).
- Service `InterviewBaseService` & `AnalysisService`: Tách Step 7 thành Step 7A (Synthesize Core Questions) và Step 7B (Generate Teacher Follow-ups with RQ tagging).
- Frontend: Tab CRUD 22 câu hỏi gốc trong Interview Studio + Approval Banner cho Core Questions + Cards hiển thị Follow-up questions có RQ badges & evidence quotes.

## Task List

### Phase 1: Database & Seed Data
- [ ] Task 1: Tạo migration `000013_create_interview_base_and_refactor_analysis.up.sql` và seed 22 câu hỏi.
- [ ] Task 2: Cập nhật Go models trong `backend/internal/model/models.go`.

### Checkpoint: Foundation
- [ ] Migration apply thành công, DB có bảng `interview_base_questions` với 22 câu hỏi.

### Phase 2: Backend Repositories, Services & Endpoints
- [ ] Task 3: Tạo `internal/repository/interview_base.go` và cập nhật `internal/repository/analysis.go`.
- [ ] Task 4: Tạo `internal/service/interview_base.go` cho CRUD câu hỏi gốc.
- [ ] Task 5: Cập nhật `internal/service/analysis.go` cho Flow A: Synthesize Core Questions (Step 7A) & Generate Follow-up Questions với RQ Tagging và Interaction Log (Step 7B).
- [ ] Task 6: Tạo `internal/handler/interview.go` và đăng ký routes trong `internal/handler/router.go`.

### Checkpoint: Backend Core
- [ ] Backend tests pass (`go test ./...`) và build sạch (`go build ./...`).

### Phase 3: Frontend UI Mockup & Integration
- [ ] Task 7: Tạo standalone HTML preview `frontend/public/mockup-interview-guide.html`.
- [ ] Task 8: Cập nhật types và API client trong `frontend/lib/api.ts`.
- [ ] Task 9: Nâng cấp `frontend/app/interview/page.tsx` hỗ trợ Tab CRUD Base Questions, Core Questions Review & Approval Banner, và Follow-up Questions có RQ badges.

### Checkpoint: Complete
- [ ] Frontend build succeeds (`npm run build`).
- [ ] Flow kiểm tra hoàn chỉnh end-to-end.
