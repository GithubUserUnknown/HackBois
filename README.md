# 🚦 Smart City Traffic Management & Vehicle Tracing System

[![Python](https://img.shields.io/badge/Python-3.8%2B-blue)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)](https://nodejs.org/)
[![SUMO](https://img.shields.io/badge/SUMO-1.20%2B-orange)](https://www.eclipse.org/sumo/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100%2B-red)](https://fastapi.tiangolo.com/)

---

## 🧩 Problem We Set Out to Solve

Traffic in growing cities isn't just about long queues at intersections—it's also about safety, response time, and situational awareness. Today, when a crime involves a vehicle or when congestion spikes unexpectedly, authorities are forced to react after the damage is already done.

We wanted to build a system that could give cities:

- **Real-time, adaptive traffic signals** that learn and optimize themselves
- **Instant vehicle tracing**, whether through a number plate or just an image of the car
- **A unified intelligence layer** that makes roads safer and traffic smoother

Urban traffic shouldn't be guesswork. It should be smart, predictive, and actionable—and that's exactly what we set out to create.

---

## 🏆 What Our Solution Brings

### 🚦 Reinforcement-Learning Traffic Control
The system observes live vehicle flow and adapts the signal phases dynamically, reducing idle time, cutting congestion, and improving overall efficiency.

### 🔍 High-Accuracy Number Plate Tracing
Using optimized OCR + detection pipelines, we can track a vehicle through its number plate with extremely high accuracy.

### 🚗 Image-Based Vehicle Tracing (Fallback Matching)
When the plate isn't visible, we match vehicles using only their image—make, color, pattern—slightly less accurate but incredibly powerful in real scenarios.

### 🛡️ Real-Time Crime Prevention & Rapid Response
Stolen vehicle? Hit-and-run? Our system can help pinpoint the vehicle's last known location and possible routes in seconds.

Together, it becomes a city-scale traffic intelligence platform.

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SMART CITY TRAFFIC SYSTEM                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│  │   Traffic       │    │   Vehicle       │    │   Unified   │  │
│  │   Management    │    │   Tracing      │    │   Dashboard │  │
│  │   (RL + SUMO)   │    │   (AI Models)   │    │   (Web UI)  │  │
│  └─────────────────┘    └─────────────────┘    └─────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│  │   SUMO          │    │   FastAPI       │    │   React/    │  │
│  │   Simulation    │    │   Backend       │    │   Vite      │  │
│  └─────────────────┘    └─────────────────┘    └─────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐  │
│  │   PPO Agents    │    │   YOLOv8 +      │    │   Real-time │  │
│  │   (9 Inter-     │    │   TorchReID     │    │   Analytics │  │
│  │    sections)    │    │   + FAISS       │    │             │  │
│  └─────────────────┘    └─────────────────┘    └─────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📦 Core Components

### 1. **Traffic Frontend** (`/Traffic Frontend/`)
A comprehensive web dashboard for traffic management and simulation.

#### Features:
- **Interactive Traffic Dashboard**: Real-time visualization of traffic flow
- **Reinforcement Learning Control**: PPO agents managing 9-intersection grid
- **SUMO Integration**: Realistic traffic simulation
- **Analytics Dashboard**: Performance metrics and insights
- **Simulation Panel**: Control and monitor traffic scenarios

#### Tech Stack:
- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend**: Node.js + Express
- **Simulation**: SUMO (Simulation of Urban MObility)
- **AI**: PyTorch + Stable Baselines3

### 2. **Vehicle Tracking** (`/Vehicle Tracking/`)
AI-powered vehicle detection and tracing system.

#### Features:
- **Vehicle Detection**: YOLOv8 for accurate vehicle identification
- **ReID Embeddings**: TorchReID for vehicle re-identification
- **Similarity Search**: FAISS for fast vehicle matching
- **Smart Filtering**: GPS, direction, and temporal filtering
- **Alert System**: Real-time notifications to authorities

#### Tech Stack:
- **Backend**: FastAPI (Python)
- **AI Models**: YOLOv8, TorchReID, FAISS
- **Frontend**: HTML5 + CSS3 + JavaScript
- **Data**: JSON configuration + image processing

---

## 🔧 Challenges We Ran Into

### 1. Training RL Agents in a "Messy" Real-World Simulator
SUMO doesn't behave like a perfect world—and neither do cities. We had to handle weird traffic spikes, inconsistent lane behavior, and tuning reward functions that didn't break the system. It took a ton of trial, error, and retraining to get stable, intelligent signal behavior.

### 2. Achieving High Accuracy on Number Plates
Number plates come in all shapes, fonts, noise levels, and angles. We had to fight low-resolution plates, glare/reflection, and motion blur. We ended up building a tighter detection-to-OCR pipeline and fine-tuning thresholds to get "real-world-friendly" accuracy.

### 3. Matching Vehicles by Image Alone
This was the toughest cognitive task. Cars with similar colors/models often confused the model, and lighting changes made things worse. We improved it using multi-feature embeddings, color histograms, and shape-based clues. It's still slightly less accurate—but it's a game-changer when plates aren't readable.

### 4. Integrating Everything Into One Flow
RL + SUMO + OCR + CV models → all running together in real time. Syncing that pipeline without lag or crashes became its own engineering challenge.

---

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- Node.js 18+
- SUMO 1.20+
- Git

### 1. Clone the Repository
```bash
git clone <repository-url>
cd hackbois
```

### 2. Set Up Traffic Frontend
```bash
cd "Traffic Frontend"
npm install
npm run dev
```

### 3. Set Up Vehicle Tracking Backend
```bash
cd "../Vehicle Tracking/backend"
pip install -r requirements.txt
python build_index.py  # Build FAISS index
uvicorn app:app --reload --port 8000
```

### 4. Access the Systems
- **Traffic Dashboard**: http://localhost:5173
- **Vehicle Tracking**: Open `Vehicle Tracking/mobile-map/test_report.html`

---

## 📊 Performance Metrics

### Traffic Management
| Controller | Avg Reward | EV Delay (s) | Throughput |
|------------|-----------|--------------|------------|
| Fixed-Time | -1500     | 45.2         | Low        |
| Actuated   | -1200     | 38.5         | Medium     |
| **PPO-RL** | **-800**  | **25.3**     | **High**   |

### Vehicle Tracing
- **Detection Accuracy**: 85-95% (YOLOv8 confidence)
- **ReID Similarity**: 70-90% for same vehicle
- **Processing Time**: 300-500ms per request
- **False Positive Rate**: Low (<5%)

---

## 📁 Project Structure

```
hackbois/
├── Traffic Frontend/              # React dashboard + RL traffic control
│   ├── src/
│   │   ├── components/           # React components
│   │   ├── hooks/               # Custom hooks
│   │   └── services/            # API services
│   ├── server/                  # Node.js backend
│   └── Traffic Reinforcement/   # SUMO + PPO agents
│       ├── models/              # Trained RL models
│       ├── logs/                # Training logs
│       └── runs/                # Simulation runs
├── Vehicle Tracking/            # AI vehicle tracing system
│   ├── backend/                 # FastAPI server
│   │   ├── src/                 # Core processing modules
│   │   ├── models/              # AI model weights
│   │   └── embeddings/          # FAISS index & metadata
│   └── mobile-map/              # Testing interface
├── .gitattributes
├── LICENSE
└── README.md                    # This file
```

---

## 🛠️ Development

### Traffic Frontend Development
```bash
cd "Traffic Frontend"
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Vehicle Tracking Development
```bash
cd "Vehicle Tracking/backend"
uvicorn app:app --reload --port 8000  # Start API server
# Open mobile-map/test_report.html for testing
```

### Running SUMO Simulations
```bash
cd "Traffic Frontend/Traffic Reinforcement"
python train_ppo_agent.py     # Train RL agents
python sumo_api_server.py    # Start SUMO API server
```

---

## 📚 Documentation

- **[Traffic Frontend README](Traffic%20Frontend/README.md)**: Dashboard setup and usage
- **[Traffic RL README](Traffic%20Frontend/Traffic%20Reinforcement/README.md)**: Reinforcement learning system guide
- **[Vehicle Tracking Implementation](Vehicle%20Tracking/IMPLEMENTATION_SUMMARY.md)**: Vehicle tracing system details
- **[Vehicle Tracking Documentation](Vehicle%20Tracking/SYSTEM_DOCUMENTATION.md)**: Complete API and architecture guide
- **[Testing Guide](Vehicle%20Tracking/TESTING_GUIDE.md)**: Comprehensive testing instructions

---

## 🤝 Contributing

We welcome contributions! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

This project was developed during the **HackBois 2025 Hackathon** conducted at SSIMPT Bhilai. We would like to thank the organizers for providing an excellent platform to innovate and collaborate.

- **SUMO** (Simulation of Urban MObility) - Traffic simulation platform
- **PyTorch** - Deep learning framework
- **FastAPI** - High-performance API framework
- **YOLOv8** - State-of-the-art object detection
- **FAISS** - Efficient similarity search

---

## 📧 Contact

For questions or issues, please open an issue on GitHub.

---

**Made with ❤️ for smarter, safer cities**
