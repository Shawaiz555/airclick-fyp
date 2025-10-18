@echo off
REM AirClick - Start Python MediaPipe Service
REM This script starts the hand tracking service on port 8765

echo ============================================================
echo   Starting AirClick MediaPipe Hand Tracking Service
echo ============================================================
echo.

cd backend_mediapipe
python hand_tracking_service.py

pause
