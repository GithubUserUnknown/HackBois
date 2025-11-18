#!/bin/bash

echo "========================================"
echo "  SUMO Traffic Simulation API Server"
echo "========================================"
echo ""

# Check if SUMO_HOME is set
if [ -z "$SUMO_HOME" ]; then
    echo "ERROR: SUMO_HOME environment variable is not set!"
    echo "Please install SUMO and set SUMO_HOME to the installation directory."
    echo "Example: export SUMO_HOME=/usr/share/sumo"
    echo ""
    exit 1
fi

echo "SUMO_HOME: $SUMO_HOME"
echo ""

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: Python 3 is not installed!"
    echo "Please install Python 3.8 or higher."
    echo ""
    exit 1
fi

echo "Python version:"
python3 --version
echo ""

# Check if dependencies are installed
echo "Checking dependencies..."
if ! python3 -c "import fastapi" &> /dev/null; then
    echo "Installing dependencies..."
    pip3 install -r requirements_api.txt
    echo ""
fi

echo "Starting SUMO API Server..."
echo "Server will be available at: http://localhost:8000"
echo "WebSocket endpoint: ws://localhost:8000/ws"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

python3 sumo_api_server.py

