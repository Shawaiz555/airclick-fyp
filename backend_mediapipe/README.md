# AirClick MediaPipe Backend

## Overview
Python service that provides real-time hand tracking using MediaPipe and OpenCV. Streams hand landmark data to the frontend via WebSocket.

## Architecture
```
Camera (OpenCV) → MediaPipe Processing → WebSocket Server (Port 8765) → Next.js Frontend
```

## Installation

### 1. Install Python Dependencies
```bash
cd backend_mediapipe
pip install -r requirements.txt
```

### 2. Run the Service
```bash
python hand_tracking_service.py
```

You should see:
```
============================================================
  AirClick - Hand Tracking Service
  Real-time MediaPipe Hand Landmark Detection
============================================================

2025-01-18 20:00:00 - INFO - Initializing Hand Tracking Service...
2025-01-18 20:00:00 - INFO - Camera initialized successfully
2025-01-18 20:00:00 - INFO - Starting WebSocket server on ws://localhost:8765
2025-01-18 20:00:00 - INFO - ✓ Server started successfully!
2025-01-18 20:00:00 - INFO - ✓ Camera is active and tracking hands
2025-01-18 20:00:00 - INFO - ✓ Waiting for frontend connections...
```

## Features

### Hand Detection
- Detects up to 2 hands simultaneously
- 21 landmark points per hand
- Left/Right hand classification
- Real-time processing at 30 FPS

### Data Format
Sends JSON data via WebSocket:
```json
{
  "timestamp": "2025-01-18T20:00:00.123456",
  "hand_count": 1,
  "hands": [{
    "handedness": "Right",
    "confidence": 0.95,
    "landmark_count": 21,
    "landmarks": [
      {"x": 0.5, "y": 0.5, "z": 0.0},
      ...
    ]
  }],
  "frame_size": {
    "width": 640,
    "height": 480
  }
}
```

## Building .exe

To create a standalone executable:

```bash
# Install PyInstaller
pip install pyinstaller

# Build exe
pyinstaller --onefile --windowed --name AirClick-HandTracking hand_tracking_service.py

# Output: dist/AirClick-HandTracking.exe
```

## Troubleshooting

### Camera Not Found
- Check if camera is connected
- Try different camera_index (0, 1, 2...)
- Close other apps using the camera

### Port Already in Use
- Change port in `start_server(port=8765)`
- Update frontend WebSocket URL accordingly

### High CPU Usage
- Reduce FPS in `asyncio.sleep(0.033)`
- Lower camera resolution
- Reduce `max_num_hands`

## Configuration

Edit `hand_tracking_service.py`:

```python
# Camera settings
camera_index = 0              # Change camera (0, 1, 2...)
frame_width = 640            # Resolution width
frame_height = 480           # Resolution height
fps = 30                     # Frames per second

# MediaPipe settings
max_num_hands = 2            # Maximum hands to detect
min_detection_confidence = 0.5  # Detection threshold
min_tracking_confidence = 0.5   # Tracking threshold

# Server settings
host = "localhost"           # Server host
port = 8765                  # Server port
```
