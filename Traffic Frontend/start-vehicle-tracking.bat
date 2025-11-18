@echo off
echo ========================================
echo Starting Vehicle Tracking System
echo ========================================
echo.

echo Installing server dependencies...
cd server
call npm install
echo.

echo Starting backend server...
start cmd /k "npm start"
cd ..

timeout /t 3 /nobreak > nul

echo Starting frontend...
npm run dev

pause

