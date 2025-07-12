// SPOC-Shot Demo JavaScript - DRY Refactored Version
// Uses centralized utilities to eliminate code duplication

import { LiveMetricsAnalyzer } from './analysis.js';
import { UnifiedUIManager } from './ui-components.js';
import { 
  WEBLLM_CONFIG, 
  buildMessages, 
  buildWebLLMOptions, 
  validateInput,
  getMockResponse 
} from './config.js';
import { 
  DEFAULT_MODEL, 
  WEBLLM_CDN_URL, 
  TIMING,
  BATCH_SIZE,
  BATCH_DELAY
} from './constants.js';
import { getElement, addEventListener } from './dom-utils.js';

// ========================================
// MAIN APPLICATION CLASS
// ========================================

class SPOCShotApp {
  constructor() {
    // Initialize unified UI manager
    this.ui = new UnifiedUIManager();
    
    // Global state
    this.currentAbortController = null;
    this.isGenerating = false;
    this.webllmEngine = null;
    this.modelLoaded = false;
    
    // Live metrics analyzer
    this.liveMetrics = new LiveMetricsAnalyzer();
    
    console.log('🚀 SPOC-Shot initialized with refactored architecture');
  }
  
  // ========================================
  // INITIALIZATION
  // ========================================
  
  async initialize() {
    try {
      this.setupEventListeners();
      this.ui.setIdleState();
      await this.checkServerConfig();
      await this.initializeWebLLM();
    } catch (error) {
      console.error('❌ Error during SPOC-Shot initialization:', error);
      this.showInitializationError(error);
    }
  }
  
  setupEventListeners() {
    // Main execution button
    addEventListener('run-button', 'click', (e) => {
      e.preventDefault();
      this.handleExecuteClick();
    });
    
    // Stop button
    addEventListener('stop-button', 'click', (e) => {
      e.preventDefault();
      this.handleStopClick();
    });
    
    console.log('✅ Event listeners configured');
  }
  
  // ========================================
  // WEBLLM INITIALIZATION
  // ========================================
  
  async initializeWebLLM() {
    this.ui.showModelLoading();
    
    try {
      console.log("🔍 Starting WebLLM initialization...");
      
      // 1️⃣ Load WebLLM library
      this.ui.updateModelLoading("Loading WebLLM library...");
      const { CreateMLCEngine, prebuiltAppConfig } = await import(WEBLLM_CDN_URL);
      console.log("✅ WebLLM loaded");
      
      // 2️⃣ Check WebGPU support
      this.ui.updateModelLoading("Checking WebGPU support...");
      if (!navigator.gpu) {
        throw new Error('WebGPU unavailable on this browser');
      }
      console.log("✅ WebGPU ready");
      
      // 3️⃣ Verify model availability
      this.ui.updateModelLoading("Verifying model availability...");
      const found = prebuiltAppConfig.model_list.some(m => m.model_id === DEFAULT_MODEL);
      if (!found) {
        throw new Error(`${DEFAULT_MODEL} missing from catalogue`);
      }
      console.log(`✅ Model found: ${DEFAULT_MODEL}`);
      
      // 4️⃣ Load the model with progress tracking
      this.ui.updateModelLoading("Loading model...");
      const initProgressCallback = (report) => {
        const progress = Math.round((report.progress || 0) * 100);
        this.ui.updateModelLoading(report.text || `Loading model... ${progress}%`, progress);
      };
      
      this.webllmEngine = await CreateMLCEngine(DEFAULT_MODEL, { initProgressCallback });
      
      // Make globally available for compatibility
      window.webllmEngine = this.webllmEngine;
      window.modelLoaded = true;
      
      this.modelLoaded = true;
      this.ui.completeModelLoading();
      this.ui.statusDisplay.setStatus('WebLLM Ready');
      
      console.log("✅ WebLLM initialization complete");
      
    } catch (error) {
      console.error("❌ WebLLM initialization failed:", error);
      this.ui.errorModelLoading(error.message);
      this.showWebLLMError(error);
    }
  }
  
  // ========================================
  // EVENT HANDLERS
  // ========================================
  
  async handleExecuteClick() {
    if (this.isGenerating) {
      console.log('Generation already in progress');
      return;
    }
    
    try {
      const input = this.ui.getInputValues();
      const errors = validateInput(input.prompt, input.temperature, input.topP);
      
      if (errors.length > 0) {
        alert('Validation errors:\n' + errors.join('\n'));
        return;
      }
      
      console.log('🚀 Execute button clicked - Starting analysis');
      await this.startUncertaintyAnalysis(input);
      
    } catch (error) {
      console.error('❌ Error in execute handler:', error);
      this.ui.setErrorState();
    }
  }
  
  handleStopClick() {
    try {
      console.log('⏹ Stop button clicked - Cancelling generation');
      this.stopGeneration();
    } catch (error) {
      console.error('❌ Error in stop handler:', error);
    }
  }
  
  // ========================================
  // UNCERTAINTY ANALYSIS
  // ========================================
  
  async startUncertaintyAnalysis(input) {
    if (this.isGenerating) return;
    
    // Set up generation state
    this.isGenerating = true;
    this.currentAbortController = new AbortController();
    this.liveMetrics.reset();
    
    // Update UI to analyzing state
    this.ui.setAnalyzingState();
    
    try {
      await this.runAnalysis(input, this.currentAbortController.signal);
      this.ui.setCompleteState();
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('Generation cancelled by user');
        this.ui.setCancelledState();
      } else {
        console.error('Analysis error:', error);
        this.ui.setErrorState();
      }
    } finally {
      this.resetGenerationState();
    }
  }
  
  async runAnalysis(input, signal) {
    if (this.modelLoaded && this.webllmEngine) {
      await this.runWebLLMAnalysis(input, signal);
    } else {
      await this.runMockAnalysis(input, signal);
    }
  }
  
  async runWebLLMAnalysis(input, signal) {
    const messages = buildMessages(input.prompt, input.scenario);
    const options = buildWebLLMOptions(input.scenario, {
      temperature: input.temperature,
      top_p: input.topP
    });
    
    try {
      const chunks = await this.webllmEngine.chat.completions.create({
        messages,
        ...options
      });
      
      let fullResponse = '';
      
      for await (const chunk of chunks) {
        // Check for cancellation
        if (signal?.aborted) {
          throw new DOMException('Generation cancelled', 'AbortError');
        }
        
        const choice = chunk.choices[0];
        const delta = choice?.delta;
        
        if (delta?.content) {
          fullResponse += delta.content;
          
          // Get logprobs from choice, not delta
          const chunkLogprobs = choice?.logprobs;
          
          // Add token to heatmap with batching
          this.ui.addTokenToHeatmap(delta.content, chunkLogprobs, true);
          
          // Calculate live metrics
          const currentMetrics = this.liveMetrics.addToken(delta.content, chunkLogprobs);
          
          // Update UI every N tokens
          if (this.liveMetrics.shouldUpdateUI()) {
            this.ui.updateLiveMetrics(currentMetrics);
          }
        }
      }
      
      // Final metrics update
      const finalMetrics = this.liveMetrics.getCurrentMetrics();
      this.ui.updateLiveMetrics(finalMetrics);
      
    } catch (error) {
      console.error('WebLLM analysis failed:', error);
      throw error;
    }
  }
  
  async runMockAnalysis(input, signal) {
    console.log('Running mock analysis - WebLLM not available');
    
    // Simulate loading delay
    await this.sleep(TIMING.DEMO_DELAY_LONG);
    
    if (signal?.aborted) {
      throw new DOMException('Generation cancelled', 'AbortError');
    }
    
    // Get mock response for scenario
    const response = getMockResponse(input.scenario);
    
    // Simulate token-by-token display
    await this.simulateTokenDisplay(response, signal);
    
    // Simulate final metrics
    this.simulateFinalMetrics();
  }
  
  async simulateTokenDisplay(text, signal) {
    const tokens = text.split(/(\s+)/);
    
    for (const token of tokens) {
      if (signal?.aborted) {
        throw new DOMException('Generation cancelled', 'AbortError');
      }
      
      if (token.trim() !== '') {
        // Simulate confidence
        const confidence = 0.3 + Math.random() * 0.7;
        const logprob = Math.log(confidence);
        const mockLogprobs = {
          content: [{ logprob }]
        };
        
        this.ui.addTokenToHeatmap(token, mockLogprobs, false);
        
        const currentMetrics = this.liveMetrics.addToken(token, mockLogprobs);
        if (this.liveMetrics.shouldUpdateUI()) {
          this.ui.updateLiveMetrics(currentMetrics);
        }
      }
      
      await this.sleep(50); // Simulate typing speed
    }
  }
  
  simulateFinalMetrics() {
    const mockMetrics = {
      confidence: 0.6 + Math.random() * 0.3,
      entropy: 1.2 + Math.random() * 0.8,
      logprob: -2.5 - Math.random() * 1.0,
      perplexity: 3.5 + Math.random() * 2.0,
      selfScore: 0.7 + Math.random() * 0.2,
      variance: Math.random() * 0.1,
      topP: 0.7 + Math.random() * 0.3,
      calibration: 0.6 + Math.random() * 0.4,
      coherence: 0.8 + Math.random() * 0.2
    };
    
    this.ui.updateLiveMetrics(mockMetrics);
  }
  
  // ========================================
  // GENERATION CONTROL
  // ========================================
  
  stopGeneration() {
    if (this.currentAbortController && this.isGenerating) {
      this.currentAbortController.abort();
      console.log('Generation cancellation requested');
    }
  }
  
  resetGenerationState() {
    this.isGenerating = false;
    this.currentAbortController = null;
    
    // Process any remaining batched tokens
    this.ui.tokenHeatmap.processBatch();
  }
  
  // ========================================
  // SERVER CONFIGURATION
  // ========================================
  
  async checkServerConfig() {
    try {
      const response = await fetch('/api/config');
      const config = await response.json();
      console.log('Server config:', config);
      
      if (!config.server_available) {
        console.log('Server not available, WebLLM required...');
      }
    } catch (error) {
      console.error('Failed to check server config:', error);
    }
  }
  
  // ========================================
  // ERROR HANDLING
  // ========================================
  
  showInitializationError(error) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-notice';
    errorElement.innerHTML = `
      <h3 class="error-title">⚠️ Initialization Error</h3>
      <p class="error-message">Something went wrong while loading SPOC-Shot. Please refresh the page.</p>
      <details class="error-details">
        <summary>Technical Details</summary>
        <pre>${error.message}\n\n${error.stack}</pre>
      </details>
    `;
    document.body.insertBefore(errorElement, document.body.firstChild);
  }
  
  showWebLLMError(error) {
    // Enable demo mode with helpful error message
    setTimeout(() => {
      const panel = getElement('model-loading-panel')?.querySelector('div');
      if (panel) {
        panel.innerHTML = `
          <div class="text-center">
            <div class="error-title">⚠️ WebLLM Unavailable</div>
            <div class="error-message">
              <strong>Most likely cause:</strong> WebGPU not enabled in Chrome<br><br>
            </div>
            <button onclick="location.reload()" class="retry-button">Retry</button>
            <button onclick="window.spocApp.enableDemoMode()" class="demo-button">View Demo UI</button>
          </div>
        `;
      }
    }, TIMING.DEMO_DELAY_LONG);
  }
  
  enableDemoMode() {
    this.ui.modelLoading.hide();
    
    // Show demo notice
    const demoNotice = document.createElement('div');
    demoNotice.className = 'demo-notice';
    demoNotice.innerHTML = `
      <div class="demo-notice-title">📖 Demo UI Mode</div>
      <div class="demo-notice-text">
        WebLLM is unavailable, but you can explore the interface design.<br>
        For full functionality, try a WebGPU-compatible browser.
      </div>
    `;
    
    const mainContainer = document.querySelector('.main-container');
    const agentComparison = document.querySelector('.agent-comparison');
    if (mainContainer && agentComparison) {
      mainContainer.insertBefore(demoNotice, agentComparison);
    }
    
    this.ui.runButton.setEnabled(true);
    this.ui.runButton.setText('Demo Mode - Click to See Error');
  }
  
  // ========================================
  // UTILITIES
  // ========================================
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ========================================
// APPLICATION INITIALIZATION
// ========================================

let spocApp;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    spocApp = new SPOCShotApp();
    window.spocApp = spocApp; // Make globally available for demo mode
    await spocApp.initialize();
  } catch (error) {
    console.error('Failed to initialize SPOC-Shot application:', error);
  }
});

// Export for module usage
export { SPOCShotApp };