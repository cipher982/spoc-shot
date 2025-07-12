// Shared DOM utilities and helpers
export const dom = {
  // Common element queries
  get: (id) => document.getElementById(id),
  getAll: (selector) => document.querySelectorAll(selector),
  
  // Frequently used elements
  elements: {
    get runButton() { return document.getElementById('run-button'); },
    get modelLoadingPanel() { return document.getElementById('model-loading-panel'); },
    get modelStatus() { return document.getElementById('model-status'); },
    get modelProgressText() { return document.getElementById('model-progress-text'); },
    get modelProgressBar() { return document.getElementById('model-progress-bar'); },
    get uncertaintyStatus() { return document.getElementById('uncertainty-status'); },
    get heatmapText() { return document.getElementById('heatmap-text'); },
    get promptInput() { return document.getElementById('prompt-input'); },
    get scenarioSelect() { return document.getElementById('scenario-select'); },
    get tempSlider() { return document.getElementById('temp-slider'); },
    get tempDisplay() { return document.getElementById('temp-display'); },
    get topPSlider() { return document.getElementById('top-p-slider'); },
    get topPDisplay() { return document.getElementById('top-p-display'); }
  }
};

// Logging utility
export const logger = {
  log: (message) => console.log(message),
  error: (message, error) => {
    console.error(message, error);
  },
  warn: (message) => console.warn(message)
};

// Shared state
export const appState = {
  webllm: {
    engine: null,
    loaded: false,
    error: null
  },
  analysis: {
    running: false,
    results: null
  },
  ui: {
    modelLoading: false
  }
};