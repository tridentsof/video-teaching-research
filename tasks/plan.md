# Implementation Plan: Video Teaching Research System

## Overview

Build a full-stack system that automates classroom video analysis for a master's thesis on English teaching methods. The system processes 25 Zoom-recorded videos through a 6-phase pipeline: Video Understanding → Event Repository → Checklist Mapping → Statistics → Markdown Report → Cross-video Analysis & Interview Generation. **Backend: Go (Gin), Frontend: Next.js (App Router), DB: PostgreSQL via Supabase, Video Storage: Azure Blob, AI: Gemini Direct + OpenRouter.**

## Architecture Decisions

- **Go web framework:** Gin (widely adopted, well-documented, good middleware ecosystem)
- **Database migrations:** `golang-migrate/migrate` for versioned SQL migrations
- **Azure Blob SDK:** `azblob` v1 (official Go SDK)
- **AI Adapter Layer:** Interface-based abstraction — each AI provider implements a common interface, swappable via config
- **FFmpeg:** Invoked as subprocess via `os/exec`, not CGo binding (simpler, reliable)
- **Frontend state:** React Query (TanStack Query) for server state, React context for UI state
- **i18n:** `next-intl` for EN/VI support
- **Markdown rendering:** `react-markdown` + `remark-gfm` in frontend
- **Export:** PDF generation from markdown via browser print API
- **Auth:** JWT with `golang-jwt/jwt` on backend, httpOnly cookie on frontend

## Task List

### Phase B: Backend Core (Phases 1–5)

- [ ] Task 1: Go Project Scaffold & Config [S]
- [ ] Task 2: Database Schema & Migrations [M]
- [ ] Task 3: Auth — Registration, Login, JWT Middleware [S]
- [ ] Task 4: Checklist CRUD API [S]
- [ ] Task 5: Video Upload & Azure Blob Storage [M]
- [ ] Task 6: FFmpeg Video Chunking Service [M]
- [ ] Task 7: AI Adapter Layer — Gemini Direct & OpenRouter [M]
- [ ] Task 8: Phase 1 — Video Understanding (Event Extraction) [M]
- [ ] Task 9: Event Deduplication & Merge [S]
- [ ] Task 10: Phase 3 — Checklist Mapping (Semantic Matching) [M]
- [ ] Task 11: Phase 4 & 5 — Statistics & Markdown Report Generation [M]
- [ ] Task 12: Pipeline Orchestrator [M]

### Checkpoint: Backend Core
- [ ] All Go code compiles
- [ ] Migrations run cleanly
- [ ] Auth flow works
- [ ] Full pipeline: upload → chunk → extract → dedup → map → stats → report
- [ ] Review with user

### Phase C: Phase 6 Engine

- [ ] Task 13: Cross-video Aggregation [S]
- [ ] Task 14: Pattern Detection & Categorization [M]
- [ ] Task 15: Theme Identification [S]
- [ ] Task 16: Theme Management API [S]
- [ ] Task 17: Per-teacher Analysis & Interview Question Generation [M]

### Checkpoint: Phase 6 Engine
- [ ] Full Phase 6 pipeline works
- [ ] Theme management API supports review workflow
- [ ] Per-teacher exports generate correct markdown
- [ ] Review with user

### Phase D1: UI Mockup Gate

- [ ] Task 18: UI Mockup Design — Core Screens [M]
- [ ] Task 19: UI Mockup Design — Analysis Screens [M]

### Phase D2: Frontend Web UI

- [ ] Task 20: Next.js Project Scaffold & Design System [M]
- [ ] Task 21: Video List & Upload Page [M]
- [ ] Task 22: Pipeline Progress & Event Timeline Review [M]
- [ ] Task 23: Report View & Export [S]
- [ ] Task 24: Checklist Management Page [S]
- [ ] Task 25: Analysis Dashboard — Theme Tree & Management [M]
- [ ] Task 26: Cross-teacher Comparison & Interview Questions View [M]

### Checkpoint: Frontend Complete
- [ ] All pages render correctly
- [ ] Full user flow works
- [ ] i18n and export work
- [ ] Review with user

### Phase E: Integration & Acceptance

- [ ] Task 27: End-to-End Integration Test [M]
- [ ] Task 28: Documentation & Operational Guide [S]

### Checkpoint: Project Complete
- [ ] All 28 tasks completed
- [ ] System ready for 25 real videos
- [ ] Final review with user

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gemini API event extraction accuracy | High | Test early (Task 8), iterate prompts, Whisper fallback for audio |
| Video upload to Gemini fails for large chunks | High | 10-min chunks within limits, retry logic, test early |
| OpenRouter rate limits | Medium | Batch events (10/call), backoff, monitor usage |
| Semantic matching quality | Medium | Contextual matching (±2 events), manual review, track scores |
| FFmpeg edge cases (Zoom codecs) | Medium | Standardize codec, test with real recordings |
| Theme clustering quality | Medium | Reasoning trace required, human review, allow re-run |

## Open Questions

- Q1: Supabase project ready? Connection string needed for migrations.
- Q2: Azure Blob credentials ready? Can scaffold with local storage fallback.
- Q3: Gemini + OpenRouter API keys available for integration testing?
- Q4: Go framework preference — Gin (default) or Fiber?
- Q5: Confirm monorepo layout: `backend/` + `frontend/`
