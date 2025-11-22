"""
E2E tests for The Storyteller using intercepted WebLLM loading.
These tests verify full functionality without requiring GPU or model downloads.
"""
import pytest
from playwright.sync_api import Page, expect, Route
import json


@pytest.fixture
def mock_webllm_module():
    """Return JavaScript code that mocks the entire WebLLM module."""
    return """
export const prebuiltAppConfig = {
    model_list: [
        { model_id: 'Hermes-3-Llama-3.1-8B-q4f16_1-MLC', model: 'mock' },
        { model_id: 'Llama-3.1-8B-Instruct-q4f32_1-MLC', model: 'mock' }
    ]
};

export async function CreateMLCEngine(modelId, config) {
    const engine = new MockEngine(modelId);
    if (config && config.initProgressCallback) {
        // Simulate loading progress
        for (let i = 0; i <= 100; i += 20) {
            config.initProgressCallback({
                progress: i / 100,
                text: i < 100 ? `Loading model... ${i}%` : 'Model loaded!',
                timeElapsed: i * 0.01
            });
            await new Promise(r => setTimeout(r, 50));
        }
    }
    return engine;
}

class MockEngine {
    constructor(modelId) {
        this.modelId = modelId;
        this.completions = new MockCompletions();
    }
}

class MockCompletions {
    async create(params) {
        const isStream = params.stream !== false;
        
        if (!isStream) {
            return {
                choices: [{
                    message: { content: 'Mock non-streaming response' }
                }]
            };
        }
        
        // Return async generator for streaming
        const storyTokens = this.getStoryTokens(params.prompt || '');
        return this.generateChunks(storyTokens, params);
    }
    
    getStoryTokens(prompt) {
        if (prompt.toLowerCase().includes('robot') && prompt.toLowerCase().includes('paint')) {
            return [
                "In", " the", " ruins", " of", " what", " was", " once", " Central", " Park",
                ",", " a", " lone", " robot", " named", " Circuit", " discovered", " something",
                " extraordinary", ":", " a", " forgotten", " art", " supply", " store", "."
            ];
        }
        return ["Once", " upon", " a", " time", ",", " there", " was", " a", " story", "."];
    }
    
    async *generateChunks(tokens, params) {
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            
            // Generate realistic logprobs
            const logprobData = {
                content: [{
                    token: token,
                    logprob: -0.5 + Math.random() * 0.4,
                    prob: 0.6 + Math.random() * 0.3,
                    bytes: btoa(token)
                }]
            };
            
            // Add alternatives
            const alternatives = this.getAlternatives(token);
            for (let j = 0; j < Math.min(4, alternatives.length); j++) {
                logprobData.content.push({
                    token: alternatives[j],
                    logprob: -2.5 + Math.random() * 1.5,
                    prob: 0.05 + Math.random() * 0.2,
                    bytes: btoa(alternatives[j])
                });
            }
            
            yield {
                choices: [{
                    delta: {
                        content: token,
                        logprobs: params.logprobs ? logprobData : null
                    }
                }]
            };
            
            await new Promise(r => setTimeout(r, 20));
        }
    }
    
    getAlternatives(token) {
        const alternatives = {
            "In": ["Within", "Inside", "At", "Throughout"],
            " the": [" a", " this", " that", " our"],
            " robot": [" machine", " android", " automaton", " cyborg"],
            " ruins": [" remains", " remnants", " wreckage", " debris"]
        };
        return alternatives[token] || ["the", "and", "of", "to"];
    }
}
    """


class TestStorytellerWithInterceptedWebLLM:
    """Test The Storyteller by intercepting WebLLM module loading."""
    
    def test_full_story_generation_flow(self, page: Page, mock_webllm_module):
        """Test the complete flow from page load to story generation."""
        
        # Intercept the WebLLM module request and serve our mock
        def handle_route(route: Route):
            if "@mlc-ai/web-llm" in route.request.url:
                route.fulfill(
                    status=200,
                    content_type="application/javascript", 
                    body=mock_webllm_module
                )
            else:
                route.continue_()
        
        page.route("**/*", handle_route)
        
        # Also ensure WebGPU is available
        page.add_init_script("""
            if (!navigator.gpu) {
                Object.defineProperty(navigator, 'gpu', {
                    value: { 
                        requestAdapter: async () => ({ 
                            requestDevice: async () => ({})
                        })
                    }
                });
            }
        """)
        
        # Navigate to the app
        page.goto("http://localhost:8004/")
        
        # Check initial state
        expect(page.locator("#loading-overlay")).to_be_visible()
        expect(page.get_by_text("Preparing the Quill")).to_be_visible()
        
        # Wait for model to load (should be quick with our mock)
        loading_overlay = page.locator("#loading-overlay")
        loading_overlay.wait_for(state="hidden", timeout=10000)
        
        # Verify we're in ready state
        expect(page.locator("#status")).to_have_text("Ready")
        
        # Start story generation
        write_button = page.locator("#run-button")
        expect(write_button).to_be_enabled()
        write_button.click()
        
        # Verify generation started
        expect(page.locator("#stop-button")).to_be_visible()
        expect(write_button).not_to_be_visible()
        
        # Wait for tokens to appear
        page.wait_for_selector(".token", timeout=10000)
        
        # Verify tokens are generated with confidence classes
        tokens = page.locator(".token")
        page.wait_for_function("document.querySelectorAll('.token').length >= 10")
        
        # Check a token has the right structure
        first_token = tokens.first
        token_classes = first_token.get_attribute("class")
        assert "token" in token_classes
        assert any(conf in token_classes for conf in [
            "token-confidence-very-high",
            "token-confidence-high", 
            "token-confidence-good",
            "token-confidence-medium",
            "token-confidence-low",
            "token-confidence-very-low"
        ])
        
        # Verify metrics are calculated
        expect(page.locator("#confidence-value")).not_to_have_text("--")
        expect(page.locator("#entropy-value")).not_to_have_text("--")
        expect(page.locator("#perplexity-value")).not_to_have_text("--")
        
        # Test hover functionality
        third_token = tokens.nth(2)
        third_token.hover()
        
        # Verify tooltip appears
        tooltip = page.locator("#token-tooltip")
        expect(tooltip).to_be_visible(timeout=2000)
        
        # Verify alternatives are shown
        expect(page.locator("#tooltip-candidates")).to_be_visible()
    
    def test_parameter_controls(self, page: Page, mock_webllm_module):
        """Test that parameter controls work correctly."""
        
        # Set up interception
        def handle_route(route: Route):
            if "@mlc-ai/web-llm" in route.request.url:
                route.fulfill(status=200, content_type="application/javascript", body=mock_webllm_module)
            else:
                route.continue_()
        
        page.route("**/*", handle_route)
        page.add_init_script("if (!navigator.gpu) { Object.defineProperty(navigator, 'gpu', { value: { requestAdapter: async () => ({ requestDevice: async () => ({}) }) } }); }")
        
        page.goto("http://localhost:8004/")
        page.locator("#loading-overlay").wait_for(state="hidden", timeout=10000)
        
        # Adjust parameters
        temp_slider = page.locator("#temp-slider")
        temp_slider.fill("1.8")
        expect(page.get_by_text("Chaos (Temp): 1.8")).to_be_visible()
        
        top_p_slider = page.locator("#top-p-slider")
        top_p_slider.fill("0.3")
        expect(page.get_by_text("Focus (Top-P): 0.3")).to_be_visible()
        
        # Generate with new parameters
        page.locator("#run-button").click()
        page.wait_for_selector(".token", timeout=10000)
        
        # Verify generation completed
        tokens = page.locator(".token")
        assert tokens.count() > 5
    
    def test_stop_button_functionality(self, page: Page, mock_webllm_module):
        """Test that generation can be stopped mid-stream."""
        
        # Set up interception
        def handle_route(route: Route):
            if "@mlc-ai/web-llm" in route.request.url:
                route.fulfill(status=200, content_type="application/javascript", body=mock_webllm_module)
            else:
                route.continue_()
        
        page.route("**/*", handle_route)
        page.add_init_script("if (!navigator.gpu) { Object.defineProperty(navigator, 'gpu', { value: { requestAdapter: async () => ({ requestDevice: async () => ({}) }) } }); }")
        
        page.goto("http://localhost:8004/")
        page.locator("#loading-overlay").wait_for(state="hidden", timeout=10000)
        
        # Start generation
        page.locator("#run-button").click()
        
        # Wait for a few tokens
        page.wait_for_function("document.querySelectorAll('.token').length >= 3")
        
        # Stop generation
        stop_button = page.locator("#stop-button")
        stop_button.click()
        
        # Verify we're back to ready state
        expect(page.locator("#run-button")).to_be_visible(timeout=2000)
        expect(stop_button).not_to_be_visible()
        
        # Check we have partial generation
        token_count = page.locator(".token").count()
        assert 3 <= token_count < 15, f"Expected partial generation, got {token_count} tokens"
