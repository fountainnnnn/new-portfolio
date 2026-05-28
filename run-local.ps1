# Portfolio Monorepo - Local Stack Runner (PowerShell version - Persistent Loop Edition)
$rootDir = $PSScriptRoot
if (-not $rootDir) { $rootDir = Get-Location }

function Resolve-RequiredTool {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if (-not $command) {
        Write-Host "[ERROR] $Name was not found on PATH." -ForegroundColor Red
        exit 1
    }

    return $command.Source
}

$nodePath = Resolve-RequiredTool "node"
$pythonPath = Resolve-RequiredTool "python"
$npmPath = Resolve-RequiredTool "npm"
$npmStartCommand = Get-Command "npm.cmd" -ErrorAction SilentlyContinue
$npmStartPath = if ($npmStartCommand) { $npmStartCommand.Source } else { $npmPath }

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Portfolio Monorepo - PowerShell Local Runner" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  Using absolute paths:"
Write-Host "  Node:   $nodePath"
Write-Host "  Python: $pythonPath"
Write-Host "  NPM:    $npmPath"
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Terminate existing processes on relevant ports to prevent address-in-use errors
Write-Host "[1/5] Freeing ports..." -ForegroundColor Yellow
$ports = @(3000, 8011, 8012, 8013, 8014, 8020, 8021, 8031, 8032)
foreach ($port in $ports) {
    $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
    if ($connections) {
        foreach ($conn in $connections) {
            Write-Host "Stopping process $($conn.OwningProcess) listening on port $port..."
            Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}

# 2. Setup Portfolio Website frontend dependencies
Write-Host ""
Write-Host "[2/5] Preparing apps/portfolio-website..." -ForegroundColor Yellow
Set-Location "$rootDir\apps\portfolio-website"
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing portfolio web dependencies..."
    & $npmPath install
}

# 3. Setup Microservices virtualenvs and install dependencies
Write-Host ""
Write-Host "[3/5] Preparing backend microservices..." -ForegroundColor Yellow

# Coding Quiz service venv setup
Set-Location "$rootDir\services\coding-quiz"
if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment for coding-quiz..."
    & $pythonPath -m venv .venv
}
Write-Host "Installing coding-quiz dependencies..."
& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt

# Verify pre-made virtualenvs in root to make sure pip dependencies are healthy
Set-Location $rootDir
if (Test-Path ".venv-quiz-generator") {
    Write-Host "Verifying quiz-generator dependencies..."
    & ".\.venv-quiz-generator\Scripts\python.exe" -m pip install -r "services\quiz-generator\requirements.txt"
}
if (Test-Path ".venv-mock-generator") {
    Write-Host "Verifying mock-generator dependencies..."
    & ".\.venv-mock-generator\Scripts\python.exe" -m pip install -r "services\mock-generator\requirements.txt"
}
if (Test-Path ".venv-file-chat") {
    Write-Host "Verifying file-chat dependencies..."
    & ".\.venv-file-chat\Scripts\python.exe" -m pip install -r "services\file-chat-assistant\requirements.txt"
}

# 5. Setup Auto Dashboard backend and frontend
Write-Host ""
Write-Host "[4/5] Preparing projects/auto-dashboard..." -ForegroundColor Yellow

# Backend venv setup
Set-Location "$rootDir\projects\auto-dashboard\backend"
if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment for auto-dashboard backend..."
    & $pythonPath -m venv .venv
}
Write-Host "Installing auto-dashboard backend dependencies..."
& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt

# Frontend dependencies setup
Set-Location "$rootDir\projects\auto-dashboard\frontend"
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing auto-dashboard frontend dependencies..."
    & $npmPath install
}

# School project dependencies setup
Set-Location "$rootDir\projects\school-hdb-resale-ca1"
if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment for school-hdb-resale-ca1..."
    & $pythonPath -m venv .venv
}
Write-Host "Installing school-hdb-resale-ca1 dependencies..."
& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt

Set-Location "$rootDir\projects\school-veggie-ai-ca2"
if (-not (Test-Path ".venv")) {
    Write-Host "Creating virtual environment for school-veggie-ai-ca2..."
    & $pythonPath -m venv .venv
}
Write-Host "Installing school-veggie-ai-ca2 dependencies..."
& ".\.venv\Scripts\python.exe" -m pip install -r requirements.txt

# 6. Launch all 9 services as persistent background processes using Start-Process
Write-Host ""
Write-Host "[5/5] Launching all 9 services as persistent background processes..." -ForegroundColor Yellow

# Set environment variables for Next.js routing and basePath to enable correct proxying
$env:AUTODASH_BASE_PATH = "/auto-dashboard"
$env:NEXT_PUBLIC_API_BASE_URL = "/api/auto-dashboard"

# Quiz slide generator (8011)
Write-Host "Starting Quiz Slide Deck Generator on Port 8011..."
Start-Process -FilePath "$rootDir\.venv-quiz-generator\Scripts\python.exe" -ArgumentList "-m uvicorn app:app --port 8011" -WorkingDirectory "$rootDir\services\quiz-generator" -WindowStyle Hidden

# Mock paper generator (8012)
Write-Host "Starting Mock Paper Generator on Port 8012..."
Start-Process -FilePath "$rootDir\.venv-mock-generator\Scripts\python.exe" -ArgumentList "-m uvicorn app:app --port 8012" -WorkingDirectory "$rootDir\services\mock-generator" -WindowStyle Hidden

# File chat assistant (8013)
Write-Host "Starting File Chat Assistant on Port 8013..."
Start-Process -FilePath "$rootDir\.venv-file-chat\Scripts\python.exe" -ArgumentList "-m uvicorn app:app --port 8013" -WorkingDirectory "$rootDir\services\file-chat-assistant" -WindowStyle Hidden

# Coding quiz (8014)
Write-Host "Starting Coding Quiz on Port 8014..."
Start-Process -FilePath "$rootDir\services\coding-quiz\.venv\Scripts\python.exe" -ArgumentList "-m uvicorn app:app --port 8014" -WorkingDirectory "$rootDir\services\coding-quiz" -WindowStyle Hidden

# Decidr Backend (8021)
Write-Host "Starting Auto Dashboard Backend on Port 8021..."
Start-Process -FilePath "$rootDir\projects\auto-dashboard\backend\.venv\Scripts\python.exe" -ArgumentList "-m uvicorn main:app --port 8021" -WorkingDirectory "$rootDir\projects\auto-dashboard\backend" -WindowStyle Hidden

# Decidr Next.js Frontend (8020)
Write-Host "Starting Auto Dashboard Next.js Frontend on Port 8020..."
Start-Process -FilePath "$npmStartPath" -ArgumentList "run dev -- -p 8020" -WorkingDirectory "$rootDir\projects\auto-dashboard\frontend" -WindowStyle Hidden

# School HDB Resale Price Predictor (8031)
Write-Host "Starting School HDB Resale Price Predictor on Port 8031..."
$env:PORT = "8031"
$env:APP_BASE_PATH = "/school-hdb-resale-ca1"
$env:FLASK_ENV = "development"
$env:SESSION_COOKIE_SECURE = "false"
$env:SECRET_KEY = $env:SCHOOL_HDB_SECRET_KEY
if (-not $env:SECRET_KEY) { $env:SECRET_KEY = "local-dev-school-hdb-secret" }
Start-Process -FilePath "$rootDir\projects\school-hdb-resale-ca1\.venv\Scripts\python.exe" -ArgumentList "app.py" -WorkingDirectory "$rootDir\projects\school-hdb-resale-ca1" -WindowStyle Hidden

# School VeggieAI Classifier (8032)
Write-Host "Starting School VeggieAI Classifier on Port 8032..."
$env:PORT = "8032"
$env:APP_BASE_PATH = "/school-veggie-ai-ca2"
$env:FLASK_ENV = "development"
$env:SESSION_COOKIE_SECURE = "false"
$env:TRUST_PROXY_HEADERS = "true"
$env:SECRET_KEY = $env:SCHOOL_VEGGIE_SECRET_KEY
if (-not $env:SECRET_KEY) { $env:SECRET_KEY = "local-dev-school-veggie-secret" }
Start-Process -FilePath "$rootDir\projects\school-veggie-ai-ca2\.venv\Scripts\python.exe" -ArgumentList "app.py" -WorkingDirectory "$rootDir\projects\school-veggie-ai-ca2" -WindowStyle Hidden

# Main Portfolio Gateway Server (3000)
Write-Host "Starting Main Portfolio Gateway on Port 3000..."
Start-Process -FilePath "$nodePath" -ArgumentList "server.js" -WorkingDirectory "$rootDir\apps\portfolio-website" -WindowStyle Hidden

Write-Host ""
Write-Host "===================================================" -ForegroundColor Green
Write-Host "  All 9 services have been successfully launched!" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Portfolio Gateway: http://localhost:3000"
Write-Host "Auto Dashboard:    http://localhost:3000/auto-dashboard"
Write-Host "HDB Predictor:     http://localhost:3000/school-hdb-resale-ca1/"
Write-Host "VeggieAI:          http://localhost:3000/school-veggie-ai-ca2/"
Write-Host ""
Write-Host "Launching your browser in 5 seconds..."
Start-Sleep -Seconds 5
Start-Process "http://localhost:3000"

Set-Location $rootDir

Write-Host ""
Write-Host "Keeping runner alive to preserve active background services. Do NOT close this task." -ForegroundColor Yellow
while ($true) {
    Start-Sleep -Seconds 3600
}
