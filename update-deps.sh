#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== Updating backend dependencies ==="
cd "$ROOT/backend"

if [ ! -d .venv ]; then
  echo "Creating virtual environment..."
  python3 -m venv .venv
fi

source .venv/bin/activate

pip install --upgrade pip -q
pip install -r requirements.txt -q
echo "Backend dependencies updated."

echo ""
echo "=== Updating frontend dependencies ==="
cd "$ROOT/frontend"
npm install
echo "Frontend dependencies updated."

echo ""
echo "=== Done! Run ./start.sh to launch the app. ==="
