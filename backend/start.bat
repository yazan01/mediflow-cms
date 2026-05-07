@echo off
cd /d "%~dp0"
if exist ".venv\Scripts\activate" (
    call .venv\Scripts\activate
) else (
    pip install -r requirements.txt -q
)
uvicorn main:app --reload --port 8000
