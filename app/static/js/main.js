// Main Application Entry Point
import { UncertaintyAnalyzer } from './modules/uncertainty.js';

// Application State
const app = {
  modules: {},
  initialized: false
};

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 Token Logits Playground initializing...');
  
  try {
    // Initialize WebLLM engine first
    await initializeWebLLMEngine();
    
    // Initialize core modules
    app.modules.uncertainty = new UncertaintyAnalyzer();
    
    // Initialize legacy code view
    initCodeView();
    
    app.initialized = true;
    console.log('✅ All modules initialized successfully');
    
    // Expose app for debugging
    window.SPOCShot = app;
    
  } catch (error) {
    console.error('❌ Error during initialization:', error);
  }
});

// WebLLM Engine Initialization
async function initializeWebLLMEngine() {
  try {
    console.log("🔍 Starting WebLLM initialization...");
    
    // Show loading UI
    const modelLoadingPanel = document.getElementById('model-loading-panel');
    const modelStatus = document.getElementById('model-status');
    const modelProgressText = document.getElementById('model-progress-text');
    const modelProgressBar = document.getElementById('model-progress-bar');
    const runButton = document.getElementById('run-button');
    
    if (modelLoadingPanel) modelLoadingPanel.classList.remove('hidden');
    if (runButton) runButton.disabled = true;
    if (modelStatus) modelStatus.textContent = "Loading WebLLM library...";
    
    // Import WebLLM
    const { CreateMLCEngine, prebuiltAppConfig } = await import(
      'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm'
    );
    console.log("✅ WebLLM 0.2.79 loaded");

    // Check WebGPU
    if (modelStatus) modelStatus.textContent = "Checking WebGPU support...";
    if (!('gpu' in navigator)) {
      throw new Error('WebGPU unavailable on this browser');
    }
    console.log("✅ WebGPU ready");

    // Verify model
    if (modelStatus) modelStatus.textContent = "Verifying model availability...";
    const selectedModel = "Qwen3-0.6B-q4f16_1-MLC";
    const found = prebuiltAppConfig.model_list.some((m) => m.model_id === selectedModel);
    
    if (!found) {
      throw new Error(`${selectedModel} missing from catalogue`);
    }
    console.log(`✅ Model found: ${selectedModel}`);

    // Load model
    if (modelStatus) modelStatus.textContent = "Loading model...";
    console.log("🔄 Creating MLC Engine...");
    
    const initProgressCallback = (report) => {
      const progress = Math.round((report.progress || 0) * 100);
      if (modelProgressText) modelProgressText.textContent = `${progress}%`;
      if (modelProgressBar) modelProgressBar.style.setProperty('--progress-width', `${progress}%`);
      if (modelStatus) modelStatus.textContent = report.text || `Loading model... ${progress}%`;
    };

    const webllmEngine = await CreateMLCEngine(selectedModel, { initProgressCallback });
    
    // Make globally available
    window.webllmEngine = webllmEngine;
    window.modelLoaded = true;
    
    console.log("✅ WebLLM engine ready globally");

    // Update UI
    if (modelStatus) modelStatus.textContent = "Model loaded successfully!";
    if (modelProgressText) modelProgressText.textContent = "100%";
    if (modelProgressBar) modelProgressBar.style.setProperty('--progress-width', '100%');
    
    setTimeout(() => {
      if (modelLoadingPanel) modelLoadingPanel.classList.add('hidden');
      if (runButton) runButton.disabled = false;
    }, 1000);

  } catch (error) {
    console.error("❌ WebLLM initialization failed:", error);
    
    const modelStatus = document.getElementById('model-status');
    const modelProgressBar = document.getElementById('model-progress-bar');
    const runButton = document.getElementById('run-button');
    
    if (modelStatus) modelStatus.textContent = `Error: ${error.message}`;
    if (modelProgressBar) modelProgressBar.classList.add('progress-error');
    if (runButton) {
      runButton.disabled = true;
      runButton.textContent = 'WebLLM Required';
    }
    
    throw error;
  }
}

// Initialize code view functionality
function initCodeView() {
  // Code view functionality can be removed or repurposed for uncertainty analysis
}

// Export for potential external usage  
export { app };