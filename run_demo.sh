#!/bin/bash

echo "🧠 Starting SPOC-Shot Demo..."
echo "=============================="

# Kill any existing processes on port 8001
echo "Cleaning up any existing processes..."
lsof -ti:8001 | xargs kill -9 2>/dev/null || true

# Start the server
echo "Starting FastAPI server..."
WEBLLM_MODE=webllm uv run uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

echo ""
echo "🎉 Demo should be running at: http://localhost:8001"
echo "📱 Or access from other devices at: http://[your-ip]:8001"