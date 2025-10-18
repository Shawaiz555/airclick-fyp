@echo off
REM AirClick - Start FastAPI Backend
REM This script starts the FastAPI backend on port 8000

echo ============================================================
echo   Starting AirClick FastAPI Backend
echo ============================================================
echo.

cd backend
uvicorn app.main:app --reload

pause
