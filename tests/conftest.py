import pytest
import subprocess
import time
import signal
import os
from pathlib import Path


@pytest.fixture(scope="session")
def server():
    """Start the FastAPI server for testing."""
    # Set environment variables for testing
    env = os.environ.copy()
    env["WEBLLM_MODE"] = "webllm"  # Use webllm mode for testing
    env["HOST"] = "127.0.0.1"
    env["PORT"] = "8004"

    # Start the server
    server_process = subprocess.Popen(
        ["uv", "run", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8004", "--reload"],
        cwd=Path(__file__).parent.parent,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    # Wait for server to start
    time.sleep(3)

    try:
        # Verify server is running
        import requests
        response = requests.get("http://localhost:8004/health", timeout=5)
        assert response.status_code == 200

        yield server_process

    finally:
        # Clean up: terminate the server
        server_process.terminate()
        try:
            server_process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            server_process.kill()
            server_process.wait()


@pytest.fixture(autouse=True)
def setup_page(page, server):
    """Set up each page for testing."""
    # Set a reasonable timeout for WebLLM operations
    page.set_default_timeout(30000)  # 30 seconds

    # Navigate to the base URL
    page.goto("http://localhost:8004/")

    yield page
