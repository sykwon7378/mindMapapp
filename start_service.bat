@echo off
REM Mind Map App Start Script

echo Starting Mind Map Service...

REM Navigate to the script's directory
cd /d "%~dp0"

REM Activate virtual environment if it exists
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else (
    echo [WARNING] Virtual environment venv not found. running with system python...
)

REM Run the FastAPI application
echo Running main.py...
venv\Scripts\python.exe main.py

pause
