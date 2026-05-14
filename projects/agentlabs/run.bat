@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   AgentLabs LoRA Lab - Starting Backend + Frontend
echo ============================================
echo.

if not exist "node_modules" (
  echo Installing dependencies...
  call npm install
  if errorlevel 1 (
    echo.
    echo npm install failed.
    pause
    exit /b 1
  )
  echo.
)

echo Clearing old dev servers on ports 3000 and 8000 ...
for %%P in (3000 8000) do (
  for /f %%A in ('powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -LocalPort %%P -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"') do (
    echo   Killing PID %%A on port %%P
    taskkill /PID %%A /T /F >nul 2>&1
  )
)
echo.

echo Starting backend at http://127.0.0.1:8000 ...
start "AgentLabs Backend" /D "%~dp0backend" cmd /k "python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

echo Starting frontend at http://127.0.0.1:3000 ...
echo.
call npm run dev -- --host 127.0.0.1 --port 3000 --strictPort

pause
