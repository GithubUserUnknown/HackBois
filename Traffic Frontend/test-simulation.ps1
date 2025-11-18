Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Traffic Management System" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "[Test 1] Checking Vehicle Tracking API (port 5000)..." -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/vehicles/recent" -Method GET -TimeoutSec 5
    Write-Host " OK" -ForegroundColor Green
}
catch {
    Write-Host " FAILED" -ForegroundColor Red
}

Write-Host "[Test 2] Checking SUMO API Server (port 8000)..." -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/status" -Method GET -TimeoutSec 5
    $status = $response.Content | ConvertFrom-Json
    Write-Host " OK" -ForegroundColor Green
    Write-Host "  Simulation running: $($status.is_running)" -ForegroundColor Gray
}
catch {
    Write-Host " FAILED" -ForegroundColor Red
}

Write-Host "[Test 3] Checking Frontend (port 3000)..." -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method GET -TimeoutSec 5
    Write-Host " OK" -ForegroundColor Green
}
catch {
    Write-Host " FAILED" -ForegroundColor Red
}

Write-Host "[Test 4] Checking RL Models..." -NoNewline
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/rl/models" -Method GET -TimeoutSec 5
    $rlData = $response.Content | ConvertFrom-Json
    Write-Host " OK ($($rlData.algorithms.Count) algorithms)" -ForegroundColor Green
}
catch {
    Write-Host " FAILED" -ForegroundColor Red
}

Write-Host ""
Write-Host "All tests complete!" -ForegroundColor Cyan
Write-Host "Open http://localhost:3000 to use the application" -ForegroundColor Yellow
Read-Host "Press Enter to exit"

