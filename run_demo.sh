#!/bin/bash

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set defaults if not defined
HOST=${HOST:-127.0.0.1}
PORT=${PORT:-8004}
WEBLLM_MODE=${WEBLLM_MODE:-webllm}
RELOAD=${RELOAD:-true}

echo "🧠 Starting SPOC-Shot Demo..."
echo "=============================="
echo "📡 Host: $HOST"
echo "🔌 Port: $PORT"
echo "🧠 WebLLM Mode: $WEBLLM_MODE"
echo "🔄 Reload: $RELOAD"
echo ""

# Kill any existing processes on the configured port
echo "Cleaning up any existing processes on port $PORT..."
lsof -ti:$PORT | xargs kill -9 2>/dev/null || true

# Start the server with configured parameters
echo "Starting FastAPI server..."
if [ "$RELOAD" = "true" ]; then
    uv run uvicorn app.main:app --host $HOST --port $PORT --reload
else
    uv run uvicorn app.main:app --host $HOST --port $PORT
fi

echo ""
echo "🎉 Demo running at: http://$HOST:$PORT"
echo "🔒 Using $HOST for WebGPU security compatibility"
if [ "$HOST" = "127.0.0.1" ] && [ "$PORT" != "80" ]; then
    echo "📱 For remote access, use: ssh -L 8001:$HOST:$PORT user@host"
fi
