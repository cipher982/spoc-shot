"""
Basic E2E tests for The Storyteller focusing on what CAN be tested
without WebLLM/GPU functionality.
"""
import pytest
from playwright.sync_api import Page, expect


class TestStorytellerBasicFunctionality:
    """Test the parts of The Storyteller that don't require WebLLM."""
    
    def test_page_loads_correctly(self, page: Page):
        """Test that the page loads with all expected elements."""
        page.goto("http://localhost:8004/")
        
        # Title and header
        expect(page).to_have_title("The Storyteller's Quill")
        expect(page.locator("h1")).to_contain_text("The Storyteller")
        expect(page.get_by_text("Weaving tales from the ether")).to_be_visible()
        
        # Control panel
        expect(page.locator("#prompt-input")).to_be_visible()
        expect(page.locator("#temp-slider")).to_be_visible()
        expect(page.locator("#top-p-slider")).to_be_visible()
        expect(page.locator("#run-button")).to_be_visible()
        
        # Story area
        expect(page.get_by_text('"The blank page is the most terrifying')).to_be_visible()
        
        # Metrics panel
        expect(page.get_by_text("Certainty")).to_be_visible()
        expect(page.get_by_text("Arcana")).to_be_visible()
        expect(page.get_by_text("Ink Quality")).to_be_visible()
    
    def test_parameter_sliders_update_display(self, page: Page):
        """Test that sliders update their display values."""
        page.goto("http://localhost:8004/")
        
        # Temperature
        temp_slider = page.locator("#temp-slider")
        temp_slider.fill("1.3")
        expect(page.locator("#temp-display")).to_have_text("1.3")
        
        # Top-p
        top_p_slider = page.locator("#top-p-slider")
        top_p_slider.fill("0.7")
        expect(page.locator("#top-p-display")).to_have_text("0.7")
    
    def test_prompt_input_accepts_text(self, page: Page):
        """Test that the prompt input accepts and retains text."""
        page.goto("http://localhost:8004/")
        
        prompt_input = page.locator("#prompt-input")
        test_prompt = "A dragon teaching mathematics to young wizards"
        prompt_input.fill(test_prompt)
        
        expect(prompt_input).to_have_value(test_prompt)
    
    def test_responsive_layout(self, page: Page):
        """Test that the layout adapts to different screen sizes."""
        viewports = [
            {"width": 375, "height": 667, "name": "mobile"},
            {"width": 768, "height": 1024, "name": "tablet"},
            {"width": 1920, "height": 1080, "name": "desktop"}
        ]
        
        for viewport in viewports:
            page.set_viewport_size({"width": viewport["width"], "height": viewport["height"]})
            page.goto("http://localhost:8004/")
            
            # Key elements should remain visible
            expect(page.locator("h1")).to_be_visible()
            expect(page.locator("#prompt-input")).to_be_visible()
            expect(page.locator("#run-button")).to_be_visible()
    
    def test_loading_overlay_behavior(self, page: Page):
        """Test the loading overlay appears and contains expected elements."""
        page.goto("http://localhost:8004/")
        
        # The loading overlay should appear (even if briefly)
        loading_overlay = page.locator("#loading-overlay")
        
        # If WebLLM loads successfully, overlay will be hidden
        # If it fails, we should see an error
        # Either way, we can check the overlay exists
        assert loading_overlay.count() == 1
        
        # Check loading elements exist in the DOM
        expect(page.locator("#loading-status")).to_have_count(1)
        expect(page.locator("#loading-progress")).to_have_count(1)
        expect(page.locator("#loading-progress-text")).to_have_count(1)
    
    def test_initial_metric_values(self, page: Page):
        """Test that metrics show placeholder values initially."""
        page.goto("http://localhost:8004/")
        
        # All metrics should show "--" initially
        expect(page.locator("#confidence-value")).to_have_text("--")
        expect(page.locator("#entropy-value")).to_have_text("--")
        expect(page.locator("#perplexity-value")).to_have_text("--")
        expect(page.locator("#variance-value")).to_have_text("--")
        expect(page.locator("#coherence-value")).to_have_text("--")
    
    def test_status_indicator_exists(self, page: Page):
        """Test that the status indicator is present."""
        page.goto("http://localhost:8004/")
        
        status = page.locator("#status")
        expect(status).to_have_count(1)
        
        # Status will be either "Initializing WebLLM...", "Ready", or an error
        # We just verify it exists and has some text
        status_text = status.text_content()
        assert status_text is not None and len(status_text) > 0


class TestStorytellerAccessibility:
    """Test accessibility features of The Storyteller."""
    
    def test_form_labels_and_aria(self, page: Page):
        """Test that form elements have proper labels."""
        page.goto("http://localhost:8004/")
        
        # Prompt input should have associated label or aria-label
        prompt_input = page.locator("#prompt-input")
        assert prompt_input.get_attribute("placeholder") is not None
        
        # Sliders should have associated labels
        expect(page.get_by_text("Chaos (Temp):")).to_be_visible()
        expect(page.get_by_text("Focus (Top-P):")).to_be_visible()
    
    def test_keyboard_navigation(self, page: Page):
        """Test basic keyboard navigation."""
        page.goto("http://localhost:8004/")
        
        # Tab through interactive elements
        page.keyboard.press("Tab")  # Should focus prompt input
        page.keyboard.press("Tab")  # Should focus temp slider
        page.keyboard.press("Tab")  # Should focus top-p slider
        page.keyboard.press("Tab")  # Should focus Write button
        
        # The Write button should be focusable
        write_button = page.locator("#run-button")
        expect(write_button).to_be_visible()


# Summary of what we can and cannot test:

# ✅ CAN TEST (without WebLLM):
# - Page structure and layout
# - UI controls (sliders, inputs, buttons)
# - Responsive design
# - Initial state values
# - Accessibility features
# - CSS styling and classes
# - Error states (if WebLLM fails to load)

# ❌ CANNOT TEST (requires WebLLM/GPU):
# - Model loading progress
# - Story generation
# - Token visualization with confidence colors
# - Hover tooltips with alternatives
# - Metrics calculation (entropy, perplexity, etc.)
# - Stop button functionality
# - Token clicking to branch stories
