# Tasks: Comprehensive English-Vietnamese Bilingual (EN/VI) Refactor

- [x] Task 1: Nâng cấp `frontend/lib/i18n.tsx` (sửa 29 key sao chép tiếng Anh, bổ sung toàn bộ key cho Interview Studio, Stepper, Notifications, Themes, v.v.)
- [x] Task 2: Chuẩn hóa song ngữ cho `frontend/app/interview/page.tsx` (thay 100% chữ cứng bằng `t(...)`, tab, modal, banner Flow A, toast)
- [x] Task 3: Chuẩn hóa song ngữ cho `frontend/app/videos/[id]/page.tsx` (status mappings, Smart Resume card, rerun modal/button, countdown)
- [x] Task 4: Chuẩn hóa song ngữ cho `frontend/app/settings/page.tsx` (Mock tin nhắn Telegram chuyển đổi EN/VI, model selector)
- [x] Task 5: Chuẩn hóa song ngữ cho các Components dùng chung (`Sidebar.tsx`, `PipelineStepper.tsx`, `PipelineNotificationCenter.tsx`, `ThemeTree.tsx`, `EventTimeline.tsx`)
- [x] Task 6: Chuẩn hóa song ngữ cho các trang còn lại (`reports/[id]/page.tsx`, `checklists/page.tsx`, `upload/page.tsx`, `login/page.tsx`, `codebook/page.tsx`, `themes/page.tsx`)
- [x] Task 7: Hỗ trợ song ngữ cho công cụ xuất file (`frontend/lib/wordExport.ts` & `frontend/lib/activityLog.ts`)
- [x] Task 8: Định dạng thông báo Telegram song ngữ trong `backend/internal/service/telegram.go` & `backend/internal/service/telegram_bot.go`
- [x] Task 9: Kiểm thử toàn bộ hệ thống (Build frontend 14/14 routes, test backend `go test ./...` 100% pass)
