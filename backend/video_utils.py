"""
video_utils.py — Core helpers for downloading videos and running FFmpeg operations.

Key design:
- yt_dlp_download()   : handles YouTube / social links via yt-dlp
- http_download()     : streams direct .mp4/.mov URLs with httpx
- get_video_info()    : probes metadata with ffprobe
- extract_thumbnail() : single-frame JPEG from a video file
- cut_clip()          : fast (-c copy) or accurate (re-encode) clip extraction
- apply_effects()     : 9:16 crop, fade in/out, text overlay via FFmpeg filters
- auto_segments()     : interval-based or scene-change segment detection
"""

import asyncio
import json
import math
import os
import re
import subprocess
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import httpx
import yt_dlp

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MAX_SOURCE_MB = int(os.getenv("MAX_SOURCE_MB", "500"))
MAX_SOURCE_BYTES = MAX_SOURCE_MB * 1024 * 1024

UPLOADS_DIR = Path(__file__).parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


# ---------------------------------------------------------------------------
# Progress hook helpers
# ---------------------------------------------------------------------------

def _make_ytdlp_hook(progress_callback=None):
    """Return a yt-dlp progress hook that calls an optional async callback."""
    def hook(d: dict):
        if d["status"] == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate") or 0
            downloaded = d.get("downloaded_bytes", 0)
            pct = int(downloaded / total * 100) if total else 0
            if progress_callback:
                progress_callback(pct)
        elif d["status"] == "finished":
            if progress_callback:
                progress_callback(100)
    return hook


# ---------------------------------------------------------------------------
# Download helpers
# ---------------------------------------------------------------------------

async def yt_dlp_download(
    url: str,
    session_dir: Path,
    progress_callback=None,
) -> Tuple[Path, Dict[str, Any]]:
    """
    Download a video from YouTube or any yt-dlp-supported site.
    Returns (path_to_video_file, info_dict).
    """
    out_template = str(session_dir / "source.%(ext)s")

    ydl_opts = {
        "format": "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
        "outtmpl": out_template,
        "merge_output_format": "mp4",
        "quiet": True,
        "no_warnings": True,
        "progress_hooks": [_make_ytdlp_hook(progress_callback)],
        # Cap download size to avoid abuse
        "max_filesize": MAX_SOURCE_BYTES,
    }

    loop = asyncio.get_event_loop()

    def _run():
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            return info

    try:
        info = await loop.run_in_executor(None, _run)
    except yt_dlp.utils.DownloadError as e:
        raise ValueError(f"yt-dlp download failed: {e}")

    # Find the downloaded file
    for candidate in session_dir.glob("source.*"):
        if candidate.suffix.lower() in {".mp4", ".mkv", ".webm", ".mov", ".avi"}:
            return candidate, info

    raise FileNotFoundError("Downloaded file not found in session directory")


async def http_download(
    url: str,
    session_dir: Path,
    progress_callback=None,
) -> Path:
    """
    Stream-download a direct video URL using httpx.
    Returns path to the saved file.
    """
    # Detect extension from URL
    clean_url = url.split("?")[0]
    ext = Path(clean_url).suffix.lower() or ".mp4"
    if ext not in {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v", ".flv"}:
        ext = ".mp4"

    dest = session_dir / f"source{ext}"
    downloaded = 0

    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        async with client.stream("GET", url) as response:
            response.raise_for_status()
            total = int(response.headers.get("content-length", 0))

            if total and total > MAX_SOURCE_BYTES:
                raise ValueError(
                    f"Video file is too large ({total // (1024*1024)} MB). "
                    f"Maximum allowed is {MAX_SOURCE_MB} MB."
                )

            with open(dest, "wb") as f:
                async for chunk in response.aiter_bytes(chunk_size=65536):
                    f.write(chunk)
                    downloaded += len(chunk)
                    if total and progress_callback:
                        progress_callback(int(downloaded / total * 100))

    if progress_callback:
        progress_callback(100)

    if downloaded == 0:
        raise ValueError("Downloaded file is empty — invalid URL?")

    return dest


def is_youtube_url(url: str) -> bool:
    """Return True if URL looks like a YouTube or yt-dlp-supported social link."""
    patterns = [
        r"youtube\.com/watch",
        r"youtu\.be/",
        r"youtube\.com/shorts",
        r"vimeo\.com/",
        r"twitter\.com/",
        r"x\.com/",
        r"instagram\.com/",
        r"tiktok\.com/",
        r"twitch\.tv/",
        r"dailymotion\.com/",
        r"facebook\.com/",
        r"reddit\.com/",
    ]
    return any(re.search(p, url, re.IGNORECASE) for p in patterns)


# ---------------------------------------------------------------------------
# FFprobe — video metadata
# ---------------------------------------------------------------------------

def get_video_info(video_path: Path) -> Dict[str, Any]:
    """
    Probe video file with ffprobe and return a metadata dict:
    {duration, width, height, fps, codec, title}
    """
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_streams", "-show_format",
        str(video_path),
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except FileNotFoundError:
        raise RuntimeError(
            "ffprobe not found. Please install FFmpeg and add it to PATH."
        )

    if result.returncode != 0:
        raise ValueError(f"ffprobe error: {result.stderr[:500]}")

    data = json.loads(result.stdout)
    duration = float(data.get("format", {}).get("duration", 0))
    title = data.get("format", {}).get("tags", {}).get("title", video_path.stem)

    width = height = fps = codec = None
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            width = stream.get("width")
            height = stream.get("height")
            codec = stream.get("codec_name")
            r_frame_rate = stream.get("r_frame_rate", "0/1")
            try:
                num, den = r_frame_rate.split("/")
                fps = round(float(num) / float(den), 2) if int(den) else None
            except (ValueError, ZeroDivisionError):
                fps = None
            break

    return {
        "duration": duration,
        "width": width,
        "height": height,
        "fps": fps,
        "codec": codec,
        "title": title,
    }


# ---------------------------------------------------------------------------
# Thumbnail extraction
# ---------------------------------------------------------------------------

def extract_thumbnail(
    video_path: Path,
    output_path: Path,
    seek_seconds: float = 5.0,
) -> Path:
    """
    Extract a single JPEG frame from video_path at seek_seconds.
    Returns the output path.
    """
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(min(seek_seconds, 2.0)),   # fast seek before input
        "-i", str(video_path),
        "-ss", str(max(0, seek_seconds - 2.0)),  # fine-seek after
        "-frames:v", "1",
        "-vf", "scale=480:-1",
        "-q:v", "3",
        str(output_path),
    ]
    result = subprocess.run(cmd, capture_output=True, timeout=60)
    if result.returncode != 0 or not output_path.exists():
        # Fallback: grab first frame
        cmd_fallback = [
            "ffmpeg", "-y", "-i", str(video_path),
            "-frames:v", "1", "-vf", "scale=480:-1", "-q:v", "3",
            str(output_path),
        ]
        subprocess.run(cmd_fallback, capture_output=True, timeout=60)
    return output_path


# ---------------------------------------------------------------------------
# Clip cutting
# ---------------------------------------------------------------------------

def build_ffmpeg_cut_cmd(
    source: Path,
    output: Path,
    start: float,
    end: float,
    fast_cut: bool,
    effect: str,
    caption: Optional[str],
) -> List[str]:
    """
    Build the FFmpeg command list for cutting a clip.
    - fast_cut=True  → stream copy (no re-encode), very fast
    - fast_cut=False → libx264/aac re-encode for frame accuracy
    Effects force re-encode automatically.
    """
    duration = end - start
    needs_encode = not fast_cut or effect != "none" or caption

    cmd = ["ffmpeg", "-y"]

    if fast_cut and not needs_encode:
        # Fast path: seek before input for speed
        cmd += ["-ss", str(start), "-to", str(end)]
        cmd += ["-i", str(source)]
        cmd += ["-c", "copy", "-avoid_negative_ts", "1"]
    else:
        # Accurate path: seek before input (fast), fine-seek after
        cmd += ["-ss", str(start)]
        cmd += ["-i", str(source)]
        cmd += ["-t", str(duration)]

        # Build filtergraph
        vf_parts = []
        af_parts = []

        if effect in ("crop_vertical", "fade_crop"):
            # 9:16 crop: take center strip of width = height * 9/16
            vf_parts.append("crop=ih*9/16:ih")

        if effect in ("fade", "fade_crop"):
            fade_dur = min(1.0, duration * 0.1)
            vf_parts.append(f"fade=t=in:st=0:d={fade_dur:.2f}")
            vf_parts.append(f"fade=t=out:st={duration - fade_dur:.2f}:d={fade_dur:.2f}")
            af_parts.append(f"afade=t=in:st=0:d={fade_dur:.2f}")
            af_parts.append(f"afade=t=out:st={duration - fade_dur:.2f}:d={fade_dur:.2f}")

        if caption:
            safe_caption = caption.replace("'", "\\'").replace(":", "\\:")
            vf_parts.append(
                f"drawtext=text='{safe_caption}':fontsize=36:fontcolor=white"
                f":x=(w-text_w)/2:y=h-th-40:box=1:boxcolor=black@0.6:boxborderw=8"
            )

        if vf_parts:
            cmd += ["-vf", ",".join(vf_parts)]
        if af_parts:
            cmd += ["-af", ",".join(af_parts)]

        cmd += ["-c:v", "libx264", "-preset", "fast", "-crf", "23"]
        cmd += ["-c:a", "aac", "-b:a", "128k"]

    cmd.append(str(output))
    return cmd


async def cut_clip(
    source: Path,
    output: Path,
    start: float,
    end: float,
    fast_cut: bool = True,
    effect: str = "none",
    caption: Optional[str] = None,
    progress_callback=None,
) -> Path:
    """
    Run FFmpeg to cut a clip. progress_callback(pct: int) is called periodically.
    Returns output path on success, raises on failure.
    """
    duration = end - start
    cmd = build_ffmpeg_cut_cmd(source, output, start, end, fast_cut, effect, caption)

    loop = asyncio.get_event_loop()

    def _run():
        proc = subprocess.Popen(
            cmd,
            stderr=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            text=True,
        )
        elapsed = 0.0
        for line in proc.stderr:
            # Parse time= from FFmpeg output for progress
            m = re.search(r"time=(\d+):(\d+):(\d+\.\d+)", line)
            if m and duration > 0:
                h, mn, s = int(m.group(1)), int(m.group(2)), float(m.group(3))
                current = h * 3600 + mn * 60 + s
                pct = min(99, int(current / duration * 100))
                if progress_callback:
                    progress_callback(pct)
        proc.wait()
        if proc.returncode != 0:
            raise RuntimeError(f"FFmpeg exited with code {proc.returncode}")
        if progress_callback:
            progress_callback(100)

    await loop.run_in_executor(None, _run)
    return output


# ---------------------------------------------------------------------------
# Auto-segment detection
# ---------------------------------------------------------------------------

async def auto_segments_interval(
    duration: float,
    interval: float,
    max_clips: int,
) -> List[Dict[str, float]]:
    """
    Split video into equal-length segments of `interval` seconds.
    Returns list of {start, end} dicts.
    """
    segments = []
    start = 0.0
    while start < duration and len(segments) < max_clips:
        end = min(start + interval, duration)
        if end - start >= 1.0:   # skip <1s fragments
            segments.append({"start": round(start, 2), "end": round(end, 2)})
        start = end
    return segments


async def auto_segments_scene(
    video_path: Path,
    max_clips: int,
    min_clip_len: float = 10.0,
) -> List[Dict[str, float]]:
    """
    Detect scene changes with FFmpeg's scene filter, then cluster them
    into segments of at least min_clip_len seconds.
    """
    loop = asyncio.get_event_loop()

    def _detect():
        cmd = [
            "ffmpeg", "-i", str(video_path),
            "-vf", "select='gt(scene,0.35)',showinfo",
            "-vsync", "vfr",
            "-f", "null", "-",
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        timestamps = []
        for line in result.stderr.splitlines():
            m = re.search(r"pts_time:(\d+\.\d+)", line)
            if m:
                timestamps.append(float(m.group(1)))
        return sorted(set(timestamps))

    raw_times = await loop.run_in_executor(None, _detect)

    # Probe total duration
    info = get_video_info(video_path)
    total = info["duration"]

    # Cluster: skip scene changes that are too close together
    cut_points = [0.0]
    for t in raw_times:
        if t - cut_points[-1] >= min_clip_len:
            cut_points.append(t)
    cut_points.append(total)

    segments = []
    for i in range(len(cut_points) - 1):
        if len(segments) >= max_clips:
            break
        segments.append({
            "start": round(cut_points[i], 2),
            "end": round(cut_points[i + 1], 2),
        })
    return segments
