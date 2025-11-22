# The Storyteller's Quill - Development Context

## Project Overview

Interactive AI storytelling app with real-time token probability visualization. Users type a topic, the AI writes a story, and they can see/interact with the model's confidence and alternative word choices.

**Live:** https://drose.io/storyteller/

## Quick Commands

```bash
make dev          # Start local dev server (port 8004)
make test         # Run test suite
make stop         # Stop dev server
make docker-prod  # Build & run production Docker
```

## Key Files

| File | Purpose |
|------|---------|
| `app/templates/logit-viz.html` | Main HTML template (single-page app) |
| `app/static/js/logit-viz.js` | Core UI logic, token rendering, click handlers |
| `app/static/js/webllm.js` | WebLLM initialization and streaming |
| `app/static/js/confidence-utils.js` | Token processing, probability calculations |
| `app/static/js/constants.js` | Configuration constants, WebLLM CDN URL |
| `app/main.py` | FastAPI server (serves static files) |

## Architecture

- **Frontend:** Vanilla JS + Tailwind CSS, old-book aesthetic
- **Inference:** WebLLM (runs entirely in browser via WebGPU)
- **Backend:** FastAPI (only serves static files, no compute)
- **Deployment:** Docker on Coolify (clifford server)

## Deployment Details

### Production URL
`https://drose.io/storyteller/`

### Server
- **Host:** clifford (Hetzner VPS)
- **Platform:** Coolify
- **Container:** `agent-zoom-h88goswcskksokcwcckcgs48-*`
- **Internal port:** 8000
- **Coolify App ID:** 23

### Routing
Caddy reverse proxy config at:
`/data/coolify/proxy/caddy/dynamic/drose-subdirectories.caddy`

```caddy
# Storyteller subdirectory
@storyteller path /storyteller /storyteller/*
handle @storyteller {
    uri strip_prefix /storyteller
    reverse_proxy agent-zoom:8000
}
```

### Deploying Changes
1. Push to `main` branch on GitHub
2. Coolify auto-detects and rebuilds (~1-2 min)
3. Container restarts with new code

To manually trigger:
```bash
ssh clifford "cd /data/coolify && docker compose restart agent-zoom"
```

### Checking Logs
```bash
ssh clifford "docker logs -f agent-zoom-h88goswcskksokcwcckcgs48-210109341093"
```

## Testing

```bash
make test                    # All tests
pytest tests/test_storyteller_basic.py  # UI tests only
```

Test infrastructure includes mock WebLLM for GPU-free CI/CD testing. See `tests/README.md`.

## Common Issues

### WebLLM not loading
- Check browser has WebGPU support (chrome://gpu)
- Check CDN URL in `constants.js` is accessible
- Check browser console for CORS or network errors

### Container unhealthy
- Check `/health` endpoint returns 200
- Review logs: `docker logs <container>`

### Caddy routing issues
- Verify config: `sudo cat /data/coolify/proxy/caddy/dynamic/drose-subdirectories.caddy`
- Restart proxy: `docker restart coolify-proxy`

## History

Evolved from SPOC-Shot (agent comparison demo) in Nov 2025. Original agent code archived in `tests/archive/`. See `CODE_REVIEW_SUMMARY.md` for migration details.
