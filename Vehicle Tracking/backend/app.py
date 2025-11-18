from fastapi import FastAPI, File, UploadFile, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
import io
import base64
import numpy as np
from PIL import Image, ImageDraw
from src.pipeline import Pipeline
from src.utils import load_config
import threading
import uuid
import time
import requests
from typing import Dict, Any
import os
import json
from fastapi.staticfiles import StaticFiles
from fastapi import HTTPException
from datetime import datetime




app = FastAPI(title="Vehicle Tracing & Alert System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


CONFIG = load_config('config/settings.yaml')
PIPE = Pipeline(CONFIG)

# Simple in-memory subscribers for alerts (simulation)
# subscribers (callables) kept for backwards compatibility; webhooks stored separately
ALERT_SUBSCRIBERS = []
ALERT_WEBHOOKS: list = []

# Pending reports waiting for mobile confirmation: report_id -> dict
PENDING_REPORTS: Dict[str, Dict[str, Any]] = {}
# Confirmation timeout (seconds)
CONFIRM_TIMEOUT = 40.0
REBUILD_IN_PROGRESS = False

def pil_to_base64(pil_image):
    """Convert PIL Image to base64 string."""
    buffered = io.BytesIO()
    pil_image.save(buffered, format="JPEG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    return f"data:image/jpeg;base64,{img_str}"

def draw_bbox_on_image(pil_image, bbox):
    """Draw bounding box on image and return new image."""
    img_copy = pil_image.copy()
    draw = ImageDraw.Draw(img_copy)
    x1, y1, x2, y2 = bbox
    draw.rectangle([x1, y1, x2, y2], outline="red", width=3)
    return img_copy

@app.get('/health')
def health():
    return {"status": "ok"}


# Serve camera feed images as static files
if not os.path.exists('Camera_feeds'):
    os.makedirs('Camera_feeds', exist_ok=True)
app.mount('/camera_feeds', StaticFiles(directory='Camera_feeds'), name='camera_feeds')


@app.get('/cameras')
def get_cameras():
    cfg_path = CONFIG.get('camera_config')
    try:
        with open(cfg_path, 'r') as f:
            cams = json.load(f)
        return cams
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load camera config: {e}")


@app.post('/camera')
def create_camera(payload: dict):
    """Create a new camera entry. Expects JSON with keys: camera_id, gps: [lat,lon], direction (opt), intersection (opt), address (opt).
    """
    camera_id = payload.get('camera_id')
    gps = payload.get('gps')
    direction = payload.get('direction')
    intersection = payload.get('intersection')
    address = payload.get('address')

    if not camera_id or not gps or len(gps) != 2:
        raise HTTPException(status_code=400, detail='camera_id and gps required')

    cfg_path = CONFIG.get('camera_config')
    try:
        with open(cfg_path, 'r') as f:
            cams = json.load(f)
    except Exception:
        cams = {}

    cams[camera_id] = {
        'gps': gps,
        'direction': direction or '',
        'intersection': intersection or '',
        'image_path': None,
        'last_frame_timestamp': None,
        'address': address or ''
    }

    # create camera feed folder
    folder = os.path.join('Camera_feeds', camera_id)
    os.makedirs(folder, exist_ok=True)

    # write back config
    with open(cfg_path, 'w') as f:
        json.dump(cams, f, indent=2)

    return {'created': True, 'camera_id': camera_id}


@app.post('/camera/{camera_id}/upload-frame')
async def upload_camera_frame(camera_id: str, image: UploadFile = File(...)):
    """Upload a frame for a camera; saves image, updates camera config, runs detection+embed and adds embedding(s) to FAISS index."""
    # ensure camera exists
    cfg_path = CONFIG.get('camera_config')
    try:
        with open(cfg_path, 'r') as f:
            cams = json.load(f)
    except Exception:
        cams = {}

    if camera_id not in cams:
        raise HTTPException(status_code=404, detail='camera not found')

    # read bytes and save file
    contents = await image.read()
    now = datetime.utcnow().strftime('%Y%m%dT%H%M%S')
    filename = f"frame_{now}.jpg"
    folder = os.path.join('Camera_feeds', camera_id)
    os.makedirs(folder, exist_ok=True)
    path = os.path.join(folder, filename)
    with open(path, 'wb') as f:
        f.write(contents)

    # update camera config
    cams[camera_id]['image_path'] = os.path.join('camera_feeds', camera_id, filename)
    cams[camera_id]['last_frame_timestamp'] = datetime.utcnow().isoformat() + 'Z'
    with open(cfg_path, 'w') as f:
        json.dump(cams, f, indent=2)

    # Detect vehicles in this camera frame and add embeddings to FAISS index
    try:
        pil_img = Image.open(path).convert('RGB')
        dets = PIPE.detector.detect(pil_img)
        added = []
        for det in dets:
            crop = det['crop']
            emb = PIPE.reid.extract(crop)
            meta = {
                'camera_id': camera_id,
                'bbox': det['bbox'],
                'image_path': os.path.join('camera_feeds', camera_id, filename),
                'gps': cams[camera_id].get('gps'),
                'direction': cams[camera_id].get('direction'),
                'intersection': cams[camera_id].get('intersection'),
                'score': det.get('score')
            }
            new_idx = PIPE.indexer.add(emb, meta)
            added.append({'idx': new_idx, 'camera_id': camera_id})

        # persist index/metadata
        PIPE.indexer.save()
    except Exception as e:
        print('Error adding embeddings for camera frame:', e)
        added = []

    return {'saved_path': cams[camera_id]['image_path'], 'added': added}

@app.post('/report-vehicle')
async def report_vehicle(
    image: UploadFile = File(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    timestamp: str = Form(...),
    direction: str = Form(None),  # Now optional
    severity: int = Form(...)
):
    """Endpoint mobile app calls to report a vehicle.
    Returns best matched camera and triggers alert to subscribers.
    Direction is now optional - if not provided, only GPS filtering is used.
    """
    # read image bytes
    img_bytes = await image.read()
    image_pil = Image.open(io.BytesIO(img_bytes)).convert('RGB')

    # run pipeline
    result = PIPE.find_matches(
        query_image=image_pil,
        gps=(latitude, longitude),
        direction=direction,
        timestamp=timestamp,
        severity=severity,
        top_k=5
    )

    # Prepare image data for frontend
    response_data = {
        'status': 'ok',
        'result': result.copy()
    }

    # Convert images to base64 if detection was successful
    if 'error' not in result:
        # Draw all detection bboxes on a copy of original image
        if 'detections' in result and isinstance(result['detections'], list):
            img_with_boxes = image_pil.copy()
            draw = ImageDraw.Draw(img_with_boxes)
            for d in result['detections']:
                try:
                    x1, y1, x2, y2 = d['bbox']
                    draw.rectangle([x1, y1, x2, y2], outline='red', width=3)
                except Exception:
                    pass
            response_data['result']['original_image_with_bbox'] = pil_to_base64(img_with_boxes)

        # Original image without bbox
        response_data['result']['original_image'] = pil_to_base64(image_pil)

        # Per-detection crops
        detected_vehicle_images = []
        if 'detections' in result:
            for d in result['detections']:
                try:
                    crop = d.get('detected_crop')
                    if crop is not None:
                        detected_vehicle_images.append(pil_to_base64(crop))
                        # remove PIL object so it's not returned directly
                        d.pop('detected_crop', None)
                except Exception:
                    detected_vehicle_images.append(None)
        # attach list (may be empty)
        response_data['result']['detected_vehicles'] = detected_vehicle_images

        # Add camera feed images for each match
        if 'matches' in result:
            for match in response_data['result']['matches']:
                if 'meta' in match and 'image_path' in match['meta']:
                    try:
                        cam_img_path = match['meta']['image_path']
                        cam_image = Image.open(cam_img_path).convert('RGB')

                        # If there's a bbox in metadata, crop it
                        if 'bbox' in match['meta']:
                            bbox = match['meta']['bbox']
                            cam_vehicle_crop = cam_image.crop(bbox)
                            match['camera_vehicle_image'] = pil_to_base64(cam_vehicle_crop)

                        # Also provide full camera image
                        match['camera_full_image'] = pil_to_base64(cam_image)
                    except Exception as e:
                        print(f"Error loading camera image: {e}")
                        match['camera_image_error'] = str(e)
    else:
        # In error path, still provide the original image and any detected crops if present
        response_data['result']['original_image'] = pil_to_base64(image_pil)
        if 'detections' in result and len(result['detections']) > 0:
            detected_vehicle_images = []
            for d in result['detections']:
                crop = d.get('detected_crop')
                if crop is not None:
                    detected_vehicle_images.append(pil_to_base64(crop))
                    d.pop('detected_crop', None)
            response_data['result']['detected_vehicles'] = detected_vehicle_images

    # build alert payload
    alert = {
        'camera_id': result.get('best_camera'),
        'similarity': result.get('best_similarity'),
        'gps': result.get('camera_location'),
        'timestamp': timestamp,
        'direction': direction,
        'severity': severity,
        'matches': result.get('matches', []),
        'detection_confidence': result.get('detection_confidence')
    }

    # dispatch to in-memory subscribers (callables)
    for sub in ALERT_SUBSCRIBERS:
        try:
            sub(alert)
        except Exception:
            pass

    # Create a report ID so mobile app can confirm which report it's responding to
    report_id = str(uuid.uuid4())
    alert_payload = alert.copy()
    alert_payload.update({'report_id': report_id, 'created_at': int(time.time())})

    # Store pending report and start confirmation timeout
    def _on_timeout(rid):
        pending = PENDING_REPORTS.pop(rid, None)
        if not pending:
            return
        final_alert = pending.get('alert_payload', {}).copy()
        final_alert.update({'no_confirmation': True, 'finalized_at': int(time.time())})

        # Broadcast to registered webhook URLs
        for url in list(ALERT_WEBHOOKS):
            try:
                requests.post(url, json=final_alert, timeout=5)
            except Exception:
                pass

        # Also call internal receive-alert endpoint so local logs update
        try:
            requests.post('http://127.0.0.1:8000/receive-alert', json=final_alert, timeout=5)
        except Exception:
            pass

    timer = threading.Timer(CONFIRM_TIMEOUT, lambda: _on_timeout(report_id))
    PENDING_REPORTS[report_id] = {'timer': timer, 'alert_payload': alert_payload}
    timer.daemon = True
    timer.start()

    # Include report metadata for the mobile app so it can POST confirmation
    response_data['result']['report_id'] = report_id
    response_data['result']['confirm_timeout'] = CONFIRM_TIMEOUT

    # Also provide top-3 matched camera images (if present) for quick mobile UI
    matches_list = response_data['result'].get('matches', [])
    response_data['result']['top_matches'] = matches_list[:3]

    # Notify internal receive-alert for visibility (non-blocking HTTP call)
    try:
        requests.post('http://127.0.0.1:8000/receive-alert', json=alert_payload, timeout=2)
    except Exception:
        pass

    return JSONResponse(content=response_data)


@app.get('/index/stats')
def index_stats():
    """Return basic index statistics (number of embeddings)."""
    try:
        stats = PIPE.indexer.stats()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post('/rebuild-index')
def rebuild_index():
    """Trigger a rebuild of the FAISS index by running `build_index.py` in the backend folder.
    This runs in a background thread and returns immediately.
    """
    global REBUILD_IN_PROGRESS
    if REBUILD_IN_PROGRESS:
        return {"started": False, "reason": "rebuild_already_in_progress"}

    def _run_build():
        global REBUILD_IN_PROGRESS
        REBUILD_IN_PROGRESS = True
        try:
            # run build_index.py as a subprocess so it doesn't interfere with server process state
            import subprocess
            backend_dir = os.path.dirname(os.path.abspath(__file__))
            subprocess.run(["python", os.path.join(backend_dir, '..', 'build_index.py')], cwd=backend_dir, timeout=600)
            # After rebuild completes, reload the index into the current Indexer instance
            try:
                PIPE.indexer.load()
            except Exception:
                pass
        except Exception as e:
            print('Rebuild index failed:', e)
        finally:
            REBUILD_IN_PROGRESS = False

    threading.Thread(target=_run_build, daemon=True).start()
    return {"started": True}

@app.post('/subscribe-alert')
async def subscribe_alert(payload: dict):
    """Register a webhook URL to receive alerts.
    Expected JSON: {"callback_url": "https://yourserver.example/alerts"}
    """
    callback_url = payload.get('callback_url') if isinstance(payload, dict) else None
    if callback_url:
        ALERT_WEBHOOKS.append(callback_url)
        return {"subscribed": True, "callback_url": callback_url}
    return {"subscribed": True}


@app.post('/confirm-detection')
async def confirm_detection(payload: dict):
    """Mobile app calls this to confirm which camera match (if any) is correct.
    Payload expected: {"report_id": "...", "selected_camera": "cam_A1" | null, "user_id": "..."}
    """
    report_id = payload.get('report_id')
    selected_camera = payload.get('selected_camera')
    user_id = payload.get('user_id')

    if not report_id:
        return JSONResponse(status_code=400, content={"error": "missing_report_id"})

    pending = PENDING_REPORTS.pop(report_id, None)
    if not pending:
        return JSONResponse(status_code=404, content={"error": "report_not_found_or_already_finalized"})

    try:
        pending['timer'].cancel()
    except Exception:
        pass

    final_alert = pending.get('alert_payload', {}).copy()
    final_alert.update({
        'user_confirmation': True,
        'selected_camera': selected_camera,
        'confirmed_by': user_id,
        'finalized_at': int(time.time())
    })

    # Broadcast to webhooks in background
    def _broadcast(a):
        for url in list(ALERT_WEBHOOKS):
            try:
                requests.post(url, json=a, timeout=5)
            except Exception:
                pass
        # also notify internal endpoint
        try:
            requests.post('http://127.0.0.1:8000/receive-alert', json=a, timeout=2)
        except Exception:
            pass

    threading.Thread(target=_broadcast, args=(final_alert,), daemon=True).start()

    return {"status": "confirmed", "report_id": report_id}

@app.post('/receive-alert')
async def receive_alert(payload: dict):
    """Simulate STO/CHASE receiving an alert (for testing)."""
    # In practice, this endpoint would be on STO/CHASE side. Here we just log.
    print("ALERT RECEIVED:", payload)
    return {"received": True}

if __name__ == '__main__':
    uvicorn.run(app, host='0.0.0.0', port=8000)
