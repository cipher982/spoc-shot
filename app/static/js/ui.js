// UI Management and DOM Updates
import { dom, logger, appState } from './utils.js';

export class UIManager {
  constructor() {
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Temperature slider
    const tempSlider = dom.elements.tempSlider;
    const tempDisplay = dom.elements.tempDisplay;
    if (tempSlider && tempDisplay) {
      tempSlider.addEventListener('input', (e) => {
        tempDisplay.textContent = e.target.value;
      });
    }

    // Top-P slider
    const topPSlider = dom.elements.topPSlider;
    const topPDisplay = dom.elements.topPDisplay;
    if (topPSlider && topPDisplay) {
      topPSlider.addEventListener('input', (e) => {
        topPDisplay.textContent = e.target.value;
      });
    }
  }

  // Unified logging system
  updateLog(type, message) {
    const log = dom.elements.uncertaintyLog;
    if (!log) return;

    const entry = document.createElement('div');
    entry.className = `log-entry ${type === 'error' ? 'log-error' : type === 'response' ? 'log-response' : ''}`;
    
    const timestamp = new Date().toLocaleTimeString();
    const icons = { 
      info: '🔍', 
      response: '💬', 
      error: '❌',
      success: '✅',
      warning: '⚠️'
    };
    const icon = icons[type] || 'ℹ️';
    
    entry.innerHTML = `[${timestamp}] ${icon} ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;

    // Also log to console for debugging
    if (type === 'error') {
      logger.error(message);
    } else {
      logger.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  updateStatus(message) {
    const status = dom.elements.uncertaintyStatus;
    if (status) {
      status.textContent = message;
    }
  }

  updateMetrics(metrics) {
    // Update all metric displays
    const metricElements = {
      'confidence-value': metrics.confidence ? `${(metrics.confidence * 100).toFixed(1)}` : '--',
      'entropy-value': metrics.entropy ? metrics.entropy.toFixed(2) : '--',
      'logprob-value': metrics.logprob ? metrics.logprob.toFixed(2) : '--',
      'perplexity-value': metrics.perplexity ? metrics.perplexity.toFixed(2) : '--',
      'self-score-value': metrics.selfScore ? metrics.selfScore.toFixed(2) : '--',
      'variance-value': metrics.variance ? metrics.variance.toFixed(3) : '--',
      'top-p-value': metrics.topP ? metrics.topP.toFixed(2) : '--',
      'calibration-value': metrics.calibration ? metrics.calibration.toFixed(2) : '--',
      'coherence-value': metrics.coherence ? metrics.coherence.toFixed(2) : '--'
    };

    Object.entries(metricElements).forEach(([id, value]) => {
      const element = dom.get(id);
      if (element) {
        element.textContent = value;
        // Remove loading class if present for live updates
        element.classList.remove('metrics-loading');
      }
    });

    // Update confidence bar
    this.updateConfidenceBar(metrics.confidence || 0);
  }

  updateConfidenceBar(confidence) {
    const confidenceBar = dom.get('confidence-bar');
    if (!confidenceBar) return;

    const percentage = Math.round(confidence * 100);
    const filledBlocks = Math.round((percentage / 100) * 30);
    const emptyBlocks = 30 - filledBlocks;
    
    const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
    confidenceBar.textContent = bar; // Remove brackets for consistency with live updates
    
    // Remove demo opacity class for live updates
    confidenceBar.classList.remove('demo-opacity');
  }

  appendTokenToHeatmap(token, logprobs) {
    const heatmapText = dom.elements.heatmapText;
    if (!heatmapText) return;

    // Calculate confidence for color coding
    let confidence = 0.5; // default
    if (logprobs && logprobs.content && logprobs.content.length > 0) {
      const logprob = logprobs.content[0].logprob;
      confidence = Math.exp(Math.max(logprob, -10)); // Clamp very low logprobs
    }

    // Create colored span based on confidence
    const span = document.createElement('span');
    span.textContent = token;
    
    // Color mapping: red (low confidence) to green (high confidence)
    const hue = Math.round(confidence * 120); // 0 = red, 120 = green
    const saturation = 70;
    const lightness = 40;
    span.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    span.style.color = 'white';
    span.style.padding = '1px 2px';
    span.style.margin = '0 1px';
    span.style.borderRadius = '2px';
    span.title = `Confidence: ${(confidence * 100).toFixed(1)}%`;

    heatmapText.appendChild(span);
    heatmapText.scrollTop = heatmapText.scrollHeight;
  }

  clearHeatmap() {
    const heatmapText = dom.elements.heatmapText;
    if (heatmapText) {
      heatmapText.innerHTML = '';
    }
  }

  clearLog() {
    const log = dom.elements.uncertaintyLog;
    if (log) {
      log.innerHTML = '<div class="log-ready">Ready to analyze uncertainty - click Execute above</div>';
    }
  }

  setIdleState() {
    this.updateStatus('Idle');
    
    const heatmapText = dom.elements.heatmapText;
    if (heatmapText) {
      heatmapText.innerHTML = `<span style="color: #999; font-style: italic;">Waiting to analyze...</span>`;
    }

    // Reset all metrics to '--'
    this.updateMetrics({});
    this.updateConfidenceBar(0);
    this.clearLog();
  }

  showRunButton(enabled = true) {
    const runButton = dom.elements.runButton;
    if (runButton) {
      runButton.disabled = !enabled;
      runButton.textContent = enabled ? '🚀 Execute' : 'Loading...';
    }
  }

  getInputValues() {
    const prompt = dom.elements.promptInput?.value || '';
    const scenario = dom.elements.scenarioSelect?.value || 'sql';
    const temperature = parseFloat(dom.elements.tempSlider?.value || '0.7');
    const topP = parseFloat(dom.elements.topPSlider?.value || '0.9');

    return { prompt, scenario, temperature, topP };
  }
}

// Singleton instance
export const uiManager = new UIManager();