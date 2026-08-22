# Video Teaching Research — Task List

## Phase B: Backend Core (Phases 1–5)

- [x] **Task 1:** Go Project Scaffold & Config [S]
  - Init Go module, project structure, config loader, health endpoint
- [x] **Task 2:** Database Schema & Migrations [M]
  - All 16 tables, golang-migrate, seed default checklist
- [x] **Task 3:** Auth — Registration, Login, JWT Middleware [S]
  - POST /auth/register, POST /auth/login, JWT middleware
- [x] **Task 4:** Checklist CRUD API [S]
  - CRUD endpoints for checklists + items, versioning, reorder
- [/] **Task 5:** Video Upload & Azure Blob Storage [M]
  - Multipart upload, stream to Azure Blob, video record in DB
- [x] **Task 6:** FFmpeg Video Chunking Service [M]
  - 10-min chunks, 30s overlap, upload chunks to Azure
- [x] **Task 7:** AI Adapter Layer — Gemini Direct & OpenRouter [M]
  - Interface abstraction, Gemini video upload, OpenRouter text completion
- [x] **Task 8:** Phase 1 — Event Extraction [M]
  - Process chunks via Gemini, parallel (max 3), save raw events
- [x] **Task 9:** Event Deduplication & Merge [S]
  - Merge overlapping events, ±30s window, ±5s tolerance
- [x] **Task 10:** Phase 3 — Checklist Mapping [M]
  - Semantic matching via Claude 3.5, exact/semantic/contextual methods
- [x] **Task 11:** Phase 4 & 5 — Statistics & Report [M]
  - Aggregate stats, generate markdown report per video
- [x] **Task 12:** Pipeline Orchestrator [M]
  - Async pipeline, status tracking, re-run capability

### ✅ Checkpoint: Backend Core
- [x] `go build ./...` succeeds
- [x] Migrations run cleanly
- [x] Full pipeline: upload → chunk → extract → dedup → map → stats → report
- [x] User review

---

## Phase C: Phase 6 Engine (Report Analysis)

- [x] **Task 13:** Cross-video Aggregation [S]
  - Aggregate per-teacher across all videos
- [x] **Task 14:** Pattern Detection & Categorization [M]
  - Recurring patterns (3 levels), AI-driven threshold, bottom-up clustering
- [x] **Task 15:** Theme Identification [S]
  - Grounded theory themes, reasoning trace with evidence
- [x] **Task 16:** Theme Management API [S]
  - List/rename/merge/confirm/reassign themes
- [x] **Task 17:** Per-teacher Analysis & Interview Questions [M]
  - Per-teacher markdown, core + dynamic questions with evidence

### ✅ Checkpoint: Phase 6 Engine
- [x] Full analysis pipeline works
- [x] Theme CRUD + review workflow
- [x] Per-teacher exports correct
- [x] User review

---

## Phase D1: UI Mockup Gate

- [x] **Task 18:** UI Mockup — Core Screens [M]
  - Dashboard, Upload, Pipeline Progress, Timeline Review, Report View
- [x] **Task 19:** UI Mockup — Analysis Screens [M]
  - Theme Tree, Cross-teacher Comparison, Interview Questions

---

## Phase D2: Frontend Web UI (Next.js)

- [x] **Task 20:** Next.js Scaffold & Design System [M]
  - App Router, TypeScript, design tokens, i18n, auth, API client
- [x] **Task 21:** Video List & Upload Page [M]
  - Video table/cards, drag-drop upload, progress bar
- [x] **Task 22:** Pipeline Progress & Event Timeline [M]
  - Multi-phase stepper, scrollable event list, category filters
- [x] **Task 23:** Report View & Export [S]
  - Markdown renderer, download .md, print/export PDF
- [x] **Task 24:** Checklist Management Page [S]
  - Editable items (Sections A–E), reorder, add/remove
- [x] **Task 25:** Analysis Dashboard — Theme Tree [M]
  - Grounded theory tree, reasoning traces, merge/confirm
- [x] **Task 26:** Cross-teacher Comparison & Interview Questions [M]
  - Comparison table/heatmap, core + dynamic question generator

### ✅ Checkpoint: Frontend Web UI
- [x] All 7 pages render and route cleanly
- [x] API proxy to backend
- [x] Bilingual EN/VI toggle
- [x] User review

---

## Phase E: Integration & Acceptance

- [x] **Task 27:** End-to-End Integration Test [M]
  - Test full lifecycle: upload → pipeline → analysis → interview export
- [x] **Task 28:** Documentation & Operational Guide [S]
  - README, setup guide, operations runbook

### ✅ Checkpoint: Project Complete
- [x] All 28 tasks complete
- [x] Backend tests pass (100%)
- [x] Frontend builds cleanly
- [x] Full 6-phase pipeline functional
- [x] User review & sign-off
