# Overview
Tôi đang theo học chương trình thạc sỹ về ngôn ngữ Anh và tôi muốn xây dựng một hệ thống research, tôi cũng có kiến thức về lập trình, bạn có thể hỏi thêm tôi để cung cấp chính xác thông tin nếu chưa hiểu nhé, đừng assume bất kì thứ gì nếu chưa clear

# Brief requirement
Tôi muốn xây dựng một hệ thống:
Trích xuất toàn bộ các sự kiện (Event Extraction) từ video → Chuẩn hóa thành dữ liệu → Mapping với checklist → Xuất report → Phân tích cross-video, nhận diện recurring teaching strategies, sinh câu hỏi phỏng vấn giáo viên

# Full Requirement Analysis

## Business Goal
Xây dựng một hệ thống có khả năng tự động phân tích video ghi lại quá trình giảng dạy tiếng Anh cho trẻ em, trích xuất các sự kiện xảy ra trong lớp học, sau đó đối chiếu với một checklist đã định nghĩa trước để tạo báo cáo thống kê dưới dạng Markdown.

Mục tiêu của hệ thống là giảm tối đa việc quan sát và thống kê thủ công video phục vụ nghiên cứu phương pháp giảng dạy.

## Functional Requirements
### Phase 1 - Video Understanding
Sau khi người dùng upload video, hệ thống cần thực hiện bước đầu tiên là phân tích toàn bộ video.

Thay vì chỉ tìm các checklist, hệ thống cần cố gắng thu thập càng nhiều thông tin càng tốt từ video.

Ví dụ (chỉ là ví dụ, không phải danh sách cố định):

Visual Events

* Child raises hand
* Child stands up
* Teacher points to board
* Teacher walks around classroom
* Student looks confused
* Student writes
* Teacher writes
* Students clap
* Teacher smiles
* Teacher gestures
* Teacher approaches student

Audio Events

* Teacher asks question
* Teacher praises student
* Teacher gives instruction
* Teacher repeats instruction
* Student asks question
* Student answers
* Student says "I don't understand"
* Silence
* Group discussion

Context Events

* Student does not understand
* Student needs help
* Teacher corrects pronunciation
* Teacher encourages participation
* Teacher waits for answer

Lưu ý:

Đây chỉ là dữ liệu thô (Raw Events), chưa phải checklist.

### Phase 2 - Event Repository

Toàn bộ event được lưu lại theo cấu trúc chuẩn.

Ví dụ:

```json

{ 
    "video_id": "video-123", 
    "events": [
        { "timestamp": "00:10", "event": "teacher_points_to_board", "description": "Teacher points to board", "confidence": 0.98 }, 
        { "timestamp": "00:15", "event": "student_raises_hand", "description": "Student raises hand", "confidence": 0.95 }, 
        { "timestamp": "00:20", "event": "student_answers", "description": "Student answers", "confidence": 0.92 } 
    ]
}

```

Repository này sẽ là nguồn dữ liệu để thực hiện các bước phía sau.

### Phase 3 - Mapping with Checklist

Sau khi có toàn bộ Event Repository, hệ thống đọc Checklist và thực hiện semantic matching — mỗi raw event có thể match một hoặc nhiều checklist item.

Ví dụ: checklist item `Student doesn't understand` có thể được match bởi:
- `student_looks_confused`
- `student_says_i_dont_understand`
- `student_asks_for_help`

Điều này làm hệ thống linh hoạt — checklist có thể thay đổi mà không cần phân tích lại video, chỉ cần re-run mapping.

**Output — Stored (DB):**

```json
{
  "id": "map-8832",
  "raw_event_id": "evt-4521",
  "checklist_item_id": "B-003",
  "match_score": 0.93,
  "match_method": "semantic",
  "matched_by_model": "anthropic/claude-3.5-sonnet"
}
```

`match_method` có thể là `exact` (text khớp hoàn toàn), `semantic` (AI suy luận ngữ nghĩa), hoặc `contextual` (suy ra từ chuỗi sự kiện xung quanh).

**Displayed (UI):** Mapping audit view — xem mỗi checklist item được match bởi những event nào, score bao nhiêu, method gì. Dùng để verify độ chính xác của AI.

### Phase 4 - Statistics

Sau khi mapping xong, hệ thống tổng hợp thống kê per checklist item per video.

**Output — Stored (DB):**

```json
{
  "id": "rpt-item-221",
  "report_id": "rpt-045",
  "checklist_item_id": "B-003",
  "checklist_section": "B",
  "checklist_text": "Teacher provides wait time",
  "count": 9,
  "avg_confidence": 0.91,
  "avg_duration_sec": 5.2,
  "occurrences": [
    { "timestamp_sec": 271, "confidence": 0.95, "duration_sec": 6 },
    { "timestamp_sec": 433, "confidence": 0.88, "duration_sec": 5 }
  ]
}
```

Phase 4 là bước trung gian — không có file export riêng, dữ liệu được dùng trực tiếp để render Phase 5.


### Phase 5 - Markdown Report

Tổng hợp kết quả statistics thành report có thể đọc được. Mỗi video tạo ra một report riêng.

**Output — Stored (DB):** Bảng `reports` lưu cả markdown content lẫn metadata (video_id, teacher_id, checklist_id, generated_at).

**Exported (File):** File `.md` per video — có thể export thêm sang `.pdf` từ UI.

**Displayed (UI):** Render markdown trực tiếp trên UI, có nút Export.

**Format:**

```markdown
# Classroom Analysis Report
**Teacher:** T01 | **Video:** V01 | **Session date:** 2024-01-15
**Checklist version:** v1.0 | **Generated:** 2024-03-01

---

## Section B — Managing Turn-taking and Speaking Participation

### Teacher provides wait time
- **Count:** 9 | **Avg Confidence:** 0.91 | **Avg Duration:** 5.2s

| # | Timestamp | Confidence | Duration |
|---|-----------|------------|----------|
| 1 | 00:04:31  | 0.95       | 6s       |
| 2 | 00:07:13  | 0.88       | 5s       |
| 3 | 00:12:54  | 0.90       | 5s       |

### Teacher nominates students to speak
- **Count:** 14 | **Avg Confidence:** 0.94 | **Avg Duration:** 3.1s

| # | Timestamp | Confidence | Duration |
|---|-----------|------------|----------|
| 1 | 00:03:12  | 0.97       | 3s       |
| 2 | 00:05:21  | 0.92       | 3s       |

---

## Section D — Providing Scaffolding and Positive Reinforcement

### Teacher gives praise and encouragement
- **Count:** 18 | **Avg Confidence:** 0.96 | **Avg Duration:** 2.8s
...
```

### Phase 6 - Report Analysis

Phase phân tích tổng hợp sau khi toàn bộ 24 videos (12 giáo viên × 2 videos/giáo viên) đã hoàn thành Phase 1–5. Mục tiêu là trích xuất **recurring teaching strategies**, phân loại thành **themes**, và tạo ra **bộ câu hỏi phỏng vấn cá nhân hóa** cho từng giáo viên phục vụ nghiên cứu định tính.

**Trigger:** Thủ công — người dùng nhấn "Run Analysis" trên UI. Có thể re-run bất cứ lúc nào.

**Input sources** (hai nguồn song song):
- `report_items` (Phase 5): count, timestamps per checklist item per video — cho overview
- `raw_events` + `event_mappings` (Phase 2–3): context, confidence, trigger conditions — cho deep analysis

**Analysis Pipeline (7 steps):**

**Step 1 — Cross-video Aggregation**
Gom toàn bộ dữ liệu từ 24 videos, tổ chức theo giáo viên (T01–T12). Tính tần suất tương đối (frequency) và phân phối theo thời điểm (timestamp distribution) của từng strategy.

**Step 2 — Recurring Pattern Detection**
Xác định strategies mà giáo viên lặp đi lặp lại có tính hệ thống. AI tự xác định ngưỡng (threshold) dựa trên phân phối tổng thể của data — không hardcode. Phân tích ở ba cấp độ:
- **Intra-teacher:** strategy lặp trong cả 2 videos của cùng một giáo viên
- **Cross-teacher:** strategy phổ biến ở nhiều giáo viên khác nhau
- **Contextual co-occurrence:** strategy X thường xuất hiện kèm với event Y

**Step 3 — Categorize**
AI cluster các recurring strategies thành các categories hành vi. Bottom-up clustering từ data thực tế — không dùng taxonomy cố định. Mỗi category có: tên, danh sách strategies, ví dụ minh họa.

**Step 4 — Theme Identification**
AI gom categories thành themes lớn hơn theo phương pháp grounded theory (data-driven). **Bắt buộc có reasoning trace** — AI phải giải thích tại sao một strategy/category thuộc về theme này, có cite evidence (timestamp, count, trigger condition).

**Step 5 — Human Review** *(Optional)*
UI hiển thị themes → categories → strategies dạng cây collapse/expand. Người dùng có thể: reassign strategy/category sang theme khác, đổi tên, merge hai themes, flag để xem lại. Không bắt buộc trước khi qua Step 6.

**Step 6 — Final Theme**
Lock kết quả themes (status: `confirmed`). Có thể re-open để chỉnh sửa và chạy lại Step 7.

**Step 7 — Analyze & Generate Interview Questions**
Với mỗi giáo viên (T01–T12), tạo:
- **Per-teacher analysis:** strategies nổi bật, theme thuộc về, bối cảnh sử dụng (contextual triggers), timing distribution (warm-up / mid-lesson / closing), so sánh với trung bình nhóm.
- **Interview question set** gồm hai loại:
  - *Core Questions* (tác giả define sẵn, áp dụng cho tất cả): *"Why do you use [strategy X]?"*, *"How do you decide when to use it?"*, *"What challenges do you face?"*
  - *Dynamic Questions* (AI sinh ra, cá nhân hóa): dựa trên patterns đặc trưng của từng giáo viên, AI phải cite evidence (timestamp, count) trong câu hỏi để có chiều sâu.

**Output — Stored (DB):** 6 bảng analysis (analysis_runs, patterns, categories, themes, teacher_analyses, interview_questions).

**Exported (File):** Hai file per teacher, export từ UI:

*File 1 — `T01_analysis.md`:*
```markdown
# Teaching Strategy Analysis — T01
**Videos analyzed:** V01, V02 | **Analysis run:** 2024-03-01

## Recurring Strategies

### Strategy: Wait time after question
- **Occurrences:** 21 lần (V01: 11, V02: 10)
- **Theme:** Scaffolding Through Patience
- **Category:** Pacing strategies
- **Context:** Xuất hiện sau mỗi lần teacher đặt câu hỏi mở,
  trung bình 4.5s silence trước khi gọi học sinh
- **Frequency vs group avg:** +40% so với trung bình 12 giáo viên
- **Timing distribution:** 80% trong mid-lesson (15–40 phút)

| Video | Count | Avg wait time |
|-------|-------|---------------|
| V01   | 11    | 4.2s          |
| V02   | 10    | 4.8s          |
```

*File 2 — `T01_interview_questions.md`:*
```markdown
# Interview Questions — T01
**Prepared:** 2024-03-01

## Core Questions (áp dụng cho tất cả giáo viên)
1. Why do you use [strategy X]?
2. How do you decide when to use this strategy?
3. What challenges do you face when applying it?

## Dynamic Questions (sinh từ data của T01)
1. Trong video V02 (00:23:15), bạn chờ 7 giây sau khi đặt câu hỏi
   trước khi gọi học sinh — đây có phải chiến thuật chủ động không?
2. Strategy "wait time" của bạn xuất hiện nhiều hơn 40% so với
   trung bình nhóm. Bạn có nhận thức được điều này không?
```

**Displayed (UI):**

| View | Format | Mục đích |
|------|--------|----------|
| Theme tree | Interactive (collapse/expand, reassign) | Human review |
| Per-teacher analysis | Rendered markdown + export | Đọc trước khi phỏng vấn |
| Interview question set | Markdown / PDF export | Mang đi phỏng vấn |
| Cross-teacher comparison | Table + Chart | So sánh pattern giữa các giáo viên |

## Data Flow
```text
Video
      │
      ▼
Video Understanding (Phase 1)
      │
      ▼
Raw Event Extraction
      │
      ▼
Event Repository (Phase 2)         ◄──────────────────────────┐
      │                                                         │
      ▼                                                         │
Checklist Matching (Phase 3)                                    │ deep analysis input
      │                                                         │
      ▼                                                         │
Statistics (Phase 4)                                           │
      │                                                         │
      ▼                                                         │
Markdown Report (Phase 5)          ──── overview input ────────┤
                                                                │
                                                                ▼
                                              Report Analysis (Phase 6)
                                                [manual trigger]
                                                                │
                                              Cross-video Aggregation
                                                                │
                                              Recurring Pattern Detection
                                                                │
                                              Categorize → Theme Identification
                                                                │
                                              Human Review (optional)
                                                                │
                                              Final Theme → Analyze
                                                                │
                                   Per-teacher Analysis + Interview Questions
                                         (UI Dashboard / Export)
```
Điểm mạnh của thiết kế này là checklist có thể thay đổi mà không cần phân tích lại video, chỉ cần chạy lại bước mapping và thống kê nếu Event Repository đã đủ thông tin. Phase 6 (Report Analysis) cũng có thể re-run độc lập mà không cần xử lý lại video.

## Additional context:
1. DOD Analysis
Timestamp tương đối
Ví dụ:
±2 giây
±3 giây

Đây là tiêu chuẩn thường thấy trong các bài toán Video Understanding.
Khuyến nghị sử dụng làm Definition of Done.
* Detect đúng event.
* Count đúng hoặc gần đúng.
* Timestamp tương đối (sai số nhỏ và có thể dùng để review).
* Có confidence score cho từng event.

2. Checklist đầy đủ
## Observation Checklist

### Section A. Establishing Online Rules and Routines
- [ ] Teacher explains classroom rules
- [ ] Teacher reminds students of classroom expectations
- [ ] Teacher establishes lesson routines
- [ ] Teacher provides clear task instructions
- [ ] Teacher manages transitions between activities

### Section B. Managing Turn-taking and Speaking Participation
- [ ] Teacher nominates students to speak
- [ ] Teacher encourages volunteers
- [ ] Teacher provides wait time
- [ ] Teacher encourages quieter learners
- [ ] Teacher balances speaking opportunities
- [ ] Teacher organises pair/group speaking tasks

### Section C. Sustaining Learner Attention and Engagement
- [ ] Teacher monitors learner attention
- [ ] Teacher checks understanding
- [ ] Teacher asks follow-up questions
- [ ] Teacher redirects distracted learners
- [ ] Teacher maintains lesson pace
- [ ] Teacher motivates learners to participate

### Section D. Providing Scaffolding and Positive Reinforcement
- [ ] Teacher models target language
- [ ] Teacher provides sentence starters
- [ ] Teacher uses prompts
- [ ] Teacher gives praise and encouragement
- [ ] Teacher provides corrective feedback
- [ ] Teacher adjusts support based on learners' responses

### Section E. Using Digital Tools to Support Learning and Interaction
- [ ] Teacher uses the chat box
- [ ] Teacher uses reaction icons
- [ ] Teacher uses breakout rooms
- [ ] Teacher shares screen
- [ ] Teacher uses a digital whiteboard
- [ ] Teacher uses polls or annotation tools

3. Có cần lưu toàn bộ Event Repository không? => Có hãy lưu lại
4. Video được ghi như thế nào? => Zoom meeting
5. Chất lượng video => 720p, không rung lắc, cam cố định một chỗ, video được trích xuất từ zoom recording, nội dung được record sẽ bao gồm: cam của giáo viên, cam của nhiều học sinh, và màn hình share của giáo viên
5. Audio => Có âm thanh thu từ micro giáo viên và học sinh, rất ít tạp âm
6. Ngôn ngữ sử dụng => Tiếng Anh xen tiếng Việt
7. Thời lượng video => dưới 60 phút
8. Số lượng video => 25 videos
9. Có cần hỗ trợ review thủ công không? => Có, nhưng không block pipeline. Sau khi Event Repository được tạo xong, hệ thống hiển thị notification/badge trên UI để nhắc nhở người dùng có thể chủ động vào review events trước khi chạy mapping. MVP không có email, chỉ quan sát trên UI.
10. Tiêu chí đánh giá chất lượng hệ thống (Acceptance Criteria) => Recall cao + Precision cao

---

# Confirmed Decisions (từ buổi clarify)

## Interface & UX
- **Giao diện:** Web UI dùng Next.js (App Router) với backend Go (Golang) tách biệt hoàn toàn
- **Đa ngôn ngữ (i18n):** Hỗ trợ 2 ngôn ngữ **Tiếng Anh / Tiếng Việt (EN/VI)** trên giao diện (UI only, có switch chuyển đổi ngôn ngữ)
- **UI Design Workflow (Mockup-First):** Bắt buộc áp dụng cơ chế Mockup-first. Trước khi triển khai code giao diện Next.js, agent phải tạo các bản mockup xem trước (2–3 biến thể dạng static HTML prototype hoặc ảnh PNG) cho các màn hình chính (Upload/Pipeline progress, Timeline Review, Theme Tree, Cross-teacher Compare, Interview Generator) để tác giả duyệt layout, typography và trải nghiệm tương tác trước khi implement
- **Video input:** Upload trực tiếp từ máy tính (file local), không hỗ trợ URL/link
- **Manual review flow (Phase 1–5):** Sau khi Event Repository xong → hiển thị notification/badge trên UI → người dùng tự chủ động vào review. Không block pipeline, không có email ở MVP
- **Report Analysis trigger (Phase 6):** Người dùng chủ động vào UI và nhấn "Run Analysis". Có thể re-run bất cứ lúc nào. UI hiển thị theme tree (collapse/expand) và cho phép reassign, rename, merge, flag themes trước khi confirm
- **Auth:** Username/password (JWT), extensible để tích hợp OAuth sau này. Tạm thời single-user
- **Scope:** Chỉ mình tác giả sử dụng, nhưng hệ thống có login để mở rộng sau

## Storage
- **Video storage:** Azure Blob Storage, xác thực bằng Account Key (credentials sẽ cung cấp sau)
- **Azure container name:** `videos`
- **Database:** PostgreSQL qua Supabase (chỉ dùng DB, không dùng Supabase Auth)
- **Event Repository:** Lưu toàn bộ vào PostgreSQL, không xóa sau khi process

## Checklist
- Checklist trong file này là **bản final** về nội dung
- Hệ thống cần hỗ trợ: thêm item, xóa item, chỉnh sửa text, reorder
- Thiết kế để có thể có nhiều phiên bản checklist (dù hiện tại chỉ dùng 1)

## Deployment
- **MVP:** Chạy local (localhost). Deployment lên cloud để sau
- **Backend:** Go server (Gin/Fiber), chạy local port 8000
- **Frontend:** Next.js dev server, chạy local port 3000

---

# Technical Architecture

## Tech Stack

| Layer | Technology | Ghi chú |
|-------|------------|----------|
| Frontend | Next.js (App Router), TypeScript | Web UI |
| Backend | Go (Golang 1.22+) | REST API, tách biệt với frontend |
| Database | PostgreSQL via Supabase | Lưu events, checklists, reports, themes |
| Video Storage | Azure Blob Storage | Account Key auth |
| Video Processing | FFmpeg | Chunking video |
| AI — Video Understanding | Google Gemini API (trực tiếp) | Gemini 2.0 Flash, native video support |
| AI — Mapping/Reasoning | OpenRouter | Claude 3.5 Sonnet cho semantic matching |
| AI — Classification | OpenRouter | Gemini 2.0 Flash via OpenRouter |
| AI — Pattern Clustering & Theme | OpenRouter | Claude 3.5 Sonnet, grounded theory reasoning |
| AI — Interview Question Generation | OpenRouter | Claude 3.5 Sonnet, evidence-cited output |

## AI Provider Strategy

**Hybrid provider approach** (đã xác nhận):

- **Google Gemini API trực tiếp** cho video understanding vì OpenRouter không hỗ trợ native video file upload lên Gemini (Gemini cần Google File API riêng). Video được upload qua `google-genai` SDK.
- **OpenRouter** cho tất cả các task khác (mapping, classification, future reasoning). Dùng chung 1 API key, dễ swap model.
- Code được thiết kế với **AI Adapter Layer** — có thể swap model/provider chỉ bằng cách đổi config, không cần sửa business logic.

## AI Model Assignments

| Task | Model | Provider | Lý do |
|------|-------|----------|---------|
| Video Understanding (visual + audio) | `gemini-2.0-flash` | Gemini Direct | Native video, xử lý audio+visual cùng lúc |
| Checklist Mapping / Semantic Matching | `anthropic/claude-3.5-sonnet` | OpenRouter | Reasoning mạnh, semantic matching chính xác |
| Event Classification | `google/gemini-2.0-flash` | OpenRouter | Nhanh, rẻ |
| Whisper (fallback audio transcription) | `openai/whisper-1` | OpenRouter | Nếu cần transcript riêng |
| Pattern Clustering & Categorization (Phase 6) | `anthropic/claude-3.5-sonnet` | OpenRouter | Reasoning + bottom-up clustering từ data |
| Theme Identification + Reasoning Trace (Phase 6) | `anthropic/claude-3.5-sonnet` | OpenRouter | Grounded theory, phải giải thích evidence |
| Interview Question Generation (Phase 6) | `anthropic/claude-3.5-sonnet` | OpenRouter | Cá nhân hóa per-teacher, cite timestamp/count |

## Video Chunking Strategy

Video Zoom ≤60 phút được xử lý theo pipeline sau:

```
Video (Azure Blob URL)
  → FFmpeg: chia chunk 10 phút, overlap 30 giây giữa các chunk
  → Upload từng chunk lên Azure Blob
  → Xử lý parallel (tối đa 3 chunk cùng lúc)
  → Mỗi chunk → Gemini API → Raw Events JSON
  → Merge + Deduplicate events ở ranh giới chunk (±30s window)
  → Lưu vào Event Repository (PostgreSQL)
```

**Lý do chunk:** Video dài → hallucination cao hơn, latency cao hơn. Chunk 10 phút là sweet spot giữa context đủ và độ chính xác cao.

**Overlap 30 giây:** Đảm bảo event xảy ra ở ranh giới 2 chunk không bị bỏ sót.

## Database Schema (tóm tắt)

```
-- Phase 1–5 (pipeline cơ bản)
users
  id, username, password_hash, created_at

videos
  id, teacher_id, title, blob_url, duration_sec,
  status, uploaded_at

video_chunks
  id, video_id, chunk_index,
  chunk_start_sec, chunk_end_sec,
  blob_path, status,
  gemini_raw_output,  -- JSON thô từ Gemini, lưu để re-run merge mà không gọi lại API
  processed_at

raw_events
  id, video_id, teacher_id, chunk_id,
  timestamp_sec, event_type (visual|audio|context),
  event_key, description,
  confidence, duration_sec,
  is_duplicate_of,    -- null nếu là event gốc, trỏ đến id nếu bị deduplicate
  created_at

checklists
  id, name, version, created_at

checklist_items
  id, checklist_id, section (A|B|C|D|E), text, sort_order

event_mappings
  id, raw_event_id, checklist_item_id,
  match_score, match_method (exact|semantic|contextual),
  matched_by_model, created_at

reports
  id, video_id, teacher_id,
  checklist_id, checklist_version,
  markdown_content, generated_at

report_items
  id, report_id, checklist_item_id,
  checklist_section, checklist_text,
  count, avg_confidence, avg_duration_sec,
  occurrences        -- JSON[]: [{timestamp_sec, confidence, duration_sec}]

pipeline_jobs
  id, video_id, step, status, started_at, finished_at, error_msg

-- Phase 6 (Report Analysis)
analysis_runs
  id, triggered_at, status, config

patterns
  id, analysis_run_id, checklist_item_id,
  frequency_score, threshold_method,
  intra_teacher_count, cross_teacher_count

categories
  id, analysis_run_id, name, description, pattern_ids

themes
  id, analysis_run_id, name, description,
  reasoning_trace, category_ids,
  status (draft|confirmed)

teacher_analyses
  id, analysis_run_id, teacher_id,
  theme_ids, context_summary, markdown_content

interview_questions
  id, teacher_analysis_id, teacher_id,
  type (core|dynamic), question_text, evidence_ref
```

Mọi bước pipeline đều persist kết quả vào DB — không có bước nào lưu tạm trong memory. Schema Phase 6 non-breaking — thêm bảng mới, không sửa bảng cũ.

## Pipeline States

**Phase 1–5 (per video):**
```
upload → chunking → event_extraction → event_merge → [review_pending] → mapping → statistics → report_generation
```

`review_pending` là state tùy chọn — hệ thống hiển thị notification, người dùng có thể vào review hoặc bỏ qua.

**Phase 6 (cross-video, manual trigger):**
```
[manual: run_analysis] → aggregation → pattern_detection → categorize → theme_identification → [theme_review] → theme_confirmed → analyze → interview_generation → done
```

`theme_review` là state tùy chọn — người dùng có thể reassign/rename/merge themes trên UI trước khi confirm.
