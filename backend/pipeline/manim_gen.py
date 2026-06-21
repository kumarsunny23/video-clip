import os
import subprocess
import tempfile
import sys
import shutil
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

async def render_manim_scene(manim_code: str, scene_name: str, output_dir: str) -> str:
    """
    Saves Manim code to a temporary file, runs Manim renderer, and returns
    the file path of the generated MP4.
    If Manim isn't installed or fails, falls back to generating a beautiful
    placeholder video using FFmpeg.
    """
    os.makedirs(output_dir, exist_ok=True)
    temp_dir = tempfile.mkdtemp()
    
    script_path = os.path.join(temp_dir, "scene.py")
    with open(script_path, "w", encoding="utf-8") as f:
        # Ensure we have standard imports
        header = "from manim import *\n\n"
        f.write(header + manim_code)

    # Determine class name to render
    # Typically, class is found in the code e.g. "class BinarySearchDemo(Scene):"
    import re
    class_match = re.search(r"class\s+(\w+)\s*\(", manim_code)
    class_name = class_match.group(1) if class_match else "EducationalVideo"

    # We try to run manim via CLI: manim -qp scene.py ClassName -o output_name
    output_filename = f"{scene_name}.mp4"
    rendered_path = None

    try:
        # Run manim command
        # -q l (low quality for fast rendering), or -q m (medium quality)
        cmd = [
            sys.executable, "-m", "manim",
            "-ql",
            "--media_dir", temp_dir,
            script_path,
            class_name
        ]
        
        logger.info(f"Running Manim command: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
        
        if result.returncode == 0:
            # Locate rendered file in temp_dir
            # Typically Manim puts it in: temp_dir/videos/scene/480p15/ClassName.mp4
            # Let's search recursively for .mp4 files inside temp_dir
            for root, _, files in os.walk(temp_dir):
                for file in files:
                    if file.endswith(".mp4") and class_name in file:
                        src_path = os.path.join(root, file)
                        dest_path = os.path.join(output_dir, output_filename)
                        shutil.copy2(src_path, dest_path)
                        rendered_path = dest_path
                        break
                if rendered_path:
                    break
        else:
            logger.error(f"Manim error output: {result.stderr}")
            
    except Exception as e:
        logger.error(f"Failed to run Manim: {e}")

    # Fallback if Manim is not installed or fails
    if not rendered_path or not os.path.exists(rendered_path):
        logger.warning("Manim rendering failed or skipped. Creating a simulated visual showcase using FFmpeg.")
        dest_path = os.path.join(output_dir, output_filename)
        
        # We can build a beautiful video with gradient/solid background and title using ffmpeg directly
        # This acts as a robust failover.
        # We try to use Arial font on Windows, and escape it properly.
        font_path = "C\\:/Windows/Fonts/arial.ttf"
        clean_name = scene_name.replace(":", " -")
        ffmpeg_cmd = [
            "ffmpeg", "-y",
            "-f", "lavfi",
            "-i", "color=c=0x1a1a2e:s=854x480:d=10:r=25", # dark navy color
            "-vf", f"drawtext=fontfile='{font_path}':text='Visual Scene - {clean_name}':fontcolor=white:fontsize=28:x=(w-text_w)/2:y=(h-text_h)/2",
            "-pix_fmt", "yuv420p",
            dest_path
        ]
        
        try:
            logger.info(f"Executing FFmpeg text video fallback: {' '.join(ffmpeg_cmd)}")
            res = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=15)
            if res.returncode == 0 and os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
                rendered_path = dest_path
            else:
                logger.warning(f"FFmpeg drawtext fallback failed (code {res.returncode if res else 'None'}): {res.stderr if res else ''}. Trying solid color...")
                # Solid color fallback (no drawtext filters to fail)
                ffmpeg_cmd_solid = [
                    "ffmpeg", "-y",
                    "-f", "lavfi",
                    "-i", "color=c=0x1a1a2e:s=854x480:d=10:r=25",
                    "-pix_fmt", "yuv420p",
                    dest_path
                ]
                res_solid = subprocess.run(ffmpeg_cmd_solid, capture_output=True, text=True, timeout=15)
                if res_solid.returncode == 0 and os.path.exists(dest_path) and os.path.getsize(dest_path) > 0:
                    rendered_path = dest_path
                else:
                    logger.error(f"FFmpeg solid color fallback failed: {res_solid.stderr if res_solid else ''}")
                    # Absolute worst-case scenario fallback
                    rendered_path = dest_path
                    with open(rendered_path, "wb") as f:
                        f.write(b"")
        except Exception as fe:
            logger.error(f"FFmpeg fallback exception: {fe}")
            rendered_path = dest_path
            try:
                with open(rendered_path, "wb") as f:
                    f.write(b"")
            except Exception:
                pass
                
    # Clean up temp files
    try:
        shutil.rmtree(temp_dir)
    except Exception:
        pass

    return rendered_path

