@echo off
chcp 65001 >nul
title MediFlow CMS
cd /d "%~dp0"

echo.
echo  Starting MediFlow CMS...
echo  ─────────────────────────────────────────

REM ── MySQL ──────────────────────────────────────────────────────────────────
set MYSQL_OK=0

REM Try common Windows service names
for %%S in (MySQL84 MySQL80 MySQL57 MySQL) do (
    sc query %%S >nul 2>&1
    if not errorlevel 1 (
        net start %%S >nul 2>&1
        echo  [OK] MySQL service started
        set MYSQL_OK=1
        goto :mysql_done
    )
)

REM Fall back to starting mysqld.exe directly
if exist "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" (
    start /B "" "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe" --defaults-file="C:\ProgramData\MySQL\MySQL Server 8.4\my.ini"
    timeout /t 3 /nobreak >nul
    echo  [OK] MySQL started
    set MYSQL_OK=1
    goto :mysql_done
)

echo  [!!] MySQL not found - make sure it is running before continuing

:mysql_done

REM ── Backend (FastAPI) ──────────────────────────────────────────────────────
set BACKEND=%~dp0backend
if exist "%BACKEND%\.venv\Scripts\python.exe" (
    start "MediFlow - Backend" cmd /k "cd /d %BACKEND% && .venv\Scripts\python -m uvicorn main:app --reload --port 8000"
) else (
    start "MediFlow - Backend" cmd /k "cd /d %BACKEND% && python -m uvicorn main:app --reload --port 8000"
)
echo  [OK] Backend starting on http://localhost:8000

REM ── Frontend (Next.js) ────────────────────────────────────────────────────
if exist ".next\BUILD_ID" (
    start "MediFlow - Frontend" cmd /k "cd /d %~dp0 && npm start"
    echo  [OK] Frontend starting in PRODUCTION mode on http://localhost:3000
) else (
    start "MediFlow - Frontend" cmd /k "cd /d %~dp0 && npm run dev"
    echo  [OK] Frontend starting in DEV mode on http://localhost:3000
    echo  [!!] Run build.bat once for faster production mode
)

REM ── Open browser after a short wait ───────────────────────────────────────
timeout /t 5 /nobreak >nul

echo.
echo  ┌──────────────────────────────────────────┐
echo  │   MediFlow CMS is running!               │
echo  │                                          │
echo  │   App      :  http://localhost:3000      │
echo  │   API docs :  http://localhost:8000/docs │
echo  │                                          │
echo  │   Login    :  admin@mediflow.com         │
echo  │   Password :  Admin@1234                 │
echo  └──────────────────────────────────────────┘
echo.

start http://localhost:3000
