# 🚗 Vehicle Tracing & Alert System MVP - Complete Documentation

## Overview

This is a complete FastAPI-based backend system for vehicle tracing and alert management. The system uses state-of-the-art AI models to detect vehicles, extract unique embeddings, and match them against a database of camera feeds using FAISS similarity search.

## 🎯 Key Features

### 1. **Vehicle Detection**
- Uses **YOLOv8** pretrained model for accurate vehicle detection
- Detects multiple vehicles and selects the highest confidence detection
- Returns bounding box coordinates and confidence scores

### 2. **ReID Embedding Extraction**
- Uses **TorchReID** (ResNet50 backbone) for vehicle re-identification
- Extracts 2048-dimensional embeddings for each detected vehicle
- Normalized embeddings for better similarity comparison

### 3. **Smart Camera Filtering**
- **GPS Proximity**: Filters cameras within configurable distance (default: 2000m)
- **Direction Alignment**: Matches camera direction with vehicle movement (±60° tolerance)
- **Timestamp Window**: Considers temporal proximity (default: 180 seconds)

### 4. **FAISS Similarity Search**
- Fast approximate nearest neighbor search using FAISS IndexFlatL2
- Compares query vehicle embedding with preprocessed camera feed embeddings
- Returns top-k matches with similarity scores

### 5. **Alert System**
- Triggers alerts to STO/CHASE units with:
  - Matched camera location
  - Severity level (1-5)
  - Timestamp and direction
  - Similarity score and confidence metrics

### 6. **Enhanced Frontend**
- Beautiful, responsive UI with real-time results
- Side-by-side image comparison (uploaded vs detected)
- Comprehensive accuracy metrics display
- Visual detection with bounding boxes
- Detailed match information with similarity scores

## 📁 Project Structure

```
Vehicle Tracking/
├── backend/
│   ├── app.py                      # Main FastAPI application
│   ├── build_index.py              # Script to build FAISS index
│   ├── requirements.txt            # Python dependencies
│   ├── config/
│   │   ├── settings.yaml           # Configuration file
│   │   └── cameras.json            # Camera metadata
│   ├── src/
│   │   ├── detector.py             # YOLOv8 vehicle detector
│   │   ├── reid_extractor.py       # TorchReID embedding extractor
│   │   ├── indexer.py              # FAISS index manager
│   │   ├── pipeline.py             # Main processing pipeline
│   │   └── utils.py                # Utility functions
│   ├── models/
│   │   └── yolo/
│   │       └── yolov8s.pt          # YOLOv8 weights
│   ├── embeddings/
│   │   ├── faiss_index.bin         # FAISS index file
│   │   └── metadata.json           # Camera embeddings metadata
│   └── camera_feeds/               # Camera feed images
│       ├── cam_A1/
│       ├── cam_B1/
│       └── cam_C1/
└── mobile-map/
    ├── test_report.html            # Enhanced testing interface
    ├── report.js                   # Report submission logic
    └── cameras.json                # Camera locations for map

```

## 🚀 API Endpoints

### 1. POST `/report-vehicle`

**Description**: Main endpoint for vehicle reporting and matching

**Request Format**: `multipart/form-data`

**Parameters**:
- `image` (file): Vehicle image file
- `latitude` (float): GPS latitude
- `longitude` (float): GPS longitude
- `timestamp` (string): ISO timestamp
- `direction` (string): Direction (north/south/east/west/north-east/etc.)
- `severity` (int): Priority level 1-5

**Response**:
```json
{
  "status": "ok",
  "result": {
    "best_camera": "cam_A1",
    "best_similarity": 0.8523,
    "camera_location": [21.229001, 81.678221],
    "detection_count": 1,
    "detection_confidence": 0.92,
    "detection_bbox": [120, 80, 450, 320],
    "original_image": "data:image/jpeg;base64,...",
    "original_image_with_bbox": "data:image/jpeg;base64,...",
    "detected_vehicle_image": "data:image/jpeg;base64,...",
    "matches": [
      {
        "camera_id": "cam_A1",
        "distance": 0.1234,
        "similarity": 0.8523,
        "meta": {
          "gps": [21.229001, 81.678221],
          "direction": "east",
          "intersection": "A"
        }
      }
    ],
    "severity": 3
  }
}
```

### 2. POST `/receive-alert`

**Description**: Simulates STO/CHASE receiving alerts

**Request Format**: `application/json`

**Response**:
```json
{
  "received": true
}
```

### 3. GET `/health`

**Description**: Health check endpoint

**Response**:
```json
{
  "status": "ok"
}
```

## 🔧 Configuration

### `config/settings.yaml`

```yaml
models:
  yolo_model: "models/yolo/yolov8s.pt"
  reid_model: "models/reid/vehicle_reid_model.pth"

faiss:
  index_path: "embeddings/faiss_index.bin"
  meta_path: "embeddings/metadata.json"
  embedding_dim: 2048

camera_config: "config/cameras.json"

filters:
  max_distance_meters: 2000        # GPS proximity filter
  direction_tolerance_deg: 60      # Direction alignment tolerance
  time_window_seconds: 180         # Timestamp window

similarity_threshold: 0.55         # Minimum similarity for match

device: "cpu"                      # Use "cuda" for GPU
```

## 📊 Accuracy Metrics

The system provides comprehensive accuracy metrics:

1. **Detection Confidence**: YOLOv8 confidence score (0-1)
2. **Similarity Score**: ReID embedding similarity (0-1)
   - Formula: `1.0 / (1.0 + L2_distance)`
3. **Distance Score**: L2 distance in embedding space
4. **Match Count**: Number of potential camera matches

### Interpretation:
- **High Confidence** (≥70%): Strong match, high reliability
- **Medium Confidence** (40-70%): Moderate match, requires verification
- **Low Confidence** (<40%): Weak match, manual review recommended

## 🛠️ Setup & Installation

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Build FAISS Index

```bash
python build_index.py
```

This will:
- Process all camera feed images
- Detect vehicles using YOLOv8
- Extract ReID embeddings
- Build and save FAISS index

### 3. Run Backend Server

```bash
uvicorn app:app --reload --port 8000
```

### 4. Open Frontend

Open `mobile-map/test_report.html` in a web browser

## 🧪 Testing

1. **Open the test interface**: `mobile-map/test_report.html`
2. **Upload a vehicle image**
3. **Set GPS coordinates** (default: 21.229001, 81.678221)
4. **Select direction** (e.g., east, north)
5. **Set severity level** (1-5)
6. **Click "Analyze & Match Vehicle"**

The system will:
- Display the uploaded image with detection bounding box
- Show the detected vehicle crop
- Display accuracy metrics (detection confidence, similarity score)
- List all matching cameras with detailed information

## 🎨 Frontend Features

### Visual Components:
- **Gradient background** with modern design
- **Responsive grid layout** for metrics
- **Side-by-side image comparison**
- **Color-coded confidence levels**:
  - 🟢 Green: High confidence (≥70%)
  - 🟡 Yellow: Medium confidence (40-70%)
  - 🔴 Red: Low confidence (<40%)
- **Animated results** with smooth transitions
- **Detailed match cards** with hover effects

## 🔍 How It Works

### Processing Pipeline:

1. **Image Upload** → User submits vehicle image with metadata
2. **Vehicle Detection** → YOLOv8 detects vehicles and extracts bounding boxes
3. **Embedding Extraction** → TorchReID extracts 2048-dim embedding from detected vehicle
4. **Camera Filtering** → Filters cameras by GPS, direction, and timestamp
5. **Similarity Search** → FAISS finds top-k most similar embeddings
6. **Result Ranking** → Ranks matches by similarity score
7. **Alert Dispatch** → Sends alert to STO/CHASE units
8. **Frontend Display** → Shows results with images and metrics

## 📈 Performance

- **Detection Speed**: ~140-200ms per image (CPU)
- **Embedding Extraction**: ~50-100ms per vehicle
- **FAISS Search**: <10ms for 1000s of embeddings
- **Total Processing Time**: ~300-500ms per request

## 🔐 Security Considerations

- CORS enabled for development (restrict in production)
- No authentication (add JWT/OAuth in production)
- File upload validation needed
- Rate limiting recommended

## 🚀 Future Enhancements

1. **GPU Acceleration** for faster processing
2. **Real-time camera feed processing**
3. **Multi-vehicle tracking** across cameras
4. **Historical trajectory analysis**
5. **Advanced filtering** (vehicle type, color, etc.)
6. **WebSocket alerts** for real-time notifications
7. **Database integration** for persistent storage
8. **User authentication** and role-based access

## 📝 License

This is an MVP system for demonstration purposes.

---

**Built with**: FastAPI, YOLOv8, TorchReID, FAISS, and modern web technologies

