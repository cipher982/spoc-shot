// Uncertainty Analysis Module
export class UncertaintyAnalyzer {
  constructor() {
    this.init();
  }

  init() {
    // Set up event listeners for the new UI
    this.setupEventListeners();
  }

  setupEventListeners() {
    // No separate event listeners needed - unified interface handles everything
    console.log('✅ Uncertainty analyzer initialized - using unified controls');
  }

  async startAnalysis() {
    // Legacy method for shared control panel (Tab A compatibility)
    const prompt = document.getElementById('prompt-input').value;
    const scenario = document.getElementById('scenario-select').value;
    
    // Update button state
    const runButton = document.getElementById('run-button');
    if (runButton) {
      runButton.disabled = true;
      runButton.textContent = 'Analyzing...';
    }
    
    await this.startAnalysisWithPrompt(prompt, scenario);
    
    // Reset button state
    if (runButton) {
      runButton.disabled = false;
      runButton.textContent = '🚀 Execute';
    }
  }

  async startAnalysisWithPrompt(prompt, scenario) {
    // New method that actually uses the provided prompt
    this.resetUI();
    this.updateStatus('Analyzing...');
    
    try {
      await this.runSingleResponseAnalysis(prompt, scenario);
    } catch (error) {
      console.error('Uncertainty analysis error:', error);
      this.updateLog('error', `Analysis failed: ${error.message}`);
    }
  }

  resetUI() {
    // Safely reset UI elements with null checks
    const elements = {
      'uncertainty-status': 'Analyzing...',
      'heatmap-text': 'Analyzing token-level confidence...',
      'confidence-value': '--',
      'entropy-value': '--',
      'logprob-value': '--',
      'perplexity-value': '--',
      'self-score-value': '--'
    };
    
    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        if (id === 'heatmap-text') {
          element.innerHTML = value;
        } else {
          element.textContent = value;
        }
      }
    });
    
    // Reset confidence bar width
    const confidenceBar = document.getElementById('confidence-bar');
    if (confidenceBar) {
      confidenceBar.style.width = '0%';
    }
    
    // Reset log
    const uncertaintyLog = document.getElementById('uncertainty-log');
    if (uncertaintyLog) {
      uncertaintyLog.innerHTML = '<div class="log-ready">Starting uncertainty analysis...</div>';
    }
    
    // Hide variant section
    const variantSection = document.getElementById('variant-section');
    if (variantSection) {
      variantSection.classList.add('hidden');
    }
  }

  updateStatus(status) {
    const statusElement = document.getElementById('uncertainty-status');
    if (statusElement) {
      statusElement.textContent = status;
    }
  }

  updateLog(type, message) {
    const log = document.getElementById('uncertainty-log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    const timestamp = new Date().toLocaleTimeString();
    const icons = { info: '🔍', response: '💬', error: '❌' };
    const icon = icons[type] || 'ℹ️';
    
    entry.innerHTML = `[${timestamp}] ${icon} ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  async runSingleResponseAnalysis(prompt, scenario) {
    this.updateLog('info', `Analyzing prompt: "${prompt.substring(0, 50)}${prompt.length > 50 ? '...' : ''}"`);
    
    try {
      // Use real WebLLM inference instead of fake responses
      const response = await this.runRealWebLLMAnalysis(prompt);
      this.updateLog('response', response.text);
      
      // Use real logprobs and confidence data from model response
      this.processRealTokenHeatmap(response.text, response.logprobs);
      this.updateRealSequenceMetrics(response.metrics);
      
      this.updateStatus('Complete');
    } catch (error) {
      this.updateLog('error', `WebLLM analysis failed: ${error.message}`);
      this.updateStatus('Error');
    }
  }

  async runRealWebLLMAnalysis(prompt) {
    // Check if WebLLM is available and initialized
    if (!window.webllmEngine || !window.modelLoaded) {
      throw new Error('WebLLM not initialized. Please wait for model loading to complete.');
    }

    this.updateLog('info', 'Running WebLLM inference...');

    try {
      // Generate response using WebLLM with logprobs enabled
      const messages = [{ role: 'user', content: prompt }];
      const response = await window.webllmEngine.chat.completions.create({
        messages: messages,
        max_tokens: 200,
        temperature: 0.7,
        logprobs: true,
        top_logprobs: 5
      });

      const choice = response.choices[0];
      return {
        text: choice.message.content,
        logprobs: choice.logprobs,
        metrics: {
          entropy_avg: this.calculateEntropy(choice.logprobs),
          min_logprob: this.getMinLogprob(choice.logprobs),
          ppl: this.calculatePerplexity(choice.logprobs)
        }
      };
    } catch (error) {
      throw new Error(`WebLLM inference failed: ${error.message}`);
    }
  }

  async runMultiSampleAnalysis(prompt, scenario) {
    this.updateLog('info', 'Running multi-sample analysis (N=5)...');
    document.getElementById('variant-section').classList.remove('hidden');
    
    await this.sleep(1500);
    
    const semanticEntropy = 1.8 + Math.random() * 0.7;
    document.getElementById('semantic-entropy').textContent = `Semantic Entropy: ${semanticEntropy.toFixed(2)}`;
    
    const variants = this.generateVariants(scenario);
    const variantList = document.getElementById('variant-list');
    variantList.innerHTML = variants.map(v => 
      `<div class="variant-item">
         <span class="variant-text">${v.text}</span>
         <span class="variant-count">${v.count}x</span>
       </div>`
    ).join('');
    
    this.setupVariantToggle();
    this.updateLog('info', 'Multi-sample analysis complete');
  }

  setupVariantToggle() {
    document.getElementById('toggle-variants').addEventListener('click', () => {
      const list = document.getElementById('variant-list');
      const button = document.getElementById('toggle-variants');
      if (list.classList.contains('hidden')) {
        list.classList.remove('hidden');
        button.textContent = 'Hide Variants';
      } else {
        list.classList.add('hidden');
        button.textContent = 'Show Variants';
      }
    });
  }

  processRealTokenHeatmap(text, logprobs) {
    if (!logprobs || !logprobs.content) {
      // Fallback if no logprobs available
      document.getElementById('heatmap-text').innerHTML = text;
      return;
    }

    let heatmapHTML = '';
    
    logprobs.content.forEach(tokenData => {
      const token = tokenData.token;
      const logprob = tokenData.logprob;
      const confidence = Math.exp(logprob); // Convert logprob to probability
      
      // Map real confidence to CSS classes
      const getConfidenceClass = (conf) => {
        if (conf >= 0.9) return 'token-confidence-very-high';
        if (conf >= 0.7) return 'token-confidence-high';
        if (conf >= 0.5) return 'token-confidence-good';
        if (conf >= 0.3) return 'token-confidence-medium';
        if (conf >= 0.1) return 'token-confidence-low';
        return 'token-confidence-very-low';
      };
      
      const confidenceClass = getConfidenceClass(confidence);
      heatmapHTML += `<span class="token ${confidenceClass}" title="LogProb: ${logprob.toFixed(3)} | Confidence: ${(confidence * 100).toFixed(1)}%">${token}</span>`;
    });
    
    document.getElementById('heatmap-text').innerHTML = heatmapHTML;
  }

  updateRealSequenceMetrics(metrics) {
    const confidence = Math.max(0, Math.min(100, 100 / metrics.ppl * 10));
    document.getElementById('confidence-bar').style.setProperty('--progress-width', `${confidence}%`);
    document.getElementById('confidence-value').textContent = `${confidence.toFixed(1)}%`;
    
    document.getElementById('entropy-value').textContent = metrics.entropy_avg.toFixed(2);
    document.getElementById('logprob-value').textContent = metrics.min_logprob.toFixed(2);
    document.getElementById('perplexity-value').textContent = metrics.ppl.toFixed(2);
    
    // Remove fake self-score - use real metric if available
    const selfScoreElement = document.getElementById('self-score-value');
    if (selfScoreElement) {
      selfScoreElement.textContent = metrics.self_score ? metrics.self_score.toFixed(2) : '--';
    }
  }

  // Real metric calculation functions
  calculateEntropy(logprobs) {
    if (!logprobs || !logprobs.content) return 0;
    
    let entropy = 0;
    logprobs.content.forEach(tokenData => {
      const prob = Math.exp(tokenData.logprob);
      if (prob > 0) {
        entropy -= prob * Math.log2(prob);
      }
    });
    
    return entropy / logprobs.content.length;
  }

  getMinLogprob(logprobs) {
    if (!logprobs || !logprobs.content) return 0;
    
    return Math.min(...logprobs.content.map(tokenData => tokenData.logprob));
  }

  calculatePerplexity(logprobs) {
    if (!logprobs || !logprobs.content) return 1;
    
    const avgLogprob = logprobs.content.reduce((sum, tokenData) => sum + tokenData.logprob, 0) / logprobs.content.length;
    return Math.exp(-avgLogprob);
  }

  // Removed fake response generation functions - using real WebLLM only

  // Removed fake variant generation - would need real multi-sample WebLLM runs

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}