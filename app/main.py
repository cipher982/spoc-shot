from fastapi import FastAPI, Request, HTTPException
from fastapi.staticfiles import StaticFiles
from sse_starlette.sse import EventSourceResponse
from app.agent import solve_multi_pass, solve_single_pass, WEBLLM_MODE
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

app = FastAPI()

# Add observability middleware
app.add_middleware(ObservabilityMiddleware)

# Instrument FastAPI with OpenTelemetry
instrument_fastapi(app)

# Get business metrics and tracer
business_metrics = get_metrics()
tracer = get_tracer()

# Mount static files using standard directory structure
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

@app.post("/solve")
async def solve_sse(request: Request):
    """
    Handles the POST request to solve a prompt and streams the response.
    """
    
    # ------------------------------------------------------------------
    # HTMX submits forms as "application/x-www-form-urlencoded".  The original
    # implementation only handled JSON and returned 400 errors when the UI
    # tried to call this endpoint.  Support both encodings so the API works
    # for browsers (form) and programmatic clients (JSON).
    # ------------------------------------------------------------------
    try:
        # Try JSON first – this will succeed for programmatic API usage.
        data = await request.json()
    except (json.JSONDecodeError, ValueError):
        # Fall back to URL-encoded or multipart forms (HTMX default).
        try:
            form = await request.form()
            data = dict(form)
        except Exception as e:
            logger.error("Failed to parse request body: %s", e, exc_info=True)
            # Error automatically tracked by OpenTelemetry instrumentation
            raise HTTPException(status_code=400, detail="Invalid request body.")

    prompt = data.get("prompt")
    mode = data.get("mode", "multi_pass")  # Default to multi_pass
    scenario = data.get("scenario", "sql")  # Default to sql

    if not prompt:
        # Error automatically tracked by OpenTelemetry instrumentation
        raise HTTPException(status_code=400, detail="Prompt not provided.")

    # Record business metrics
    if business_metrics and business_metrics.enabled:
        business_metrics.record_agent_request(
            mode=mode,
            scenario=scenario,
            webllm_mode=WEBLLM_MODE
        )

    logger.info(f"Received request for mode='{mode}', scenario='{scenario}' with prompt='{prompt}'")
    # Choose the solver based on the mode
    solver = solve_single_pass if mode == "single_pass" else solve_multi_pass
    logger.info(f"Using solver: {solver.__name__}")

    iteration_count = 0
    success = False
    start_time = time.time()
    
    # Start business context span
    if tracer:
        span = tracer.start_span("agent_execution")
        span.set_attributes({
            "agent.mode": mode,
            "agent.scenario": scenario,
            "agent.webllm_mode": WEBLLM_MODE,
            "agent.prompt_length": len(prompt)
        })
    
    async def event_generator():
        """
        A generator function that yields server-sent events.
        """
        nonlocal iteration_count, success
        
        try:
            async for row in solver(prompt, scenario=scenario):
                iteration_count += 1
                yield {"data": json.dumps(row)}
                
                # Check if this indicates success
                if isinstance(row, dict) and row.get("phase") == "complete":
                    success = True
                    
        except Exception as e:
            logger.error(f"An unexpected error occurred in the event generator: {e}", exc_info=True)
            
            # Record business error metrics
            if business_metrics and business_metrics.enabled:
                from app.observability import classify_error
                business_metrics.record_error(
                    error_type=classify_error(e),
                    mode=mode,
                    scenario=scenario
                )
                
            yield {"data": json.dumps({"phase": "error", "message": "An unexpected server error occurred."})}
        
        finally:
            # Record final business metrics
            duration = time.time() - start_time
            
            if business_metrics and business_metrics.enabled:
                business_metrics.record_agent_completion(
                    mode=mode,
                    scenario=scenario,
                    success=success,
                    duration=duration,
                    iterations=iteration_count
                )
            
            # Close span
            if tracer and 'span' in locals():
                span.set_attribute("agent.success", success)
                span.set_attribute("agent.iterations", iteration_count)
                span.set_attribute("agent.duration_seconds", duration)
                span.end()

    return EventSourceResponse(event_generator())

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
