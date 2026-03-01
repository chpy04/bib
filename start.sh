#!/usr/bin/env bash
set -e

trap 'kill 0' EXIT

# Backend
cd backend
if [ ! -d .venv ]; then
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
else
  source .venv/bin/activate
fi
[ ! -f .env ] && cp .env.example .env
uvicorn app.main:app --reload --port 8000 &

# Frontend
cd ../frontend
[ ! -d node_modules ] && npm install
npm run dev &

wait
