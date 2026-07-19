@echo off
cd /d "%~dp0"

if not exist venv (
    echo No venv found here. Run start_backend.bat first.
    pause
    exit /b 1
)

call venv\Scripts\activate.bat

echo Starting Gradio UI...
echo A local URL (e.g. http://127.0.0.1:7861) will be printed below - open that in your browser.
echo.
python frontend\app.py

pause
