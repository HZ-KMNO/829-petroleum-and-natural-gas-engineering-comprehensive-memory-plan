@echo off
setlocal
cd /d "%~dp0"

set "PORTABLE_APP=%~dp0desktop-app\829-memory-plan-1.0.0-portable.exe"
set "UNPACKED_APP=%~dp0desktop-app\win-unpacked\829石油与天然气工程综合记忆计划.exe"

if exist "%PORTABLE_APP%" (
  start "" "%PORTABLE_APP%"
  exit /b 0
)

if exist "%UNPACKED_APP%" (
  start "" "%UNPACKED_APP%"
  exit /b 0
)

echo [ERROR] Desktop application was not found.
echo Run "pnpm desktop:build" once, then try again.
pause
exit /b 1
