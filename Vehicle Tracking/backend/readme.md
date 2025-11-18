## File: `README.md`

````markdown
# Vehicle Tracing & Alert System — Backend (MVP)

## Description
This backend accepts vehicle reports (image + gps + timestamp + direction + severity), finds the most likely camera that saw the vehicle using pretrained detection and ReID models, and broadcasts an alert payload.

## Setup
1. Create a Python 3.10+ virtualenv and activate it.
2. Install dependencies:

```bash
pip install -r requirements.txt
````

3. Place pretrained weights in `models/` as specified in `config/settings.yaml`.

   * `models/yolo/yolov8s.pt` (or installed ultralytics default)
   * `models/reid/vehicle_reid_model.pth` (optional; fallback uses torchvision resnet50)

4. Prepare `camera_feeds/` images and `config/cameras.json` with camera metadata.

5. Build FAISS index (you can write a simple script to run detection + reid on camera_feeds and save embeddings/meta into `embeddings/`).

## Run

```bash
uvicorn backend.app:app --reload --port 8000
```

## API

### POST /report-vehicle

Form data:

* image: file
* latitude: float
* longitude: float
* timestamp: string (ISO)
* direction: string (e.g., north-east)
* severity: int 1..5

Response: JSON with best_camera, similarity, matches, etc.

---

```

---

# Notes & next steps
- The provided code focuses on clarity and an MVP path. For production, add authentication, error handling, persistent subscriptions, and a robust FAISS build script.
- If you want, I can now generate:
  - a `build_index.py` script that processes `camera_feeds/` and populates FAISS + metadata
  - a small HTML Leaflet map that uses `config/cameras.json` and highlights cameras when the backend returns a match
  - sample camera images to test

---

_End of document._

```
