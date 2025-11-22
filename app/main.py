from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from sse_starlette.sse import EventSourceResponse
from app.agent import WEBLLM_MODE
from app.observability import setup_otel, instrument_fastapi, get_metrics, get_tracer
from app.middleware import ObservabilityMiddleware
import json
import asyncio
import logging
import os
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize OpenTelemetry early
setup_otel()

# --- Logging Setup ---
from logging.config import dictConfig
import logging

# Define the logging configuration
LogConfig = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {
            "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            "datefmt": "%Y-%m-%d %H:%M:%S",
        },
    },
    "handlers": {
        "default": {
            "class": "logging.StreamHandler",
            "formatter": "default",
            "level": "INFO",
        },
    },
    "loggers": {
        "": {"handlers": ["default"], "level": "INFO"}, # Root logger
        "uvicorn.error": {"level": "INFO"},
        "uvicorn.access": {"level": "INFO"},
    },
}

# Apply the configuration
dictConfig(LogConfig)

logger = logging.getLogger(__name__)

# Don't use root_path - let Caddy handle subdirectory routing with uri strip_prefix
app = FastAPI()

# Mount static files FIRST, before middleware/instrumentation
app.mount("/static", StaticFiles(directory="app/static"), name="static")

# Add observability middleware
app.add_middleware(ObservabilityMiddleware)

# Instrument FastAPI with OpenTelemetry
instrument_fastapi(app)

# Get business metrics and tracer
business_metrics = get_metrics()
tracer = get_tracer()

@app.on_event("startup")
async def startup_event():
    host = os.getenv("HOST", "127.0.0.1")
    port = os.getenv("PORT", "8004")
    logger.info("Application startup complete. All logs should now be visible.")
    logger.info(f"Open http://{host}:{port} to view the demo.")

# Removed /execute_tool endpoint - not used by storyteller


@app.get("/api/config")
async def get_config():
    """
    Returns the current server configuration.
    """
    return {
        "webllm_mode": WEBLLM_MODE,
        "server_available": WEBLLM_MODE in ["hybrid", "server"]
    }

from fastapi.responses import HTMLResponse

@app.api_route("/", methods=["GET", "HEAD"], response_class=HTMLResponse)
async def read_index():
    """
    Serves the main HTML page for the demo.
    """
    try:
        with open("app/templates/logit-viz.html") as f:
            return HTMLResponse(content=f.read(), status_code=200)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="logit-viz.html not found.")

# Debug endpoint removed - css-debug.html template no longer exists

# ---------------------------------------------------------------------------
# Optional favicon route
# Browsers look for /favicon.ico automatically; we return 204 to avoid the
# distracting 404 in the console.
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    """
    Health check endpoint for Docker healthcheck and monitoring systems.
    Returns 200 OK if the service is healthy.
    """
    return {"status": "healthy", "service": "spoc-shot"}


@app.get("/debug/metrics")
async def debug_metrics():
    """
    Debug endpoint to check if business metrics are working.
    """
    if not business_metrics:
        return {"error": "Business metrics not initialized"}
    
    if not business_metrics.enabled:
        return {"error": "Business metrics disabled (ENABLE_OTEL=false)"}
    
    return {
        "status": "Business metrics initialized",
        "enabled": business_metrics.enabled,
        "otel_configured": True
    }

@app.get("/favicon.ico")
async def favicon():
    return HTMLResponse(status_code=204)
