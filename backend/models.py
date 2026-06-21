"""
models.py — Pydantic request/response schemas for the Video Clip Cutter API.
"""

from pydantic import BaseModel, HttpUrl, field_validator
from typing import Optional, List
from enum import Enum


class LoadVideoRequest(BaseModel):
    url: str  # YouTube URL or direct video URL

    @field_validator("url")
    @classmethod
    def url_must_not_be_empty(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("URL must not be empty")
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


class VideoInfo(BaseModel):
    session_id: str
    title: str
    duration: float          # seconds
    thumbnail_url: str       # relative API path to thumbnail
    source_url: str
    width: Optional[int] = None
    height: Optional[int] = None
    fps: Optional[float] = None


class ClipEffect(str, Enum):
    none = "none"
    fade = "fade"                # fade in/out
    crop_vertical = "crop_vertical"   # 9:16 crop for Shorts/Reels
    fade_crop = "fade_crop"      # both


class ClipSpec(BaseModel):
    """A single clip to be cut from the source video."""
    start: float             # start time in seconds
    end: float               # end time in seconds
    label: Optional[str] = None
    effect: ClipEffect = ClipEffect.none
    caption: Optional[str] = None    # text overlay
    fast_cut: bool = True    # use -c copy for speed; False = re-encode

    @field_validator("end")
    @classmethod
    def end_must_be_after_start(cls, v: float, info) -> float:
        if "start" in info.data and v <= info.data["start"]:
            raise ValueError("end must be greater than start")
        if v - info.data.get("start", 0) > 3600:
            raise ValueError("Clip cannot be longer than 1 hour")
        return v


class AddClipsRequest(BaseModel):
    session_id: str
    clips: List[ClipSpec]

    @field_validator("clips")
    @classmethod
    def clips_not_empty(cls, v):
        if not v:
            raise ValueError("clips list must not be empty")
        if len(v) > 50:
            raise ValueError("Cannot queue more than 50 clips at once")
        return v


class ClipStatus(str, Enum):
    queued = "queued"
    processing = "processing"
    done = "done"
    error = "error"


class ClipInfo(BaseModel):
    clip_id: str
    label: Optional[str]
    start: float
    end: float
    duration: float
    status: ClipStatus
    progress: int = 0           # 0-100
    error_msg: Optional[str] = None
    thumbnail_url: Optional[str] = None
    download_url: Optional[str] = None
    file_size: Optional[int] = None   # bytes


class SessionStatus(BaseModel):
    session_id: str
    video_title: str
    overall_status: str     # "idle" | "processing" | "done" | "error"
    clips: List[ClipInfo]


class AutoSegmentRequest(BaseModel):
    session_id: str
    mode: str = "interval"   # "interval" | "scene"
    interval_seconds: float = 30.0
    max_clips: int = 20


class AutoSegmentResponse(BaseModel):
    segments: List[ClipSpec]


class ProcessRequest(BaseModel):
    session_id: str
