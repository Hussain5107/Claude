@echo off
cd /d "%~dp0"

if not exist venv (
    echo Creating virtual environment...
    py -3.12 -m venv venv
)

call venv\Scripts\activate.bat

echo Installing/updating dependencies...
pip install -r requirements.txt

echo.
echo Starting backend on http://localhost:8000 ...
echo Leave this window open. Run start_frontend.bat in a separate window next.
echo.
uvicorn backend.main:app --reload --port 8000

pause
