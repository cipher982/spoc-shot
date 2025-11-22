"""
Integration tests for The Storyteller that verify actual functionality
including WebLLM model loading and story generation.

WARNING: These tests require:
1. A GPU-enabled browser (Chrome/Firefox with WebGPU support)
2. ~4GB of free disk space for model caching
3. ~8GB of available RAM
4. Time - first run downloads a 2GB model

These tests are SLOW and should be run manually, not in CI.
"""
import pytest
from playwright.sync_api import Page, expect, TimeoutError
import time


class TestStorytellerWebLLMIntegration:
    """Test actual WebLLM functionality - requires GPU and significant time."""
    
    @pytest.mark.slow
    @pytest.mark.gpu_required
    def test_webllm_model_loads_successfully(self, page: Page):
        """Test that WebLLM actually loads the model (takes 1-3 minutes)."""
        page.goto("http://localhost:8004/")
        
        # Wait for the loading overlay to appear
        loading_overlay = page.locator("#loading-overlay")
        expect(loading_overlay).to_be_visible(timeout=5000)
        
        # Check that we see the "Preparing the Quill" message
        expect(page.get_by_text("Preparing the Quill")).to_be_visible()
        
        # Wait for model to load (this can take 1-3 minutes on first run)
        # We'll wait up to 3 minutes
        try:
            loading_overlay.wait_for(state="hidden", timeout=180000)  # 3 minutes
        except TimeoutError:
            pytest.fail("Model failed to load within 3 minutes - may need GPU or more time")
        
        # Verify the status changes to "Ready"
        expect(page.locator("#status")).to_have_text("Ready")
        
        # Verify the Write button is still enabled
        write_button = page.locator("#run-button")
        expect(write_button).to_be_enabled()
    
    @pytest.mark.slow
    @pytest.mark.gpu_required
    def test_story_generation_works(self, page: Page):
        """Test that clicking Write actually generates a story with tokens."""
        page.goto("http://localhost:8004/")
        
        # Wait for model to load (reuse cached model if available)
        loading_overlay = page.locator("#loading-overlay")
        loading_overlay.wait_for(state="hidden", timeout=180000)
        
        # Click the Write button
        write_button = page.locator("#run-button")
        write_button.click()
        
        # Status should change to indicate generation
        status = page.locator("#status")
        expect(status).not_to_have_text("Ready", timeout=5000)
        
        # The Write button should change to Cease
        cease_button = page.locator("#stop-button")
        expect(cease_button).to_be_visible()
        expect(write_button).not_to_be_visible()
        
        # Wait for some tokens to appear (give it 30 seconds)
        heatmap_text = page.locator("#heatmap-text")
        
        # Check that the placeholder text is replaced
        expect(heatmap_text).not_to_have_text(
            '"The blank page is the most terrifying thing the writer faces..."',
            timeout=30000
        )
        
        # Check that we have token elements with confidence classes
        tokens = page.locator(".token")
        tokens.first.wait_for(timeout=30000)
        
        # Verify we have multiple tokens
        token_count = tokens.count()
        assert token_count > 5, f"Expected multiple tokens, got {token_count}"
        
        # Verify tokens have confidence classes
        first_token = tokens.first
        token_classes = first_token.get_attribute("class")
        assert any(conf in token_classes for conf in [
            "token-confidence-very-high",
            "token-confidence-high",
            "token-confidence-good",
            "token-confidence-medium",
            "token-confidence-low",
            "token-confidence-very-low"
        ]), f"Token missing confidence class: {token_classes}"
        
        # Check that metrics are updated
        expect(page.locator("#confidence-value")).not_to_have_text("--")
        expect(page.locator("#entropy-value")).not_to_have_text("--")
        expect(page.locator("#perplexity-value")).not_to_have_text("--")
    
    @pytest.mark.slow
    @pytest.mark.gpu_required  
    def test_token_hover_shows_alternatives(self, page: Page):
        """Test that hovering over tokens shows alternative predictions."""
        # This test depends on story generation working
        # We'll reuse the generated story from the previous test
        # or generate a new one
        
        page.goto("http://localhost:8004/")
        
        # Wait for model and generate if needed
        loading_overlay = page.locator("#loading-overlay")
        loading_overlay.wait_for(state="hidden", timeout=180000)
        
        # Check if we have tokens already
        tokens = page.locator(".token")
        if tokens.count() == 0:
            # Generate a story
            page.locator("#run-button").click()
            tokens.first.wait_for(timeout=30000)
        
        # Hover over a token
        token_to_hover = tokens.nth(2)  # Pick the 3rd token
        token_to_hover.hover()
        
        # Check that tooltip appears
        tooltip = page.locator("#token-tooltip")
        expect(tooltip).to_be_visible(timeout=5000)
        
        # Check that tooltip contains candidate alternatives
        candidates = page.locator("#tooltip-candidates")
        expect(candidates).to_be_visible()
        
        # Verify we have multiple candidates listed
        candidate_items = candidates.locator("div")
        candidate_count = candidate_items.count()
        assert candidate_count > 0, "Tooltip should show alternative token candidates"


# Marker registration for pytest
def pytest_configure(config):
    """Register custom markers."""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "gpu_required: marks tests that require GPU/WebGPU support"
    )
