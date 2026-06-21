"""
tasks.py — In-memory session store and background processing logic.

Each session represents one loaded video. Clips within a session are
processed sequentially (one FFmpeg process at a time per session) to
avoid resource contention on single-machine deployments.

Session data is cleaned up automatically after CLEANUP_AFTER_SECONDS.
"""

import asyncio
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from models import ClipSpec, ClipStatus
from video_utils import (
    UPLOADS_DIR,
    cut_clip,
    extract_thumbnail,
    get_video_info,
)

# ---------------------------------------------------------------------------
# In-memory store
# ---------------------------------------------------------------------------

# sessions: { session_id: SessionData }
sessions: Dict[str, Dict[str, Any]] = {}

CLEANUP_AFTER_SECONDS = 3600  # 1 hour


def _make_clip_record(clip_id: str, spec: ClipSpec) -> Dict[str, Any]:
    return {
        "clip_id": clip_id,
        "label": spec.label or f"clip_{clip_id[:6]}",
        "start": spec.start,
        "end": spec.end,
        "duration": round(spec.end - spec.start, 2),
        "effect": spec.effect,
        "caption": spec.caption,
        "fast_cut": spec.fast_cut,
        "status": ClipStatus.queued,
        "progress": 0,
        "error_msg": None,
        "thumbnail_url": None,
        "download_url": None,
        "file_size": None,
    }


def create_session(
    session_id: str,
    source_path: Path,
    video_info: Dict[str, Any],
    title: str,
    source_url: str,
) -> None:
    """Register a newly loaded video session."""
    session_dir = UPLOADS_DIR / session_id
    session_dir.mkdir(exist_ok=True)

    sessions[session_id] = {
        "session_id": session_id,
        "title": title,
        "source_path": source_path,
        "session_dir": session_dir,
        "video_info": video_info,
        "source_url": source_url,
        "clips": {},          # clip_id → clip record
        "clip_order": [],     # preserves insertion order
        "overall_status": "idle",
        "created_at": time.time(),
        "download_progress": 0,
    }


def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    return sessions.get(session_id)


def add_clips_to_session(session_id: str, specs: list[ClipSpec]) -> list[str]:
    """Add clip specs to the session queue. Returns list of new clip_ids."""
    session = sessions[session_id]
    new_ids = []
    for spec in specs:
        clip_id = uuid.uuid4().hex[:10]
        record = _make_clip_record(clip_id, spec)
        session["clips"][clip_id] = record
        session["clip_order"].append(clip_id)
        new_ids.append(clip_id)
    return new_ids


def get_session_status(session_id: str) -> Optional[Dict[str, Any]]:
    session = sessions.get(session_id)
    if not session:
        return None
    clips_list = [
        session["clips"][cid] for cid in session["clip_order"]
    ]
    return {
        "session_id": session_id,
        "video_title": session["title"],
        "overall_status": session["overall_status"],
        "clips": clips_list,
        "download_progress": session.get("download_progress", 100),
    }


def delete_session(session_id: str) -> bool:
    """Remove session data and all associated files."""
    import shutil
    session = sessions.pop(session_id, None)
    if not session:
        return False
    session_dir: Path = session["session_dir"]
    if session_dir.exists():
        shutil.rmtree(session_dir, ignore_errors=True)
    return True


# ---------------------------------------------------------------------------
# Background processing
# ---------------------------------------------------------------------------

async def process_session_clips(session_id: str) -> None:
    """
    Background coroutine: iterate through all queued clips in a session
    and run FFmpeg for each one sequentially.
    """
    session = sessions.get(session_id)
    if not session:
        return

    session["overall_status"] = "processing"
    source: Path = session["source_path"]
    session_dir: Path = session["session_dir"]

    for clip_id in session["clip_order"]:
        clip = session["clips"][clip_id]
        if clip["status"] not in (ClipStatus.queued, "queued"):
            continue  # skip already-processed clips

        clip["status"] = ClipStatus.processing
        clip["progress"] = 0

        out_path = session_dir / f"{clip_id}.mp4"

        def _progress(pct: int, _cid=clip_id):
            sessions[session_id]["clips"][_cid]["progress"] = pct

        try:
            await cut_clip(
                source=source,
                output=out_path,
                start=clip["start"],
                end=clip["end"],
                fast_cut=clip["fast_cut"],
                effect=clip["effect"],
                caption=clip.get("caption"),
                progress_callback=_progress,
            )

            # Generate per-clip thumbnail at midpoint
            thumb_path = session_dir / f"{clip_id}_thumb.jpg"
            midpoint = (clip["start"] + clip["end"]) / 2 - clip["start"]
            extract_thumbnail(out_path, thumb_path, seek_seconds=midpoint)

            clip["status"] = ClipStatus.done
            clip["progress"] = 100
            clip["download_url"] = f"/api/download/{session_id}/{clip_id}"
            clip["thumbnail_url"] = f"/api/clip-thumb/{session_id}/{clip_id}"
            clip["file_size"] = out_path.stat().st_size if out_path.exists() else 0

        except Exception as exc:
            clip["status"] = ClipStatus.error
            clip["error_msg"] = str(exc)[:300]
            clip["progress"] = 0

    # Determine overall status
    statuses = [c["status"] for c in session["clips"].values()]
    if all(s == ClipStatus.done for s in statuses):
        session["overall_status"] = "done"
    elif any(s == ClipStatus.error for s in statuses):
        session["overall_status"] = "done_with_errors"
    else:
        session["overall_status"] = "done"


# ---------------------------------------------------------------------------
# Cleanup task
# ---------------------------------------------------------------------------

async def cleanup_old_sessions():
    """Periodically remove sessions older than CLEANUP_AFTER_SECONDS."""
    while True:
        await asyncio.sleep(300)   # check every 5 min
        now = time.time()
        stale = [
            sid for sid, s in list(sessions.items())
            if now - s["created_at"] > CLEANUP_AFTER_SECONDS
        ]
        for sid in stale:
            delete_session(sid)
