# Traffic Management System - Start All Servers
# PowerShell Script

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting Traffic Management System" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if SUMO_HOME is set
if (-not $env:SUMO_HOME) {
    Write-Host "ERROR: SUMO_HOME environment variable is not set!" -ForegroundColor Red
    Write-Host "Please set SUMO_HOME to your SUMO installation directory." -ForegroundColor Yellow
    Write-Host "Example: `$env:SUMO_HOME = 'C:\Program Files\Eclipse\Sumo'" -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host "SUMO_HOME is set to: $env:SUMO_HOME" -ForegroundColor Green
Write-Host ""

# Store job references
$jobs = @()

# Start Vehicle Tracking Backend (Port 5000)
Write-Host "[1/3] Starting Vehicle Tracking Backend on port 5000..." -ForegroundColor Yellow
$job1 = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd server; npm start" -PassThru
$jobs += $job1
Start-Sleep -Seconds 3

# Start SUMO API Server (Port 8000)
Write-Host "[2/3] Starting SUMO API Server on port 8000..." -ForegroundColor Yellow
$job2 = Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'Traffic Reinforcement'; python sumo_api_server.py" -PassThru
$jobs += $job2
Start-Sleep -Seconds 3

# Start Frontend Dev Server (Port 3000)
Write-Host "[3/3] Starting Frontend Dev Server on port 3000..." -ForegroundColor Yellow
$job3 = Start-Process powershell -ArgumentList "-NoExit", "-Command", "npm run dev" -PassThru
$jobs += $job3
Start-Sleep -Seconds 5

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "All servers started!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Vehicle Tracking API: http://localhost:5000" -ForegroundColor Cyan
Write-Host "SUMO API Server:       http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend Dashboard:    http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "Opening browser..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"

Write-Host ""
Write-Host "Press any key to stop all servers..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Stop all servers
Write-Host ""
Write-Host "Stopping all servers..." -ForegroundColor Yellow
foreach ($job in $jobs) {
    if ($job -and !$job.HasExited) {
        Stop-Process -Id $job.Id -Force -ErrorAction SilentlyContinue
    }
}

# Also kill any remaining node/python processes on these ports
Write-Host "Cleaning up processes..." -ForegroundColor Yellow
Get-NetTCPConnection -LocalPort 3000,5000,8000 -ErrorAction SilentlyContinue | ForEach-Object {
    Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

Write-Host "All servers stopped." -ForegroundColor Green
Read-Host "Press Enter to exit"

