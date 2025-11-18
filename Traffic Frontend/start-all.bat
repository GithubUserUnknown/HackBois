@echo off
echo ========================================
echo Starting Traffic Management System
echo ========================================
echo.

REM Check if SUMO_HOME is set
if not defined SUMO_HOME (
    echo ERROR: SUMO_HOME environment variable is not set!
    echo Please set SUMO_HOME to your SUMO installation directory.
    echo Example: set SUMO_HOME=C:\Program Files\Eclipse\Sumo
    pause
    exit /b 1
)

echo SUMO_HOME is set to: %SUMO_HOME%
echo.

REM Start Vehicle Tracking Backend (Port 5000)
echo [1/3] Starting Vehicle Tracking Backend on port 5000...
start "Vehicle Tracking API" cmd /k "cd server && npm start"
timeout /t 3 /nobreak >nul

REM Start SUMO API Server (Port 8000)
echo [2/3] Starting SUMO API Server on port 8000...
start "SUMO API Server" cmd /k "cd Traffic Reinforcement && python sumo_api_server.py"
timeout /t 3 /nobreak >nul

REM Start Frontend Dev Server (Port 3000)
echo [3/3] Starting Frontend Dev Server on port 3000...
start "Frontend Dev Server" cmd /k "npm run dev"
timeout /t 5 /nobreak >nul

echo.
echo ========================================
echo All servers started!
echo ========================================
echo.
echo Vehicle Tracking API: http://localhost:5000
echo SUMO API Server:       http://localhost:8000
echo Frontend Dashboard:    http://localhost:3000
echo.
echo Opening browser...
timeout /t 2 /nobreak >nul
start http://localhost:3000
echo.
echo Press any key to close all servers...
pause >nul

REM Kill all servers
echo.
echo Stopping all servers...
taskkill /FI "WindowTitle eq Vehicle Tracking API*" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq SUMO API Server*" /T /F >nul 2>&1
taskkill /FI "WindowTitle eq Frontend Dev Server*" /T /F >nul 2>&1
echo All servers stopped.
pause

