# The Storyteller Test Suite

This directory contains various test suites for The Storyteller application, ranging from basic UI tests to full integration tests.

## Test Categories

### 1. Basic E2E Tests (`test_storyteller_e2e.py`)
✅ **Currently Working** - Tests the basic UI without WebLLM
- Page loading and structure
- Parameter controls (sliders, inputs)
- Responsive design
- Initial state verification

**Run:** `make test-e2e`

### 2. Enhanced Basic Tests (`test_storyteller_basic.py`)  
✅ **Currently Working** - More comprehensive UI testing
- All elements present and visible
- Form interactions
- Accessibility features
- Keyboard navigation
- Loading overlay behavior

**Run:** `uv run python -m pytest tests/test_storyteller_basic.py -v`

### 3. Integration Tests (`test_storyteller_integration.py`)
❌ **Requires GPU/WebLLM** - Full functionality tests
- Model loading (2GB download)
- Story generation with real AI
- Token confidence visualization
- Interactive features

**Run:** `pytest tests/test_storyteller_integration.py -m "gpu_required"`

### 4. Mock Tests (Attempted)
🚧 **Work in Progress** - Attempts to mock WebLLM
- `test_storyteller_mocked.py` - Inject mock via page scripts
- `test_storyteller_with_mocks.py` - Intercept module loading
- `mock_webllm.py` - Python mock implementation

**Status:** Currently not working due to WebLLM's dynamic import mechanism

## What We Can Test Without GPU

✅ **UI/UX Elements:**
- Page structure and layout
- Form controls functionality
- CSS styling and responsive design
- Error states when WebLLM fails
- Accessibility compliance

❌ **AI Functionality (Requires GPU):**
- Model downloading and loading
- Text generation
- Token confidence visualization  
- Hover tooltips with alternatives
- Metrics calculation
- Story branching

## Running Tests

```bash
# Basic UI tests (always work)
make test-e2e

# All basic tests
uv run python -m pytest tests/test_storyteller_basic.py tests/test_storyteller_e2e.py -v

# GPU tests (only with WebGPU-capable browser)
uv run python -m pytest tests/test_storyteller_integration.py -v -m "gpu_required"

# Run all tests
uv run python -m pytest tests/ -v
```

## CI/CD Recommendations

For continuous integration, only run the basic tests:
- `test_storyteller_e2e.py`
- `test_storyteller_basic.py`

The GPU-dependent tests should be run manually or in specialized GPU-enabled environments.

## Future Improvements

1. **Service Worker Mocking:** Intercept WebLLM at the service worker level
2. **Stub Server:** Create a mock WebLLM server that mimics the API
3. **Visual Regression:** Screenshot tests for UI consistency
4. **Performance Tests:** Measure load times and responsiveness
