@echo off
echo ========================================
echo   SUMO Traffic Simulation API Server
echo ========================================
echo.

REM Check if SUMO_HOME is set
if not defined SUMO_HOME (
    echo ERROR: SUMO_HOME environment variable is not set!
    echo Please install SUMO and set SUMO_HOME to the installation directory.
    echo Example: set SUMO_HOME=C:\Program Files ^(x86^)\Eclipse\Sumo
    echo.
    pause
    exit /b 1
)

echo SUMO_HOME: %SUMO_HOME%
echo.

REM Check if Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python is not installed or not in PATH!
    echo Please install Python 3.8 or higher.
    echo.
    pause
    exit /b 1
)

echo Python version:
python --version
echo.

REM Check if dependencies are installed
echo Checking dependencies...
pip show fastapi >nul 2>&1
if errorlevel 1 (
    echo Installing dependencies...
    pip install -r requirements_api.txt
    echo.
)

echo Starting SUMO API Server...
echo Server will be available at: http://localhost:8000
echo WebSocket endpoint: ws://localhost:8000/ws
echo.
echo Press Ctrl+C to stop the server
echo.

python sumo_api_server.py

pause

