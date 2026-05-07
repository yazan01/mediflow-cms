@echo off
chcp 65001 >nul
title MediFlow CMS - Setup

python setup.py
if %errorlevel% neq 0 (
    echo.
    echo Setup failed. Check the error above.
    pause
    exit /b 1
)
