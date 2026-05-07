@echo off
chcp 65001 >nul
title MediFlow CMS - Building...
cd /d "%~dp0"

echo.
echo  Building MediFlow CMS for production...
echo  This takes about 1-2 minutes.
echo  ─────────────────────────────────────────

call npm run build

if %errorlevel% neq 0 (
    echo.
    echo  [!!] Build failed. Check the errors above.
    pause
    exit /b 1
)

echo.
echo  [OK] Build complete. Run start.bat to launch.
echo.
pause
