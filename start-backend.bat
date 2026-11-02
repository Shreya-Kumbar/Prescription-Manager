@echo off
title ArogyaNova Backend Server
cd /d "%~dp0arogyanova\backend"
echo ========================================================
echo  Starting ArogyaNova Backend API (FastAPI)
echo  http://localhost:8000
echo  API Documentation: http://localhost:8000/docs
echo ========================================================
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" run.py
) else (
    python run.py
)
pause
