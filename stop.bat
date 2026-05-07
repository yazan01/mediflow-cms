@echo off
chcp 65001 >nul
title MediFlow CMS - Stopping

echo.
echo  Stopping MediFlow CMS...
echo  ─────────────────────────────────────────

REM Stop backend (Python / uvicorn)
taskkill /F /IM python.exe /T >nul 2>&1
echo  [OK] Backend stopped

REM Stop frontend (Node.js / Next.js)
taskkill /F /IM node.exe /T >nul 2>&1
echo  [OK] Frontend stopped

REM Stop MySQL — try service first, then taskkill
set MYSQL_STOPPED=0
for %%S in (MySQL84 MySQL80 MySQL57 MySQL) do (
    sc query %%S >nul 2>&1
    if not errorlevel 1 (
        net stop %%S >nul 2>&1
        set MYSQL_STOPPED=1
        goto :mysql_done
    )
)
taskkill /F /IM mysqld.exe /T >nul 2>&1
:mysql_done
echo  [OK] MySQL stopped

echo.
echo  MediFlow CMS has been stopped.
echo.
pause
