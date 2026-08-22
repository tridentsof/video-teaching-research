# Classroom Video Teaching Research Platform 🎓📹

An AI-assisted multimodal research platform for analyzing online English classroom interaction videos (Zoom recordings) for young learners, extracting fine-grained pedagogical behaviors, matching observational checklists, synthesizing Grounded Theory themes, and generating evidence-cited teacher interview questionnaires.

---

## 🌟 Key Architecture & 6-Phase Pipeline

```mermaid
graph TD
    A[Zoom 720p MP4 Video Upload] --> B[Phase 1: FFmpeg 10-min Chunks with 30s Overlap]
    B --> C[Phase 2: Gemini 1.5 Flash Multimodal Understanding]
    C --> D[Phase 2: ±5s Boundary Deduplication & Merge]
    D --> E[Phase 3: Claude 3.5 Sonnet Semantic Checklist Matching]
    E --> F[Phase 4 & 5: Item Statistics & Markdown Report Generation]
    F --> G[Phase 6: Cross-Corpus Grounded Theory Synthesis]
    G --> H[Evidence-Cited Teacher Interview Generator]
```

### 1. **Phase 1: Video Chunking & Multimodal Extraction**
- Splits recordings into 10-minute segments with a 30-second overlap via **FFmpeg**.
- Analyzes video and audio multimodal streams with **Google Gemini 1.5 Flash** (`gemini-1.5-flash`).
- Extracts **visual** (body language, gestures, screen interactions), **audio** (verbal scaffolding, questions, wait time, praise), and **context** events with exact second timestamps.

### 2. **Phase 2: Boundary Deduplication**
- Reconciles events across the 30-second chunk overlap window with a ±5.0s tolerance window.
- Flags subsequent duplicates while preserving canonical events.

### 3. **Phase 3: Semantic Checklist Matching**
- Utilizes **Claude 3.5 Sonnet** (via OpenRouter) to semantically align raw extracted events with the standard 28-item classroom observation checklist (Sections A–E).

### 4. **Phase 4 & 5: Statistics & Report Generation**
- Computes frequency, average confidence, average duration, and timestamp distributions per checklist criterion.
- Produces academic-formatted markdown reports with occurrences tables and summary metrics.

### 5. **Phase 6: Grounded Theory Strategy Synthesis & Interview Generator**
- Bottom-up clustering of recurring teaching strategies across all teachers (T01–T12).
- Grounded Theory themes with human-readable **reasoning traces** citing real timestamps and empirical counts.
- Generates **Core Questions** (uniform research baseline) and **Dynamic Personalized Questions** (citing individual teacher evidence).

---

## 📋 Prerequisites & Tools

Make sure you have the following installed on your machine (for local development without Docker):

| Tool | Minimum Version | Installation Command (macOS) |
| :--- | :--- | :--- |
| **Docker & Docker Compose** *(recommended)* | `24.0+` | `brew install --cask docker` |
| **Go** | `1.22+` | `brew install go` |
| **Node.js** | `18+` | `brew install node` |
| **FFmpeg** | `6.0+` | `brew install ffmpeg` |
| **Azure CLI** *(optional)* | `2.50+` | `brew install azure-cli` |

---

## 🐳 Quick Start with Docker Compose (Recommended)

Run the entire application stack (**Frontend**, **Backend with FFmpeg**, and **PostgreSQL with auto-migrations**) on any machine with a single command:

### 1. Configure Environment Variables
```bash
# Copy Docker environment template to root .env
cp .env.docker.example .env
```
Open `.env` and fill in your AI credentials:
- `GEMINI_API_KEY` (from [Google AI Studio](https://aistudio.google.com/))
- `OPENROUTER_API_KEY` (from [OpenRouter](https://openrouter.ai/))

### 2. Build & Start All Services
```bash
docker compose up -d --build
```

### 3. Access Application
| Service | URL | Description |
| :--- | :--- | :--- |
| **Web UI** | `http://localhost:3000` *(or `http://<server-ip>:3000`)* | Main research platform & video upload |
| **API Docs (Scalar UI)** | `http://localhost:8000/scalar` | Interactive OpenAPI playground |
| **Backend Health** | `http://localhost:8000/healthz` | Service health status |
| **OpenAPI Spec** | `http://localhost:8000/openapi.yaml` | Raw OpenAPI 3.0 specification |

### 4. Manage Containers
```bash
# View live logs for all containers
docker compose logs -f

# View backend logs specifically (e.g. video processing progress)
docker compose logs -f backend

# Stop all services
docker compose down

# Stop and reset database volume
docker compose down -v
```

---

## 🛠️ Manual Local Development Setup (Without Docker)

### Step 1: Configure Environment Variables

Create your backend `.env` file from the example:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your credentials:

```env
# Server
PORT=8000
GIN_MODE=debug

# 1. Database: Supabase PostgreSQL (include ?sslmode=require)
DB_URL=postgresql://postgres:[YOUR_PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres?sslmode=require

# 2. Storage: Azure Blob Storage (or leave blank to fallback to local ./storage)
AZURE_STORAGE_ACCOUNT=vtrdevstorage
AZURE_STORAGE_KEY=your_azure_storage_key
AZURE_CONTAINER_NAME=videos

# 3. AI Providers
GEMINI_API_KEY=AIzaSy...              # Get from https://aistudio.google.com/
OPENROUTER_API_KEY=sk-or-v1-...       # Get from https://openrouter.ai/

# 4. Security & Auth
JWT_SECRET=dev_jwt_secret_key_video_teaching_research_2026
JWT_EXPIRY_HOURS=24

# 5. FFmpeg Binary Path
FFMPEG_PATH=ffmpeg

# 6. Pipeline Tuning
MAX_CONCURRENT_CHUNKS=3
CHUNK_DURATION_SEC=600
CHUNK_OVERLAP_SEC=30
```

---

### Step 2: (Optional) Provision Azure Blob Storage

If you want to use Azure Blob Storage for video uploads in both Local & Cloud environments, run the automated provisioning script:

```zsh
./infrastructure/setup-azure-storage.sh
```

*This script creates the Resource Group (`rg-vtr-dev`), Storage Account (`vtrdevstorage`), and the `videos` container, and outputs the `.env` values.*

*(If skipped, the system automatically saves uploaded videos locally to `backend/storage/videos`).*

---

### Step 3: Run Database Schema Migrations & Seed Data

Execute the database migrations against your Supabase / PostgreSQL database:

#### Option A: Via Supabase SQL Editor (Recommended)
1. Open your **Supabase Dashboard** ➡️ **SQL Editor**.
2. Copy and execute **[backend/migrations/000001_init.up.sql](backend/migrations/000001_init.up.sql)** *(creates tables)*.
3. Copy and execute **[backend/migrations/000002_seed_checklist.up.sql](backend/migrations/000002_seed_checklist.up.sql)** *(seeds 28 observation checklist items)*.

#### Option B: Via Terminal CLI
```bash
cd backend
make migrate-up-env
```

---

### Step 4: Start the Backend Server (Go)

```bash
cd backend
go run cmd/server/main.go
```

* **API Server:** `http://localhost:8000`
* **Health Check:** `http://localhost:8000/healthz`
* **Interactive API Docs (Scalar UI):** `http://localhost:8000/scalar`
* **OpenAPI Specification:** `http://localhost:8000/openapi.yaml`

---

### Step 5: Start the Frontend Application (Next.js)

In a new terminal window:

```bash
cd frontend
npm install
npm run dev
```

Open **`http://localhost:3000`** in your browser.

---

## 📱 Web UI Routes & Pages

| Route | Page Name | Description |
| :--- | :--- | :--- |
| **`/`** | **Video Dashboard** | Overview of all uploaded lessons, statuses, and one-click pipeline triggers. |
| **`/upload`** | **Upload Lesson** | Drag-and-drop video uploader with Teacher ID assignment (`T01`–`T12`). |
| **`/videos/[id]`** | **Pipeline & Timeline** | Real-time multi-phase pipeline tracker with interactive event timeline. |
| **`/reports/[id]`** | **Lesson Report** | Academic report with occurrence citations, Markdown download, and PDF export. |
| **`/checklists`** | **Checklist Manager** | Manage the 28-item observation rubric across Sections A–E. |
| **`/themes`** | **Grounded Theory Themes** | Interactive theme tree, category grouping, and theme merging. |
| **`/interview`** | **Interview Studio** | Generates evidence-cited teacher interview questions with Markdown export. |

---

## 🧪 Testing & Verification

```bash
# Run backend unit and integration tests
cd backend
go test ./... -v

# Verify frontend build
cd frontend
npm run build
```

---

## 🛠️ Troubleshooting & FAQ

* **Q: The UI shows sample/mock data instead of live data.**
  * **A:** Ensure the Go backend is running on port `8000` and connected to Supabase (`Connected to database successfully` in terminal logs).
* **Q: Database connection error with Supabase.**
  * **A:** Ensure `?sslmode=require` is appended to your `DB_URL` in `backend/.env`.
* **Q: FFmpeg error during video upload.**
  * **A:** Run `ffmpeg -version` to verify it is installed and in your system `PATH`.
* **Q: How to reset/re-seed the database?**
  * **A:** Run `000001_init.down.sql` followed by `000001_init.up.sql` and `000002_seed_checklist.up.sql`.

---

## 📄 License & Academic Attribution
Developed for master's research in English Language Teaching & Multimodal Classroom Interaction Analysis.

