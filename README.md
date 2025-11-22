# The Storyteller's Quill

An interactive AI storytelling experience with real-time token probability visualization. Watch the model "think" as it writes, seeing the confidence and alternative choices for each word.

**Live Demo:** https://drose.io/storyteller/

---

## Features

- **Interactive Story Generation** — Type a topic and watch the AI craft a story in real-time
- **Token Probability Visualization** — See model confidence with color-coded uncertainty indicators
- **Alternative Token Explorer** — Hover over any word to see what other tokens the model considered
- **Click-to-Retry** — Don't like a word? Click it to regenerate from that point with a different choice
- **Beautiful Old-Book Aesthetic** — Parchment textures, ink colors, and serif typography
- **Fully Client-Side** — Model runs in your browser via WebLLM (no data sent to servers)

---

## Requirements

- Python ≥ 3.12
- `uv` package manager
- A modern browser with **WebGPU** support (Chrome 113+, Edge 113+, Firefox 121+)

> The server only serves static files; all inference happens client-side in your browser.

---

## Quick Start

```bash
# 1. Install dependencies
make install

# 2. Start development server
make dev

# 3. Open browser
open http://127.0.0.1:8004
```

Or use the config helper:

```bash
./config.sh init      # Create .env from template
./config.sh dev       # Configure for development
make dev              # Start server
```

---

## Make Targets

```text
make help        # Show all available commands
make install     # Install Python dependencies (uv sync)
make dev         # Start development server with hot-reload
make test        # Run test suite
make docker      # Build and run in Docker (development)
make docker-prod # Build and run in Docker (production, detached)
make stop        # Stop the development server
make clean       # Remove cache files and prune Docker
```

---

## Configuration

Key environment variables (see `.env.example`):

| Variable       | Default   | Description                          |
|----------------|-----------|--------------------------------------|
| `HOST`         | `0.0.0.0` | Server bind address                  |
| `PORT`         | `8004`    | HTTP port                            |
| `RELOAD`       | `true`    | Enable uvicorn auto-reload           |
| `WEBLLM_MODE`  | `webllm`  | Inference mode (webllm/server/hybrid)|

---

## How It Works

1. **WebLLM** loads a quantized LLM (Llama/Qwen) directly in your browser using WebGPU
2. As the model generates tokens, it streams both the token and its **logprobs** (log probabilities)
3. The UI visualizes confidence levels:
   - **High confidence** (>90%) — Solid ink color
   - **Medium confidence** (70-90%) — Slightly faded
   - **Low confidence** (<70%) — Golden/uncertain appearance with decorative underline
4. Hovering reveals the top-5 alternative tokens the model considered
5. Clicking a token lets you "rewind" and try a different path

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      Browser                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  logit-viz  │───▶│   WebLLM    │───▶│   WebGPU    │  │
│  │    (.js)    │◀───│  Manager    │◀───│   (GPU)     │  │
│  └─────────────┘    └─────────────┘    └─────────────┘  │
└─────────────────────────────────────────────────────────┘
              │
              ▼ (static files only)
┌─────────────────────────────────────────────────────────┐
│                    FastAPI Server                        │
│         Serves HTML/JS/CSS • Health checks              │
└─────────────────────────────────────────────────────────┘
```

---

## Testing

```bash
make test
```

The test suite includes:
- **Basic tests** — UI elements, parameter controls, accessibility
- **E2E tests** — Full user interactions via Playwright
- **Mock infrastructure** — GPU-free testing with simulated WebLLM responses

See `tests/README.md` for details on the testing strategy.

---

## Deployment

Deployed via **Coolify** on clifford at `https://drose.io/storyteller/`

The Docker container:
- Builds with `uv` for fast dependency installation
- Runs uvicorn on port 8000 internally
- Caddy reverse proxy handles `/storyteller` path routing

---

## History

This project evolved from **SPOC-Shot**, an agent comparison demo. In November 2025, it was reimagined as **The Storyteller's Quill** — focusing on the creative and educational aspects of watching an LLM generate text token-by-token.

The original agent comparison code has been archived. See `CODE_REVIEW_SUMMARY.md` for details on the migration.

---

## License

Apache 2.0
