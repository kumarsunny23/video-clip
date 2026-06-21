import uuid
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from database import get_db
from models import Job
from pipeline.orchestrator import run_pipeline

router = APIRouter(prefix="/generate", tags=["generation"])

class GenerateRequest(BaseModel):
    topic: str

class GenerateResponse(BaseModel):
    job_id: str
    topic: str
    status: str

@router.post("", response_model=GenerateResponse)
async def generate_video(
    request: GenerateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    topic = request.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic cannot be empty")

    job_id = str(uuid.uuid4())
    
    # Create the job in the database
    new_job = Job(
        id=job_id,
        topic=topic,
        status="PENDING",
        progress=0.0
    )
    db.add(new_job)
    await db.commit()

    # Launch pipeline orchestrator as a background task
    background_tasks.add_task(run_pipeline, job_id, topic)

    return GenerateResponse(
        job_id=job_id,
        topic=topic,
        status="PENDING"
    )
