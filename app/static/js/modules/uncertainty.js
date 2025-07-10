// Uncertainty Analysis Module
export class UncertaintyAnalyzer {
  constructor() {
    this.init();
  }

  init() {
    // No separate analyze button - analysis is triggered by main execute button
  }

  async startAnalysis() {
    const prompt = document.getElementById('prompt-input').value;
    const scenario = document.getElementById('scenario-select').value;
    
    // Update button state
    const runButton = document.getElementById('run-button');
    if (runButton) {
      runButton.disabled = true;
      runButton.textContent = 'Analyzing...';
    }
    
    this.resetUI();
    this.updateStatus('Analyzing...');
    
    try {
      await this.runSingleResponseAnalysis(prompt, scenario);
    } catch (error) {
      console.error('Uncertainty analysis error:', error);
      this.updateLog('error', `Analysis failed: ${error.message}`);
    } finally {
      // Reset button state
      if (runButton) {
        runButton.disabled = false;
        runButton.textContent = '🚀 Execute';
      }
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
    this.updateLog('info', 'Running single response analysis...');
    
    // Simulate analysis
    await this.sleep(1000);
    const response = this.getResponseForScenario(scenario);
    this.updateLog('response', response);
    
    await this.sleep(500);
    this.simulateTokenHeatmap(response);
    
    await this.sleep(300);
    this.updateSequenceMetrics({
      entropy_avg: 1.5 + Math.random() * 0.6,
      min_logprob: -3.2 - Math.random() * 1.0,
      ppl: 4.5 + Math.random() * 1.5
    });
    
    this.updateStatus('Complete');
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

  simulateTokenHeatmap(text) {
    const tokens = text.split(/(\s+)/);
    const heatmapHTML = tokens.map(token => {
      if (token.trim() === '') return token;
      
      const confidence = 0.3 + Math.random() * 0.7;
      const logprob = Math.log(confidence);
      
      // Map confidence to CSS classes instead of inline styles
      const getConfidenceClass = (conf) => {
        if (conf >= 0.9) return 'token-confidence-very-high';
        if (conf >= 0.7) return 'token-confidence-high';
        if (conf >= 0.5) return 'token-confidence-good';
        if (conf >= 0.3) return 'token-confidence-medium';
        if (conf >= 0.1) return 'token-confidence-low';
        return 'token-confidence-very-low';
      };
      
      const confidenceClass = getConfidenceClass(confidence);
      return `<span class="token ${confidenceClass}" title="Simulated LogProb: ${logprob.toFixed(3)}">${token}</span>`;
    }).join('');
    
    document.getElementById('heatmap-text').innerHTML = heatmapHTML;
  }

  updateSequenceMetrics(metrics) {
    const confidence = Math.max(0, Math.min(100, 100 / metrics.ppl * 10));
    document.getElementById('confidence-bar').style.setProperty('--progress-width', `${confidence}%`);
    document.getElementById('confidence-value').textContent = `${confidence.toFixed(1)}%`;
    
    document.getElementById('entropy-value').textContent = metrics.entropy_avg.toFixed(2);
    document.getElementById('logprob-value').textContent = metrics.min_logprob.toFixed(2);
    document.getElementById('perplexity-value').textContent = metrics.ppl.toFixed(2);
    
    const selfScore = 0.4 + Math.random() * 0.5;
    document.getElementById('self-score-value').textContent = selfScore.toFixed(2);
  }

  getResponseForScenario(scenario) {
    const responses = {
      sql: "Based on our database query, we had 1,247 conversions this week, representing a 15% increase from last week.",
      research: "Recent climate research shows accelerating ice sheet loss in Antarctica, with new studies indicating a 20% faster melting rate than previously estimated.",
      data_analysis: "User engagement analysis reveals a 12% increase in daily active users, with peak activity occurring between 2-4 PM on weekdays.",
      math_tutor: "To solve 2x + 5 = 15: First, subtract 5 from both sides: 2x = 10. Then divide by 2: x = 5."
    };
    return responses[scenario] || responses.sql;
  }

  generateVariants(scenario) {
    const variants = {
      sql: [
        { text: "We recorded 1,247 conversions this week (15% increase)", count: 3 },
        { text: "This week's conversions total 1,245 (14.8% growth)", count: 2 }
      ],
      research: [
        { text: "Antarctic ice loss accelerated 20% beyond projections", count: 2 },
        { text: "New studies show 22% faster Antarctic melting rates", count: 2 },
        { text: "Ice sheet dynamics indicate 18% acceleration in loss", count: 1 }
      ],
      data_analysis: [
        { text: "Daily active users increased 12% with 2-4 PM peak", count: 3 },
        { text: "User engagement up 11.8%, peak at 2-4 PM weekdays", count: 2 }
      ],
      math_tutor: [
        { text: "Subtract 5, then divide by 2: x = 5", count: 4 },
        { text: "2x = 10, therefore x = 5", count: 1 }
      ]
    };
    return variants[scenario] || variants.sql;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}