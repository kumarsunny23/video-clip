from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
import datetime
from pydantic import BaseModel

from database import get_db
from models import Video

router = APIRouter(prefix="/videos", tags=["videos"])

class VideoOut(BaseModel):
    id: str
    job_id: str
    title: str
    file_path: str
    duration: float | None
    created_at: datetime.datetime

    class Config:
        from_attributes = True

@router.get("", response_model=List[VideoOut])
async def list_videos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Video).order_by(Video.created_at.desc()))
    videos = result.scalars().all()
    return videos

@router.get("/{video_id}", response_model=VideoOut)
async def get_video(video_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Video).filter(Video.id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    return video
