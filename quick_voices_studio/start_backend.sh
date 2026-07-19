#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

if [ ! -d venv ]; then
    echo "Creating virtual environment..."
    python3.12 -m venv venv
fi

source venv/bin/activate

echo "Installing/updating dependencies..."
pip install -r requirements.txt

echo
echo "Starting backend on http://localhost:8100 ..."
echo "Leave this running. Run start_frontend.sh in a separate terminal next."
echo

uvicorn backend.main:app --reload --port 8100
