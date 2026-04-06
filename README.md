# AirClick - Hand Gesture Recognition & Control System

A full-stack desktop application that enables touchless device control through real-time hand gesture recognition using computer vision, machine learning, and a native desktop overlay.

> **Final Year Project (FYP) — Muhammad Shawaiz, Computer Science**

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [How It Works — End to End](#how-it-works--end-to-end)
5. [Core Services & Algorithms](#core-services--algorithms)
6. [Database Schema](#database-schema)
7. [API Reference](#api-reference)
8. [Frontend Application](#frontend-application)
9. [Electron Overlay](#electron-overlay)
10. [Installation & Setup](#installation--setup)
11. [Running the Application](#running-the-application)
12. [Configuration Reference](#configuration-reference)
13. [Security](#security)
14. [Project Structure](#project-structure)
15. [Troubleshooting](#troubleshooting)

---

## Project Overview

AirClick allows users to control their computer with hand gestures instead of a mouse and keyboard. The system can:

- **Move the cursor** by tracking the index fingertip in real time
- **Click** using pinch gestures (index+thumb = left click, middle+thumb = right click)
- **Recognize custom gestures** and map them to application-specific actions (e.g., swipe right → next PowerPoint slide)
- **Record new gestures** via a web dashboard with live camera feedback
- **Work across all applications** through a system-wide transparent Electron overlay

The system is built around three independent services that communicate over HTTP REST and WebSocket:

| Service | Technology | Port |
|---------|-----------|------|
| Backend (API + Hand Tracking) | Python / FastAPI | 8000 |
| Frontend Dashboard | Next.js | 3000 |
| Desktop Overlay | Electron | — |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                       AirClick System                               │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                  FastAPI Backend (Port 8000)                  │  │
│  │                                                              │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐ │  │
│  │  │  MediaPipe  │  │  Hybrid Mode │  │  Gesture Matcher   │ │  │
│  │  │  OpenCV     │  │  Controller  │  │  (DTW Algorithm)   │ │  │
│  │  │  Camera     │  │  State FSM   │  │  Action Executor   │ │  │
│  │  └──────┬──────┘  └──────┬───────┘  └────────────────────┘ │  │
│  │         │                │                                   │  │
│  │         └────────────────┴────── WebSocket (/ws/...)        │  │
│  │                                                              │  │
│  │  REST API: /api/auth  /api/gestures  /api/settings           │  │
│  │           /api/admin  /api/action-mappings                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
│            │ WebSocket                    │ REST API               │
│            ▼                             ▼                         │
│  ┌──────────────────────┐    ┌─────────────────────────────────┐  │
│  │  Electron Overlay    │    │  Next.js Frontend (Port 3000)   │  │
│  │  - Transparent       │    │  - Login / Signup               │  │
│  │  - Always-on-top     │    │  - Gesture Management           │  │
│  │  - Camera preview    │    │  - Settings Panel               │  │
│  │  - Status display    │    │  - Admin Dashboard              │  │
│  │  - Match results     │    │  - Google OAuth                 │  │
│  └──────────────────────┘    └─────────────────────────────────┘  │
│                                          │ REST API               │
│                                          ▼                         │
│                              ┌───────────────────────┐            │
│                              │   Supabase PostgreSQL  │            │
│                              │   - Users & Auth       │            │
│                              │   - Gestures (JSONB)   │            │
│                              │   - Action Mappings    │            │
│                              │   - Activity Logs      │            │
│                              └───────────────────────┘            │
└─────────────────────────────────────────────────────────────────────┘
```

### WebSocket Endpoints

| Endpoint | Purpose |
|----------|---------|
| `ws://localhost:8000/ws/hand-tracking` | Gesture-only mode — streams raw hand landmark data |
| `ws://localhost:8000/ws/hand-tracking-hybrid` | Hybrid mode — cursor control + click detection + gesture recognition |

---

## Technology Stack

### Backend (`/backend`)

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Web Framework | FastAPI | 0.115.0 | REST API + WebSocket server |
| ASGI Server | Uvicorn | 0.32.0 | Production async server |
| Hand Tracking | MediaPipe | ≥0.10.14 | 21-point hand landmark detection |
| Camera | OpenCV (`cv2`) | 4.10.0 | Webcam capture |
| ORM | SQLAlchemy | 2.0.35 | Database model management |
| Migrations | Alembic | 1.13.3 | Database schema versioning |
| DB Driver | psycopg3 | ≥3.0 | PostgreSQL async driver |
| Auth | PyJWT | 2.8.0 | JWT token generation/validation |
| Password Hash | bcrypt | 4.1.2 | Secure password storage |
| Validation | Pydantic v2 | 2.9.2 | Schema validation |
| OAuth | Authlib | 1.3.0 | Google OAuth 2.0 |
| Email | fastapi-mail | 1.4.1 | Password reset emails |
| Cursor Control | ctypes / pyautogui | — | System cursor movement |
| Window Control | pygetwindow | 0.0.9 | Application window detection |
| Numerical Compute | NumPy | 1.26.4 | Array math for DTW |
| Signal Processing | SciPy | 1.11.4 | Gaussian smoothing |
| ML Utilities | scikit-learn | 1.3.2 | K-means clustering (gesture indexing) |

### Frontend (`/frontend`)

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Framework | Next.js | 15.5.4 | React SSR/SSG framework |
| UI Library | React | 19.1.0 | Component-based UI |
| Styling | Tailwind CSS | v4 | Utility-first styling |
| Charts | Recharts | 3.2.1 | Admin analytics charts |
| Notifications | react-hot-toast | 2.6.0 | Toast notifications |
| Icons | lucide-react | 0.545.0 | Icon library |
| OAuth UI | @react-oauth/google | 0.12.2 | Google Sign-In button |

### Desktop Overlay (`/electron`)

| Category | Technology | Version | Purpose |
|----------|-----------|---------|---------|
| Desktop Shell | Electron | 28.0.0 | Native desktop window |
| Remote Module | @electron/remote | 2.1.3 | IPC between processes |
| Build | electron-builder | 24.9.1 | Package to .exe / .dmg |

### Database

| Category | Technology | Purpose |
|----------|-----------|---------|
| Cloud DB | Supabase (PostgreSQL) | Managed database hosting |
| Data Type | JSONB | Gesture landmark storage |
| Schema | SQL + Alembic | Versioned migrations |

---

## How It Works — End to End

### 1. Application Startup

1. Backend starts with `uvicorn app.main:app --port 8000`
2. FastAPI initializes the `HandTrackingService`, which:
   - Opens the webcam with OpenCV (`cv2.VideoCapture(0)`)
   - Loads the MediaPipe Hands model with `mp.solutions.hands.Hands()`
   - Starts a background async loop processing 30 FPS camera frames
3. Electron overlay starts, connects to `ws://localhost:8000/ws/hand-tracking-hybrid`
4. The overlay renders a transparent 520×650px window always on top of all other applications

### 2. Hand Tracking Pipeline

Every video frame goes through this pipeline:

```
OpenCV Frame → MediaPipe Detection → 21 Landmarks → JSON Broadcast
```

MediaPipe outputs **21 hand landmarks** per hand, each with normalized `{x, y, z}` coordinates (0.0–1.0 range):

```
Landmark 0:  Wrist
Landmarks 1-4:   Thumb (CMC → Tip)
Landmarks 5-8:   Index finger (MCP → Tip)
Landmarks 9-12:  Middle finger (MCP → Tip)
Landmarks 13-16: Ring finger (MCP → Tip)
Landmarks 17-20: Pinky (MCP → Tip)
```

The WebSocket broadcasts this JSON structure at up to 30 FPS:

```json
{
  "timestamp": "2024-10-19T00:00:00",
  "hands": [{
    "handedness": "Right",
    "confidence": 0.97,
    "landmarks": [{"x": 0.5, "y": 0.6, "z": -0.02}, ...],
    "landmark_count": 21
  }],
  "hand_count": 1,
  "frame_size": {"width": 640, "height": 480}
}
```

### 3. Hybrid Mode — Cursor + Click + Gesture (Unified FSM)

The core innovation of AirClick is the **Hybrid State Machine** (`HybridStateMachine`) which coordinates cursor control and gesture recognition without conflict.

#### State Machine States

```
CURSOR_ONLY ──(stationary ≥1.2s OR moving ≥0.15s)──► COLLECTING
    ▲                                                       │
    │                                              (frames collected)
    │                                                       │
    └──(cooldown ≥0.5s)── IDLE ◄── MATCHING ◄─────────────┘
                                   (DTW runs)
```

| State | Cursor Active | Gesture Collection | Description |
|-------|--------------|-------------------|-------------|
| `CURSOR_ONLY` | Yes | No | Default — index finger controls cursor |
| `COLLECTING` | No | Yes | Building frame buffer for gesture |
| `MATCHING` | No | No | Running DTW algorithm on collected frames |
| `IDLE` | No | No | Cooldown after match result |

#### Dual Gesture Trigger System

The system detects TWO types of gestures:
- **Static (Stationary) Trigger**: Hand stays still for ≥1.2 seconds → starts collecting frames → user then performs the gesture movement
- **Dynamic (Moving) Trigger**: Hand moves at velocity >0.08 (normalized) for ≥0.15 seconds → immediately starts collecting

#### Cursor Activity Guards

To prevent accidental gesture recognition when the user is using the cursor:
- **Cursor movement guard**: After significant cursor movement (>30px), blocks gesture collection for 1.0 second
- **Click activity guard**: After any click (left or right), blocks gesture collection for 2.5 seconds — allows multi-click workflows (double-click, triple-click)

### 4. Cursor Control

When in `CURSOR_ONLY` state:

1. Extract **index finger tip** (landmark #8) coordinates
2. Apply **One Euro Filter** smoothing (adaptive low-pass filter) for jitter reduction
3. Apply **dead zone filtering** — ignore movements below threshold to prevent tremor
4. **Mirror the X axis** (camera is naturally mirrored)
5. Apply **movement scaling** (default 1.0× — direct 1:1 mapping)
6. Map to screen pixel coordinates
7. Move cursor via `ctypes.windll.user32.SetCursorPos()` (Windows fast path) or `pyautogui.moveTo()` fallback

### 5. Click Detection

The `HandPoseDetector` service detects pinch gestures:

| Gesture | Click Type | Detection |
|---------|-----------|-----------|
| Index tip (landmark 8) + Thumb tip (landmark 4) close together | Left click | Distance < 0.05 (normalized) |
| Middle tip (landmark 12) + Thumb tip (landmark 4) close together | Right click | Distance < 0.05 (normalized) |

Detection uses:
- **Adaptive thresholds** — scale pinch distance relative to hand size (wrist-to-middle-MCP span)
- **State machine** (IDLE → PINCH_DETECTED → CLICK_TRIGGERED → COOLDOWN) to prevent double-clicks
- **Temporal consistency** — require 3 consecutive frames of pinch before triggering
- **Stability check** — hand must not be moving significantly during click

### 6. Gesture Recording

Users record gestures through the web dashboard (`/User/gestures-management`):

1. Component connects to `ws://localhost:8000/ws/hand-tracking`
2. Live camera feed displayed as hand skeleton canvas (21 landmarks + connections)
3. User clicks "Start Recording" → frames buffered for up to 10 seconds
4. User performs the gesture
5. User clicks "Stop" → frames sent to `POST /api/gestures/record`
6. Backend applies preprocessing + resampling → saves to database

**Frame Preprocessing** (`GesturePreprocessor`):
- **Procrustes Analysis**: Removes translation (position), rotation (orientation), and scale (hand size) variations so the same gesture matches regardless of where/how the hand is held
- **Bone-length normalization**: Anatomically consistent scaling
- **Wrist-centered coordinate system**: All landmarks relative to wrist (landmark 0)
- **Trajectory feature encoding**: Embeds movement direction into landmark data so that "swipe left" and "swipe right" are NOT confused despite having the same hand shape

**Frame Resampling** (`FrameResampler`):
- Recorded gestures may have varying frame counts (fast vs. slow performers)
- Linear interpolation resamples all gesture recordings to exactly **60 frames**
- This normalizes timing differences before DTW matching

### 7. Gesture Matching (DTW Algorithm)

When the state machine transitions to `MATCHING`, collected frames are passed to the `GestureMatcher`.

**Pipeline:**

```
Collected Frames
    │
    ▼ Phase 1: Preprocessing (GesturePreprocessor)
Normalized Frames (Procrustes + trajectory encoding)
    │
    ▼ Phase 2: Enhanced DTW Ensemble (EnhancedDTW)
Similarity Scores
    │
    ▼ Phase 3: Index-Accelerated Lookup (GestureIndexer)
Candidate Gestures (K-means clustering)
    │
    ▼ Best Match (if similarity ≥ threshold)
Action Execution
```

**DTW Ensemble (direction-aware v2):**

The `EnhancedDTW` class computes three similarity metrics and combines them:

| Component | Weight | Description |
|-----------|--------|-------------|
| Direction-Focused DTW | 50% | Emphasizes movement direction (prevents opposite gestures matching) |
| Multi-Feature DTW | 30% | Position + velocity (1st derivative) + acceleration (2nd derivative) |
| Standard DTW | 20% | Baseline positional similarity |

Additional trajectory penalty applies when recorded and matched gestures have opposite movement directions.

**Gesture Indexing (Phase 3 optimization):**

`GestureIndexer` uses K-means clustering on gesture feature vectors to group similar gestures. During matching, only gestures in the nearest cluster are compared in full DTW — reducing matching time from O(N) to O(N/k) for large gesture libraries.

**Caching:**

`GestureCache` maintains an LRU cache of preprocessed gesture feature vectors. When a gesture is matched or added, the cache is updated, avoiding repeated preprocessing on every match.

**Default threshold: 75% similarity** — a matched gesture must score ≥75% to be accepted. Each gesture also stores an `adaptive_threshold` that is learned from historical match data.

### 8. Action Execution

On a successful gesture match, the `ActionExecutor`:

1. Looks up the matched gesture's `action` field and `app_context`
2. If context is application-specific (e.g., `POWERPOINT`):
   - Uses `pygetwindow` to find and focus the target application window
3. Executes the keyboard shortcut via `pyautogui.hotkey()`
4. Sends the action result back via WebSocket to the overlay

**Supported Application Contexts:**

| Context | Example Actions |
|---------|---------------|
| `GLOBAL` | Volume up/down, brightness, screenshot |
| `POWERPOINT` | Next/prev slide, start/end presentation, new slide, delete slide, zoom in/out |
| `WORD` | Bold/italic/underline, undo/redo, copy/paste, font size, paragraph formatting |
| `BROWSER` | Back/forward, refresh, new tab, close tab, scroll |
| `MEDIA` | Play/pause, next/prev track, volume |

### 9. Result Broadcasting

After matching, the result is broadcast via WebSocket to the Electron overlay which displays:
- Matched gesture name and action
- Similarity score
- Visual feedback (green border animation)

The overlay also polls `/api/auth/me` with the stored JWT token to verify the user is authenticated before enabling gesture recognition — unauthenticated users still get cursor control but gestures are blocked.

---

## Core Services & Algorithms

### `HandTrackingService` (`backend/app/services/hand_tracking.py`)

Central service managing the camera loop and WebSocket clients.

- Runs MediaPipe in a dedicated background thread at ~30 FPS
- Manages a set of WebSocket client connections
- Routes frames through `HybridModeController` (hybrid endpoint) or raw broadcast (gesture-only endpoint)
- Cleans up camera resources on shutdown

### `HybridStateMachine` (`backend/app/services/hybrid_state_machine.py`)

Finite State Machine (FSM) implementing the 4-state model described above. Key parameters:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `stationary_duration_threshold` | 1.2s | Hold still for this long to trigger static gesture |
| `collection_frame_count` | 60 | Max frames to collect |
| `min_collection_frames` | 10 | Minimum frames before matching |
| `idle_cooldown_duration` | 0.5s | Rest after each match |
| `velocity_threshold` | 0.015 | Below this = hand considered stationary |
| `moving_velocity_threshold` | 0.08 | Above this = hand considered moving |
| `cursor_activity_guard_duration` | 1.0s | Block gesture after cursor movement |
| `click_guard_duration` | 2.5s | Block gesture after click |

### `CursorController` (`backend/app/services/cursor_controller.py`)

Handles hand-to-cursor coordinate mapping with:
- **One Euro Filter** (`temporal_smoothing.py`) — adaptive low-pass filter that reduces jitter while preserving fast movements
- **Dead zone filtering** — movements below threshold are ignored
- **X-axis mirroring** — corrects the natural mirror effect of front-facing camera
- **Movement scaling** — amplifies small hand movements to reach full screen
- Fast path via `ctypes.windll.user32.SetCursorPos()` on Windows

### `HandPoseDetector` (`backend/app/services/hand_pose_detector.py`)

Pinch-based click detection with:
- 4-state click FSM: IDLE → PINCH_DETECTED → CLICK_TRIGGERED → COOLDOWN
- Adaptive thresholds relative to hand size
- Hysteresis (different pinch vs. release thresholds) for stable detection
- Temporal consistency requirement (3 frames) to prevent false clicks

### `GesturePreprocessor` (`backend/app/services/gesture_preprocessing.py`)

Direction-aware normalization (v4):
1. Per-frame Procrustes analysis (shape normalization)
2. Trajectory feature extraction (captures actual movement direction)
3. Trajectory encoding embedded into landmark array
4. Outlier frame removal (low-confidence frames filtered)

### `EnhancedDTW` (`backend/app/services/enhanced_dtw.py`)

Multi-feature Dynamic Time Warping ensemble:
1. Extract velocity features (1st derivative of landmark positions)
2. Extract acceleration features (2nd derivative)
3. Run standard DTW on positions
4. Run direction-similarity DTW (direction penalty for opposite movements)
5. Run multi-feature DTW (position + velocity + acceleration concatenated)
6. Weighted ensemble: 50% direction + 30% multi-feature + 20% standard
7. Apply trajectory penalty for opposite-direction gestures

### `GestureIndexer` (`backend/app/services/gesture_indexing.py`)

K-means clustering for O(N/k) approximate nearest neighbor search:
- Clusters gestures by feature vector similarity
- Only full DTW on candidates in the nearest cluster

### `GestureCache` (`backend/app/services/gesture_cache.py`)

LRU cache for preprocessed gesture features:
- Avoids recomputing Procrustes features on every match call
- Invalidated when a gesture is added, updated, or deleted

### `ActionExecutor` (`backend/app/services/action_executor.py`)

Executes keyboard shortcuts using `pyautogui.hotkey()`:
- Window title pattern matching to identify target application
- Auto-focuses the target application window before sending keys
- Falls back gracefully if the target application is not running

---

## Database Schema

### `users` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer PK | Auto-increment |
| `full_name` | String | User's display name |
| `email` | String UNIQUE | Login email |
| `password_hash` | String (nullable) | Bcrypt hash (NULL for OAuth users) |
| `oauth_provider` | String (nullable) | `"google"` or NULL |
| `oauth_provider_id` | String (nullable) | Provider's unique user ID |
| `role` | String | `"USER"` or `"ADMIN"` |
| `status` | String | `"ACTIVE"` or `"INACTIVE"` |
| `accessibility_settings` | JSONB | User preferences (sensitivity, speed, etc.) |
| `email_verified` | Boolean | Email verification status |
| `last_login` | DateTime | Last successful login |
| `created_at` / `updated_at` | DateTime | Timestamps |

### `gestures` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer PK | Auto-increment |
| `user_id` | Integer FK | Owner user |
| `name` | String(100) | Gesture display name |
| `action` | String(50) | Action code (e.g., `ppt_next_slide`) |
| `app_context` | String(50) | `GLOBAL`, `POWERPOINT`, `WORD`, etc. |
| `landmark_data` | JSONB | 60 frames × 21 landmarks × {x,y,z} |
| `accuracy_score` | Float | Rolling average similarity score |
| `total_similarity` | Float | Sum of all match similarity scores |
| `match_count` | Integer | Total successful matches |
| `false_trigger_count` | Integer | Below-threshold match attempts |
| `template_index` | Integer | 0=primary, 1-4=variation templates |
| `parent_gesture_id` | Integer FK | Link to primary template |
| `is_primary_template` | Boolean | True for main gesture recording |
| `quality_score` | Float | Recording quality (0–1) |
| `adaptive_threshold` | Float | Learned optimal threshold |
| `recording_metadata` | JSONB | Recording conditions and statistics |
| `precomputed_features` | JSONB | Cached Procrustes features (60×63) |
| `features_version` | Integer | Feature algorithm version |
| `created_at` / `updated_at` | DateTime | Timestamps |

### `action_mappings` Table

Custom gesture-to-action overrides per user per context.

### `activity_logs` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer PK | Auto-increment |
| `user_id` | Integer FK | Associated user |
| `action` | String(255) | Action description |
| `meta_data` | JSONB | Additional context data |
| `ip_address` | String(45) | Client IP |
| `timestamp` | DateTime | When the action occurred |

### `password_reset_tokens` Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | Integer PK | Auto-increment |
| `user_id` | Integer FK | User requesting reset |
| `token_hash` | String(64) UNIQUE | SHA-256 hash of the reset token |
| `created_at` | DateTime | Token creation time |
| `expires_at` | DateTime | Expiry (15 minutes after creation) |
| `used` | Boolean | Prevents token reuse |

---

## API Reference

Base URL: `http://localhost:8000`

### Authentication (`/api/auth`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register with email/password |
| POST | `/api/auth/login` | Login, receive JWT token |
| GET | `/api/auth/me` | Get current user info (validates token) |
| POST | `/api/auth/google` | Google OAuth login/signup |
| GET | `/api/auth/google/callback` | OAuth redirect handler |
| POST | `/api/auth/forgot-password` | Send password reset email |
| POST | `/api/auth/reset-password` | Reset password with token |
| POST | `/api/auth/verify-reset-token` | Validate a reset token |

### Gestures (`/api/gestures`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/gestures/record` | Save a new gesture recording |
| GET | `/api/gestures/` | List all gestures for current user |
| GET | `/api/gestures/{id}` | Get a single gesture |
| PUT | `/api/gestures/{id}` | Update gesture name/action |
| DELETE | `/api/gestures/{id}` | Delete a gesture |
| POST | `/api/gestures/match` | Test gesture matching (debug) |
| GET | `/api/gestures/actions` | List all available actions |
| GET | `/api/gestures/rebuild-index` | Force rebuild gesture search index |

### Settings (`/api/settings`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/` | Get current user settings |
| PUT | `/api/settings/` | Update user settings |
| POST | `/api/settings/reset` | Reset settings to defaults |

**User Settings Schema:**

```json
{
  "hybrid_mode": true,
  "sensitivity": 0.75,
  "cursor_speed": 1.5,
  "gesture_threshold": 0.75,
  "pinch_threshold": 0.05,
  "stationary_duration": 1.2,
  "cooldown_duration": 0.5
}
```

### Admin (`/api/admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/users` | List all users |
| GET | `/api/admin/users/{id}` | Get user details |
| POST | `/api/admin/users/{id}/block` | Block/unblock a user |
| GET | `/api/admin/overview` | System statistics |
| GET | `/api/admin/settings` | Get global system settings |
| PUT | `/api/admin/settings` | Update global system settings |

### Action Mappings (`/api/action-mappings`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/action-mappings/` | Get user's custom action mappings |
| POST | `/api/action-mappings/` | Create a custom mapping |
| PUT | `/api/action-mappings/{id}` | Update a mapping |
| DELETE | `/api/action-mappings/{id}` | Delete a mapping |

### System (`/api/system`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Backend health check |
| GET | `/` | API info and service URLs |
| GET | `/docs` | Swagger UI documentation |

---

## Frontend Application

The Next.js frontend serves as the management dashboard. It is **optional for gesture control** (the Electron overlay + backend work independently) but required for:
- User registration and login
- Recording and managing gestures
- Configuring settings
- Admin panel

### Page Structure

```
/                        → Redirect to login or home
/login                   → Email/password + Google OAuth login
/signup                  → User registration
/forgot-password         → Request password reset email
/reset-password          → Set new password with token

/User/home               → User dashboard (gesture count, recent activity)
/User/gestures-management → Record, view, edit, delete gestures
/User/settings           → Sensitivity, cursor speed, hybrid mode toggle
/Admin/overview          → System stats, user counts, activity
/Admin/users             → User list, block/unblock users
/Admin/action-mappings   → Manage global gesture-action mappings
/Admin/settings          → Global system configuration
```

### Key Frontend Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `GestureRecorderReal` | `app/components/` | Live camera preview + gesture recording UI |
| `GestureList` | `app/components/` | Gesture card list with edit/delete |
| `GestureTester` | `app/components/` | Test matching of recorded gestures |
| `HandTrackingClient` | `app/components/` | WebSocket client for hand data |
| `SettingsComponents` | `app/components/` | Settings form controls |
| `AuthContext` | `app/context/` | Global auth state (JWT token management) |
| `ProtectedRoute` | `app/components/` | Route guard requiring authentication |

### Authentication Flow

1. User submits login form → `POST /api/auth/login`
2. Backend returns `{ access_token, token_type }`
3. Token stored in `localStorage` and `AuthContext`
4. All API calls include `Authorization: Bearer <token>` header
5. `tokenSync.js` utility syncs token to a local file for Electron to read

### Google OAuth Flow

1. User clicks "Sign in with Google" button (`GoogleSignInButton`)
2. Google identity credential received in browser
3. Token sent to `POST /api/auth/google`
4. Backend verifies with Google, creates/updates user, returns JWT

---

## Electron Overlay

The overlay is an Electron application that runs as a transparent, always-on-top window (520×650px) displaying real-time hand tracking feedback.

### Overlay Features

- **Transparent background** — shows hand skeleton over any application
- **Always on top** — visible even over full-screen presentations (PowerPoint, etc.)
- **Camera canvas** — renders 21-landmark hand skeleton with connections in real time
- **State indicator** — shows current FSM state (Cursor Mode / Collecting / Matching / Idle)
- **Progress bar** — frame collection progress during gesture detection
- **Match result banner** — displays matched gesture name and similarity score
- **Recording indicator** — red pulsing border when user is recording via web UI
- **Draggable header** — can be repositioned anywhere on screen
- **System tray icon** — toggle overlay visibility without closing
- **Auto-click-through** — mouse clicks pass through the overlay to underlying windows when not hovering the header

### Token Authentication

The overlay reads the JWT token via a local HTTP helper (`token-helper.js`) to authenticate the gesture recognition pipeline. This allows the backend to verify the user before executing gesture actions.

### Overlay Communication Protocol

The overlay connects to `ws://localhost:8000/ws/hand-tracking-hybrid` and receives frames enriched with hybrid processing results:

```json
{
  "timestamp": "...",
  "hands": [...],
  "hybrid": {
    "success": true,
    "hybrid_mode_enabled": true,
    "cursor": { "success": true, "screen_position": {"x": 800, "y": 400} },
    "clicks": { "click_type": "none" },
    "state_machine": {
      "state": "cursor_only",
      "cursor_enabled": true,
      "collecting": false,
      "collected_count": 0,
      "velocity": 0.012,
      "match_result": null
    }
  }
}
```

---

## Installation & Setup

### Prerequisites

- **Python 3.10+** with pip
- **Node.js 18+** with npm
- **Webcam** connected to the computer
- **Supabase account** (free tier at [supabase.com](https://supabase.com))

### 1. Clone Repository

```bash
git clone <repo-url>
cd airclick-fyp
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
source venv/bin/activate     # macOS/Linux

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create `backend/.env`:

```env
# Required
DATABASE_URL=postgresql+psycopg://user:password@db.supabase.co:5432/postgres
SECRET_KEY=your-secret-key-minimum-32-characters

# Optional — Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback

# Optional — Email (for password reset)
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_FROM=your-email@gmail.com
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587

# Optional
FRONTEND_URL=http://localhost:3000
```

### 4. Initialize Database

```bash
# In Supabase SQL Editor, run:
backend/supabase_setup.sql
```

Or run Alembic migrations:

```bash
cd backend
alembic upgrade head
```

### 5. Frontend Setup

```bash
cd frontend
npm install
```

### 6. Electron Overlay Setup

```bash
cd electron
npm install
```

---

## Running the Application

### Start All Services (Recommended)

**Terminal 1 — Backend:**
```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 — Electron Overlay:**
```bash
cd electron
npm start
```

**Terminal 3 — Frontend (Optional, for dashboard):**
```bash
cd frontend
npm run dev
```

### Service Access Points

| Service | URL |
|---------|-----|
| Backend API | http://localhost:8000 |
| Swagger API Docs | http://localhost:8000/docs |
| WebSocket (Gesture Mode) | ws://localhost:8000/ws/hand-tracking |
| WebSocket (Hybrid Mode) | ws://localhost:8000/ws/hand-tracking-hybrid |
| Frontend Dashboard | http://localhost:3000 |
| Electron Overlay | Automatic (system tray) |

### Default Admin Credentials

```
Email:    admin@airclick.com
Password: admin123
```

---

## Configuration Reference

### Backend `.env`

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `SECRET_KEY` | Yes | — | JWT signing key |
| `ALGORITHM` | No | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `30` | Token lifetime |
| `FRONTEND_URL` | No | `http://localhost:3000` | CORS origin |
| `GOOGLE_CLIENT_ID` | No | — | Google OAuth app ID |
| `GOOGLE_CLIENT_SECRET` | No | — | Google OAuth secret |
| `MAIL_*` | No | — | Email provider settings |

### Gesture System Tuning

These are configurable via `PUT /api/settings/`:

| Setting | Default | Effect |
|---------|---------|--------|
| `gesture_threshold` | 0.75 | Minimum similarity score to accept a match (higher = stricter) |
| `sensitivity` | 0.75 | Overall system sensitivity |
| `cursor_speed` | 1.5 | Cursor movement amplification |
| `stationary_duration` | 1.2s | How long hand must be still to trigger gesture |
| `cooldown_duration` | 0.5s | Rest time between gesture matches |
| `pinch_threshold` | 0.05 | Pinch distance for click detection |
| `hybrid_mode` | true | Enable/disable cursor control |

### Camera Configuration

In `HandTrackingService.__init__()`:

```python
camera_index = 0              # 0 = default webcam, 1/2 = external cameras
max_num_hands = 2             # Maximum simultaneous hands
min_detection_confidence = 0.7  # MediaPipe detection threshold
min_tracking_confidence = 0.5   # MediaPipe tracking threshold
```

---

## Security

| Mechanism | Implementation |
|-----------|---------------|
| Password hashing | bcrypt with 12 rounds |
| Authentication | JWT (HS256, 30-minute expiration) |
| Token transport | `Authorization: Bearer <token>` header |
| Database injection | SQLAlchemy ORM (parameterized queries) |
| Input validation | Pydantic v2 schemas on all endpoints |
| CORS | Whitelist: `localhost:3000`, `localhost:3001` only |
| Password reset | SHA-256 hashed tokens, 15-minute expiry, single-use |
| OAuth | Authlib verifies Google ID token server-side |
| User blocking | Admin can set `status=INACTIVE` to prevent login |
| Gesture auth | Backend verifies JWT before executing actions; unauthenticated users lose gesture recognition (cursor still works) |

---

## Project Structure

```
airclick-fyp/
├── README.md                        # This file
│
├── backend/                         # FastAPI backend
│   ├── requirements.txt
│   ├── supabase_setup.sql           # Initial DB schema
│   ├── migrations/                  # Alembic migration scripts
│   └── app/
│       ├── main.py                  # FastAPI app factory + startup
│       ├── api/
│       │   └── routes/
│       │       ├── auth.py          # Login, register, OAuth, password reset
│       │       ├── gestures.py      # Gesture CRUD + matching
│       │       ├── settings.py      # User settings
│       │       ├── admin.py         # Admin user management
│       │       ├── action_mappings.py  # Custom gesture-action mappings
│       │       └── websocket.py     # WS endpoints (gesture + hybrid mode)
│       ├── core/
│       │   ├── config.py            # Pydantic settings (env vars)
│       │   ├── database.py          # SQLAlchemy engine + session
│       │   ├── security.py          # JWT creation/validation, bcrypt
│       │   ├── deps.py              # FastAPI dependency injection
│       │   ├── actions.py           # Action catalog (all keyboard shortcuts)
│       │   ├── email.py             # Email sending (password reset)
│       │   └── oauth.py             # Google OAuth verification
│       ├── models/
│       │   ├── user.py              # User + PasswordResetToken models
│       │   ├── gesture.py           # Gesture + ActivityLog models
│       │   └── action_mapping.py    # ActionMapping model
│       ├── schemas/
│       │   ├── user.py              # User request/response schemas
│       │   ├── gesture.py           # Gesture schemas
│       │   ├── settings.py          # UserSettings schema
│       │   ├── admin_settings.py    # Admin settings schema
│       │   └── action_mapping.py    # ActionMapping schemas
│       └── services/
│           ├── hand_tracking.py         # MediaPipe camera loop + WS broadcast
│           ├── hybrid_mode_controller.py # Unified cursor+gesture controller
│           ├── hybrid_state_machine.py  # 4-state FSM (cursor/collect/match/idle)
│           ├── cursor_controller.py     # Index finger → cursor mapping
│           ├── hand_pose_detector.py    # Pinch → click detection
│           ├── gesture_matcher.py       # DTW-based gesture matching
│           ├── gesture_preprocessing.py # Procrustes + direction normalization
│           ├── enhanced_dtw.py          # Multi-feature DTW ensemble
│           ├── temporal_smoothing.py    # One Euro Filter + Gaussian smoothing
│           ├── frame_resampler.py       # Resample frames to 60 (linear interp)
│           ├── gesture_indexing.py      # K-means cluster indexing
│           ├── gesture_cache.py         # LRU cache for preprocessed features
│           ├── hand_pose_fingerprint.py # Hand shape fingerprinting
│           └── action_executor.py       # pyautogui keyboard action execution
│
├── frontend/                        # Next.js dashboard
│   ├── package.json
│   ├── next.config.mjs
│   ├── app/
│   │   ├── layout.js                # Root layout
│   │   ├── page.js                  # Root redirect
│   │   ├── globals.css              # Global Tailwind styles
│   │   ├── context/
│   │   │   └── AuthContext.js       # JWT auth state management
│   │   ├── components/
│   │   │   ├── GestureRecorderReal.js  # Live camera + recording UI
│   │   │   ├── GestureList.js          # Gesture card list
│   │   │   ├── GestureTester.js        # Match testing tool
│   │   │   ├── HandTrackingClient.js   # WebSocket hand data client
│   │   │   ├── SettingsComponents.js   # Settings form components
│   │   │   ├── ProtectedRoute.js       # Auth-required route guard
│   │   │   ├── UserHeader.js           # Top nav bar
│   │   │   ├── UserSidebar.js          # User navigation sidebar
│   │   │   ├── AdminSidebar.js         # Admin navigation sidebar
│   │   │   ├── GoogleSignInButton.js   # Google OAuth button
│   │   │   ├── ConfirmModal.js         # Confirmation dialog
│   │   │   └── LoadingSpinner.js       # Loading state
│   │   ├── login/                   # Login page
│   │   ├── signup/                  # Registration page
│   │   ├── forgot-password/         # Password reset request
│   │   ├── reset-password/          # New password form
│   │   ├── User/
│   │   │   ├── home/                # User dashboard
│   │   │   ├── gestures-management/ # Record & manage gestures
│   │   │   └── settings/            # User preferences
│   │   ├── Admin/
│   │   │   ├── overview/            # System statistics
│   │   │   ├── users/               # User management
│   │   │   ├── action-mappings/     # Global action config
│   │   │   └── settings/            # Global system settings
│   │   └── utils/
│   │       └── api.js               # Fetch wrapper (auth headers)
│   └── utils/
│       └── tokenSync.js             # Sync JWT token to disk for Electron
│
└── electron/                        # Desktop overlay
    ├── package.json
    ├── main.js                      # Electron main process (window creation)
    ├── overlay.html                 # Overlay UI (camera canvas + status)
    ├── overlay-bridge.js            # WebSocket + IPC communication
    ├── token-helper.js              # Local HTTP server for token sharing
    └── assets/
        └── tray-icon.png            # System tray icon
```

---

## Troubleshooting

### Camera Not Working

- Ensure no other application has the camera open (Teams, Zoom, OBS, etc.)
- Change `camera_index` in `HandTrackingService.__init__()`: try `1`, `2`, etc.
- On Windows: check Camera Privacy settings in System Settings

### WebSocket Connection Failed

- Verify the backend is running: `http://localhost:8000/health` should return `{"status": "healthy"}`
- Check firewall — port 8000 must not be blocked
- Ensure MediaPipe initialized (look for `✓ Hand Tracking Service initialized successfully` in backend logs)

### Gestures Not Matching

- Lower `gesture_threshold` in user settings (try 0.60 instead of 0.75)
- Record multiple templates of the same gesture for better coverage
- Ensure consistent recording conditions (lighting, hand size, position)
- Use the gesture tester (`/User/gestures-management`) to test match scores
- Check backend logs for `GestureMatcher` similarity scores

### Cursor Jitter

- Increase `dead_zone_threshold` in cursor controller settings
- Reduce `cursor_speed` in user settings
- Enable smoothing in `CursorController` (currently disabled for responsiveness)

### Admin Panel Not Working

- Verify user has `role = "ADMIN"` in the database
- Default admin: `admin@airclick.com` / `admin123`

### Performance Issues

- Reduce camera resolution in `HandTrackingService` (`cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)`)
- Rebuild gesture index: `GET /api/gestures/rebuild-index`
- Check that gesture cache is populated (logged on first match)

---

## Academic Context

This is a Final Year Project (FYP) for a Computer Science degree. The technical contributions include:

1. **Multi-service Architecture** — Python native backend with camera access integrated with a web frontend via WebSocket and REST
2. **Hybrid Mode FSM** — Novel state machine design preventing cursor/gesture interference during real-time use
3. **Direction-Aware DTW** — Custom DTW ensemble that discriminates gestures with identical hand shapes but opposite movement directions
4. **Dual Gesture Trigger System** — Supports both static (stationary hold) and dynamic (movement-based) gesture triggers simultaneously
5. **Multi-layer Click Guards** — Cursor activity guard + click activity guard preventing false gesture triggers during normal computer use
6. **Production-Ready Full Stack** — JWT auth, Google OAuth, role-based access, email password reset, admin dashboard, cloud database

---

## Author

**Muhammad Shawaiz**
Final Year Project — Computer Science

## Acknowledgments

- Google MediaPipe Team
- FastAPI Framework
- Supabase Platform
- Next.js / React Teams
- OpenCV Community
- Electron Framework

## License

Educational use — Final Year Project. Not for commercial distribution.
