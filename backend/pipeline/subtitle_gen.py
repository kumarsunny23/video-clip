import os
import datetime
import logging
from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

def format_timestamp(seconds: float) -> str:
    """Formats seconds to SRT timestamp format (HH:MM:SS,mmm)"""
    td = datetime.timedelta(seconds=seconds)
    hours, remainder = divmod(td.seconds, 3600)
    minutes, seconds_part = divmod(remainder, 60)
    milliseconds = int(td.microseconds / 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds_part:02d},{milliseconds:03d}"

async def generate_subtitles(audio_path: str, narration_text: str, output_dir: str, scene_num: int) -> str:
    """
    Transcribes audio using Whisper to create timed subtitles.
    If Whisper is not installed or errors out, performs smart phonetic/length timing estimation
    to output a beautiful and valid SRT subtitle file.
    """
    os.makedirs(output_dir, exist_ok=True)
    srt_filename = f"scene_{scene_num}_subs.srt"
    srt_path = os.path.join(output_dir, srt_filename)

    # 1. Try to use Whisper if installed
    try:
        import whisper
        logger.info("Using Whisper AI to transcribe audio...")
        # Load model (tiny, base, etc. based on config)
        model = whisper.load_model(settings.whisper_model)
        result = model.transcribe(audio_path, task="transcribe", language="en")
        
        # Write SRT format
        with open(srt_path, "w", encoding="utf-8") as f:
            for idx, segment in enumerate(result.get("segments", []), 1):
                start = segment["start"]
                end = segment["end"]
                text = segment["text"].strip()
                
                f.write(f"{idx}\n")
                f.write(f"{format_timestamp(start)} --> {format_timestamp(end)}\n")
                f.write(f"{text}\n\n")
                
        if os.path.exists(srt_path) and os.path.getsize(srt_path) > 0:
            return srt_path
            
    except Exception as e:
        logger.warning(f"Whisper transcription failed or skipped: {e}")

    # 2. Smart timing estimation fallback (rule-based heuristic)
    # Split text into small readable chunks (approx 5-7 words each)
    logger.info("Using rule-based text splitter for subtitle generation fallback...")
    words = narration_text.split()
    chunks = []
    chunk_size = 6
    
    for i in range(0, len(words), chunk_size):
        chunks.append(" ".join(words[i:i+chunk_size]))

    # Total duration of audio
    # Try using ffmpeg probe or default to estimating from word count (150 words/min)
    import subprocess
    import re
    
    duration = 5.0
    try:
        # Check audio file length
        cmd = ["ffmpeg", "-i", audio_path]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        # Match Duration: 00:00:05.42
        match = re.search(r"Duration:\s*(\d+):(\d+):(\d+\.\d+)", res.stderr)
        if match:
            h, m, s = float(match.group(1)), float(match.group(2)), float(match.group(3))
            duration = h * 3600 + m * 60 + s
    except Exception:
        duration = max(5.0, (len(words) / 150.0) * 60.0)

    # Distribute timing proportionally
    chunk_duration = duration / max(1, len(chunks))
    
    with open(srt_path, "w", encoding="utf-8") as f:
        for idx, chunk in enumerate(chunks, 1):
            start_sec = (idx - 1) * chunk_duration
            end_sec = idx * chunk_duration
            
            f.write(f"{idx}\n")
            f.write(f"{format_timestamp(start_sec)} --> {format_timestamp(end_sec)}\n")
            f.write(f"{chunk}\n\n")

    return srt_path
