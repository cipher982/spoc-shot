import pytest
from playwright.sync_api import Page, expect


@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    """Configure browser context for testing."""
    return {
        **browser_context_args,
        "viewport": {"width": 1280, "height": 720},
    }


class TestStorytellerBasicFunctionality:
    """Test basic functionality of The Storyteller interface."""

    def test_should_load_storyteller_interface(self, page: Page):
        """Test that the storyteller interface loads correctly."""
        page.goto("http://localhost:8004/")

        # Check that the page title is correct
        expect(page).to_have_title("The Storyteller's Quill")

        # Check for the main header
        expect(page.get_by_text("The Storyteller")).to_be_visible()

        # Check for the subtitle
        expect(page.get_by_text("Weaving tales from the ether, one rune at a time")).to_be_visible()

        # Check for the control panel elements
        expect(page.get_by_text("The Tale's Beginning")).to_be_visible()
        expect(page.locator("#prompt-input")).to_be_visible()

    def test_should_have_working_parameter_controls(self, page: Page):
        """Test that parameter controls are present and functional."""
        page.goto("http://localhost:8004/")

        # Check that temperature slider exists and has default value
        temp_slider = page.locator("#temp-slider")
        expect(temp_slider).to_be_visible()
        expect(temp_slider).to_have_value("0.7")

        # Check temperature display
        expect(page.get_by_text("Chaos (Temp): 0.7")).to_be_visible()

        # Check that top-p slider exists and has default value
        top_p_slider = page.locator("#top-p-slider")
        expect(top_p_slider).to_be_visible()
        expect(top_p_slider).to_have_value("0.9")

        # Check top-p display
        expect(page.get_by_text("Focus (Top-P): 0.9")).to_be_visible()

    def test_should_update_parameter_displays_when_sliders_change(self, page: Page):
        """Test that parameter displays update when sliders are moved."""
        page.goto("http://localhost:8004/")

        # Change temperature slider
        temp_slider = page.locator("#temp-slider")
        temp_slider.fill("1.2")
        expect(page.get_by_text("Chaos (Temp): 1.2")).to_be_visible()

        # Change top-p slider
        top_p_slider = page.locator("#top-p-slider")
        top_p_slider.fill("0.5")
        expect(page.get_by_text("Focus (Top-P): 0.5")).to_be_visible()

    def test_should_have_write_button_enabled_initially(self, page: Page):
        """Test that the write button is enabled and visible."""
        page.goto("http://localhost:8004/")

        write_button = page.locator("#run-button")
        expect(write_button).to_be_visible()
        expect(write_button).to_be_enabled()
        expect(write_button).to_have_text("Write")

    def test_should_show_initial_placeholder_text(self, page: Page):
        """Test that the initial placeholder text is displayed."""
        page.goto("http://localhost:8004/")

        # Check for the initial placeholder text in the story area
        expect(page.get_by_text('"The blank page is the most terrifying thing the writer faces..."')).to_be_visible()
        expect(page.get_by_text("Type a topic above and command the quill to write.")).to_be_visible()


class TestStorytellerInputValidation:
    """Test input validation and interaction."""

    def test_should_accept_text_input_in_prompt_field(self, page: Page):
        """Test that the prompt input field accepts text."""
        page.goto("http://localhost:8004/")

        prompt_input = page.locator("#prompt-input")
        test_text = "A robot learning to paint in a post-apocalyptic garden"
        prompt_input.fill(test_text)

        # Verify the input was accepted
        expect(prompt_input).to_have_value(test_text)


class TestStorytellerUIResponsiveness:
    """Test UI responsiveness across different viewports."""

    @pytest.mark.parametrize("width,height", [
        (375, 667),   # Mobile
        (768, 1024),  # Tablet
        (1920, 1080), # Desktop
    ])
    def test_should_maintain_layout_on_different_viewports(self, page: Page, width: int, height: int):
        """Test that the layout works on different screen sizes."""
        page.set_viewport_size({"width": width, "height": height})
        page.goto("http://localhost:8004/")

        # Check that main elements are still visible
        expect(page.get_by_text("The Storyteller")).to_be_visible()
        expect(page.locator("#prompt-input")).to_be_visible()
        expect(page.locator("#run-button")).to_be_visible()
