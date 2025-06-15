from fastapi import FastAPI, Request, HTTPException
from sse_starlette.sse import EventSourceResponse
from app.agent import solve_multi_pass, solve_single_pass, WEBLLM_MODE
import json
import asyncio
import logging

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

@app.on_event("startup")
async def startup_event():
    logger.info("Application startup complete. All logs should now be visible.")
    logger.info("Open http://127.0.0.1:8001 to view the demo.")

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
            raise HTTPException(status_code=400, detail="Invalid request body.")

    prompt = data.get("prompt")
    mode = data.get("mode", "multi_pass")  # Default to multi_pass

    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt not provided.")

    logger.info(f"Received request for mode='{mode}' with prompt='{prompt}'")
    # Choose the solver based on the mode
    solver = solve_single_pass if mode == "single_pass" else solve_multi_pass
    logger.info(f"Using solver: {solver.__name__}")

    async def event_generator():
        """
        A generator function that yields server-sent events.
        """
        try:
            async for row in solver(prompt):
                yield {"data": json.dumps(row)}
        except Exception as e:
            logger.error(f"An unexpected error occurred in the event generator: {e}", exc_info=True)
            yield {"data": json.dumps({"phase": "error", "message": "An unexpected server error occurred."})}

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

# ---------------------------------------------------------------------------
# Optional favicon route
# Browsers look for /favicon.ico automatically; we return 204 to avoid the
# distracting 404 in the console.
# ---------------------------------------------------------------------------

@app.get("/favicon.ico")
async def favicon():
    return HTMLResponse(status_code=204)
