#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d venv ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "Installing/updating dependencies..."
pip install -r requirements.txt

echo
echo "Starting backend on http://localhost:8000 ..."
echo "Leave this running. Run start_frontend.sh in a separate terminal next."
echo
uvicorn backend.main:app --reload --port 8000
