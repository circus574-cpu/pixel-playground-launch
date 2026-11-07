#!/usr/bin/env python3
"""
Główny serwer sieciowy FastAPI dla KI Legends Animation Studio ("Kombajn do Animacji").
Nasłuchuje na 0.0.0.0:8090 (dostępny z przeglądarki na PC oraz na telefonie).
Zarządza 16 rdzeniami CPU, ekstrakcją MP4, kombinacjami klatek, efektami VFX,
transformacjami postaci, integracją z Blenderem oraz eksportem paczek KI Legends.
"""
from __future__ import annotations

import base64
import io
import json
import math
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2
import numpy as np
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .combinator_engine import (
    KI_DIRECTIONS,
    KI_STATE_SPECS,
    build_animation_combination,
    resample_sequence_length,
)
from .exporter_engine import (
    build_ki_legends_export_zip,
    create_animated_gif_bytes,
    create_spritesheet_image,
)
from .fx_transform_engine import process_sequence_fx_parallel
from .video_extractor import (
    CPU_WORKERS,
    base64_to_rgba,
    extract_video_to_frames,
    rgba_to_base64_png,
)

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
CONFIG_DIR = BASE_DIR / "config"
BLENDER_DIR = BASE_DIR / "blender"
WORKSPACE_DIR = Path(tempfile.gettempdir()) / "ki_animation_studio_projects"
WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="KI Legends Animation Studio — Kombajn 16 CPU",
    version="2.0.0",
    description="Kompletny system online do ekstrakcji MP4, kombinacji klatek, efektów VFX, transformacji postaci i eksportu atlasów.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if (FRONTEND_DIR / "css").exists():
    app.mount("/css", StaticFiles(directory=str(FRONTEND_DIR / "css")), name="css")
if (FRONTEND_DIR / "js").exists():
    app.mount("/js", StaticFiles(directory=str(FRONTEND_DIR / "js")), name="js")


class CombineRequest(BaseModel):
    frames_b64: List[str]
    mode: str = "forward"
    custom_indices: Optional[List[int]] = None
    target_count: Optional[int] = 8
    hit_stop_frame: int = 0
    hit_stop_hold: int = 2
    hit_stop_shake_px: int = 4
    crossfade_frames: int = 2
    speed_curve: str = "linear"
    use_optical_flow: bool = True


class FXTransformRequest(BaseModel):
    frames_b64: List[str]
    params: Dict[str, Any]


class ExportPackRequest(BaseModel):
    actor_id: str = "hero-planetary-custom"
    world: str = "verdant"
    profile: str = "hero"
    version: str = "1.0.0"
    cell_size: int = 256
    state_clips_b64: Dict[str, List[str]]
    fps_map: Optional[Dict[str, int]] = None


@app.get("/", response_class=HTMLResponse)
async def serve_studio_ui() -> HTMLResponse:
    index_path = FRONTEND_DIR / "index.html"
    if not index_path.exists():
        return HTMLResponse("<h1>Brak pliku frontend/index.html</h1>", status_code=500)
    return HTMLResponse(index_path.read_text(encoding="utf-8"))


@app.get("/api/system-status")
async def get_system_status() -> JSONResponse:
    blender_bin = shutil.which("blender")
    ffmpeg_bin = shutil.which("ffmpeg")

    studio_cfg = {}
    palettes_cfg = {}
    blender_cfg = {}
    if (CONFIG_DIR / "studio_config.json").exists():
        studio_cfg = json.loads((CONFIG_DIR / "studio_config.json").read_text(encoding="utf-8"))
    if (CONFIG_DIR / "race_palettes.json").exists():
        palettes_cfg = json.loads((CONFIG_DIR / "race_palettes.json").read_text(encoding="utf-8"))
    if (CONFIG_DIR / "blender_contract.json").exists():
        blender_cfg = json.loads((CONFIG_DIR / "blender_contract.json").read_text(encoding="utf-8"))

    return JSONResponse({
        "status": "online",
        "cpu_cores_detected": os.cpu_count() or 16,
        "cpu_workers_active": CPU_WORKERS,
        "blender_available": blender_bin is not None,
        "blender_path": blender_bin or "blender (tryb generowania skryptów)",
        "ffmpeg_available": ffmpeg_bin is not None,
        "studio_config": studio_cfg,
        "race_palettes": palettes_cfg,
        "blender_contract": blender_cfg,
    })


@app.post("/api/upload-video")
async def upload_and_extract_video(
    file: UploadFile = File(...),
    max_frames: int = Form(32),
    sample_fps: float = Form(16.0),
    bg_mode: str = Form("none"),
    tolerance: int = Form(38),
    canvas_size: int = Form(512),
    lock_feet: bool = Form(True),
    anchor_y: float = Form(0.95),
) -> JSONResponse:
    t0 = time.time()
    ext = Path(file.filename or "video.mp4").suffix.lower() or ".mp4"
    job_id = uuid.uuid4().hex[:10]
    temp_video_path = WORKSPACE_DIR / f"upload_{job_id}{ext}"

    try:
        content = await file.read()
        temp_video_path.write_bytes(content)

        extracted = extract_video_to_frames(
            video_path=temp_video_path,
            max_frames=max(1, min(128, max_frames)),
            sample_fps=sample_fps if sample_fps > 0 else None,
            bg_mode=bg_mode,
            tolerance=tolerance,
            canvas_size=canvas_size,
            lock_feet=lock_feet,
            anchor_y=anchor_y,
        )
        extracted["processing_time_sec"] = round(time.time() - t0, 2)
        extracted["filename"] = file.filename
        return JSONResponse(extracted)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Błąd ekstrakcji wideo: {exc}") from exc
    finally:
        if temp_video_path.exists():
            try:
                temp_video_path.unlink()
            except OSError:
                pass


@app.post("/api/combine-frames")
async def api_combine_frames(req: CombineRequest) -> JSONResponse:
    t0 = time.time()
    if not req.frames_b64:
        raise HTTPException(status_code=400, detail="Brak klatek wejściowych do kombinacji.")

    rgba_frames = [base64_to_rgba(b64) for b64 in req.frames_b64]
    combined = build_animation_combination(
        frames=rgba_frames,
        mode=req.mode,
        custom_indices=req.custom_indices,
        target_count=req.target_count,
        hit_stop_frame=req.hit_stop_frame,
        hit_stop_hold=req.hit_stop_hold,
        hit_stop_shake_px=req.hit_stop_shake_px,
        crossfade_frames=req.crossfade_frames,
        speed_curve=req.speed_curve,
        use_optical_flow=req.use_optical_flow,
    )

    out_b64 = [rgba_to_base64_png(f) for f in combined]
    return JSONResponse({
        "mode": req.mode,
        "count": len(out_b64),
        "processing_time_sec": round(time.time() - t0, 2),
        "frames_b64": out_b64,
    })


@app.post("/api/apply-fx-transform")
async def api_apply_fx_transform(req: FXTransformRequest) -> JSONResponse:
    t0 = time.time()
    if not req.frames_b64:
        raise HTTPException(status_code=400, detail="Brak klatek wejściowych do nałożenia efektów.")

    rgba_frames = [base64_to_rgba(b64) for b64 in req.frames_b64]
    processed = process_sequence_fx_parallel(rgba_frames, req.params)
    out_b64 = [rgba_to_base64_png(f) for f in processed]

    return JSONResponse({
        "count": len(out_b64),
        "cpu_workers_used": CPU_WORKERS,
        "processing_time_sec": round(time.time() - t0, 2),
        "frames_b64": out_b64,
    })


@app.post("/api/export-pack")
async def api_export_pack(req: ExportPackRequest) -> Response:
    if not req.state_clips_b64:
        raise HTTPException(status_code=400, detail="Brak klipów stanów do eksportu paczki.")

    state_clips_rgba: Dict[str, List[np.ndarray]] = {}
    for state_name, b64_list in req.state_clips_b64.items():
        if b64_list:
            state_clips_rgba[state_name] = [base64_to_rgba(b) for b in b64_list]

    zip_bytes = build_ki_legends_export_zip(
        state_clips=state_clips_rgba,
        actor_id=req.actor_id,
        world=req.world,
        profile=req.profile,
        version=req.version,
        cell_size=req.cell_size,
        fps_map=req.fps_map,
    )

    filename = f"{req.actor_id}-{req.version}-ki-pack.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.post("/api/export-gif")
async def api_export_gif(
    frames_b64: List[str] = Form(...),
    fps: int = Form(12),
) -> Response:
    rgba_frames = [base64_to_rgba(b) for b in frames_b64]
    gif_bytes = create_animated_gif_bytes(rgba_frames, fps=fps)
    return Response(
        content=gif_bytes,
        media_type="image/gif",
        headers={"Content-Disposition": 'attachment; filename="animation.gif"'},
    )


@app.get("/api/blender-scripts/{script_name}")
async def download_blender_script(script_name: str) -> Response:
    safe_name = Path(script_name).name
    target = BLENDER_DIR / safe_name
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"Nie znaleziono skryptu Blendera: {safe_name}")
    return FileResponse(
        path=str(target),
        filename=safe_name,
        media_type="text/x-python",
    )
