# SPOC-Shot Demo

This project demonstrates a dashboard comparing traditional multi-pass agent loops against single-pass (SPOC-style) loops, now **deployable as a web demo** with client-side WebLLM inference!

## 🚀 Quick Start (WebLLM Mode)

The easiest way to run the demo - no GPU server required!

```bash
# Test setup
uv run python test_setup.py

# Run the demo
WEBLLM_MODE=webllm uv run uvicorn app.main:app --host 0.0.0.0 --port 8001

# Open http://localhost:8001
```

The WebLLM model (Qwen2.5-0.5B-Instruct, ~500MB) downloads automatically on first use.

## 🐋 Docker Deployment

```bash
# Build and run
docker-compose up --build

# Or with Docker directly
docker build -t spoc-shot .
docker run -p 8001:8001 -e WEBLLM_MODE=webllm spoc-shot
```

## ⚙️ Deployment Modes

### WebLLM Mode (Recommended)
- **Client-side inference** using WebGPU
- **No server GPU required**
- Works on modern browsers (Chrome 113+, Firefox 110+)
- Model runs entirely in the user's browser

```bash
WEBLLM_MODE=webllm uv run uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### Hybrid Mode (Legacy + WebLLM)
- Supports both server-side vLLM and client-side WebLLM
- Falls back gracefully if vLLM server unavailable

```bash
WEBLLM_MODE=hybrid VLLM_BASE_URL=http://your-server:8000/v1 uv run uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### Server Mode (Original)
- Requires external vLLM server with `--openai-api-server` flag
- Uses your specified model and hardware

```bash
WEBLLM_MODE=server VLLM_BASE_URL=http://cube:8000/v1 uv run uvicorn app.main:app --host 0.0.0.0 --port 8001
```

## 🧠 How It Works

The demo compares two agent architectures:

1. **Multi-Pass (Traditional ReAct)**: Multiple separate LLM calls for each tool interaction
2. **Single-Pass (SPOC)**: Maintains conversation state and KV cache across tool calls

Key features:
- **Real-time metrics**: Latency, token usage, LLM call count
- **Live log stream**: Step-by-step agent execution
- **WebGPU acceleration**: Client-side inference with WebLLM
- **KV cache demonstration**: Shows efficiency gains from state reuse

## 🧪 Browser Requirements

For WebLLM mode:
- **Chrome 113+** or **Firefox 110+** (for WebGPU support)
- **~2GB RAM** available for model inference
- **Modern GPU** recommended (integrated graphics work but slower)

## 🧪 Testing

```bash
# Run setup verification
uv run python test_setup.py

# Run agent tests (requires vLLM server)
pytest -q
```

## 📊 Performance Notes

WebLLM performance varies by device:
- **Desktop GPU**: Fast inference, excellent experience
- **Laptop/Integrated**: Slower but functional
- **Mobile**: Limited, may not work reliably

The demo automatically detects capabilities and provides fallback options.
