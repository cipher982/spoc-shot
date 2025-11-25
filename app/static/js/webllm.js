// WebLLM Engine Management
import { dom, logger, appState } from './utils.js';

export class WebLLMManager {
  constructor() {
    this.engine = null;
    this.loaded = false;
  }

  async initialize() {
    if (this.loaded) return this.engine;

    try {
      logger.log("🔄 Starting WebLLM initialization...");

      // Show loading panel
      const loadingPanel = dom.elements.modelLoadingPanel;
      const modelStatus = dom.elements.modelStatus;
      const modelProgressText = dom.elements.modelProgressText;
      const modelProgressBar = dom.elements.modelProgressBar;

      if (loadingPanel) loadingPanel.classList.remove('hidden');
      if (modelStatus) modelStatus.textContent = "Loading WebLLM library...";

      // 1️⃣ Check WebLLM availability
      if (!window.webllm) {
        throw new Error("WebLLM library not loaded");
      }
      logger.log("✅ WebLLM latest loaded");

      // 2️⃣ Check WebGPU support
      if (!navigator.gpu) {
        throw new Error("WebGPU not supported in this browser");
      }
      logger.log("✅ WebGPU ready");

      // 3️⃣ Check model availability
      const selectedModel = "Hermes-3-Llama-3.1-8B-q4f16_1-MLC";
      const availableModels = webllm.prebuiltAppConfig.model_list.map(m => m.model_id);
      
      if (!availableModels.includes(selectedModel)) {
        throw new Error(`Model ${selectedModel} not found in WebLLM catalog`);
      }
      logger.log(`✅ Model found: ${selectedModel}`);

      // 4️⃣ Initialize engine with progress callback
      if (modelStatus) modelStatus.textContent = "Loading model...";
      logger.log("🔄 Creating MLC Engine with model:", selectedModel);
      
      const initProgressCallback = (report) => {
        const progress = Math.round((report.progress || 0) * 100);
        if (modelProgressText) modelProgressText.textContent = `${progress}%`;
        if (modelProgressBar) modelProgressBar.style.setProperty('--progress-width', `${progress}%`);
        if (modelStatus) modelStatus.textContent = report.text || `Loading model... ${progress}%`;
      };

      this.engine = new webllm.MLCEngine();
      await this.engine.reload(selectedModel, undefined, {
        initProgressCallback: initProgressCallback
      });

      // Success!
      this.loaded = true;
      appState.webllm.engine = this.engine;
      appState.webllm.loaded = true;
      
      // Update global references for compatibility
      window.webllmEngine = this.engine;
      window.modelLoaded = true;

      // Hide loading panel
      if (loadingPanel) loadingPanel.classList.add('hidden');
      if (modelStatus) {
        modelStatus.textContent = "Model loaded successfully!";
        if (modelProgressText) modelProgressText.textContent = "100%";
        if (modelProgressBar) modelProgressBar.style.setProperty('--progress-width', '100%');
      }

      logger.log("✅ WebLLM initialization complete");
      return this.engine;

    } catch (error) {
      this.loaded = false;
      appState.webllm.error = error;
      
      logger.error("❌ WebLLM initialization failed:", error);
      
      const modelStatus = dom.elements.modelStatus;
      if (modelStatus) {
        modelStatus.textContent = `Error: ${error.message}`;
        modelStatus.style.color = '#ff0000';
      }
      
      throw error;
    }
  }

  async generateResponse(messages, options = {}) {
    if (!this.loaded || !this.engine) {
      throw new Error('WebLLM engine not initialized');
    }

    const defaultOptions = {
      temperature: 0.7,
      top_p: 0.9,
      stream: false,
      logprobs: true,
      top_logprobs: 1
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      const response = await this.engine.chat.completions.create({
        messages,
        ...finalOptions
      });

      return response;
    } catch (error) {
      logger.error('❌ WebLLM generation failed:', error);
      throw new Error(`WebLLM generation failed: ${error.message}`);
    }
  }

  async generateStreamingResponse(messages, options = {}, onChunk = null) {
    if (!this.loaded || !this.engine) {
      throw new Error('WebLLM engine not initialized');
    }

    const defaultOptions = {
      temperature: 0.7,
      top_p: 0.9,
      stream: true,
      logprobs: true,
      top_logprobs: 1
    };

    const finalOptions = { ...defaultOptions, ...options };

    try {
      const chunks = await this.engine.chat.completions.create({
        messages,
        ...finalOptions
      });

      let fullResponse = '';
      const tokens = [];
      const logprobs = [];

      for await (const chunk of chunks) {
        try {
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) {
            fullResponse += delta.content;
            tokens.push(delta.content);
            
            if (delta.logprobs) {
              logprobs.push(delta.logprobs);
            }

            if (onChunk) {
              onChunk(delta.content, delta.logprobs);
            }
          }
        } catch (chunkError) {
          logger.error("Error processing chunk:", chunkError);
        }
      }

      return {
        text: fullResponse,
        tokens,
        logprobs,
        metrics: this.calculateBasicMetrics(logprobs)
      };

    } catch (error) {
      logger.error('❌ WebLLM streaming failed:', error);
      throw new Error(`WebLLM streaming failed: ${error.message}`);
    }
  }

  calculateBasicMetrics(logprobs) {
    if (!logprobs || logprobs.length === 0) {
      return {
        avgLogprob: 0,
        perplexity: 1,
        confidence: 0
      };
    }

    const validLogprobs = logprobs.filter(lp => lp && lp.content && lp.content.length > 0);
    if (validLogprobs.length === 0) {
      return { avgLogprob: 0, perplexity: 1, confidence: 0 };
    }

    const logprobValues = validLogprobs.map(lp => lp.content[0].logprob);
    const avgLogprob = logprobValues.reduce((sum, val) => sum + val, 0) / logprobValues.length;
    const perplexity = Math.exp(-avgLogprob);
    const confidence = Math.exp(avgLogprob);

    return {
      avgLogprob: avgLogprob,
      perplexity: perplexity,
      confidence: Math.min(confidence, 1.0)
    };
  }
}

// Singleton instance
export const webllmManager = new WebLLMManager();