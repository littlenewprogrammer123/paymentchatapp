@echo off
echo ============================================
echo   MERN Interview Demo - Starting Application
echo ============================================
echo.

echo [1/2] Starting Backend (Port 5000)...
start cmd /k "cd /d "%~dp0backend" && echo Installing backend dependencies... && npm install && echo. && echo Starting Node.js server... && node server.js"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend (Port 3000)...
start cmd /k "cd /d "%~dp0frontend" && echo Installing frontend dependencies... && npm install && echo. && echo Starting React app... && npm start"

echo.
echo ============================================
echo   Both services are starting up!
echo   Backend:  http://localhost:5000
echo   Frontend: http://localhost:3000
echo ============================================
echo.
echo Note: Make sure MongoDB is running locally.
echo       Install MongoDB from https://www.mongodb.com/try/download/community
echo.
pause
