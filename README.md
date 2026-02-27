# AirClick - Hand Gesture Recognition System

A full-stack desktop application that enables touchless device control through real-time hand gesture recognition using computer vision and machine learning.

## 🚀 Project Overview

AirClick uses Python MediaPipe for hand tracking and machine learning models to recognize custom gestures and map them to device actions (media control, app navigation, system commands). Built with Next.js, FastAPI, Python MediaPipe, and Supabase PostgreSQL.

## ✨ Features

- **Real-time Hand Tracking**: 21-point hand landmark detection using Python MediaPipe
- **WebSocket Communication**: Real-time streaming of hand data (30 FPS)
- **Custom Gesture Recording**: Record and save your own gestures
- **User Authentication**: Secure JWT-based authentication
- **Role-Based Access**: User and Admin roles
- **Context-Aware Control**: Different gestures for different applications
- **Cloud Sync**: Gestures stored in Supabase PostgreSQL
- **Admin Dashboard**: User management and analytics
- **Desktop Application**: Native Python backend with web UI

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│              AirClick Desktop Application            │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────┐                               │
│  │ Python MediaPipe │  WebSocket (Port 8765)        │
│  │   Hand Tracking  │  ────────────┐                │
│  │  OpenCV Camera   │              │                │
│  └──────────────────┘              │                │
│          │                          ▼                │
│          │                  ┌───────────────┐       │
│          │                  │   Next.js     │       │
│          │                  │   Frontend    │       │
│          │                  │  (Port 3000)  │       │
│          │                  └───────┬───────┘       │
│          │                          │                │
│          │                          │ REST API       │
│          │                          ▼                │
│          │                  ┌───────────────┐       │
│          └─────────────────>│    FastAPI    │       │
│                              │    Backend    │       │
│                              │  (Port 8000)  │       │
│                              └───────┬───────┘       │
│                                      │                │
│                                      ▼                │
│                              ┌───────────────┐       │
│                              │   Supabase    │       │
│                              │  PostgreSQL   │       │
│                              └───────────────┘       │
└─────────────────────────────────────────────────────┘
```

## 🛠️ Technology Stack

### Frontend
- **Next.js 15** - React framework
- **React 19** - UI library
- **WebSocket Client** - Real-time hand data reception
- **Tailwind CSS 4** - Styling
- **Recharts** - Data visualization

### Backend Services

#### 1. Python MediaPipe Service (Port 8765)
- **Python 3.10+** - Runtime
- **MediaPipe** - Hand landmark detection
- **OpenCV** - Camera access
- **WebSockets** - Real-time data streaming

#### 2. FastAPI Backend (Port 8000)
- **FastAPI** - Python web framework
- **SQLAlchemy** - ORM
- **Pydantic** - Data validation
- **JWT** - Authentication
- **Bcrypt** - Password hashing

### Database
- **Supabase** - Managed PostgreSQL with JSONB support

## 📦 Installation

### Prerequisites
- **Python 3.10+** and pip
- **Node.js 18+** and npm
- **Webcam/Camera**
- **Supabase account** (free tier)

### Quick Start

#### 1. Clone Repository
```bash
git clone <your-repo-url>
cd airclick-fyp
```

#### 2. Install Python MediaPipe Dependencies
```bash
cd backend_mediapipe
pip install -r requirements.txt
cd ..
```

#### 3. Setup FastAPI Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
source venv/bin/activate  # Mac/Linux
pip install -r requirements.txt
```

#### 4. Configure Supabase
- Create project at [supabase.com](https://supabase.com)
- Run `backend/supabase_setup.sql` in Supabase SQL Editor
- Copy connection string to `backend/.env`

#### 5. Install Frontend Dependencies
```bash
cd ..
npm install
```

## 🚀 Running the Application

### Option 1: Quick Start (Recommended)

**Start All Services:**

Windows:
```bash
start-all.bat
```

Linux/Mac:
```bash
./start-all.sh
```

This will open separate windows for:
1. Backend Server (FastAPI + MediaPipe)
2. Electron Overlay

Each service runs independently and can be closed separately.

---

### Option 2: Manual Start (Independent Services)

**Start Backend Server:**

Windows:
```bash
start-backend.bat
```

Linux/Mac:
```bash
./start-backend.sh
```

**Start Electron Overlay (AFTER backend is running):**

Windows:
```bash
start-electron.bat
```

Linux/Mac:
```bash
./start-electron.sh
```

**Start Next.js Frontend (Optional - for dashboard/settings):**
```bash
cd frontend
npm run dev
```

---

### Option 3: Advanced - Manual Terminal Commands

**Terminal 1 - Backend Server:**
```bash
cd backend
source venv/bin/activate  # Mac/Linux
venv\Scripts\activate     # Windows
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 - Electron Overlay:**
```bash
cd electron
npm start
```

**Terminal 3 - Next.js Frontend (Optional):**
```bash
cd frontend
npm run dev
```

## 🌐 Access Points

- **Electron Overlay:** Automatically appears on screen (system tray icon)
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs
- **WebSocket:** ws://localhost:8000/ws/hand-tracking
- **Frontend Dashboard (Optional):** http://localhost:3000

### Default Credentials
- **Email:** `admin@airclick.com`
- **Password:** `admin123`

### Service Independence

✅ **Backend and Electron are now independent:**
- Backend can run without Electron
- Electron can be closed/restarted without affecting backend
- Each service has its own startup script
- Services communicate via WebSocket (backend stays running)

## 📚 Documentation

- **[START_HERE.md](START_HERE.md)** - Quick start guide & troubleshooting
- **[backend_mediapipe/README.md](backend_mediapipe/README.md)** - MediaPipe service documentation
- **[backend/README.md](backend/README.md)** - FastAPI backend documentation

## 🧪 Testing

### Test Backend API
```bash
cd backend
python test_api.py
```

### Verify Hand Tracking
1. Start Python MediaPipe service
2. Open gesture recorder in frontend
3. Look for green dot (hand detected)
4. Should see cyan skeleton overlay

## 🎯 Current Status

✅ **Week 1 Complete:**
- Python MediaPipe hand tracking service
- WebSocket real-time communication
- FastAPI backend with production architecture
- Supabase PostgreSQL database
- JWT authentication system
- Gesture recording and storage
- Frontend-backend integration
- Admin and User roles

## 🗓️ Development Roadmap

### ✅ Week 1: Foundation (COMPLETED)
- Python MediaPipe integration
- WebSocket communication
- Backend API with FastAPI
- Database setup with Supabase
- Authentication system
- Real-time gesture recording

### 📍 Week 2: Machine Learning (Current)
- Data collection (100+ samples/gesture)
- Feature extraction from landmarks
- Random Forest classifier
- Prediction API endpoint
- Real-time recognition

### Week 3: Advanced ML
- LSTM neural network
- 85%+ accuracy target
- Dynamic gesture recognition
- Model optimization

### Week 4-8: Production Features
- Desktop .exe packaging
- Admin dashboard enhancements
- Testing suite
- Performance optimization
- FYP documentation

## 🏗️ Project Structure

```
airclick-fyp/
├── backend_mediapipe/           # Python MediaPipe service (NEW)
│   ├── hand_tracking_service.py # Main hand tracking service
│   ├── requirements.txt         # Python dependencies
│   └── README.md                # Service documentation
├── backend/                     # FastAPI backend
│   ├── app/
│   │   ├── api/routes/          # API endpoints
│   │   ├── core/                # Config & security
│   │   ├── models/              # Database models
│   │   └── schemas/             # Validation schemas
│   ├── .env                     # Environment variables
│   └── requirements.txt         # Python dependencies
├── app/                         # Next.js frontend
│   ├── components/
│   │   ├── HandTrackingClient.js      # WebSocket client (NEW)
│   │   └── GestureRecorderReal.js     # Updated for WebSocket
│   ├── context/                 # React context
│   ├── utils/                   # API utilities
│   ├── User/                    # User pages
│   ├── Admin/                   # Admin pages
│   └── login/                   # Auth pages
├── public/                      # Static assets
├── start_mediapipe.bat          # Start hand tracking (Windows)
├── start_backend.bat            # Start FastAPI (Windows)
├── start_frontend.bat           # Start Next.js (Windows)
├── package.json                 # Node.js dependencies
├── START_HERE.md                # Quick start guide
└── README.md                    # This file
```

## 🔐 Security

- JWT token authentication with 30-minute expiration
- Bcrypt password hashing (12 rounds)
- CORS whitelist for frontend
- SQL injection prevention via SQLAlchemy ORM
- Input validation with Pydantic schemas
- Protected API routes with Bearer tokens
- WebSocket connection from localhost only

## 🔧 Configuration

### Python MediaPipe Service
Edit `backend_mediapipe/hand_tracking_service.py`:
```python
camera_index = 0              # Change camera (0, 1, 2...)
max_num_hands = 2            # Maximum hands to detect
min_detection_confidence = 0.5  # Detection threshold
port = 8765                  # WebSocket port
```

### FastAPI Backend
Edit `backend/.env`:
```
DATABASE_URL=your_supabase_url
SECRET_KEY=your_secret_key
```

### Next.js Frontend
WebSocket URL in components: `ws://localhost:8765`

## 🐛 Troubleshooting

### Camera Not Working
- Check if Python service is running
- Try different `camera_index` (0, 1, 2...)
- Close other apps using camera
- Check camera permissions

### WebSocket Connection Failed
- Verify Python service is running on port 8765
- Check firewall settings
- Look for "✓ Connected" message in console

### Backend API Errors
- Verify FastAPI is running on port 8000
- Check database connection in `.env`
- Verify JWT token in localStorage

See **[START_HERE.md](START_HERE.md)** for detailed troubleshooting.

## 🎓 For FYP Evaluation

### Technical Contributions
1. **Multi-Service Architecture**: Python + FastAPI + Next.js integration
2. **Real-time Communication**: WebSocket for 30 FPS hand tracking
3. **Full-Stack Development**: Frontend, backend, and ML service
4. **Production-Ready**: Authentication, database, cloud storage
5. **Desktop Application**: Native Python for reliable camera access

### Innovation
- Hybrid architecture combining web UI with native performance
- Real-time gesture recognition pipeline
- Context-aware gesture control system

## 🤝 Contributing

This is a Final Year Project. Contributions are welcome after project submission.

## 📄 License

This project is for educational purposes as part of a university FYP.

## 👨‍💻 Author

**Muhammad Shawaiz**
Final Year Project - Computer Science

## 🙏 Acknowledgments

- Google MediaPipe Team
- FastAPI Framework
- Supabase Platform
- Next.js Team
- OpenCV Community

## 📞 Support

For issues and questions:
1. Check **[START_HERE.md](START_HERE.md)** for quick solutions
2. Review service-specific READMEs in `backend_mediapipe/` and `backend/`
3. Test each service individually to isolate issues

---

**Status**: Week 1 Complete ✅ | Python MediaPipe Integrated ✅ | Ready for ML Development 🚀

**Key Achievement**: Transitioned from browser-based MediaPipe to native Python service for 100% reliable camera access and superior performance.
