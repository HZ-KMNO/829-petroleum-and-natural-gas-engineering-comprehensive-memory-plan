@echo off
setlocal
cd /d "%~dp0"

set "PNPM_CMD=pnpm.cmd"
where pnpm.cmd >nul 2>&1
if errorlevel 1 (
  set "PNPM_CMD=C:\Users\86131\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd"
  if not exist "%PNPM_CMD%" (
    echo [ERROR] pnpm was not found. Install Node.js and run: npm install -g pnpm
    pause
    exit /b 1
  )
)

if not exist "node_modules\.pnpm" (
  echo Installing dependencies...
  call "%PNPM_CMD%" install
  if errorlevel 1 (
    echo [ERROR] Dependency installation failed.
    pause
    exit /b 1
  )
)

powershell.exe -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  start "829 Memory Server" /min cmd /k ""%PNPM_CMD%" dev -- --port 5173 --strictPort"
  timeout /t 2 /nobreak >nul
)
start "" "http://127.0.0.1:5173/"
