@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0"
cd /d "%ROOT_DIR%"

echo ===================================================
echo   Portfolio Monorepo - Local Stack Runner
echo ===================================================
echo.

:: 1. Check prerequisites
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Please install Node.js first.
  exit /b 1
)

where python >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Python was not found. Please install Python 3.12+ first.
  exit /b 1
)

:: 2. Terminate existing processes on relevant ports to prevent address-in-use errors
echo [1/5] Freeing ports...
for %%P in (3000 8011 8012 8013 8014 8020 8021 8031 8032) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING"') do (
    echo Stopping process %%A on port %%P...
    taskkill /F /PID %%A >nul 2>nul
  )
)

:: 3. Setup Portfolio Website frontend dependencies
echo.
echo [2/5] Preparing apps/portfolio-website...
cd /d "%ROOT_DIR%apps\portfolio-website"
if not exist "node_modules" (
  echo Installing portfolio web dependencies...
  call npm install
)
echo Building portfolio React frontend...
call npm run build

:: 4. Setup Microservices virtualenvs and install dependencies
echo.
echo [3/5] Preparing backend microservices...

:: Coding Quiz service venv setup
cd /d "%ROOT_DIR%services\coding-quiz"
if not exist ".venv" (
  echo Creating virtual environment for coding-quiz...
  python -m venv .venv
)
echo Installing coding-quiz dependencies...
".venv\Scripts\python.exe" -m pip install -r requirements.txt

:: Check other pre-made virtualenvs in root to make sure pip dependencies are healthy
cd /d "%ROOT_DIR%"
if exist ".venv-quiz-generator" (
  echo Verifying quiz-generator dependencies...
  ".venv-quiz-generator\Scripts\python.exe" -m pip install -r "services\quiz-generator\requirements.txt" >nul 2>nul
)
if exist ".venv-mock-generator" (
  echo Verifying mock-generator dependencies...
  ".venv-mock-generator\Scripts\python.exe" -m pip install -r "services\mock-generator\requirements.txt" >nul 2>nul
)
if exist ".venv-file-chat" (
  echo Verifying file-chat dependencies...
  ".venv-file-chat\Scripts\python.exe" -m pip install -r "services\file-chat-assistant\requirements.txt" >nul 2>nul
)

:: 5. Setup Auto Dashboard backend and frontend
echo.
echo [4/5] Preparing projects/auto-dashboard...

:: Backend venv setup
cd /d "%ROOT_DIR%projects\auto-dashboard\backend"
if not exist ".venv" (
  echo Creating virtual environment for auto-dashboard backend...
  python -m venv .venv
)
echo Installing auto-dashboard backend dependencies...
".venv\Scripts\python.exe" -m pip install -r requirements.txt

:: Frontend dependencies setup
cd /d "%ROOT_DIR%projects\auto-dashboard\frontend"
if not exist "node_modules" (
  echo Installing auto-dashboard frontend dependencies...
  call npm install
)

:: School project dependencies setup
cd /d "%ROOT_DIR%projects\school-hdb-resale-ca1"
if not exist ".venv" (
  echo Creating virtual environment for school-hdb-resale-ca1...
  python -m venv .venv
)
echo Installing school-hdb-resale-ca1 dependencies...
".venv\Scripts\python.exe" -m pip install -r requirements.txt

cd /d "%ROOT_DIR%projects\school-veggie-ai-ca2"
if not exist ".venv" (
  echo Creating virtual environment for school-veggie-ai-ca2...
  python -m venv .venv
)
echo Installing school-veggie-ai-ca2 dependencies...
".venv\Scripts\python.exe" -m pip install -r requirements.txt

:: 6. Launch all 9 services in background using start /B
echo.
echo [5/5] Launching all services in the background...

:: Quiz slide generator
echo Starting Quiz Slide Deck Generator on Port 8011...
cd /d "%ROOT_DIR%services\quiz-generator"
start /B cmd /c "..\..\.venv-quiz-generator\Scripts\python.exe -m uvicorn app:app --port 8011"

:: Mock paper generator
echo Starting Mock Paper Generator on Port 8012...
cd /d "%ROOT_DIR%services\mock-generator"
start /B cmd /c "..\..\.venv-mock-generator\Scripts\python.exe -m uvicorn app:app --port 8012"

:: File chat assistant
echo Starting File Chat Assistant on Port 8013...
cd /d "%ROOT_DIR%services\file-chat-assistant"
start /B cmd /c "..\..\.venv-file-chat\Scripts\python.exe -m uvicorn app:app --port 8013"

:: Coding quiz
echo Starting Coding Quiz on Port 8014...
cd /d "%ROOT_DIR%services\coding-quiz"
start /B cmd /c ".\.venv\Scripts\python.exe -m uvicorn app:app --port 8014"

:: Decidr Backend
echo Starting Auto Dashboard Backend on Port 8021...
cd /d "%ROOT_DIR%projects\auto-dashboard\backend"
start /B cmd /c ".\.venv\Scripts\python.exe -m uvicorn main:app --port 8021"

:: Decidr Next.js Frontend
echo Starting Auto Dashboard Next.js Frontend on Port 8020...
cd /d "%ROOT_DIR%projects\auto-dashboard\frontend"
start /B cmd /c "set AUTODASH_BASE_PATH=/auto-dashboard&& set NEXT_PUBLIC_API_BASE_URL=/api/auto-dashboard&& npm run dev -- -p 8020"

:: School HDB Resale Price Predictor
echo Starting School HDB Resale Price Predictor on Port 8031...
cd /d "%ROOT_DIR%projects\school-hdb-resale-ca1"
if "%SCHOOL_HDB_SECRET_KEY%"=="" (
  set "SCHOOL_HDB_LOCAL_SECRET=local-dev-school-hdb-secret"
) else (
  set "SCHOOL_HDB_LOCAL_SECRET=%SCHOOL_HDB_SECRET_KEY%"
)
start /B cmd /c "set PORT=8031&& set APP_BASE_PATH=/school-hdb-resale-ca1&& set FLASK_ENV=development&& set SESSION_COOKIE_SECURE=false&& set SECRET_KEY=%SCHOOL_HDB_LOCAL_SECRET%&& .\.venv\Scripts\python.exe app.py"

:: School VeggieAI Classifier
echo Starting School VeggieAI Classifier on Port 8032...
cd /d "%ROOT_DIR%projects\school-veggie-ai-ca2"
if "%SCHOOL_VEGGIE_SECRET_KEY%"=="" (
  set "SCHOOL_VEGGIE_LOCAL_SECRET=local-dev-school-veggie-secret"
) else (
  set "SCHOOL_VEGGIE_LOCAL_SECRET=%SCHOOL_VEGGIE_SECRET_KEY%"
)
start /B cmd /c "set PORT=8032&& set APP_BASE_PATH=/school-veggie-ai-ca2&& set FLASK_ENV=development&& set SESSION_COOKIE_SECURE=false&& set TRUST_PROXY_HEADERS=true&& set SECRET_KEY=%SCHOOL_VEGGIE_LOCAL_SECRET%&& .\.venv\Scripts\python.exe app.py"

:: Main Portfolio Gateway Server
echo Starting Main Portfolio Gateway on Port 3000...
cd /d "%ROOT_DIR%apps\portfolio-website"
start /B cmd /c "node server.js"

echo.
echo ===================================================
echo   All 9 services have been successfully launched!
echo ===================================================
echo.
echo Portfolio Gateway: http://localhost:3000
echo Auto Dashboard:    http://localhost:3000/auto-dashboard
echo HDB Predictor:     http://localhost:3000/school-hdb-resale-ca1/
echo VeggieAI:          http://localhost:3000/school-veggie-ai-ca2/
echo.
echo Launching your browser now...
:: Safe delay using ping instead of timeout
ping -n 6 127.0.0.1 >nul
explorer "http://localhost:3000"

endlocal
