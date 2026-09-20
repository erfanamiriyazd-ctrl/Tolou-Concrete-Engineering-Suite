@echo off
setlocal
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-windows-release.ps1"
if errorlevel 1 (
  echo.
  echo Tolou release build FAILED.
  pause
  exit /b 1
)
echo.
echo Tolou release build completed successfully.
pause
