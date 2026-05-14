@echo off
setlocal

set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

echo Starting AutoDash AI...

if not exist "%BACKEND%\.venv\Scripts\python.exe" (
  echo Backend virtual environment not found. Creating one now...
  py -3 -m venv "%BACKEND%\.venv"
  if errorlevel 1 python -m venv "%BACKEND%\.venv"
)

if not exist "%BACKEND%\.venv\Scripts\python.exe" (
  echo Could not create backend virtual environment.
  pause
  exit /b 1
)

echo Installing backend requirements...
"%BACKEND%\.venv\Scripts\python.exe" -m pip install -r "%BACKEND%\requirements.txt"
if errorlevel 1 (
  echo Backend dependency install failed.
  pause
  exit /b 1
)

if not exist "%FRONTEND%\node_modules" (
  echo Installing frontend dependencies...
  pushd "%FRONTEND%"
  call npm install
  if errorlevel 1 (
    popd
    echo Frontend dependency install failed.
    pause
    exit /b 1
  )
  popd
)

echo Freeing backend port 8000 and frontend port 3000...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8000 .*LISTENING"') do (
  echo Stopping process %%P on port 8000...
  taskkill /F /PID %%P >nul 2>nul
)
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":3000 .*LISTENING"') do (
  echo Stopping process %%P on port 3000...
  taskkill /F /PID %%P >nul 2>nul
)

start "AutoDash AI Backend" /D "%BACKEND%" cmd /k ".\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000"
start "AutoDash AI Frontend" /D "%FRONTEND%" cmd /k "npm run dev"

echo.
echo AutoDash AI is starting in two terminal windows.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo.
timeout /t 3 /nobreak >nul
start http://localhost:3000

endlocal
