# SPOC-Shot Demo

This project demonstrates a dashboard comparing traditional multi-pass agent loops against single-pass (SPOC-style) loops, now **deployable as a web demo** with client-side WebLLM inference!

## ⚙️ Configuration

SPOC-Shot uses environment variables for configuration. Get started quickly:

```bash
# Initialize configuration
make init

# Set up for development (recommended)
make dev

# Run the demo
make run
```

### Configuration Options

- **Development**: WebLLM mode, port 8004, auto-reload
- **Production**: Server mode, port 80, no reload  
- **Hybrid**: Both WebLLM and server support

```bash
# Quick configuration commands
make dev              # Development setup
make prod             # Production setup  
make hybrid           # Hybrid mode
make port PORT=3000   # Change port
make show             # Show current config
```

## 🚀 Quick Start

```bash
# 1. Initialize and configure
make init
make dev

# 2. Install dependencies and test setup
make install
make test

# 3. Run the demo
make run
```

The WebLLM model downloads automatically on first use.

## 🐋 Docker Deployment

```bash
# Build and run with Make
make docker-run

# Or build image only
make docker-build

# Or with Docker directly
docker build -t spoc-shot .
docker run -p 8004:8004 -e WEBLLM_MODE=webllm spoc-shot
```

## ⚙️ Deployment Modes

### WebLLM Mode (Recommended)
- **Client-side inference** using WebGPU
- **No server GPU required**
- Works on modern browsers (Chrome 113+, Firefox 110+)
- Model runs entirely in the user's browser

```bash
make dev && make run
```

### Hybrid Mode (Legacy + WebLLM)
- Supports both server-side vLLM and client-side WebLLM
- Falls back gracefully if vLLM server unavailable

```bash
make hybrid && make run
```

### Server Mode (Original)
- Requires external vLLM server with `--openai-api-server` flag
- Uses your specified model and hardware

```bash
make prod && make run
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
# Run setup verification and tests
make test

# Or run individually
uv run python test_setup.py
pytest -q
```

## 📊 Performance Notes

WebLLM performance varies by device:
- **Desktop GPU**: Fast inference, excellent experience
- **Laptop/Integrated**: Slower but functional
- **Mobile**: Limited, may not work reliably

The demo automatically detects capabilities and provides fallback options.
