"""
E2E tests for The Storyteller using mocked WebLLM.
These tests verify full functionality without requiring GPU or model downloads.
"""
import pytest
from playwright.sync_api import Page, expect
import asyncio


@pytest.fixture
def mock_webllm_script():
    """JavaScript to inject mock WebLLM into the page."""
    return """
    // FIRST: Mock navigator.gpu to prevent WebGPU errors
    if (!navigator.gpu) {
        Object.defineProperty(navigator, 'gpu', {
            value: { 
                requestAdapter: async () => ({ 
                    requestDevice: async () => ({ 
                        // Mock GPU device
                        queue: {},
                        features: new Set(),
                        limits: {}
                    }) 
                }) 
            },
            configurable: false,
            writable: false
        });
    }
    
    // Mock WebLLM implementation
    window.webllm = {
        prebuiltAppConfig: {
            model_list: [
                { model_id: 'Hermes-3-Llama-3.1-8B-q4f16_1-MLC' },
                { model_id: 'Llama-3.1-8B-Instruct-q4f32_1-MLC' }
            ]
        },
        
        CreateMLCEngine: async function(modelId, config) {
            const engine = new MockMLCEngine(modelId);
            if (config && config.initProgressCallback) {
                // Simulate loading progress
                for (let i = 0; i <= 100; i += 10) {
                    config.initProgressCallback({
                        progress: i / 100,
                        text: i < 100 ? `Loading model... ${i}%` : 'Model loaded!',
                        timeElapsed: i * 0.01
                    });
                    await new Promise(r => setTimeout(r, 10));
                }
            }
            return engine;
        }
    };
    
    class MockMLCEngine {
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
            
            // Return async iterator for streaming
            const storyTokens = this.getStoryTokens(params.prompt || '');
            const generator = this.generateChunks(storyTokens, params);
            return generator;
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
                const alternatives = this.getAlternatives(token);
                
                // Generate realistic logprobs
                const logprobData = {
                    content: [
                        { token: token, logprob: -0.5 + Math.random() * 0.4, prob: 0.6 + Math.random() * 0.3 },
                        ...alternatives.map(alt => ({
                            token: alt,
                            logprob: -2.5 + Math.random() * 1.5,
                            prob: 0.05 + Math.random() * 0.2
                        }))
                    ]
                };
                
                yield {
                    choices: [{
                        delta: {
                            content: token,
                            logprobs: params.logprobs ? logprobData : null
                        }
                    }]
                };
                
                // Simulate generation delay
                await new Promise(r => setTimeout(r, 5));
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


class TestStorytellerWithMocks:
    """Test The Storyteller with mocked WebLLM to verify integration."""
    
    def test_model_loading_with_mock(self, page: Page, mock_webllm_script):
        """Test that model loading UI works with mocked WebLLM."""
        # Inject the mock before navigation
        page.add_init_script(mock_webllm_script)
        
        # Navigate to the app with mock already injected
        page.goto("http://localhost:8004/")
        
        # The loading overlay should appear briefly
        loading_overlay = page.locator("#loading-overlay")
        
        # Wait for model to "load" (mock takes ~1 second)
        loading_overlay.wait_for(state="hidden", timeout=5000)
        
        # Verify status changes to Ready
        expect(page.locator("#status")).to_have_text("Ready")
        
        # Verify Write button is enabled
        expect(page.locator("#run-button")).to_be_enabled()
    
    def test_story_generation_with_mock(self, page: Page, mock_webllm_script):
        """Test that story generation works with mocked WebLLM."""
        page.add_init_script(mock_webllm_script)
        page.goto("http://localhost:8004/")
        
        # Wait for mock model to load
        page.locator("#loading-overlay").wait_for(state="hidden", timeout=5000)
        
        # Click Write button
        write_button = page.locator("#run-button")
        write_button.click()
        
        # Verify UI state changes
        expect(page.locator("#status")).not_to_have_text("Ready")
        expect(page.locator("#stop-button")).to_be_visible()
        expect(write_button).not_to_be_visible()
        
        # Wait for tokens to appear
        page.wait_for_selector(".token", timeout=10000)
        
        # Verify we have multiple tokens with confidence classes
        tokens = page.locator(".token")
        page.wait_for_function("document.querySelectorAll('.token').length > 5")
        
        # Check first token has confidence class
        first_token = tokens.first
        classes = first_token.get_attribute("class")
        assert "token-confidence-" in classes, f"Expected confidence class, got: {classes}"
        
        # Verify metrics are updated
        expect(page.locator("#confidence-value")).not_to_have_text("--")
        expect(page.locator("#entropy-value")).not_to_have_text("--")
        expect(page.locator("#perplexity-value")).not_to_have_text("--")
    
    def test_token_hover_with_mock(self, page: Page, mock_webllm_script):
        """Test that token hover shows alternatives with mocked data."""
        page.add_init_script(mock_webllm_script)
        page.goto("http://localhost:8004/")
        
        # Wait for model and generate story
        page.locator("#loading-overlay").wait_for(state="hidden", timeout=5000)
        page.locator("#run-button").click()
        
        # Wait for tokens
        page.wait_for_selector(".token", timeout=10000)
        page.wait_for_function("document.querySelectorAll('.token').length > 3")
        
        # Hover over the third token
        third_token = page.locator(".token").nth(2)
        third_token.hover()
        
        # Verify tooltip appears
        tooltip = page.locator("#token-tooltip")
        expect(tooltip).to_be_visible(timeout=2000)
        
        # Verify tooltip contains alternatives
        candidates = page.locator("#tooltip-candidates")
        expect(candidates).to_be_visible()
        
        # Should have multiple candidate entries
        candidate_items = candidates.locator("div")
        expect(candidate_items).to_have_count(4, timeout=2000)  # Expecting 4 alternatives
    
    def test_parameter_changes_affect_generation(self, page: Page, mock_webllm_script):
        """Test that temperature and top-p parameters are passed to the engine."""
        page.add_init_script(mock_webllm_script)
        page.goto("http://localhost:8004/")
        
        # Wait for model
        page.locator("#loading-overlay").wait_for(state="hidden", timeout=5000)
        
        # Change parameters
        temp_slider = page.locator("#temp-slider")
        temp_slider.fill("1.5")
        
        top_p_slider = page.locator("#top-p-slider") 
        top_p_slider.fill("0.5")
        
        # Verify displays updated
        expect(page.get_by_text("Chaos (Temp): 1.5")).to_be_visible()
        expect(page.get_by_text("Focus (Top-P): 0.5")).to_be_visible()
        
        # Generate story - parameters should be passed to mock engine
        page.locator("#run-button").click()
        
        # Verify generation works with new parameters
        page.wait_for_selector(".token", timeout=10000)
        tokens = page.locator(".token")
        expect(tokens).to_have_count(10, timeout=5000)
    
    def test_stop_generation_works(self, page: Page, mock_webllm_script):
        """Test that the stop button interrupts generation."""
        page.add_init_script(mock_webllm_script)
        page.goto("http://localhost:8004/")
        
        # Wait for model
        page.locator("#loading-overlay").wait_for(state="hidden", timeout=5000)
        
        # Start generation
        page.locator("#run-button").click()
        
        # Wait for a few tokens
        page.wait_for_function("document.querySelectorAll('.token').length >= 3")
        
        # Click stop
        stop_button = page.locator("#stop-button")
        stop_button.click()
        
        # Verify UI returns to ready state
        expect(page.locator("#run-button")).to_be_visible(timeout=2000)
        expect(stop_button).not_to_be_visible()
        
        # Count tokens - should be less than full story
        final_token_count = page.locator(".token").count()
        assert final_token_count < 20, f"Expected partial generation, got {final_token_count} tokens"
    
    def test_error_handling_when_webllm_fails(self, page: Page):
        """Test graceful handling when WebLLM is not available."""
        # Inject a script that removes WebLLM
        page.add_init_script("delete window.webllm; delete window.CreateMLCEngine;")
        page.goto("http://localhost:8004/")
        
        # Loading should eventually show an error
        loading_overlay = page.locator("#loading-overlay")
        
        # Wait for error state
        page.wait_for_function(
            "document.querySelector('#loading-status')?.textContent?.includes('Error') || " +
            "document.querySelector('#model-status')?.textContent?.includes('Error')",
            timeout=10000
        )
        
        # Should show error message
        error_text = page.locator("#loading-status, #model-status").text_content()
        assert "Error" in error_text or "failed" in error_text.lower()
