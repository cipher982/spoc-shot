import pytest


@pytest.fixture(autouse=True)
def setup_page(page):
    """Set up each page for testing."""
    # Set a reasonable timeout for page operations
    page.set_default_timeout(30000)  # 30 seconds

    # Navigate to the base URL (assumes server is running)
    page.goto("http://localhost:8004/")

    yield page
