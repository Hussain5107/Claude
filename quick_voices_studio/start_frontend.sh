#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if [ ! -d venv ]; then
    echo "No venv found here. Run start_backend.sh first."
    exit 1
fi

source venv/bin/activate

echo "Starting Gradio UI..."
echo "A local URL (e.g. http://127.0.0.1:7861) will be printed below - open that in your browser."
echo

python frontend/app.py
