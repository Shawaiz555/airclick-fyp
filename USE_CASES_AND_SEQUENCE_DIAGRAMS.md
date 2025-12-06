# AirClick - Use Cases and Sequence Diagram Specifications

**Author:** Muhammad Shawaiz
**Project:** AirClick FYP
**Purpose:** Detailed use case documentation for creating accurate sequence diagrams
**Date:** December 6, 2025

---

## Table of Contents

1. [Actors](#actors)
2. [Use Case Overview](#use-case-overview)
3. [Authentication Use Cases](#authentication-use-cases)
4. [Gesture Management Use Cases](#gesture-management-use-cases)
5. [Gesture Recognition Use Cases](#gesture-recognition-use-cases)
6. [Action Execution Use Cases](#action-execution-use-cases)
7. [Admin Panel Use Cases](#admin-panel-use-cases)
8. [System Integration Use Cases](#system-integration-use-cases)

---

## Actors

### Primary Actors

1. **Regular User**
   - Description: End user who records and uses gestures
   - Capabilities:
     - Register/login to the system
     - Record custom gestures
     - Manage their own gestures
     - Use gestures to control applications
     - View their statistics
     - Configure settings

2. **Admin User**
   - Description: Administrator with elevated privileges
   - Capabilities:
     - All Regular User capabilities
     - Manage all users
     - View system-wide statistics
     - Manage action mappings
     - Configure global settings
     - View activity logs

### Secondary Actors

3. **Backend System (FastAPI)**
   - Description: Core application server
   - Responsibilities:
     - Process API requests
     - Manage WebSocket connections
     - Coordinate services
     - Database operations

4. **Hand Tracking Service**
   - Description: MediaPipe-based hand detection
   - Responsibilities:
     - Capture camera frames
     - Detect hand landmarks
     - Stream data via WebSocket

5. **Gesture Matcher Service**
   - Description: DTW-based matching engine
   - Responsibilities:
     - Preprocess gesture frames
     - Match against database
     - Return similarity scores

6. **Action Executor Service**
   - Description: System automation service
   - Responsibilities:
     - Switch application windows
     - Execute keyboard shortcuts
     - Return execution results

7. **Electron Overlay**
   - Description: Desktop overlay window
   - Responsibilities:
     - Display hand skeleton
     - Show gesture status
     - Provide visual feedback

8. **Database (PostgreSQL/Supabase)**
   - Description: Data persistence layer
   - Responsibilities:
     - Store user data
     - Store gesture recordings
     - Store action mappings
     - Track activity logs

---

## Use Case Overview

### Use Case Categories

1. **Authentication (UC-AUTH-01 to UC-AUTH-05)**
   - User registration
   - User login
   - Google OAuth login
   - Password reset
   - Token validation

2. **Gesture Management (UC-GEST-01 to UC-GEST-05)**
   - Record new gesture
   - Update existing gesture
   - Delete gesture
   - List user gestures
   - Test gesture matching

3. **Gesture Recognition (UC-RECOG-01 to UC-RECOG-03)**
   - Real-time hand tracking
   - Hybrid mode operation
   - Gesture matching and execution

4. **Action Execution (UC-ACTION-01 to UC-ACTION-03)**
   - Execute keyboard shortcut
   - Switch application window
   - Handle execution errors

5. **Admin Management (UC-ADMIN-01 to UC-ADMIN-06)**
   - User management
   - System statistics
   - Activity logs
   - Action mapping management

6. **System Integration (UC-SYS-01 to UC-SYS-04)**
   - Backend startup
   - Electron overlay startup
   - WebSocket connection
   - Token synchronization

---

## Authentication Use Cases

---

### UC-AUTH-01: User Registration

**Actor:** Regular User
**Preconditions:** User has valid email and password
**Postconditions:** User account created, JWT token issued
**Trigger:** User submits registration form

#### Main Flow

```
User → Frontend → Backend → Database
```

#### Detailed Sequence

1. **User fills registration form**
   - Enter email address
   - Enter password (min 8 chars)
   - Enter full name
   - Click "Sign Up"

2. **Frontend validates input**
   - Component: `frontend/app/signup/page.js`
   - Check email format
   - Check password strength
   - Display validation errors if any

3. **Frontend sends POST request**
   - Endpoint: `POST /api/auth/register`
   - URL: `http://localhost:8000/api/auth/register`
   - Headers: `Content-Type: application/json`
   - Body:
     ```json
     {
       "email": "user@example.com",
       "password": "SecurePass123",
       "full_name": "John Doe",
       "role": "USER"
     }
     ```

4. **Backend receives request**
   - File: `backend/app/api/routes/auth.py`
   - Function: `register()`
   - Parse request body into `UserCreate` schema

5. **Backend validates email uniqueness**
   - Query database: `SELECT * FROM users WHERE email = ?`
   - If exists: Return `400 Bad Request` with error "Email already registered"
   - If not exists: Continue

6. **Backend hashes password**
   - File: `backend/app/core/security.py`
   - Function: `get_password_hash(password)`
   - Process:
     ```
     1. SHA256(password) → pre_hash
     2. bcrypt.hashpw(pre_hash, salt) → password_hash
     ```
   - Salt rounds: 12

7. **Backend creates user record**
   - Create User object:
     ```python
     new_user = User(
         email="user@example.com",
         password_hash="$2b$12$...",
         full_name="John Doe",
         role="USER",
         status="ACTIVE",
         email_verified=False,
         oauth_provider=None
     )
     ```
   - Insert into database: `INSERT INTO users (...) VALUES (...)`
   - Commit transaction
   - Get auto-generated user ID

8. **Backend generates JWT token**
   - File: `backend/app/core/security.py`
   - Function: `create_access_token()`
   - Payload:
     ```json
     {
       "sub": 1,  // user_id
       "email": "user@example.com",
       "role": "USER",
       "exp": 1733500000  // 30 min from now
     }
     ```
   - Sign with SECRET_KEY using HS256 algorithm

9. **Backend sends welcome email (background)**
   - File: `backend/app/core/email.py`
   - Function: `send_welcome_email()`
   - Send via SMTP (Gmail)
   - Non-blocking (FastAPI BackgroundTasks)

10. **Backend returns response**
    - Status: `201 Created`
    - Body:
      ```json
      {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "token_type": "bearer",
        "user": {
          "id": 1,
          "email": "user@example.com",
          "full_name": "John Doe",
          "role": "USER"
        }
      }
      ```

11. **Frontend stores token**
    - `localStorage.setItem('token', access_token)`
    - `localStorage.setItem('user', JSON.stringify(user))`

12. **Frontend saves token to Electron**
    - POST to token helper: `http://localhost:9999/set-token`
    - Body: JWT token
    - Token helper writes to: `~/.airclick-token`

13. **Frontend redirects to dashboard**
    - Redirect to: `/User/home`

#### Alternative Flows

**A1: Email already registered**
- At step 5, if email exists:
  - Backend returns `400 Bad Request`
  - Frontend shows error: "Email already registered"
  - User can try different email or go to login

**A2: Weak password**
- At step 2, if password validation fails:
  - Frontend shows error: "Password must be at least 8 characters"
  - User must enter stronger password

**A3: Database connection failed**
- At step 7, if database insert fails:
  - Backend returns `500 Internal Server Error`
  - Frontend shows error: "Registration failed, please try again"

#### Participants for Sequence Diagram

1. User (Actor)
2. Frontend (Next.js)
3. AuthAPI (FastAPI /auth routes)
4. SecurityService (JWT, password hashing)
5. Database (PostgreSQL)
6. EmailService (SMTP)
7. TokenHelper (Electron bridge)

---

### UC-AUTH-02: User Login

**Actor:** Regular User
**Preconditions:** User has registered account
**Postconditions:** User authenticated, JWT token issued
**Trigger:** User submits login form

#### Detailed Sequence

1. **User enters credentials**
   - Email: `user@example.com`
   - Password: `SecurePass123`
   - Click "Login"

2. **Frontend sends POST request**
   - Endpoint: `POST /api/auth/login`
   - Content-Type: `application/x-www-form-urlencoded`
   - Body:
     ```
     username=user@example.com&password=SecurePass123
     ```
   - Note: FastAPI OAuth2 requires form-data format

3. **Backend receives request**
   - File: `backend/app/api/routes/auth.py`
   - Function: `login()`

4. **Backend queries user by email**
   - Query: `SELECT * FROM users WHERE email = ?`
   - If not found: Return `401 Unauthorized` "Invalid credentials"

5. **Backend verifies password**
   - File: `backend/app/core/security.py`
   - Function: `verify_password(plain_password, hashed_password)`
   - Process:
     ```
     1. SHA256(plain_password) → pre_hash
     2. bcrypt.checkpw(pre_hash, stored_hash) → True/False
     ```
   - If False: Return `401 Unauthorized` "Invalid credentials"

6. **Backend checks user status**
   - If `user.status == "INACTIVE"`:
     - Return `403 Forbidden` "Account disabled"
   - If `user.status == "ACTIVE"`: Continue

7. **Backend updates last login**
   - Update: `UPDATE users SET last_login = NOW() WHERE id = ?`
   - Commit transaction

8. **Backend generates JWT token**
   - Same as UC-AUTH-01 step 8

9. **Backend logs activity**
   - Insert: `INSERT INTO activity_logs (user_id, action, timestamp) VALUES (?, 'login', NOW())`

10. **Backend returns response**
    - Status: `200 OK`
    - Body:
      ```json
      {
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "token_type": "bearer",
        "user": {
          "id": 1,
          "email": "user@example.com",
          "role": "USER"
        }
      }
      ```

11. **Frontend stores token and redirects**
    - Same as UC-AUTH-01 steps 11-13

#### Alternative Flows

**A1: Invalid email**
- At step 4, user not found:
  - Return 401 with generic message (security best practice)
  - Don't reveal whether email exists

**A2: Invalid password**
- At step 5, password mismatch:
  - Return 401 with same generic message
  - Prevents user enumeration

**A3: Account disabled**
- At step 6, if status is INACTIVE:
  - Return 403 Forbidden
  - Show message: "Your account has been disabled. Contact admin."

#### Participants for Sequence Diagram

1. User (Actor)
2. Frontend (Next.js)
3. AuthAPI (FastAPI)
4. SecurityService (Password verification)
5. Database (PostgreSQL)
6. TokenHelper (Electron bridge)

---

### UC-AUTH-03: Google OAuth Login

**Actor:** Regular User
**Preconditions:** Google OAuth configured in backend
**Postconditions:** User authenticated via Google, JWT token issued
**Trigger:** User clicks "Sign in with Google"

#### Detailed Sequence

1. **User clicks Google Sign-In button**
   - Component: `frontend/app/components/GoogleSignInButton.js`
   - Uses: `@react-oauth/google`

2. **Google OAuth flow starts**
   - Frontend redirects to Google OAuth consent screen
   - User grants permissions
   - Google returns authorization code

3. **Frontend receives auth code**
   - React Google OAuth library handles redirect
   - Extract authorization code from callback

4. **Frontend sends code to backend**
   - Endpoint: `POST /api/auth/google`
   - Body:
     ```json
     {
       "code": "4/0AY0e-g7xXxXxXxXxXxXx..."
     }
     ```

5. **Backend exchanges code for user info**
   - File: `backend/app/core/oauth.py`
   - Function: `get_user_from_google_code()`
   - Process:
     ```
     1. POST to Google OAuth token endpoint
     2. Get access_token
     3. GET user info from Google API
     4. Extract email, name, picture
     ```

6. **Backend checks if user exists**
   - Query: `SELECT * FROM users WHERE email = ? AND oauth_provider = 'google'`

7. **If user exists (returning user)**
   - Load user from database
   - Update last login timestamp
   - Go to step 9

8. **If user doesn't exist (new user)**
   - Create new user:
     ```python
     new_user = User(
         email=google_email,
         full_name=google_name,
         oauth_provider='google',
         oauth_id=google_id,
         password_hash=None,  # No password for OAuth users
         email_verified=True,  # Google already verified
         role='USER',
         status='ACTIVE'
     )
     ```
   - Insert into database
   - Send welcome email (background)

9. **Backend generates JWT token**
   - Same as UC-AUTH-01 step 8

10. **Backend returns response**
    - Status: `200 OK`
    - Body includes:
      - JWT token
      - User info
      - `is_new_user: true/false`

11. **Frontend stores token**
    - Same as UC-AUTH-01 steps 11-12

12. **Frontend redirects**
    - If new user: Show onboarding tutorial
    - If existing user: Go to dashboard

#### Alternative Flows

**A1: Google OAuth not configured**
- At step 5, if `GOOGLE_CLIENT_ID` not set:
  - Return `501 Not Implemented`
  - Show error: "Google login not configured"

**A2: Invalid authorization code**
- At step 5, if Google rejects code:
  - Return `401 Unauthorized`
  - Show error: "Google authentication failed"

**A3: Email already registered (different provider)**
- At step 6, if email exists with `oauth_provider = NULL`:
  - Link accounts (advanced feature)
  - Or return error: "Email already registered with password login"

#### Participants for Sequence Diagram

1. User (Actor)
2. Frontend (Next.js)
3. GoogleOAuthButton (React component)
4. Google OAuth Server (External)
5. AuthAPI (FastAPI)
6. OAuthService (Google integration)
7. Database (PostgreSQL)

---

### UC-AUTH-04: Password Reset Request

**Actor:** Regular User
**Preconditions:** User has registered account with email
**Postconditions:** Password reset email sent
**Trigger:** User submits forgot password form

#### Detailed Sequence

1. **User navigates to forgot password page**
   - URL: `/forgot-password`
   - Enter email address
   - Click "Send Reset Link"

2. **Frontend sends POST request**
   - Endpoint: `POST /api/auth/forgot-password`
   - Body:
     ```json
     {
       "email": "user@example.com"
     }
     ```

3. **Backend receives request**
   - File: `backend/app/api/routes/auth.py`
   - Function: `forgot_password()`

4. **Backend queries user**
   - Query: `SELECT * FROM users WHERE email = ?`
   - If not found: Still return success (security: don't reveal if email exists)

5. **If user exists**
   - Generate secure reset token:
     ```python
     reset_token = secrets.token_urlsafe(32)  # 256-bit token
     token_hash = hashlib.sha256(reset_token.encode()).hexdigest()
     expires_at = datetime.now() + timedelta(hours=1)
     ```

6. **Backend stores reset token**
   - Insert:
     ```sql
     INSERT INTO password_reset_tokens (
       user_id,
       token_hash,
       expires_at,
       used
     ) VALUES (?, ?, ?, false)
     ```

7. **Backend sends reset email**
   - File: `backend/app/core/email.py`
   - Function: `send_password_reset_email()`
   - Email contains:
     ```
     Reset link: http://localhost:3000/reset-password?token={reset_token}
     Expires in: 1 hour
     ```
   - Send via SMTP (background task)

8. **Backend returns response**
   - Status: `200 OK`
   - Body:
     ```json
     {
       "message": "If email exists, reset link sent",
       "email_sent": true
     }
     ```
   - Note: Always return success (security best practice)

9. **Frontend shows success message**
   - "Password reset link sent to your email"
   - "Check your inbox and spam folder"

10. **User receives email**
    - Opens email
    - Clicks reset link
    - Redirected to: `/reset-password?token=abc123...`

#### Alternative Flows

**A1: Email not found**
- At step 4, if user doesn't exist:
  - Skip steps 5-7
  - Still return success message (security)
  - User won't receive email

**A2: Email service unavailable**
- At step 7, if SMTP fails:
  - Log error
  - Return `500 Internal Server Error`
  - Show error: "Email service unavailable"

#### Participants for Sequence Diagram

1. User (Actor)
2. Frontend (Next.js)
3. AuthAPI (FastAPI)
4. Database (PostgreSQL)
5. EmailService (SMTP)

---

### UC-AUTH-05: Password Reset Completion

**Actor:** Regular User
**Preconditions:** User has valid reset token from email
**Postconditions:** Password changed, user can login with new password
**Trigger:** User submits new password with reset token

#### Detailed Sequence

1. **User clicks reset link in email**
   - URL: `/reset-password?token=abc123xyz...`
   - Frontend extracts token from URL

2. **Frontend validates token with backend**
   - Endpoint: `POST /api/auth/verify-reset-token`
   - Body:
     ```json
     {
       "token": "abc123xyz..."
     }
     ```

3. **Backend verifies token**
   - Hash token: `token_hash = SHA256(token)`
   - Query:
     ```sql
     SELECT * FROM password_reset_tokens
     WHERE token_hash = ?
       AND expires_at > NOW()
       AND used = false
     ```
   - If not found: Return `400 Bad Request` "Invalid or expired token"

4. **If token valid**
   - Return `200 OK` with user email
   - Frontend shows password reset form

5. **User enters new password**
   - New password: `NewSecurePass456`
   - Confirm password: `NewSecurePass456`
   - Click "Reset Password"

6. **Frontend validates password match**
   - Check password == confirm_password
   - Check password strength

7. **Frontend sends reset request**
   - Endpoint: `POST /api/auth/reset-password`
   - Body:
     ```json
     {
       "token": "abc123xyz...",
       "new_password": "NewSecurePass456"
     }
     ```

8. **Backend verifies token again**
   - Same as step 3 (double-check security)

9. **Backend hashes new password**
   - File: `backend/app/core/security.py`
   - `new_hash = get_password_hash(new_password)`

10. **Backend updates user password**
    - Update: `UPDATE users SET password_hash = ? WHERE id = ?`

11. **Backend marks token as used**
    - Update:
      ```sql
      UPDATE password_reset_tokens
      SET used = true, used_at = NOW()
      WHERE token_hash = ?
      ```

12. **Backend invalidates all sessions**
    - (Optional) Could invalidate existing JWT tokens
    - Force user to login with new password

13. **Backend returns success**
    - Status: `200 OK`
    - Body:
      ```json
      {
        "message": "Password reset successful",
        "success": true
      }
      ```

14. **Frontend redirects to login**
    - Show success message: "Password changed successfully"
    - Redirect to: `/login`

15. **User logs in with new password**
    - Proceeds to UC-AUTH-02

#### Alternative Flows

**A1: Token expired**
- At step 3, if `expires_at < NOW()`:
  - Return `400 Bad Request` "Reset link expired"
  - User must request new reset link

**A2: Token already used**
- At step 3, if `used = true`:
  - Return `400 Bad Request` "Reset link already used"
  - Prevent token reuse attack

**A3: Passwords don't match**
- At step 6, if passwords don't match:
  - Show error: "Passwords must match"
  - User must re-enter

#### Participants for Sequence Diagram

1. User (Actor)
2. Email Client (Shows reset link)
3. Frontend (Next.js)
4. AuthAPI (FastAPI)
5. SecurityService (Password hashing)
6. Database (PostgreSQL)

---

## Gesture Management Use Cases

---

### UC-GEST-01: Record New Gesture

**Actor:** Regular User
**Preconditions:** User is logged in, camera is available
**Postconditions:** Gesture saved to database with preprocessing
**Trigger:** User clicks "Record New Gesture"

#### Detailed Sequence

1. **User navigates to gesture recorder**
   - Page: `/User/home`
   - Click "Record New Gesture" button
   - Modal/component opens: `GestureRecorderReal.js`

2. **Frontend establishes WebSocket connection**
   - Component: `frontend/app/components/GestureRecorderReal.js`
   - Connect to: `ws://localhost:8000/ws/hand-tracking`
   - Event: `onopen`

3. **Backend accepts WebSocket**
   - File: `backend/app/api/routes/websocket.py`
   - Endpoint: `/ws/hand-tracking`
   - Function: `websocket_endpoint()`

4. **Backend routes to HandTrackingService**
   - File: `backend/app/services/hand_tracking.py`
   - Function: `handle_client(websocket, hybrid_mode=False)`
   - Note: Recording mode doesn't use hybrid mode

5. **HandTrackingService opens camera**
   - Use pre-warmed camera (already initialized at startup)
   - If not available, open camera:
     ```python
     cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
     cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
     cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
     cap.set(cv2.CAP_PROP_FPS, 30)
     ```

6. **Backend starts streaming frames**
   - Loop at 30 FPS:
     ```python
     while True:
         hand_data = process_frame()
         await websocket.send_text(json.dumps(hand_data))
         await asyncio.sleep(0.033)  # 30 FPS
     ```

7. **Frontend receives hand data**
   - Event: `ws.onmessage`
   - Data format:
     ```json
     {
       "timestamp": "2025-12-06T14:30:45.123",
       "hands": [{
         "handedness": "Right",
         "landmarks": [
           {"x": 0.5, "y": 0.3, "z": -0.02},
           // ... 20 more landmarks
         ]
       }],
       "hand_count": 1
     }
     ```

8. **Frontend draws hand skeleton on canvas**
   - Component: Canvas in `GestureRecorderReal.js`
   - Function: `drawHandSkeleton()`
   - Steps:
     ```javascript
     1. Clear canvas
     2. For each landmark: draw cyan circle
     3. For each connection: draw cyan line
     ```
   - User sees real-time hand visualization

9. **User fills gesture form**
   - Gesture name: e.g., "Swipe Right"
   - App context: Select "PowerPoint"
   - Action: Select "Next Slide"
   - (Actions fetched from `/api/action-mappings/context/POWERPOINT/available`)

10. **User clicks "Start Recording"**
    - State: `isRecording = true`
    - State: `recordedFrames = []`
    - Start timer showing recording duration

11. **Frontend starts recording frames**
    - In `ws.onmessage`:
      ```javascript
      if (isRecording && data.hands.length > 0) {
        setRecordedFrames(prev => [...prev, data]);
      }
      ```
    - Collect frames for 2-3 seconds (60-90 frames at 30 FPS)

12. **User performs gesture**
    - Example: Move hand from left to right for "Swipe Right"
    - Hand must be visible in camera
    - Frontend continues collecting frames

13. **User clicks "Stop Recording"**
    - State: `isRecording = false`
    - Display frame count: e.g., "75 frames recorded"
    - Show preview of gesture

14. **User clicks "Save Gesture"**
    - State: `isProcessing = true`
    - Show loading spinner

15. **Frontend sends save request**
    - Endpoint: `POST /api/gestures/record`
    - Headers: `Authorization: Bearer {jwt_token}`
    - Body:
      ```json
      {
        "name": "Swipe Right",
        "action": "POWERPOINT_NEXT_SLIDE",
        "app_context": "POWERPOINT",
        "frames": [
          {
            "timestamp": "2025-12-06T14:30:45.123",
            "landmarks": [...],
            "handedness": "Right",
            "confidence": 0.98
          },
          // ... 74 more frames
        ]
      }
      ```

16. **Backend receives save request**
    - File: `backend/app/api/routes/gestures.py`
    - Function: `record_gesture()`
    - Validate: Current user from JWT token

17. **Backend validates frame data**
    - Check: Each frame has exactly 21 landmarks
    - If invalid: Return `400 Bad Request`

18. **Backend preprocesses gesture**
    - File: `backend/app/services/gesture_preprocessing.py`
    - Function: `preprocess_for_recording()`
    - Steps:
      ```
      1. Resample to exactly 60 frames
      2. Apply temporal smoothing (One Euro Filter)
      3. Procrustes normalization (translation/rotation/scale)
      4. Bone-length normalization
      ```
    - Ensures consistency with matching algorithm

19. **Backend extracts trajectory data**
    - Calculate wrist movement (landmark 0):
      ```python
      start = frames[0].landmarks[0]
      end = frames[-1].landmarks[0]
      magnitude = sqrt((end.x - start.x)^2 + (end.y - start.y)^2)
      ```
    - Classify gesture type:
      - `magnitude < 0.02`: STATIONARY (e.g., thumbs up)
      - `magnitude > 0.05`: MOVING (e.g., swipe)
      - `0.02 < magnitude < 0.05`: AMBIGUOUS (warning)

20. **Backend extracts pose fingerprint**
    - File: `backend/app/services/hand_pose_fingerprint.py`
    - Function: `extract_pose_fingerprint()`
    - Calculate geometric features:
      - Finger extension states (0-1 for each finger)
      - Pinch distances
      - Hand orientation angle
    - Used for fast indexing

21. **Backend calculates quality score**
    - Based on:
      - Confidence scores (avg of all frames)
      - Smoothness (low jitter)
      - Trajectory clarity
    - Range: 0.0 to 1.0

22. **Backend creates gesture record**
    - Create Gesture object:
      ```python
      new_gesture = Gesture(
          user_id=current_user.id,
          name="Swipe Right",
          action="POWERPOINT_NEXT_SLIDE",
          app_context="POWERPOINT",
          landmark_data={
              "frames": preprocessed_frames,
              "frame_count": 60,
              "duration_ms": 2000
          },
          quality_score=0.85,
          adaptive_threshold=0.75,  # Initial threshold
          recording_metadata={
              "trajectory": {
                  "magnitude": 0.15,
                  "classification": "moving"
              },
              "pose_fingerprint": {...}
          }
      )
      ```

23. **Backend saves to database**
    - Insert: `INSERT INTO gestures (...) VALUES (...)`
    - Commit transaction
    - Get auto-generated gesture ID

24. **Backend invalidates cache**
    - File: `backend/app/services/gesture_cache.py`
    - Clear cached gestures for this user
    - Mark index for rebuilding

25. **Backend logs activity**
    - Insert:
      ```sql
      INSERT INTO activity_logs (user_id, action, metadata)
      VALUES (?, 'gesture_recorded', '{"gesture_name": "Swipe Right"}')
      ```

26. **Backend returns response**
    - Status: `201 Created`
    - Body:
      ```json
      {
        "id": 15,
        "name": "Swipe Right",
        "action": "POWERPOINT_NEXT_SLIDE",
        "app_context": "POWERPOINT",
        "quality_score": 0.85,
        "adaptive_threshold": 0.75,
        "created_at": "2025-12-06T14:30:50Z"
      }
      ```

27. **Frontend shows success**
    - Display toast: "Gesture 'Swipe Right' saved successfully!"
    - Close recorder modal
    - Refresh gesture list

28. **Frontend saves recording state to file**
    - Write to `~/.airclick-recording` file: `"false"`
    - This unblocks gesture matching in hybrid mode

#### Alternative Flows

**A1: Camera not available**
- At step 5, if camera open fails:
  - Backend returns WebSocket close with error
  - Frontend shows: "Camera not available. Please check permissions."

**A2: No hand detected during recording**
- At step 12, if no hands in frames:
  - Frontend shows warning: "No hand detected"
  - User can retry recording

**A3: Too few frames**
- At step 15, if less than 30 frames:
  - Frontend shows error: "Recording too short. Hold gesture for at least 1 second."
  - User must re-record

**A4: Action already assigned**
- At step 17, if action already mapped to another gesture:
  - Backend returns `400 Bad Request`
  - Error: "Action 'Next Slide' already assigned to gesture 'Right Swipe'"
  - User must choose different action or edit existing gesture

**A5: Poor quality gesture**
- At step 21, if quality_score < 0.5:
  - Backend still saves but returns warning
  - Frontend shows: "⚠️ Low quality recording. Consider re-recording for better accuracy."

#### Participants for Sequence Diagram

1. User (Actor)
2. Frontend (GestureRecorderReal.js)
3. WebSocket Connection
4. HandTrackingService (MediaPipe)
5. GestureAPI (FastAPI /gestures routes)
6. PreprocessingService (Normalization)
7. PoseFingerprint (Feature extraction)
8. Database (PostgreSQL)

---

### UC-GEST-02: Update Existing Gesture

**Actor:** Regular User
**Preconditions:** User owns the gesture to update
**Postconditions:** Gesture recording updated in database
**Trigger:** User clicks "Edit" on existing gesture

#### Detailed Sequence

1. **User navigates to gesture list**
   - Page: `/User/home`
   - List shows all user's gestures

2. **User clicks "Edit" on a gesture**
   - Gesture ID: 15
   - Opens recorder modal in edit mode
   - Pre-fills: name, action, app_context

3. **Modal loads existing gesture**
   - Fetch: `GET /api/gestures/15`
   - Display current gesture info
   - Show "Re-record" option

4. **User clicks "Re-record"**
   - Same flow as UC-GEST-01 steps 2-13
   - Records new frames

5. **Frontend writes recording state**
   - Write to `~/.airclick-recording` file: `"true"`
   - Blocks gesture matching during recording

6. **User clicks "Save Changes"**
   - Endpoint: `PUT /api/gestures/15`
   - Body includes new frames

7. **Backend validates ownership**
   - Query:
     ```sql
     SELECT * FROM gestures
     WHERE id = 15 AND user_id = ?
     ```
   - If not found: Return `404 Not Found`

8. **Backend preprocesses new recording**
   - Same as UC-GEST-01 steps 18-21

9. **Backend updates gesture record**
   - Update:
     ```sql
     UPDATE gestures
     SET landmark_data = ?,
         quality_score = ?,
         recording_metadata = ?,
         updated_at = NOW()
     WHERE id = 15
     ```

10. **Backend resets statistics**
    - Update:
      ```sql
      UPDATE gestures
      SET match_count = 0,
          total_similarity = 0.0,
          accuracy_score = NULL,
          false_trigger_count = 0,
          adaptive_threshold = 0.75
      WHERE id = 15
      ```
    - Fresh start for new recording

11. **Backend invalidates cache**
    - Clear gesture cache
    - Mark index for rebuild

12. **Backend returns updated gesture**
    - Status: `200 OK`

13. **Frontend updates UI**
    - Refresh gesture list
    - Show toast: "Gesture updated successfully!"

14. **Frontend clears recording state**
    - Write to `~/.airclick-recording` file: `"false"`

#### Alternative Flows

**A1: User doesn't own gesture**
- At step 7, if user_id doesn't match:
  - Return `403 Forbidden`
  - Error: "You don't have permission to edit this gesture"

**A2: Gesture being used by another user**
- (Only for admin editing public gestures)
- Show warning: "This gesture is used by X users. Changes will affect all."

#### Participants for Sequence Diagram

1. User (Actor)
2. Frontend (GestureRecorderReal.js in edit mode)
3. WebSocket Connection
4. HandTrackingService
5. GestureAPI
6. PreprocessingService
7. Database

---

### UC-GEST-03: Delete Gesture

**Actor:** Regular User
**Preconditions:** User owns the gesture
**Postconditions:** Gesture removed from database
**Trigger:** User clicks "Delete" on gesture

#### Detailed Sequence

1. **User clicks delete button**
   - Gesture list shows all gestures
   - Click trash icon on gesture ID 15

2. **Frontend shows confirmation**
   - Modal: "Are you sure you want to delete 'Swipe Right'?"
   - Buttons: "Cancel" | "Delete"

3. **User confirms deletion**
   - Click "Delete"

4. **Frontend sends DELETE request**
   - Endpoint: `DELETE /api/gestures/15`
   - Headers: `Authorization: Bearer {token}`

5. **Backend validates ownership**
   - Query:
     ```sql
     SELECT * FROM gestures
     WHERE id = 15 AND user_id = ?
     ```

6. **Backend deletes gesture**
   - Delete:
     ```sql
     DELETE FROM gestures WHERE id = 15
     ```
   - Cascade: Also deletes related activity logs

7. **Backend invalidates cache**
   - Clear user's gesture cache
   - Mark index for rebuild

8. **Backend logs activity**
   - Insert:
     ```sql
     INSERT INTO activity_logs (user_id, action, metadata)
     VALUES (?, 'gesture_deleted', '{"gesture_id": 15}')
     ```

9. **Backend returns success**
   - Status: `204 No Content`

10. **Frontend updates UI**
    - Remove gesture from list
    - Show toast: "Gesture deleted"

#### Alternative Flows

**A1: User cancels**
- At step 3, if user clicks "Cancel":
  - Close modal
  - No changes made

**A2: Gesture already deleted**
- At step 5, if gesture not found:
  - Return `404 Not Found`
  - Frontend shows: "Gesture not found"

#### Participants for Sequence Diagram

1. User (Actor)
2. Frontend (Gesture list)
3. ConfirmModal (Confirmation dialog)
4. GestureAPI
5. Database

---

### UC-GEST-04: List User Gestures

**Actor:** Regular User
**Preconditions:** User is logged in
**Postconditions:** Display all user's gestures
**Trigger:** User navigates to home page

#### Detailed Sequence

1. **User navigates to home**
   - URL: `/User/home`

2. **Frontend sends GET request**
   - Endpoint: `GET /api/gestures/`
   - Headers: `Authorization: Bearer {token}`

3. **Backend extracts user from token**
   - Decode JWT
   - Get user_id from payload

4. **Backend queries user's gestures**
   - Query:
     ```sql
     SELECT * FROM gestures
     WHERE user_id = ?
     ORDER BY created_at DESC
     ```

5. **Backend returns gesture list**
   - Status: `200 OK`
   - Body:
     ```json
     [
       {
         "id": 15,
         "name": "Swipe Right",
         "action": "POWERPOINT_NEXT_SLIDE",
         "app_context": "POWERPOINT",
         "accuracy_score": 0.92,
         "match_count": 25,
         "false_trigger_count": 2,
         "quality_score": 0.85,
         "created_at": "2025-12-06T10:00:00Z"
       },
       // ... more gestures
     ]
     ```

6. **Frontend displays gestures**
   - Component: `GestureList.js`
   - For each gesture, show:
     - Name
     - Action
     - App context
     - Accuracy score
     - Match count
     - Edit/Delete buttons

#### Participants for Sequence Diagram

1. User (Actor)
2. Frontend (Home page)
3. GestureAPI
4. Database

---

### UC-GEST-05: Test Gesture Matching

**Actor:** Regular User
**Preconditions:** User has recorded gestures
**Postconditions:** Display matching results
**Trigger:** User opens gesture tester

#### Detailed Sequence

1. **User opens gesture tester**
   - Component: `GestureTester.js`
   - WebSocket connects (same as UC-GEST-01 steps 2-8)

2. **User performs gesture**
   - Hold hand in front of camera
   - Perform gesture (e.g., swipe right)

3. **Frontend collects test frames**
   - Collect 60-90 frames
   - Display frame count

4. **User clicks "Test Match"**
   - Frontend sends test request
   - Endpoint: `POST /api/gestures/test`
   - Body:
     ```json
     {
       "frames": [...],
       "app_context": "POWERPOINT"
     }
     ```

5. **Backend preprocesses test frames**
   - Same preprocessing as recording

6. **Backend fetches user's gestures**
   - Query:
     ```sql
     SELECT * FROM gestures
     WHERE user_id = ?
       AND app_context IN (?, 'GLOBAL')
     ```

7. **Backend runs DTW matching**
   - File: `backend/app/services/gesture_matcher.py`
   - Function: `match_gesture()`
   - For each gesture:
     - Compute DTW distance
     - Convert to similarity score
     - Compare against adaptive threshold

8. **Backend finds best match**
   - Return gesture with highest similarity
   - Include all candidates with scores

9. **Backend returns results**
   - Status: `200 OK`
   - Body:
     ```json
     {
       "matched": true,
       "best_match": {
         "gesture_id": 15,
         "gesture_name": "Swipe Right",
         "similarity": 0.89,
         "threshold": 0.75
       },
       "all_candidates": [
         {"name": "Swipe Right", "similarity": 0.89},
         {"name": "Wave", "similarity": 0.45},
         {"name": "Thumbs Up", "similarity": 0.12}
       ]
     }
     ```

10. **Frontend displays results**
    - Show matched gesture
    - Show similarity score
    - Show all candidates with scores
    - Visual feedback (green for match, red for no match)

#### Alternative Flows

**A1: No match found**
- At step 8, if all similarities below threshold:
  - Return `matched: false`
  - Show closest gesture with score

**A2: No gestures recorded**
- At step 6, if user has no gestures:
  - Return error: "No gestures recorded yet"

#### Participants for Sequence Diagram

1. User (Actor)
2. Frontend (GestureTester.js)
3. WebSocket Connection
4. HandTrackingService
5. GestureAPI
6. GestureMatcher (DTW)
7. Database

---

## Gesture Recognition Use Cases

---

### UC-RECOG-01: Real-time Hand Tracking (Electron Overlay)

**Actor:** Regular User
**Preconditions:** Backend running, Electron overlay started
**Postconditions:** Hand skeleton displayed on overlay
**Trigger:** Backend startup (auto-starts Electron)

#### Detailed Sequence

1. **Backend starts up**
   - File: `backend/app/main.py`
   - Event: `@app.on_event("startup")`

2. **Backend initializes HandTrackingService**
   - Create singleton instance
   - Pre-warm camera (capture 5 frames)
   - MediaPipe model loaded

3. **Backend starts Electron process**
   - Execute: `npm start` in electron directory
   - Non-blocking subprocess

4. **Electron main process starts**
   - File: `electron/main.js`
   - Create overlay window:
     - Size: 480x580
     - Position: (20, 20)
     - Transparent: true
     - Always on top: true

5. **Electron loads overlay.html**
   - File: `electron/overlay.html`
   - Renders UI:
     - Header (draggable)
     - Canvas for hand skeleton
     - Status indicators
     - Performance metrics (FPS, latency)

6. **Overlay connects WebSocket**
   - JavaScript in overlay.html
   - Connect: `ws://localhost:8000/ws/hand-tracking?hybrid=true`

7. **Backend accepts WebSocket (hybrid mode)**
   - File: `backend/app/services/hand_tracking.py`
   - Function: `handle_client(websocket, hybrid_mode=True)`

8. **Backend sends initial frame immediately**
   - Optimization: Send first frame before auth check
   - User sees hand instantly

9. **Backend validates authentication**
   - Read token from: `~/.airclick-token`
   - Decode JWT
   - Get user_id

10. **Backend queries user's gestures**
    - Query:
      ```sql
      SELECT COUNT(*) FROM gestures WHERE user_id = ?
      ```
    - Send status to overlay:
      ```json
      {
        "status": "enabled",
        "gesture_count": 5
      }
      ```

11. **Backend initializes HybridModeController**
    - File: `backend/app/services/hybrid_mode_controller.py`
    - Initialize state machine
    - Register gesture match callback
    - Register auth check callback

12. **Backend starts streaming loop**
    - Loop at 30 FPS:
      ```python
      while True:
          # Capture frame
          hand_data = process_frame()

          # Process with hybrid controller
          if hybrid_mode and hand_data:
              hybrid_result = hybrid_controller.process_frame(hand_data)
              hand_data['hybrid'] = hybrid_result

          # Send to overlay
          await websocket.send_text(json.dumps(hand_data))
          await asyncio.sleep(0.033)
      ```

13. **Overlay receives frame data**
    - Event: `ws.onmessage`
    - Parse JSON
    - Extract hand landmarks

14. **Overlay draws hand skeleton**
    - Clear canvas
    - For each landmark:
      - Draw cyan circle at (x*width, y*height)
    - For each connection:
      - Draw cyan line between landmarks
    - User sees real-time hand visualization

15. **Overlay updates status indicators**
    - FPS: Display current FPS
    - Latency: Display processing time
    - State: Display state machine state
      - "CURSOR_ONLY" (default)
      - "COLLECTING" (during gesture)
      - "MATCHING" (running DTW)
      - "IDLE" (cooldown)

16. **Loop continues until disconnect**
    - Runs indefinitely
    - Updates at 30 FPS
    - Low latency (10-20ms)

#### Alternative Flows

**A1: No hand detected**
- At step 12, if no hands in frame:
  - Send empty hand data
  - Overlay shows "No hand detected"
  - Clear canvas

**A2: User not authenticated**
- At step 9, if token file missing:
  - Send status: `{"status": "disabled", "reason": "not_authenticated"}`
  - Overlay shows: "Login to enable gestures"
  - Cursor control still works

**A3: Camera busy**
- At step 2, if camera in use:
  - Log warning
  - Try alternative camera index
  - If all fail, show error in overlay

#### Participants for Sequence Diagram

1. Backend Startup (main.py)
2. HandTrackingService (MediaPipe)
3. Electron Main Process
4. Electron Overlay Window (overlay.html)
5. WebSocket Connection
6. HybridModeController
7. Database (for gesture count)

---

### UC-RECOG-02: Hybrid Mode - Cursor Control

**Actor:** Regular User
**Preconditions:** Hybrid mode WebSocket connected
**Postconditions:** Cursor moves with hand
**Trigger:** Hand detected in CURSOR_ONLY state

#### Detailed Sequence

1. **Hybrid controller receives frame**
   - File: `backend/app/services/hybrid_mode_controller.py`
   - Function: `process_frame(hand_data)`

2. **State machine checks current state**
   - File: `backend/app/services/hybrid_state_machine.py`
   - Current state: `HybridState.CURSOR_ONLY`

3. **Extract hand position**
   - Get wrist landmark (landmark 0):
     ```python
     wrist = hand_data['hands'][0]['landmarks'][0]
     hand_x = wrist['x']  # 0.0 to 1.0
     hand_y = wrist['y']  # 0.0 to 1.0
     ```

4. **Map to screen coordinates**
   - File: `backend/app/services/cursor_controller.py`
   - Function: `map_hand_to_screen()`
   - Add margins to prevent edge sticking:
     ```python
     margin = 0.1
     usable_range = 1 - 2*margin

     screen_x = ((hand_x - margin) / usable_range) * screen_width
     screen_y = ((hand_y - margin) / usable_range) * screen_height
     ```

5. **Apply smoothing**
   - Function: `smooth_cursor_position()`
   - Exponential Moving Average (EMA):
     ```python
     alpha = 0.3  # Smoothing factor
     smoothed_x = alpha * screen_x + (1 - alpha) * prev_x
     smoothed_y = alpha * screen_y + (1 - alpha) * prev_y
     ```

6. **Move cursor**
   - Use pyautogui:
     ```python
     pyautogui.moveTo(smoothed_x, smoothed_y, duration=0)
     ```
   - Instant movement (no animation)

7. **Return cursor position**
   - Return to hybrid controller:
     ```json
     {
       "cursor": {
         "x": 960,
         "y": 540,
         "smoothed": true
       }
     }
     ```

8. **Send to overlay**
   - Overlay receives cursor position
   - Can display cursor position (optional)

9. **Loop continues**
   - Process next frame in 33ms

#### Alternative Flows

**A1: Multiple hands detected**
- At step 3, if multiple hands:
  - Use dominant hand (right by default)
  - Or use hand with highest confidence

**A2: Hand near edge**
- At step 4, if hand outside margins:
  - Clamp to screen bounds
  - Prevent cursor from leaving screen

#### Participants for Sequence Diagram

1. HybridModeController
2. HybridStateMachine
3. CursorController
4. pyautogui (System cursor)

---

### UC-RECOG-03: Hybrid Mode - Gesture Recognition and Execution

**Actor:** Regular User
**Preconditions:** User has gestures, hybrid mode active, PowerPoint open
**Postconditions:** Gesture matched, action executed (slide changes)
**Trigger:** User holds hand still for 1.5 seconds (stationary gesture) or moves hand (swipe gesture)

#### Detailed Sequence

**Phase 1: Detect Gesture Start**

1. **Hybrid controller receives frames**
   - Loop at 30 FPS
   - Current state: `CURSOR_ONLY`

2. **State machine calculates velocity**
   - Compare current wrist position to previous
   - Velocity = distance / time
   - Current velocity: 0.008 (very small)

3. **Detect stationary hand**
   - If velocity < 0.015 for 1.5 seconds:
     - Transition to `COLLECTING` state
   - OR if velocity > 0.08 for 0.15 seconds:
     - Transition to `COLLECTING` state (moving gesture)

4. **State machine transitions to COLLECTING**
   - Log: "🎬 TRANSITION: CURSOR_ONLY → COLLECTING"
   - Reason: "hand_stationary" or "hand_moving"
   - Disable cursor control
   - Start frame collection

**Phase 2: Collect Gesture Frames**

5. **Check authentication**
   - State machine calls `auth_check_callback()`
   - Check token file exists
   - Validate JWT token
   - Check not recording (`.airclick-recording` file)
   - If any fail: Abort collection, return to CURSOR_ONLY

6. **Collect frames**
   - Store each frame in buffer:
     ```python
     collected_frames.append({
         'timestamp': frame['timestamp'],
         'landmarks': frame['hands'][0]['landmarks']
     })
     ```
   - Continue until:
     - Max frames reached (90)
     - OR hand becomes stationary (for moving gestures)
     - OR hand removed (no hand detected)

7. **Detect gesture end**
   - For moving gestures (swipe):
     - If velocity < 0.015 for 0.3 seconds: End gesture
   - For stationary gestures (thumbs up):
     - If 60 frames collected: End gesture
   - If hand removed: End gesture immediately

8. **Validate frame count**
   - Check: `len(collected_frames) >= min_collection_frames (10)`
   - If too few: Abort, return to CURSOR_ONLY

**Phase 3: Match Gesture**

9. **State machine transitions to MATCHING**
   - Log: "🎬 TRANSITION: COLLECTING → MATCHING"
   - Collected: 65 frames
   - Duration: 2.1 seconds

10. **Call gesture match callback**
    - File: `backend/app/services/hand_tracking.py`
    - Function: `gesture_match_callback(frames)`

11. **Read authentication token**
    - Read from: `~/.airclick-token`
    - Decode JWT
    - Get user_id

12. **Query user's gestures**
    - Query:
      ```sql
      SELECT * FROM gestures
      WHERE user_id = ?
      ORDER BY id
      ```
    - Result: 5 gestures

13. **Preprocess query frames**
    - File: `backend/app/services/gesture_preprocessing.py`
    - Steps:
      - Resample to 60 frames
      - Temporal smoothing
      - Procrustes normalization
      - Bone-length normalization

14. **Run DTW matching (parallel)**
    - File: `backend/app/services/gesture_matcher.py`
    - Function: `match_gesture()`
    - For each gesture (in parallel):
      - Preprocess stored gesture
      - Compute ensemble DTW:
        - 50% direction-aware DTW
        - 30% multi-feature DTW
        - 20% standard DTW
      - Convert distance to similarity

15. **Results from DTW**
    - Gesture ID 15 ("Swipe Right"): 0.89 similarity
    - Gesture ID 12 ("Wave"): 0.45 similarity
    - Gesture ID 8 ("Thumbs Up"): 0.12 similarity

16. **Select best match**
    - Best: Gesture ID 15 with 0.89 similarity
    - Threshold: 0.75 (adaptive threshold for this gesture)

17. **Check threshold**
    - If similarity >= threshold:
      - TRUE MATCH
    - Else:
      - FALSE TRIGGER (log but don't execute)

18. **Update gesture statistics**
    - Update:
      ```sql
      UPDATE gestures
      SET total_similarity = total_similarity + 0.89,
          match_count = match_count + 1,
          accuracy_score = total_similarity / match_count
      WHERE id = 15
      ```
    - New accuracy: 0.91 (rolling average)

**Phase 4: Execute Action**

19. **Get action details**
    - Gesture action: "POWERPOINT_NEXT_SLIDE"
    - App context: "POWERPOINT"
    - Query action mapping:
      ```sql
      SELECT * FROM action_mappings
      WHERE action_code = 'POWERPOINT_NEXT_SLIDE'
      ```
    - Result: keyboard_shortcut = "Right"

20. **Call action executor**
    - File: `backend/app/services/action_executor.py`
    - Function: `execute_action(action, app_context)`

21. **Find PowerPoint window**
    - File: `backend/app/services/action_executor.py`
    - Function: `find_application_window("POWERPOINT")`
    - Use pygetwindow:
      ```python
      all_windows = gw.getAllTitles()
      # Search for: "PowerPoint", ".pptx", "Presentation"
      ```
    - Found: "Presentation1 - PowerPoint"

22. **Switch to PowerPoint**
    - Bring window to front:
      ```python
      window = gw.getWindowsWithTitle("Presentation1")[0]
      window.activate()
      time.sleep(0.1)  # Wait for window switch
      ```

23. **Execute keyboard shortcut**
    - Press Right arrow key:
      ```python
      pyautogui.press('right')
      ```
    - PowerPoint advances to next slide

24. **Return execution result**
    - Result:
      ```json
      {
        "success": true,
        "action_name": "Next Slide",
        "keyboard_shortcut": "Right",
        "window_switched": true,
        "window_title": "Presentation1 - PowerPoint"
      }
      ```

**Phase 5: Return to Cursor Mode**

25. **State machine stores match result**
    - Store in `last_match_result`:
      ```json
      {
        "matched": true,
        "gesture_name": "Swipe Right",
        "gesture_id": 15,
        "similarity": 0.89,
        "action_executed": true
      }
      ```

26. **State machine transitions to IDLE**
    - Log: "🎬 TRANSITION: MATCHING → IDLE"
    - Cooldown: 1 second

27. **Send match result to overlay**
    - Overlay receives match result
    - Display:
      - ✓ checkmark icon (green)
      - Gesture name: "Swipe Right"
      - Similarity: "89%"
    - Show for 3 seconds

28. **After cooldown**
    - Transition: IDLE → CURSOR_ONLY
    - Re-enable cursor control
    - Ready for next gesture

#### Alternative Flows

**A1: No match found (all below threshold)**
- At step 17, if best similarity < threshold:
  - Log as FALSE TRIGGER
  - Increment false_trigger_count
  - Don't execute action
  - Return to CURSOR_ONLY
  - Show "No match" in overlay

**A2: PowerPoint not running**
- At step 21, if PowerPoint window not found:
  - Return error:
    ```json
    {
      "success": false,
      "app_not_found": true,
      "error": "PowerPoint is not running"
    }
    ```
  - Log error
  - Still show match result in overlay
  - Display warning: "⚠️ PowerPoint not running"

**A3: Recording in progress**
- At step 5, if `.airclick-recording` file contains "true":
  - Abort gesture matching
  - Log: "BLOCKING - User is recording"
  - Return to CURSOR_ONLY
  - Prevents interference

**A4: Hand removed during collection**
- At step 6, if no hand detected:
  - Check if enough frames collected (>= 10)
  - If yes: Proceed to matching
  - If no: Abort, return to CURSOR_ONLY

**A5: Ambiguous gesture (multiple high scores)**
- At step 16, if multiple gestures > 0.80:
  - Select highest
  - Log: "Multiple candidates: Gesture A (0.85), Gesture B (0.82)"

#### Participants for Sequence Diagram

1. User (Actor)
2. HybridModeController
3. HybridStateMachine
4. HandTrackingService
5. GestureMatcher (DTW Engine)
6. PreprocessingService
7. Database (Gestures, Action Mappings)
8. ActionExecutor
9. pygetwindow (Window management)
10. pyautogui (Keyboard automation)
11. PowerPoint Application (External)
12. Electron Overlay (Visual feedback)

---

## Action Execution Use Cases

---

### UC-ACTION-01: Execute PowerPoint Action

**Actor:** System (triggered by gesture match)
**Preconditions:** PowerPoint is running, gesture matched
**Postconditions:** Slide changes
**Trigger:** Gesture matcher returns "POWERPOINT_NEXT_SLIDE"

#### Detailed Sequence

(Covered in UC-RECOG-03, steps 19-24)

Additional details:

**Supported PowerPoint Actions:**
- POWERPOINT_NEXT_SLIDE (Right arrow)
- POWERPOINT_PREV_SLIDE (Left arrow)
- POWERPOINT_START_PRESENTATION (F5)
- POWERPOINT_END_PRESENTATION (Escape)
- POWERPOINT_BLANK_SCREEN (B)
- POWERPOINT_PEN_TOOL (Ctrl+P)

**Error Handling:**
- If PowerPoint not found: Log error, show notification
- If wrong context (e.g., Word open instead): Log warning
- If shortcut fails: Retry once, then log error

#### Participants

1. ActionExecutor
2. pygetwindow
3. pyautogui
4. PowerPoint

---

### UC-ACTION-02: Execute Word Action

**Actor:** System
**Preconditions:** MS Word is running
**Postconditions:** Document formatting changes
**Trigger:** Gesture matched to Word action

#### Detailed Sequence

Same flow as UC-ACTION-01, different actions:

**Supported Word Actions:**
- WORD_BOLD (Ctrl+B)
- WORD_ITALIC (Ctrl+I)
- WORD_UNDERLINE (Ctrl+U)
- WORD_SAVE (Ctrl+S)
- WORD_UNDO (Ctrl+Z)
- WORD_REDO (Ctrl+Y)

---

### UC-ACTION-03: Execute Global Action

**Actor:** System
**Preconditions:** Any application context
**Postconditions:** System action executed
**Trigger:** Gesture matched to global action

#### Detailed Sequence

1. **Action executor receives global action**
   - Action: "GLOBAL_VOLUME_UP"
   - No window switching required

2. **Execute media key**
   - pyautogui.press('volumeup')

3. **System volume increases**

**Supported Global Actions:**
- GLOBAL_VOLUME_UP
- GLOBAL_VOLUME_DOWN
- GLOBAL_VOLUME_MUTE
- GLOBAL_PLAY_PAUSE
- GLOBAL_NEXT_TRACK
- GLOBAL_PREV_TRACK
- GLOBAL_SCREENSHOT (Win+Shift+S)

---

## Admin Panel Use Cases

---

### UC-ADMIN-01: View All Users

**Actor:** Admin User
**Preconditions:** Admin is logged in
**Postconditions:** Display user list
**Trigger:** Admin navigates to users page

#### Detailed Sequence

1. **Admin navigates to users page**
   - URL: `/Admin/users`

2. **Frontend sends GET request**
   - Endpoint: `GET /api/admin/users`
   - Headers: `Authorization: Bearer {admin_token}`

3. **Backend validates admin role**
   - Decode JWT
   - Check: `user.role == "ADMIN"`
   - If not admin: Return `403 Forbidden`

4. **Backend queries all users**
   - Query:
     ```sql
     SELECT id, email, full_name, role, status, last_login, created_at
     FROM users
     ORDER BY created_at DESC
     ```

5. **Backend returns user list**
   - Status: `200 OK`
   - Body: Array of user objects

6. **Frontend displays table**
   - Columns: Email, Name, Role, Status, Last Login
   - Actions: Edit, Disable/Enable, Delete

#### Participants

1. Admin User (Actor)
2. Frontend (Admin panel)
3. AdminAPI
4. Database

---

### UC-ADMIN-02: Disable User Account

**Actor:** Admin User
**Preconditions:** Target user exists
**Postconditions:** User account disabled
**Trigger:** Admin clicks "Disable" on user

#### Detailed Sequence

1. **Admin clicks disable button**
   - User ID: 5

2. **Frontend shows confirmation**
   - "Disable user user@example.com?"

3. **Admin confirms**

4. **Frontend sends PATCH request**
   - Endpoint: `PATCH /api/admin/users/5`
   - Body:
     ```json
     {
       "status": "INACTIVE"
     }
     ```

5. **Backend updates user**
   - Update: `UPDATE users SET status = 'INACTIVE' WHERE id = 5`

6. **Backend invalidates user's sessions**
   - (Optional) Add to token blacklist
   - Force re-login

7. **Backend returns updated user**
   - Status: `200 OK`

8. **Frontend updates table**
   - Show "INACTIVE" status
   - Change button to "Enable"

#### Participants

1. Admin User
2. Frontend
3. AdminAPI
4. Database

---

### UC-ADMIN-03: View System Statistics

**Actor:** Admin User
**Preconditions:** Admin logged in
**Postconditions:** Display dashboard stats
**Trigger:** Admin navigates to dashboard

#### Detailed Sequence

1. **Admin navigates to dashboard**
   - URL: `/Admin/dashboard`

2. **Frontend sends GET request**
   - Endpoint: `GET /api/admin/overview-stats`

3. **Backend calculates statistics**
   - Total users: `SELECT COUNT(*) FROM users`
   - Active users: `SELECT COUNT(*) FROM users WHERE status = 'ACTIVE'`
   - Total gestures: `SELECT COUNT(*) FROM gestures`
   - Gestures today: `SELECT COUNT(*) FROM gestures WHERE DATE(created_at) = CURRENT_DATE`
   - Average accuracy: `SELECT AVG(accuracy_score) FROM gestures WHERE accuracy_score IS NOT NULL`

4. **Backend returns stats**
   - Body:
     ```json
     {
       "total_users": 125,
       "active_users": 118,
       "total_gestures": 450,
       "gestures_today": 15,
       "avg_accuracy": 0.89,
       "total_matches_today": 1250
     }
     ```

5. **Frontend displays dashboard**
   - Cards showing metrics
   - Charts (Recharts):
     - User growth over time
     - Gesture accuracy trends
     - Most used actions

#### Participants

1. Admin User
2. Frontend (Dashboard)
3. AdminAPI
4. Database

---

### UC-ADMIN-04: View Activity Logs

**Actor:** Admin User
**Preconditions:** Admin logged in
**Postconditions:** Display activity logs
**Trigger:** Admin requests activity logs

#### Detailed Sequence

1. **Admin requests logs**
   - Endpoint: `GET /api/admin/users/5/activity?limit=50`

2. **Backend queries activity logs**
   - Query:
     ```sql
     SELECT * FROM activity_logs
     WHERE user_id = 5
     ORDER BY timestamp DESC
     LIMIT 50
     ```

3. **Backend returns logs**
   - Array of activity log entries

4. **Frontend displays timeline**
   - Timestamp
   - Action (login, gesture_recorded, gesture_matched)
   - Metadata

#### Participants

1. Admin User
2. Frontend
3. AdminAPI
4. Database

---

### UC-ADMIN-05: Manage Action Mappings

**Actor:** Admin User
**Preconditions:** Admin logged in
**Postconditions:** Action mappings updated
**Trigger:** Admin edits action mapping

#### Detailed Sequence

1. **Admin views action mappings**
   - Endpoint: `GET /api/admin/action-mappings`
   - Groups by app context

2. **Admin edits action**
   - Change keyboard shortcut
   - Enable/disable action

3. **Admin saves changes**
   - Endpoint: `PATCH /api/admin/action-mappings/5`
   - Body:
     ```json
     {
       "keyboard_shortcut": "Ctrl+Right",
       "is_active": true
     }
     ```

4. **Backend updates action mapping**
   - Validate shortcut format
   - Update database

5. **Backend invalidates cache**
   - Clear action mapping cache
   - All users get updated mappings

#### Participants

1. Admin User
2. Frontend
3. AdminAPI
4. Database

---

### UC-ADMIN-06: View User's Gestures

**Actor:** Admin User
**Preconditions:** Admin logged in
**Postconditions:** Display specific user's gestures
**Trigger:** Admin clicks "View Gestures" on user

#### Detailed Sequence

1. **Admin clicks "View Gestures"**
   - User ID: 5

2. **Frontend sends request**
   - Endpoint: `GET /api/admin/users/5/gestures`

3. **Backend queries gestures**
   - Query:
     ```sql
     SELECT * FROM gestures
     WHERE user_id = 5
     ORDER BY created_at DESC
     ```

4. **Backend returns gestures**
   - Include statistics

5. **Frontend displays table**
   - Show gesture name, action, accuracy
   - Admin can view but not edit user gestures

#### Participants

1. Admin User
2. Frontend
3. AdminAPI
4. Database

---

## System Integration Use Cases

---

### UC-SYS-01: Backend Startup

**Actor:** System
**Preconditions:** Dependencies installed, .env configured
**Postconditions:** All services running
**Trigger:** `uvicorn app.main:app --reload`

#### Detailed Sequence

1. **Uvicorn starts FastAPI**
   - Load environment variables from .env
   - Import app from main.py

2. **Create database tables**
   - SQLAlchemy creates tables if not exist
   - Connect to PostgreSQL

3. **Initialize HandTrackingService**
   - Load MediaPipe model
   - Pre-warm camera
   - Create singleton instance

4. **Start Electron overlay**
   - Execute: `npm start` in electron directory
   - Non-blocking subprocess
   - Log success/failure

5. **Register API routes**
   - /api/auth/*
   - /api/gestures/*
   - /api/action-mappings/*
   - /api/admin/*
   - /ws/hand-tracking

6. **Server ready**
   - Log: "✅ AirClick Backend is ready!"
   - HTTP: http://localhost:8000
   - WebSocket: ws://localhost:8000/ws

#### Participants

1. Uvicorn (ASGI server)
2. FastAPI App
3. Database
4. HandTrackingService
5. Electron Process

---

### UC-SYS-02: Electron Overlay Startup

**Actor:** System
**Preconditions:** Backend started Electron
**Postconditions:** Overlay visible and connected
**Trigger:** Backend executes `npm start`

#### Detailed Sequence

1. **Electron main.js executes**
   - Initialize remote module
   - Start token helper (port 9999)

2. **Create overlay window**
   - Transparent, always-on-top
   - Size: 480x580
   - Position: (20, 20)

3. **Load overlay.html**
   - Render UI
   - Initialize canvas

4. **Create system tray**
   - Add tray icon
   - Add context menu

5. **Connect WebSocket**
   - ws://localhost:8000/ws/hand-tracking?hybrid=true
   - Start receiving hand data

6. **Ready**
   - Overlay visible
   - Waiting for hand detection

#### Participants

1. Electron Main Process
2. Electron Renderer (overlay.html)
3. System Tray
4. WebSocket Connection

---

### UC-SYS-03: Token Synchronization

**Actor:** System
**Preconditions:** User logged in via web frontend
**Postconditions:** Electron overlay has authentication
**Trigger:** User logs in

#### Detailed Sequence

1. **User logs in**
   - Frontend receives JWT token

2. **Frontend stores in localStorage**
   - localStorage.setItem('token', token)

3. **Frontend saves to token helper**
   - POST http://localhost:9999/set-token
   - Body: JWT token

4. **Token helper writes to file**
   - File: ~/.airclick-token
   - Content: JWT token (plain text)

5. **Electron overlay reads token**
   - WebSocket connection uses this token
   - Backend validates for gesture matching

6. **User logs out**
   - Frontend sends DELETE to token helper
   - Token file deleted
   - Gesture matching disabled

#### Participants

1. Frontend (Login page)
2. Token Helper (HTTP server)
3. File System (~/.airclick-token)
4. Electron Overlay

---

### UC-SYS-04: WebSocket Reconnection

**Actor:** System
**Preconditions:** WebSocket connection lost
**Postconditions:** Connection restored
**Trigger:** Network interruption or backend restart

#### Detailed Sequence

1. **Connection lost**
   - Event: ws.onclose

2. **Frontend/Overlay detects disconnect**
   - Set: isConnected = false
   - Show: "Disconnected" message

3. **Wait 3 seconds**
   - Prevent rapid reconnection spam

4. **Attempt reconnection**
   - Create new WebSocket
   - ws://localhost:8000/ws/hand-tracking

5. **If successful**
   - Set: isConnected = true
   - Resume normal operation

6. **If failed**
   - Wait 5 seconds
   - Retry (max 10 attempts)

7. **If all retries fail**
   - Show: "Connection failed. Check backend is running."

#### Participants

1. WebSocket Client
2. Backend WebSocket Endpoint
3. HandTrackingService

---

## Summary of Use Cases

### Total Use Cases: 30

**Authentication (5 use cases):**
- UC-AUTH-01: User Registration
- UC-AUTH-02: User Login
- UC-AUTH-03: Google OAuth Login
- UC-AUTH-04: Password Reset Request
- UC-AUTH-05: Password Reset Completion

**Gesture Management (5 use cases):**
- UC-GEST-01: Record New Gesture
- UC-GEST-02: Update Existing Gesture
- UC-GEST-03: Delete Gesture
- UC-GEST-04: List User Gestures
- UC-GEST-05: Test Gesture Matching

**Gesture Recognition (3 use cases):**
- UC-RECOG-01: Real-time Hand Tracking
- UC-RECOG-02: Hybrid Mode - Cursor Control
- UC-RECOG-03: Hybrid Mode - Gesture Recognition and Execution

**Action Execution (3 use cases):**
- UC-ACTION-01: Execute PowerPoint Action
- UC-ACTION-02: Execute Word Action
- UC-ACTION-03: Execute Global Action

**Admin Panel (6 use cases):**
- UC-ADMIN-01: View All Users
- UC-ADMIN-02: Disable User Account
- UC-ADMIN-03: View System Statistics
- UC-ADMIN-04: View Activity Logs
- UC-ADMIN-05: Manage Action Mappings
- UC-ADMIN-06: View User's Gestures

**System Integration (4 use cases):**
- UC-SYS-01: Backend Startup
- UC-SYS-02: Electron Overlay Startup
- UC-SYS-03: Token Synchronization
- UC-SYS-04: WebSocket Reconnection

**Additional Edge Cases (4 use cases):**
- Camera Permission Denied
- Database Connection Failed
- Invalid JWT Token
- Concurrent Gesture Recording

---

## Sequence Diagram Guidelines

For each use case above, create sequence diagrams following these guidelines:

### Participants
- List all participants at the top
- Use consistent naming
- Group by layers (Presentation, Business, Data)

### Message Types
- Synchronous calls: Solid line with filled arrow (→)
- Asynchronous calls: Solid line with open arrow (⇢)
- Return messages: Dashed line (⤶)

### Activation Boxes
- Show when participant is active
- Nested for recursive calls

### Alt/Opt/Loop Fragments
- Alt: Alternative flows
- Opt: Optional operations
- Loop: Repeated operations

### Notes
- Add notes for important details
- Explain complex operations
- Reference file names and line numbers

---

**End of Use Case Documentation**

*Use this document to create accurate sequence diagrams for your FYP report.*
