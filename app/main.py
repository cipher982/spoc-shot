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
# This is the proper way to configure logging for the whole application
# It ensures that loggers in other modules like 'app.agent' are also covered.
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

# Get root_path from environment for subdirectory support
root_path = os.getenv("APPLICATION_ROOT", "")
app = FastAPI(root_path=root_path)

# Add observability middleware
app.add_middleware(ObservabilityMiddleware)

# Instrument FastAPI with OpenTelemetry
instrument_fastapi(app)

# Get business metrics and tracer
business_metrics = get_metrics()
tracer = get_tracer()

# Mount static files at /static (Caddy will handle the root_path stripping)
# StaticFiles doesn't respect root_path, so we mount at absolute path
app.mount("/static", StaticFiles(directory="app/static"), name="static")

@app.on_event("startup")
async def startup_event():
    host = os.getenv("HOST", "127.0.0.1")
    port = os.getenv("PORT", "8004")
    logger.info("Application startup complete. All logs should now be visible.")
    logger.info(f"Open http://{host}:{port} to view the demo.")

@app.post("/execute_tool")
async def execute_tool(request: Request):
    """Execute a single tool call and return the result."""
    try:
        data = await request.json()
        tool_name = data.get("name")
        tool_args = data.get("args", {})
        
        if not tool_name:
            raise HTTPException(status_code=400, detail="Tool name is required")
        
        # Import here to avoid circular imports
        from app.tools import run_tool
        
        # Execute the tool
        result = run_tool({"name": tool_name, "args": tool_args})
        
        return result
        
    except Exception as e:
        logger.error(f"Tool execution error: {e}")
        return {"ok": False, "error": str(e)}


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

@app.get("/", response_class=HTMLResponse)
async def read_index():
    """
    Serves the main HTML page for the demo.
    """
    try:
        with open("app/templates/index.html") as f:
            return HTMLResponse(content=f.read(), status_code=200)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="index.html not found.")

@app.get("/debug", response_class=HTMLResponse)
async def css_debug():
    """
    Serves CSS debug page for testing variables.
    """
    try:
        with open("app/templates/css-debug.html") as f:
            return HTMLResponse(content=f.read(), status_code=200)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="css-debug.html not found.")

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
