// UI Component Abstractions - DRY Refactoring
// Centralized UI patterns and component creation

import { 
  getElement, 
  setText, 
  setHTML, 
  setStyle, 
  addClass, 
  removeClass, 
  show, 
  hide, 
  setValue, 
  setEnabled,
  updateElements,
  getMetricElements,
  scrollToBottom 
} from './dom-utils.js';

import { 
  processToken, 
  createTokenElement, 
  calculateMetrics, 
  formatMetrics, 
  createConfidenceBar, 
  sanitizeMetrics 
} from './confidence-utils.js';

import { 
  ELEMENT_IDS, 
  STATUS_MESSAGES, 
  CSS_CLASSES, 
  CONFIDENCE_BAR_LENGTH,
  SCENARIO_PROMPTS,
  TIMING
} from './constants.js';

// ========================================
// BUTTON COMPONENT
// ========================================

export class ButtonComponent {
  constructor(elementId) {
    this.element = getElement(elementId);
    this.originalText = this.element ? this.element.textContent : '';
  }
  
  setText(text) {
    setText(this.element, text);
  }
  
  setEnabled(enabled) {
    setEnabled(this.element, enabled);
  }
  
  setLoading(loading, loadingText = 'Loading...') {
    this.setEnabled(!loading);
    this.setText(loading ? loadingText : this.originalText);
  }
  
  reset() {
    this.setEnabled(true);
    this.setText(this.originalText);
  }
}

// ========================================
// SLIDER COMPONENT
// ========================================

export class SliderComponent {
  constructor(sliderId, displayId) {
    this.slider = getElement(sliderId);
    this.display = getElement(displayId);
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    if (this.slider && this.display) {
      this.slider.addEventListener('input', (e) => {
        setText(this.display, e.target.value);
      });
    }
  }
  
  getValue() {
    return this.slider ? parseFloat(this.slider.value) : 0;
  }
  
  setValue(value) {
    setValue(this.slider, value);
    setText(this.display, value);
  }
}

// ========================================
// PROGRESS BAR COMPONENT
// ========================================

export class ProgressBarComponent {
  constructor(barId, textId = null) {
    this.bar = getElement(barId);
    this.text = textId ? getElement(textId) : null;
  }
  
  setProgress(percentage) {
    if (this.bar) {
      setStyle(this.bar, '--progress-width', `${percentage}%`);
    }
    if (this.text) {
      setText(this.text, `${percentage}%`);
    }
  }
  
  reset() {
    this.setProgress(0);
  }
  
  complete() {
    this.setProgress(100);
  }
}

// ========================================
// METRICS DISPLAY COMPONENT
// ========================================

export class MetricsDisplayComponent {
  constructor() {
    this.elements = getMetricElements();
  }
  
  updateMetrics(metrics) {
    const sanitized = sanitizeMetrics(metrics);
    const formatted = formatMetrics(sanitized);
    
    const updates = {};
    
    // Update all metric displays
    if (this.elements.confidence) {
      updates[ELEMENT_IDS.CONFIDENCE_VALUE] = { text: formatted.confidence };
    }
    if (this.elements.entropy) {
      updates[ELEMENT_IDS.ENTROPY_VALUE] = { text: formatted.entropy };
    }
    if (this.elements.logprob) {
      updates[ELEMENT_IDS.LOGPROB_VALUE] = { text: formatted.logprob };
    }
    if (this.elements.perplexity) {
      updates[ELEMENT_IDS.PERPLEXITY_VALUE] = { text: formatted.perplexity };
    }
    if (this.elements.selfScore) {
      updates[ELEMENT_IDS.SELF_SCORE_VALUE] = { text: formatted.selfScore };
    }
    if (this.elements.variance) {
      updates[ELEMENT_IDS.VARIANCE_VALUE] = { text: formatted.variance };
    }
    if (this.elements.topP) {
      updates[ELEMENT_IDS.TOP_P_VALUE] = { text: formatted.topP };
    }
    if (this.elements.calibration) {
      updates[ELEMENT_IDS.CALIBRATION_VALUE] = { text: formatted.calibration };
    }
    if (this.elements.coherence) {
      updates[ELEMENT_IDS.COHERENCE_VALUE] = { text: formatted.coherence };
    }
    
    // Remove loading classes
    Object.keys(updates).forEach(id => {
      updates[id]['class-' + CSS_CLASSES.METRICS_LOADING] = false;
    });
    
    updateElements(updates);
    
    // Update confidence bar
    this.updateConfidenceBar(sanitized.confidence);
  }
  
  updateConfidenceBar(confidence) {
    const confidenceBar = getElement(ELEMENT_IDS.CONFIDENCE_BAR);
    if (confidenceBar) {
      const bar = createConfidenceBar(confidence, CONFIDENCE_BAR_LENGTH);
      setText(confidenceBar, bar);
      removeClass(confidenceBar, CSS_CLASSES.DEMO_OPACITY);
    }
  }
  
  reset() {
    const defaultValues = {
      [ELEMENT_IDS.CONFIDENCE_VALUE]: { text: '--', 'class-' + CSS_CLASSES.METRICS_LOADING: true },
      [ELEMENT_IDS.ENTROPY_VALUE]: { text: '--', 'class-' + CSS_CLASSES.METRICS_LOADING: true },
      [ELEMENT_IDS.LOGPROB_VALUE]: { text: '--', 'class-' + CSS_CLASSES.METRICS_LOADING: true },
      [ELEMENT_IDS.PERPLEXITY_VALUE]: { text: '--', 'class-' + CSS_CLASSES.METRICS_LOADING: true },
      [ELEMENT_IDS.SELF_SCORE_VALUE]: { text: '--', 'class-' + CSS_CLASSES.METRICS_LOADING: true },
      [ELEMENT_IDS.VARIANCE_VALUE]: { text: '--', 'class-' + CSS_CLASSES.METRICS_LOADING: true },
      [ELEMENT_IDS.TOP_P_VALUE]: { text: '--', 'class-' + CSS_CLASSES.METRICS_LOADING: true },
      [ELEMENT_IDS.CALIBRATION_VALUE]: { text: '--', 'class-' + CSS_CLASSES.METRICS_LOADING: true },
      [ELEMENT_IDS.COHERENCE_VALUE]: { text: '--', 'class-' + CSS_CLASSES.METRICS_LOADING: true }
    };
    
    updateElements(defaultValues);
    
    // Reset confidence bar
    const confidenceBar = getElement(ELEMENT_IDS.CONFIDENCE_BAR);
    if (confidenceBar) {
      setText(confidenceBar, '░'.repeat(CONFIDENCE_BAR_LENGTH));
      addClass(confidenceBar, CSS_CLASSES.DEMO_OPACITY);
    }
  }
}

// ========================================
// TOKEN HEATMAP COMPONENT
// ========================================

export class TokenHeatmapComponent {
  constructor(containerId = ELEMENT_IDS.HEATMAP_TEXT) {
    this.container = getElement(containerId);
    this.tokenBatch = [];
    this.batchTimeout = null;
  }
  
  clear() {
    if (this.container) {
      this.container.innerHTML = '';
    }
    this.clearBatch();
  }
  
  addToken(token, logprobs) {
    const tokenElement = createTokenElement(token, logprobs);
    
    if (this.container) {
      this.container.appendChild(tokenElement);
      scrollToBottom(this.container);
    }
  }
  
  addTokenBatched(token, logprobs, batchSize = 5, batchDelay = 16) {
    this.tokenBatch.push({ token, logprobs });
    
    if (this.tokenBatch.length >= batchSize) {
      this.processBatch();
    } else if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => this.processBatch(), batchDelay);
    }
  }
  
  processBatch() {
    if (this.tokenBatch.length === 0) return;
    
    const fragment = document.createDocumentFragment();
    
    this.tokenBatch.forEach(({ token, logprobs }) => {
      const tokenElement = createTokenElement(token, logprobs);
      fragment.appendChild(tokenElement);
    });
    
    if (this.container) {
      this.container.appendChild(fragment);
      scrollToBottom(this.container);
    }
    
    this.clearBatch();
  }
  
  clearBatch() {
    this.tokenBatch = [];
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }
  
  setPlaceholder(text) {
    setHTML(this.container, `<span style="color: #999; font-style: italic;">${text}</span>`);
  }
}

// ========================================
// STATUS DISPLAY COMPONENT
// ========================================

export class StatusDisplayComponent {
  constructor(elementId = ELEMENT_IDS.UNCERTAINTY_STATUS) {
    this.element = getElement(elementId);
  }
  
  setStatus(status, color = null) {
    setText(this.element, status);
    if (color && this.element) {
      setStyle(this.element, 'color', color);
    }
  }
  
  setIdle() {
    this.setStatus(STATUS_MESSAGES.IDLE, '#999');
  }
  
  setAnalyzing() {
    this.setStatus(STATUS_MESSAGES.ANALYZING);
  }
  
  setComplete() {
    this.setStatus(STATUS_MESSAGES.COMPLETE);
  }
  
  setError() {
    this.setStatus(STATUS_MESSAGES.ERROR, '#ff0000');
  }
  
  setCancelled() {
    this.setStatus(STATUS_MESSAGES.CANCELLED, '#ff9900');
  }
}

// ========================================
// SCENARIO SELECTOR COMPONENT
// ========================================

export class ScenarioSelectorComponent {
  constructor(selectId = ELEMENT_IDS.SCENARIO_SELECT, promptId = ELEMENT_IDS.PROMPT_INPUT) {
    this.select = getElement(selectId);
    this.promptInput = getElement(promptId);
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    if (this.select && this.promptInput) {
      this.select.addEventListener('change', (e) => {
        const scenario = e.target.value;
        const prompt = SCENARIO_PROMPTS[scenario];
        if (prompt) {
          setValue(this.promptInput, prompt);
        }
      });
    }
  }
  
  getSelectedScenario() {
    return this.select ? this.select.value : '';
  }
  
  getPrompt() {
    return this.promptInput ? this.promptInput.value : '';
  }
  
  setPrompt(prompt) {
    setValue(this.promptInput, prompt);
  }
}

// ========================================
// MODEL LOADING COMPONENT
// ========================================

export class ModelLoadingComponent {
  constructor() {
    this.panel = getElement(ELEMENT_IDS.MODEL_LOADING_PANEL);
    this.status = getElement(ELEMENT_IDS.MODEL_STATUS);
    this.progressBar = new ProgressBarComponent(
      ELEMENT_IDS.MODEL_PROGRESS_BAR, 
      ELEMENT_IDS.MODEL_PROGRESS_TEXT
    );
  }
  
  show() {
    show(this.panel);
  }
  
  hide() {
    hide(this.panel);
  }
  
  setStatus(message) {
    setText(this.status, message);
  }
  
  setProgress(percentage) {
    this.progressBar.setProgress(percentage);
  }
  
  setError(message) {
    this.setStatus(`Error: ${message}`);
    setStyle(this.status, 'color', '#ff0000');
    addClass(this.progressBar.bar, 'progress-error');
  }
  
  setComplete() {
    this.setStatus('Model loaded successfully!');
    this.progressBar.complete();
    
    setTimeout(() => {
      this.hide();
    }, TIMING.MODEL_LOADING_HIDE_DELAY);
  }
}

// ========================================
// UNIFIED UI MANAGER
// ========================================

export class UnifiedUIManager {
  constructor() {
    // Initialize all components
    this.runButton = new ButtonComponent(ELEMENT_IDS.RUN_BUTTON);
    this.stopButton = new ButtonComponent(ELEMENT_IDS.STOP_BUTTON);
    this.tempSlider = new SliderComponent(ELEMENT_IDS.TEMP_SLIDER, ELEMENT_IDS.TEMP_DISPLAY);
    this.topPSlider = new SliderComponent(ELEMENT_IDS.TOP_P_SLIDER, ELEMENT_IDS.TOP_P_DISPLAY);
    this.metricsDisplay = new MetricsDisplayComponent();
    this.tokenHeatmap = new TokenHeatmapComponent();
    this.statusDisplay = new StatusDisplayComponent();
    this.scenarioSelector = new ScenarioSelectorComponent();
    this.modelLoading = new ModelLoadingComponent();
  }
  
  // ========================================
  // UNIFIED STATE MANAGEMENT
  // ========================================
  
  setIdleState() {
    this.runButton.reset();
    hide(ELEMENT_IDS.STOP_BUTTON);
    this.statusDisplay.setIdle();
    this.metricsDisplay.reset();
    this.tokenHeatmap.setPlaceholder('Waiting to analyze...');
  }
  
  setAnalyzingState() {
    this.runButton.setLoading(true, 'Analyzing...');
    show(ELEMENT_IDS.STOP_BUTTON);
    this.statusDisplay.setAnalyzing();
    this.metricsDisplay.reset();
    this.tokenHeatmap.clear();
  }
  
  setCompleteState() {
    this.runButton.reset();
    hide(ELEMENT_IDS.STOP_BUTTON);
    this.statusDisplay.setComplete();
  }
  
  setErrorState() {
    this.runButton.reset();
    hide(ELEMENT_IDS.STOP_BUTTON);
    this.statusDisplay.setError();
  }
  
  setCancelledState() {
    this.runButton.reset();
    hide(ELEMENT_IDS.STOP_BUTTON);
    this.statusDisplay.setCancelled();
  }
  
  // ========================================
  // BATCH OPERATIONS
  // ========================================
  
  updateLiveMetrics(metrics) {
    this.metricsDisplay.updateMetrics(metrics);
  }
  
  addTokenToHeatmap(token, logprobs, batched = true) {
    if (batched) {
      this.tokenHeatmap.addTokenBatched(token, logprobs);
    } else {
      this.tokenHeatmap.addToken(token, logprobs);
    }
  }
  
  getInputValues() {
    return {
      prompt: this.scenarioSelector.getPrompt(),
      scenario: this.scenarioSelector.getSelectedScenario(),
      temperature: this.tempSlider.getValue(),
      topP: this.topPSlider.getValue()
    };
  }
  
  // ========================================
  // MODEL LOADING MANAGEMENT
  // ========================================
  
  showModelLoading() {
    this.modelLoading.show();
    this.runButton.setEnabled(false);
  }
  
  updateModelLoading(status, progress = null) {
    this.modelLoading.setStatus(status);
    if (progress !== null) {
      this.modelLoading.setProgress(progress);
    }
  }
  
  completeModelLoading() {
    this.modelLoading.setComplete();
    this.runButton.setEnabled(true);
  }
  
  errorModelLoading(message) {
    this.modelLoading.setError(message);
    this.runButton.setEnabled(false);
  }
}

// ========================================
// COMPONENT FACTORY
// ========================================

export class ComponentFactory {
  static createButton(elementId, originalText = null) {
    const component = new ButtonComponent(elementId);
    if (originalText) {
      component.originalText = originalText;
    }
    return component;
  }
  
  static createSlider(sliderId, displayId) {
    return new SliderComponent(sliderId, displayId);
  }
  
  static createProgressBar(barId, textId = null) {
    return new ProgressBarComponent(barId, textId);
  }
  
  static createTokenHeatmap(containerId = null) {
    return new TokenHeatmapComponent(containerId);
  }
  
  static createStatusDisplay(elementId = null) {
    return new StatusDisplayComponent(elementId);
  }
}