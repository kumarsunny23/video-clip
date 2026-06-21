# ✂️ Video Clip Cutter

A full-stack web app for cutting multiple short clips from any YouTube URL or direct video file — powered by **FFmpeg** + **yt-dlp** on the backend and **React + Tailwind** on the frontend.

---

## Features

- 🎬 **Load any video** — YouTube, Vimeo, TikTok, direct `.mp4`/`.mov` URLs
- ✂️ **Visual timeline slider** — dual-handle range to mark precise start/end points
- ➕ **Queue multiple clips** from the same source before processing
- ⚡ **Fast stream-copy cuts** with `-c copy` (no re-encode), or frame-accurate re-encode
- 🪄 **Auto-detect segments** — split by fixed interval (30s, 60s…) or FFmpeg scene detection
- 📱 **9:16 crop** for Shorts, Reels, TikTok — one click
- 🎨 **Fade in/out** and **text overlay** effects
- 📦 **Batch ZIP download** of all clips, or download individually
- 📊 **Real-time progress bars** per clip (FFmpeg output parsed live)
- 🧹 **Auto-cleanup** — session files deleted after 1 hour

---

## Prerequisites

Install these before running:

### FFmpeg
**Windows:**
```powershell
winget install Gyan.FFmpeg
# or download from https://ffmpeg.org/download.html and add to PATH
```

**macOS:**
```bash
brew install ffmpeg
```

**Linux (Debian/Ubuntu):**
```bash
sudo apt update && sudo apt install ffmpeg
```

Verify: `ffmpeg -version`

### yt-dlp
```bash
pip install yt-dlp
# or
winget install yt-dlp  # Windows
brew install yt-dlp    # macOS
```

Verify: `yt-dlp --version`

### Python 3.10+
Download from https://python.org

### Node.js 18+
Download from https://nodejs.org

---

## Setup & Run

### 1. Backend (FastAPI)

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate
# Activate (macOS/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at **http://localhost:8000**  
Interactive docs: **http://localhost:8000/docs**

### 2. Frontend (React + Vite)

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Project Structure

```
.
├── backend/
│   ├── main.py           # FastAPI app, all API endpoints
│   ├── tasks.py          # In-memory session store + background job runner
│   ├── video_utils.py    # yt-dlp download, ffprobe probe, FFmpeg helpers
│   ├── models.py         # Pydantic request/response schemas
│   ├── requirements.txt
│   └── uploads/          # Temp folder (auto-created, auto-cleaned)
│
└── frontend/
    ├── src/
    │   ├── App.jsx              # Root component + state machine
    │   ├── index.css            # Global styles, slider CSS, animations
    │   └── components/
    │       ├── UrlInput.jsx         # URL paste + Load Video button
    │       ├── VideoPlayer.jsx      # Video player / thumbnail display
    │       ├── TimelineSlider.jsx   # Dual-handle range slider
    │       ├── ClipQueue.jsx        # Clip definition UI + queued list
    │       ├── ClipCard.jsx         # Single clip card (thumb + status + download)
    │       ├── ProcessingPanel.jsx  # Process button + overall progress + ZIP
    │       └── AutoDetect.jsx       # Auto-segment controls
    ├── index.html
    ├── vite.config.js       # Proxies /api/* to :8000
    ├── tailwind.config.js
    └── package.json
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/load-video` | Download & probe source video |
| `GET`  | `/api/thumbnail/{session_id}` | Source video thumbnail |
| `POST` | `/api/add-clips` | Queue clip specs |
| `POST` | `/api/process-clips` | Start background FFmpeg |
| `GET`  | `/api/status/{session_id}` | Poll progress |
| `GET`  | `/api/clip-thumb/{sid}/{cid}` | Clip thumbnail |
| `GET`  | `/api/download/{sid}/{cid}` | Download single clip |
| `GET`  | `/api/download-all/{sid}` | Download all clips as ZIP |
| `POST` | `/api/auto-segments` | Generate segment timestamps |
| `DELETE` | `/api/session/{sid}` | Delete session + files |
| `GET`  | `/api/health` | Health check |

---

## Configuration

Set environment variables before running the backend:

| Variable | Default | Description |
|----------|---------|-------------|
| `MAX_SOURCE_MB` | `500` | Maximum source video file size |

Example:
```bash
MAX_SOURCE_MB=1000 uvicorn main:app --reload
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ffmpeg not found` | Install FFmpeg and add to PATH; restart terminal |
| `yt-dlp download failed` | Update yt-dlp: `pip install -U yt-dlp` |
| YouTube age-restricted video | Pass cookies: add `"cookiefile": "cookies.txt"` to yt-dlp opts |
| Clip has no audio after cut | Disable fast cut (re-encode mode) for that clip |
| Port 8000 already in use | Run with `--port 8001` and update `vite.config.js` proxy target |

---

## Production Build

```bash
# Build frontend
cd frontend && npm run build

# Serve static files from FastAPI
# Add StaticFiles mount to main.py, or use nginx
```
