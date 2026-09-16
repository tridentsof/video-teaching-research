# Tasks: Teacher Interview Guide & Teaching Themes Architecture

- [x] Task 1: Tạo migration `000013_create_interview_base_and_refactor_analysis.up.sql` và seed 22 câu hỏi bán cấu trúc gốc
- [x] Task 2: Cập nhật Go models trong `backend/internal/model/models.go`
- [x] Task 3: Tạo `internal/repository/interview_base.go` và cập nhật `internal/repository/analysis.go`
- [x] Task 4: Tạo `internal/service/interview_base.go` cho nghiệp vụ CRUD câu hỏi gốc
- [x] Task 5: Cập nhật `internal/service/analysis.go` cho Flow A: Synthesize Core Questions (Step 7A) & Generate Follow-up Questions với RQ Tagging và Interaction Log (Step 7B)
- [x] Task 6: Tạo `internal/handler/interview.go` và đăng ký routes trong `internal/handler/router.go`
- [x] Task 7: Tạo standalone HTML preview `frontend/public/mockup-interview-guide.html` theo UI Mockup Gate
- [x] Task 8: Cập nhật types và API client trong `frontend/lib/api.ts`
- [x] Task 9: Nâng cấp `frontend/app/interview/page.tsx` (Tab CRUD Base Questions, Approval Banner cho Core Questions, Dynamic Questions với RQ Badges)
- [x] Task 10: Kiểm thử toàn bộ hệ thống (Unit tests, Build backend & frontend, E2E check)
