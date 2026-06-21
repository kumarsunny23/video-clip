from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
import datetime
from pydantic import BaseModel

from database import get_db
from models import Job, Video

router = APIRouter(prefix="/jobs", tags=["jobs"])

class VideoOut(BaseModel):
    id: str
    title: str
    file_path: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class JobOut(BaseModel):
    id: str
    topic: str
    status: str
    progress: float
    error_message: Optional[str]
    created_at: datetime.datetime
    updated_at: datetime.datetime
    video: Optional[VideoOut] = None

    class Config:
        from_attributes = True

@router.get("", response_model=List[JobOut])
async def list_jobs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Job)
        .options(selectinload(Job.video))
        .order_by(Job.created_at.desc())
    )
    jobs = result.scalars().all()
    return jobs

@router.get("/{job_id}", response_model=JobOut)
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Job)
        .options(selectinload(Job.video))
        .filter(Job.id == job_id)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job
