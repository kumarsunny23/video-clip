"""
main.py — FastAPI application for Video Clip Cutter.

Endpoints:
  POST   /api/load-video            Download/probe source video
  GET    /api/thumbnail/{sid}        Serve source video thumbnail
  POST   /api/add-clips             Queue clip specs onto a session
  POST   /api/process-clips         Trigger background FFmpeg processing
  GET    /api/status/{sid}          Poll overall + per-clip status
  GET    /api/clip-thumb/{sid}/{cid} Serve per-clip thumbnail
  GET    /api/download/{sid}/{cid}   Download a single clip file
  GET    /api/download-all/{sid}     Download all done clips as ZIP
  POST   /api/auto-segments          Generate segment timestamps
  DELETE /api/session/{sid}          Delete session + files
"""

import asyncio
import io
import os
import uuid
import zipfile
from pathlib import Path
from typing import Any, Dict

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

import tasks
from models import (
    AddClipsRequest,
    AutoSegmentRequest,
    AutoSegmentResponse,
    ClipSpec,
    LoadVideoRequest,
    ProcessRequest,
    SessionStatus,
    VideoInfo,
)
from video_utils import (
    UPLOADS_DIR,
    auto_segments_interval,
    auto_segments_scene,
    extract_thumbnail,
    get_video_info,
    http_download,
    is_youtube_url,
    yt_dlp_download,
)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Video Clip Cutter API",
    description="Backend for cutting video clips via FFmpeg + yt-dlp",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # tighten in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    """Launch the periodic cleanup background task."""
    asyncio.create_task(tasks.cleanup_old_sessions())


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _require_session(session_id: str) -> Dict[str, Any]:
    """Return session dict or raise 404."""
    session = tasks.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    return session


# ---------------------------------------------------------------------------
# Endpoint: Load Video
# ---------------------------------------------------------------------------

@app.post("/api/load-video", response_model=VideoInfo)
async def load_video(req: LoadVideoRequest, bg: BackgroundTasks):
    """
    Step 1: Download/probe a video URL.
    - YouTube / social links → yt-dlp
    - Direct .mp4/.mov URLs  → httpx stream download
    Returns session_id + video metadata so the frontend can show a player.
    """
    session_id = uuid.uuid4().hex
    session_dir = UPLOADS_DIR / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    # Placeholder session so status polling works during download
    tasks.sessions[session_id] = {
        "session_id": session_id,
        "title": "Loading…",
        "source_path": None,
        "session_dir": session_dir,
        "video_info": {},
        "source_url": req.url,
        "clips": {},
        "clip_order": [],
        "overall_status": "downloading",
        "created_at": __import__("time").time(),
        "download_progress": 0,
    }

    def _progress(pct: int):
        if session_id in tasks.sessions:
            tasks.sessions[session_id]["download_progress"] = pct

    try:
        if is_youtube_url(req.url):
            source_path, ydl_info = await yt_dlp_download(
                req.url, session_dir, progress_callback=_progress
            )
            title = ydl_info.get("title", source_path.stem)
        else:
            source_path = await http_download(
                req.url, session_dir, progress_callback=_progress
            )
            title = Path(req.url.split("?")[0]).stem or "video"

    except ValueError as e:
        tasks.delete_session(session_id)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        tasks.delete_session(session_id)
        raise HTTPException(status_code=500, detail=f"Download failed: {str(e)[:300]}")

    # Probe metadata
    try:
        info = get_video_info(source_path)
    except Exception as e:
        tasks.delete_session(session_id)
        raise HTTPException(status_code=500, detail=f"Could not probe video: {e}")

    if info["duration"] <= 0:
        tasks.delete_session(session_id)
        raise HTTPException(status_code=400, detail="Video has zero duration")

    # Extract source thumbnail at 5 s (or 10% of duration)
    thumb_seek = min(5.0, info["duration"] * 0.1)
    thumb_path = session_dir / "thumb.jpg"
    try:
        extract_thumbnail(source_path, thumb_path, seek_seconds=thumb_seek)
    except Exception:
        pass   # thumbnail is non-critical

    # Update session
    tasks.create_session(
        session_id=session_id,
        source_path=source_path,
        video_info=info,
        title=title,
        source_url=req.url,
    )

    return VideoInfo(
        session_id=session_id,
        title=title,
        duration=info["duration"],
        thumbnail_url=f"/api/thumbnail/{session_id}",
        source_url=req.url,
        width=info.get("width"),
        height=info.get("height"),
        fps=info.get("fps"),
    )


# ---------------------------------------------------------------------------
# Endpoint: Serve source thumbnail
# ---------------------------------------------------------------------------

@app.get("/api/thumbnail/{session_id}")
async def get_thumbnail(session_id: str):
    session = _require_session(session_id)
    thumb = session["session_dir"] / "thumb.jpg"
    if not thumb.exists():
        raise HTTPException(status_code=404, detail="Thumbnail not available")
    return FileResponse(str(thumb), media_type="image/jpeg")


# ---------------------------------------------------------------------------
# Endpoint: Add Clips
# ---------------------------------------------------------------------------

@app.post("/api/add-clips")
async def add_clips(req: AddClipsRequest):
    """Queue clip specs onto a session without starting processing."""
    session = _require_session(req.session_id)

    info = session["video_info"]
    duration = info.get("duration", 0)

    # Validate timestamps against actual video duration
    for spec in req.clips:
        if spec.start < 0:
            raise HTTPException(400, f"Start time {spec.start} cannot be negative")
        if spec.end > duration + 0.5:   # allow tiny overshoot
            raise HTTPException(
                400,
                f"End time {spec.end:.1f}s exceeds video duration {duration:.1f}s",
            )

    clip_ids = tasks.add_clips_to_session(req.session_id, req.clips)
    return {"session_id": req.session_id, "added_clip_ids": clip_ids}


# ---------------------------------------------------------------------------
# Endpoint: Process Clips
# ---------------------------------------------------------------------------

@app.post("/api/process-clips")
async def process_clips(req: ProcessRequest, bg: BackgroundTasks):
    """
    Kick off background FFmpeg processing for all queued clips in a session.
    Returns immediately; poll /api/status/{session_id} for progress.
    """
    session = _require_session(req.session_id)

    # Check there are queued clips
    queued = [
        c for c in session["clips"].values()
        if c["status"] in (tasks.ClipStatus.queued, "queued")
    ]
    if not queued:
        raise HTTPException(400, "No queued clips to process")

    bg.add_task(tasks.process_session_clips, req.session_id)
    return {"message": f"Processing {len(queued)} clip(s) in background", "session_id": req.session_id}


# ---------------------------------------------------------------------------
# Endpoint: Status
# ---------------------------------------------------------------------------

@app.get("/api/status/{session_id}", response_model=None)
async def get_status(session_id: str):
    """Poll this endpoint (~1.5s interval) to get per-clip progress."""
    status = tasks.get_session_status(session_id)
    if not status:
        raise HTTPException(404, "Session not found or expired")
    return status


# ---------------------------------------------------------------------------
# Endpoint: Per-clip thumbnail
# ---------------------------------------------------------------------------

@app.get("/api/clip-thumb/{session_id}/{clip_id}")
async def get_clip_thumbnail(session_id: str, clip_id: str):
    session = _require_session(session_id)
    thumb = session["session_dir"] / f"{clip_id}_thumb.jpg"
    if not thumb.exists():
        raise HTTPException(404, "Clip thumbnail not found")
    return FileResponse(str(thumb), media_type="image/jpeg")


# ---------------------------------------------------------------------------
# Endpoint: Download single clip
# ---------------------------------------------------------------------------

@app.get("/api/download/{session_id}/{clip_id}")
async def download_clip(session_id: str, clip_id: str):
    session = _require_session(session_id)
    clip = session["clips"].get(clip_id)
    if not clip:
        raise HTTPException(404, "Clip not found")
    if clip["status"] != tasks.ClipStatus.done and clip["status"] != "done":
        raise HTTPException(400, "Clip is not ready yet")

    clip_file = session["session_dir"] / f"{clip_id}.mp4"
    if not clip_file.exists():
        raise HTTPException(404, "Clip file missing from disk")

    label = clip.get("label", clip_id)
    safe_label = "".join(c for c in label if c.isalnum() or c in " _-")[:50].strip() or clip_id
    filename = f"{safe_label}.mp4"

    return FileResponse(
        str(clip_file),
        media_type="video/mp4",
        filename=filename,
    )


# ---------------------------------------------------------------------------
# Endpoint: Download all clips as ZIP
# ---------------------------------------------------------------------------

@app.get("/api/download-all/{session_id}")
async def download_all_clips(session_id: str):
    session = _require_session(session_id)
    done_clips = [
        c for c in session["clips"].values()
        if c["status"] in (tasks.ClipStatus.done, "done")
    ]
    if not done_clips:
        raise HTTPException(400, "No completed clips to download")

    def _build_zip():
        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for clip in done_clips:
                clip_file = session["session_dir"] / f"{clip['clip_id']}.mp4"
                if clip_file.exists():
                    label = clip.get("label", clip["clip_id"])
                    safe = "".join(c for c in label if c.isalnum() or c in " _-")[:50].strip()
                    zf.write(str(clip_file), arcname=f"{safe or clip['clip_id']}.mp4")
        buf.seek(0)
        return buf

    loop = asyncio.get_event_loop()
    buf = await loop.run_in_executor(None, _build_zip)

    title = session["title"]
    safe_title = "".join(c for c in title if c.isalnum() or c in " _-")[:40].strip() or "clips"

    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}_clips.zip"'},
    )


# ---------------------------------------------------------------------------
# Endpoint: Auto-segment generation
# ---------------------------------------------------------------------------

@app.post("/api/auto-segments", response_model=AutoSegmentResponse)
async def auto_segments(req: AutoSegmentRequest):
    """
    Generate segment timestamps from a loaded video.
    mode="interval" → simple N-second split
    mode="scene"    → FFmpeg scene-change detection
    """
    session = _require_session(req.session_id)
    source: Path = session["source_path"]
    duration: float = session["video_info"].get("duration", 0)

    if not source or not source.exists():
        raise HTTPException(400, "Source video not found in session")

    if req.mode == "interval":
        segs = await auto_segments_interval(
            duration=duration,
            interval=max(1.0, req.interval_seconds),
            max_clips=min(req.max_clips, 50),
        )
    elif req.mode == "scene":
        segs = await auto_segments_scene(
            video_path=source,
            max_clips=min(req.max_clips, 50),
        )
    else:
        raise HTTPException(400, f"Unknown mode: {req.mode}")

    specs = [
        ClipSpec(start=s["start"], end=s["end"])
        for s in segs
    ]
    return AutoSegmentResponse(segments=specs)


# ---------------------------------------------------------------------------
# Endpoint: Delete session
# ---------------------------------------------------------------------------

@app.delete("/api/session/{session_id}")
async def delete_session(session_id: str):
    ok = tasks.delete_session(session_id)
    if not ok:
        raise HTTPException(404, "Session not found")
    return {"message": "Session deleted"}


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@app.get("/api/health")
async def health():
    return {"status": "ok", "active_sessions": len(tasks.sessions)}
