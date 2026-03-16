#!/usr/bin/env bash
# Build script for cloud deployment (Render, Railway, etc.)
# Builds the React frontend and installs Python backend dependencies.

set -e

echo "==> Installing backend dependencies..."
pip install -r backend/requirements.txt

echo "==> Installing frontend dependencies..."
cd frontend
npm install

echo "==> Building frontend..."
npm run build
cd ..

echo "==> Build complete. Frontend assets in frontend/dist/"
