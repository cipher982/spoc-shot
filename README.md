# SPOC-Shot Demo

SPOC-Shot is an educational sandbox that contrasts **multi-pass ReAct agents** against an optimized **single-pass (SPOC) agent**.  
It provides a live dashboard, token-level metrics, step-by-step logs and full client-side inference through **WebLLM**.

---

## 1 Requirements

• Python ≥ 3.12  
• `uv` package manager (pip-installable)  
• A modern browser with **WebGPU** (Chrome 113+, Firefox 110+) for WebLLM

> 🛈  The server can be run on CPU-only machines; model inference happens in the browser by default.

---

## 2 Quick Start (Local)

```bash
# 1. Configure environment (.env)
./config.sh init      # copy .env.example → .env
./config.sh dev       # dev mode: WebLLM, port 8004, auto-reload

# 2. Install deps & launch
make install          # ⇒ uv sync
make dev              # ⇒ uv run uvicorn app.main:app --reload

# 3. Open your browser
open http://127.0.0.1:8004
```

Alternate one-liner (uses whatever is already in `.env`):

```bash
./run_demo.sh
```

---

## 3 Configuration Helper

`config.sh` replaces several old Make targets (`init`, `prod`, `hybrid`, `port`, `show`).

| Command                 | Effect                                                        |
|-------------------------|---------------------------------------------------------------|
| `./config.sh init`      | Create `.env` from template                                   |
| `./config.sh dev`       | WebLLM mode, port 8004, auto-reload                           |
| `./config.sh prod`      | Server-only mode, port 80, no reload                          |
| `./config.sh hybrid`    | Hybrid (WebLLM + vLLM) mode, port 8004                        |
| `./config.sh port 3001` | Change exposed port                                           |
| `./config.sh show`      | Display current `.env`                                        |

Key environment variables (full list in `.env.example`):

| Var            | Default        | Description                                      |
|---------------|----------------|--------------------------------------------------|
| `HOST`         | `0.0.0.0`      | Bind address                                     |
| `PORT`         | `8004`         | HTTP port                                        |
| `RELOAD`       | `true`         | Uvicorn autoreload                               |
| `WEBLLM_MODE`  | `webllm`       | `webllm` \| `server` \| `hybrid`                 |
| `VLLM_BASE_URL`| `http://cube:8000/v1` | vLLM REST endpoint when server/hybrid mode |
| `MODEL_NAME`   | `local-7b`     | Model to request from vLLM                       |

---

## 4 Make Targets (current)

```text
make help        # print cheat-sheet
make install     # uv sync
make dev         # local development server (reload)
make test        # run pytest & sanity checks
make docker      # docker compose up --build (bind mount source)
make docker-prod # production image (detached, no mount)
make clean       # remove __pycache__, stray .pyc, prune docker
```

> ⚠️  Historical targets like `make run`, `make prod`, `make hybrid` are no longer in the Makefile. Use the equivalents above or `config.sh`.

---

## 5 Docker Usage

Development (source mounted, port forwarded from `.env`):

```bash
make docker              # or: docker compose up --build
```

Production (detached, no host port unless you set `PORT`):

```bash
make docker-prod         # or: docker compose -f docker-compose.prod.yml up -d
```

---

## 6 API End-points

| Method | Path            | Description                                         |
|--------|-----------------|-----------------------------------------------------|
| POST   | `/solve`        | SSE stream – body fields: `prompt`, `mode`, `scenario` |
| GET    | `/api/config`   | Returns `{ webllm_mode, server_available }`         |
| GET    | `/`             | SPA index page                                      |

---

## 7 Testing

```bash
# ensure .env exists first
./config.sh init --quiet || true

make test
```

The suite verifies Python imports, file structure and both agent paths (`tests/test_agent.py`).

---

## 8 How It Works (recap)

1. **Multi-Pass (baseline ReAct)** – each tool interaction is a separate LLM call.
2. **Single-Pass (SPOC)** – retains KV-cache and conversation state inside one streaming generation.

The web UI visualises: latency, token usage, LLM call count, live log stream and step-wise state.

---

## 9 Performance Notes

WebGPU / WebLLM speed depends heavily on hardware:

• Desktop dGPU → fast   
• Laptop iGPU   → usable   
• Mobile        → may fail due to memory limits (~2 GB required)

The demo auto-detects capability and falls back to server or hybrid modes when available.

---

## 10 Roadmap / Contributions

Planned features are tracked in `ROADMAP.md`.  PRs and issues are welcome — please run `make test` and format with black/ruff before submitting.

---

© 2024 SPOC-Shot authors. Licensed under the Apache 2.0 License.
