#!/bin/bash

echo "🧠 Starting SPOC-Shot Demo..."
echo "=============================="

# Kill any existing processes on port 8001
echo "Cleaning up any existing processes..."
lsof -ti:8001 | xargs kill -9 2>/dev/null || true

# Start the server
echo "Starting FastAPI server..."
WEBLLM_MODE=webllm uv run uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload

echo ""
echo "🎉 Demo running at: http://127.0.0.1:8001"
echo "🔒 Using 127.0.0.1 for WebGPU security compatibility"
echo "📱 For remote access, use: ssh -L 8001:127.0.0.1:8001 user@host"