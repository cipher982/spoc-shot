// Standalone Logit/Token Visualization
// Reuses existing visualization logic with modern Tailwind UI

import { webllmManager } from './webllm.js';
import { 
  processToken, 
  createTokenElement, 
  calculateMetrics, 
  formatMetrics 
} from './confidence-utils.js';
import { 
  CONFIDENCE_THRESHOLDS,
  CONFIDENCE_BAR_LENGTH 
} from './constants.js';
import {
  getModelCatalog,
  searchModels,
  filterModels,
  isReasoningModel,
  hasProblematicQuantization,
  getRecentModels,
  addToRecentModels,
  MODEL_FAMILIES
} from './model-catalog.js';

// DOM Elements
const elements = {
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingStatus: document.getElementById('loading-status'),
  loadingProgress: document.getElementById('loading-progress'),
  loadingProgressText: document.getElementById('loading-progress-text'),
  promptInput: document.getElementById('prompt-input'),
  tempSlider: document.getElementById('temp-slider'),
  tempDisplay: document.getElementById('temp-display'),
  topPSlider: document.getElementById('top-p-slider'),
  topPDisplay: document.getElementById('top-p-display'),
  runButton: document.getElementById('run-button'),
  stopButton: document.getElementById('stop-button'),
  status: document.getElementById('status'),
  heatmapText: document.getElementById('heatmap-text'),
  confidenceValue: document.getElementById('confidence-value'),
  confidenceBar: document.getElementById('confidence-bar'),
  confidenceBarText: document.getElementById('confidence-bar-text'),
  entropyValue: document.getElementById('entropy-value'),
  logprobValue: document.getElementById('logprob-value'),
  perplexityValue: document.getElementById('perplexity-value'),
  varianceValue: document.getElementById('variance-value'),
  topPValue: document.getElementById('top-p-value'),
  coherenceValue: document.getElementById('coherence-value'),
  tooltip: document.getElementById('token-tooltip'),
  tooltipCandidates: document.getElementById('tooltip-candidates'),
  loadModelBtn: document.getElementById('load-model-btn'),
  loadingProgressContainer: document.getElementById('loading-progress-container'),
  // New model selector elements
  libraryBrowser: document.getElementById('library-browser'),
  modelSearch: document.getElementById('model-search'),
  familyFilter: document.getElementById('family-filter'),
  modelList: document.getElementById('model-list'),
  customModelInput: document.getElementById('custom-model-input'),
  customModelHint: document.getElementById('custom-model-hint'),
  useCustomModelBtn: document.getElementById('use-custom-model-btn'),
  reasoningWarning: document.getElementById('reasoning-warning'),
  quantizationWarning: document.getElementById('quantization-warning'),
  recentModelsSection: document.getElementById('recent-models-section'),
  recentModelsList: document.getElementById('recent-models-list'),
};

// Model catalog state
let modelCatalog = null;
let selectedModelId = null;

console.log('[INIT] Elements found:', {
  loadingOverlay: !!elements.loadingOverlay,
  loadModelBtn: !!elements.loadModelBtn,
  loadingProgressContainer: !!elements.loadingProgressContainer
});

// State
let currentAbortController = null;
let isGenerating = false;
let allTokens = [];
let allLogprobs = [];
let activeTokenElement = null;
let generationId = 0; // Track generation attempts to prevent race conditions

// Initialize immediately when module loads (not waiting for DOMContentLoaded)
console.log('[INIT] Module loaded, setting up immediately');
setupEventListeners();
setupModelSelector();

// Check if WebLLM is already loaded (from cache or previous session)
if (webllmManager.loaded && webllmManager.engine) {
  console.log('[INIT] WebLLM already loaded, hiding overlay');
  if (elements.loadingOverlay) {
    elements.loadingOverlay.classList.add('hidden');
  }
  updateStatus('Ready', 'ready');
} else {
  // Show the overlay for model selection
  if (elements.loadingOverlay) {
    console.log('[INIT] Showing loading overlay for model selection');
    elements.loadingOverlay.classList.remove('hidden');
  } else {
    console.error('[INIT] Loading overlay element not found!');
  }
}

// ========================================
// MODEL SELECTOR FUNCTIONALITY
// ========================================

/**
 * Setup the model selector UI
 */
function setupModelSelector() {
  console.log('[ModelSelector] Setting up...');
  
  // Load recent models
  displayRecentModels();
  
  // Setup library browser lazy loading
  if (elements.libraryBrowser) {
    elements.libraryBrowser.addEventListener('toggle', async (e) => {
      if (e.target.open && !modelCatalog) {
        await loadModelCatalog();
      }
    });
  }
  
  // Setup search
  if (elements.modelSearch) {
    elements.modelSearch.addEventListener('input', debounce(() => {
      filterAndDisplayModels();
    }, 200));
  }
  
  // Setup family filter
  if (elements.familyFilter) {
    elements.familyFilter.addEventListener('change', () => {
      filterAndDisplayModels();
    });
  }
  
  // Setup custom model button
  if (elements.useCustomModelBtn) {
    elements.useCustomModelBtn.addEventListener('click', () => {
      const customId = elements.customModelInput?.value?.trim();
      if (customId) {
        selectModel(customId, true);
      }
    });
  }
  
  // Setup custom model input enter key
  if (elements.customModelInput) {
    elements.customModelInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        elements.useCustomModelBtn?.click();
      }
      // Also check for reasoning model as user types
      const value = e.target.value + (e.key.length === 1 ? e.key : '');
      checkAndShowReasoningWarning(value);
    });
    
    elements.customModelInput.addEventListener('input', () => {
      checkAndShowReasoningWarning(elements.customModelInput.value);
    });
  }
  
  // Setup model choice radio buttons to check for reasoning warning
  const radioButtons = document.querySelectorAll('input[name="model-choice"]');
  radioButtons.forEach(radio => {
    radio.addEventListener('change', () => {
      checkAndShowReasoningWarning(radio.value);
    });
  });
  
  // Check initial selection
  const initialSelection = document.querySelector('input[name="model-choice"]:checked');
  if (initialSelection) {
    checkAndShowReasoningWarning(initialSelection.value);
  }
}

/**
 * Load the model catalog from WebLLM
 */
async function loadModelCatalog() {
  console.log('[ModelSelector] Loading catalog...');
  
  if (elements.modelList) {
    elements.modelList.innerHTML = '<p class="text-xs text-[#8c735a] italic text-center py-4">Loading ancient tomes...</p>';
  }
  
  try {
    modelCatalog = await getModelCatalog();
    console.log('[ModelSelector] Catalog loaded:', modelCatalog.all.length, 'models');
    
    // Populate family filter
    if (elements.familyFilter) {
      elements.familyFilter.innerHTML = '<option value="All">All Families</option>';
      modelCatalog.familyNames.forEach(family => {
        if (family !== 'Other') {
          const option = document.createElement('option');
          option.value = family;
          option.textContent = family;
          elements.familyFilter.appendChild(option);
        }
      });
    }
    
    // Display all models
    filterAndDisplayModels();
    
  } catch (error) {
    console.error('[ModelSelector] Failed to load catalog:', error);
    if (elements.modelList) {
      elements.modelList.innerHTML = '<p class="text-xs text-red-600 text-center py-4">Failed to load model catalog</p>';
    }
  }
}

/**
 * Filter and display models based on current search/filter state
 */
function filterAndDisplayModels() {
  if (!modelCatalog || !elements.modelList) return;
  
  const searchQuery = elements.modelSearch?.value || '';
  const familyFilter = elements.familyFilter?.value || 'All';
  
  let models = modelCatalog.all;
  
  // Apply search
  if (searchQuery.trim()) {
    models = searchModels(modelCatalog, searchQuery);
  }
  
  // Apply family filter
  if (familyFilter !== 'All') {
    models = models.filter(m => m.family === familyFilter);
  }
  
  // Sort by VRAM (smallest first for easier selection)
  models = models.sort((a, b) => (a.vram_required_MB || 0) - (b.vram_required_MB || 0));
  
  // Render
  renderModelList(models);
}

/**
 * Render the model list
 */
function renderModelList(models) {
  if (!elements.modelList) return;
  
  if (models.length === 0) {
    elements.modelList.innerHTML = '<p class="text-xs text-[#8c735a] italic text-center py-4">No tomes match your search...</p>';
    return;
  }
  
  elements.modelList.innerHTML = '';
  
  models.forEach(model => {
    const div = document.createElement('div');
    
    // Apply different styling for problematic models
    const baseClass = 'model-list-item flex items-center p-2 rounded cursor-pointer transition-colors border border-transparent';
    const hoverClass = model.isProblematic 
      ? 'opacity-60 hover:bg-red-50 hover:border-red-200' 
      : 'hover:bg-[#d8c8b0] hover:border-[#bcaaa4]';
    div.className = `${baseClass} ${hoverClass}`;
    div.dataset.modelId = model.model_id;
    
    // Build badges
    let badges = '';
    if (model.low_resource_required) {
      badges += '<span class="ml-1 text-[10px] bg-green-100 text-green-700 px-1 rounded">📱</span>';
    }
    if (model.isReasoning) {
      badges += '<span class="ml-1 text-[10px] bg-amber-100 text-amber-700 px-1 rounded">🧠</span>';
    }
    if (model.isProblematic) {
      badges += '<span class="ml-1 text-[10px] bg-red-100 text-red-700 px-1 rounded" title="May have compatibility issues">⚠️</span>';
    }
    
    div.innerHTML = `
      <div class="flex-1 min-w-0">
        <div class="font-serif text-sm text-[#2a1810] truncate">${model.displayName}${badges}</div>
        <div class="text-[10px] text-[#8c735a] truncate">${model.parameterSize || ''} · ${model.vramGB ? model.vramGB + ' GB' : 'Unknown size'} · ${model.family}</div>
      </div>
    `;
    
    div.addEventListener('click', () => {
      selectModel(model.model_id);
    });
    
    elements.modelList.appendChild(div);
  });
}

/**
 * Select a model from the catalog or custom input
 */
function selectModel(modelId, isCustom = false) {
  console.log('[ModelSelector] Selected:', modelId, isCustom ? '(custom)' : '');
  selectedModelId = modelId;
  
  // Uncheck all radio buttons
  const radioButtons = document.querySelectorAll('input[name="model-choice"]');
  radioButtons.forEach(rb => rb.checked = false);
  
  // If it matches a featured model, check it
  const matchingRadio = document.querySelector(`input[name="model-choice"][value="${modelId}"]`);
  if (matchingRadio) {
    matchingRadio.checked = true;
  }
  
  // Update custom input if it was a library selection
  if (!isCustom && elements.customModelInput) {
    elements.customModelInput.value = modelId;
  }
  
  // Close the library browser
  if (elements.libraryBrowser) {
    elements.libraryBrowser.open = false;
  }
  
  // Check for reasoning model warning
  checkAndShowReasoningWarning(modelId);
  
  // Visual feedback
  if (elements.customModelHint) {
    elements.customModelHint.textContent = `Selected: ${modelId}`;
    elements.customModelHint.classList.add('text-[#5d4037]', 'font-semibold');
  }
}

/**
 * Check if model has warnings and show appropriate warnings
 */
function checkAndShowModelWarnings(modelId) {
  if (!modelId) return;
  
  // Check reasoning model warning
  if (elements.reasoningWarning) {
    if (isReasoningModel(modelId)) {
      elements.reasoningWarning.classList.remove('hidden');
    } else {
      elements.reasoningWarning.classList.add('hidden');
    }
  }
  
  // Check problematic quantization warning
  if (elements.quantizationWarning) {
    if (hasProblematicQuantization(modelId)) {
      elements.quantizationWarning.classList.remove('hidden');
    } else {
      elements.quantizationWarning.classList.add('hidden');
    }
  }
}

// Alias for backward compatibility
function checkAndShowReasoningWarning(modelId) {
  checkAndShowModelWarnings(modelId);
}

/**
 * Display recent models
 */
function displayRecentModels() {
  const recent = getRecentModels();
  
  if (!recent.length || !elements.recentModelsSection || !elements.recentModelsList) {
    return;
  }
  
  elements.recentModelsSection.classList.remove('hidden');
  elements.recentModelsList.innerHTML = '';
  
  recent.forEach(modelId => {
    const btn = document.createElement('button');
    btn.className = 'px-2 py-0.5 text-xs bg-[#e6e0d0] hover:bg-[#d8c8b0] text-[#5c4d3c] rounded border border-[#d4c5b0] font-serif transition-colors truncate max-w-[150px]';
    btn.textContent = modelId.replace(/-MLC.*$/, '').replace(/-q\d+f\d+.*$/, '');
    btn.title = modelId;
    btn.addEventListener('click', () => {
      selectModel(modelId);
    });
    elements.recentModelsList.appendChild(btn);
  });
}

/**
 * Simple debounce helper
 */
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

// Global function for button onclick
export function loadSelectedModel() {
  console.log('[BUTTON] Load model button clicked via onclick');

  // Determine which model to load (priority: custom input > selected from catalog > radio button)
  let modelId = null;
  
  // 1. Check if there's a custom model input with a value
  const customInput = elements.customModelInput?.value?.trim();
  if (customInput) {
    modelId = customInput;
    console.log('[BUTTON] Using custom model:', modelId);
  }
  
  // 2. Check if a model was selected from the catalog
  if (!modelId && selectedModelId) {
    modelId = selectedModelId;
    console.log('[BUTTON] Using catalog selection:', modelId);
  }
  
  // 3. Fall back to radio button selection
  if (!modelId) {
    const selectedRadio = document.querySelector('input[name="model-choice"]:checked');
    if (selectedRadio) {
      modelId = selectedRadio.value;
      console.log('[BUTTON] Using radio selection:', modelId);
    }
  }
  
  if (!modelId) {
    console.log('[BUTTON] No model selected');
    alert('Please select a storyteller first!');
    return;
  }

  console.log('[BUTTON] Final selected model:', modelId);
  
  // Add to recent models
  addToRecentModels(modelId);

  // Disable interactions
  const radioButtons = document.querySelectorAll('input[name="model-choice"]');
  radioButtons.forEach(rb => {
    rb.disabled = true;
    const container = rb.closest('label');
    if (container) {
      container.classList.remove('hover:bg-[#e6e0d0]', 'cursor-pointer');
      container.classList.add('opacity-60', 'cursor-not-allowed');
    }
  });

  elements.loadModelBtn.disabled = true;
  elements.loadModelBtn.classList.add('opacity-50', 'cursor-not-allowed');
  elements.loadModelBtn.textContent = 'Summoning...';

  // Small delay for UI update before heavy work
  setTimeout(() => {
    elements.loadModelBtn.classList.add('hidden');
    // Hide the model selection area entirely to reduce clutter
    const modelSelectionDiv = elements.loadModelBtn.previousElementSibling;
    if (modelSelectionDiv) modelSelectionDiv.classList.add('hidden');

    elements.loadingProgressContainer.classList.remove('hidden');
    initializeWebLLM(modelId);
  }, 300);
}


// Function is now exported and will be made available via import in HTML

// Setup event listeners
function setupEventListeners() {
  console.log('[SETUP] Setting up event listeners');

  // Model loading button - also add event listener as backup
  if (elements.loadModelBtn) {
    console.log('[SETUP] Found load model button, adding listener');
    elements.loadModelBtn.addEventListener('click', loadSelectedModel);
  } else {
    console.error('[SETUP] Load model button not found!');
  }

  // Parameter sliders
  elements.tempSlider.addEventListener('input', (e) => {
    elements.tempDisplay.textContent = e.target.value;
  });

  elements.topPSlider.addEventListener('input', (e) => {
    elements.topPDisplay.textContent = e.target.value;
  });

  // Run button
  elements.runButton.addEventListener('click', () => {
    if (!isGenerating) {
      startGeneration();
    }
  });

  // Stop button
  elements.stopButton.addEventListener('click', () => {
    stopGeneration();
  });

  // Enter key to generate
  elements.promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!isGenerating) {
        startGeneration();
      }
    }
  });

  // Token interactions (delegation)
  elements.heatmapText.addEventListener('mouseover', handleTokenHover);
  elements.heatmapText.addEventListener('mouseout', handleTokenMouseOut);
  elements.heatmapText.addEventListener('click', handleTokenClick);
  
  // Close tooltip on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.token') && !e.target.closest('#token-tooltip')) {
      hideTooltip();
    }
  });
  
  // Hide tooltip on scroll (but not if we're in custom input mode)
  elements.heatmapText.addEventListener('scroll', () => {
    // Check if we're currently showing the custom input
    const customInput = elements.tooltip.querySelector('input[type="text"]');
    if (!customInput) {
      hideTooltip();
    }
  });
}

// Handle token hover to show tooltip
function handleTokenHover(e) {
  const tokenEl = e.target.closest('.token');
  if (!tokenEl || !tokenEl.dataset.candidates) return;
  
  // Don't update if we're already hovering this one
  if (activeTokenElement === tokenEl && !elements.tooltip.classList.contains('hidden')) return;
  
  showTooltip(tokenEl);
}

// Handle token mouse out
function handleTokenMouseOut(e) {
  // We check relatedTarget to see where the mouse went.
  // If it went to the tooltip itself, we don't hide it (to allow clicking).
  // But if it went to the container or another element, we hide it.
  const toElement = e.relatedTarget;
  
  // If moving to the tooltip or its children, don't hide
  if (toElement && toElement.closest('#token-tooltip')) return;
  
  // If moving between tokens, handleTokenHover will pick it up, but we can hide the current one temporarily or let hover handle it
  // Ideally, we want a slight delay or just hide if it's not another token
  
  // Simple behavior: Hide unless we are over the tooltip
  // To make it user friendly for clicking, we might need a small delay or check
  
  // Actually, for the "click to branch" workflow, purely hover-based hiding is tricky because 
  // the user needs to move the mouse FROM the token TO the tooltip.
  // So we need a delay.
  
  startTooltipHideTimer();
}

let tooltipHideTimer = null;

function startTooltipHideTimer() {
  if (tooltipHideTimer) clearTimeout(tooltipHideTimer);
  tooltipHideTimer = setTimeout(() => {
    hideTooltip();
  }, 300); // 300ms delay to allow moving to tooltip
}

function cancelTooltipHideTimer() {
  if (tooltipHideTimer) {
    clearTimeout(tooltipHideTimer);
    tooltipHideTimer = null;
  }
}

// Handle token click
function handleTokenClick(e) {
  const tokenEl = e.target.closest('.token');
  if (!tokenEl || !tokenEl.dataset.candidates) return;
  
  // Click locks the tooltip (cancels hide timer) or toggles it
  cancelTooltipHideTimer();
  showTooltip(tokenEl);
}

// Show tooltip
function showTooltip(tokenEl) {
  cancelTooltipHideTimer();
  
  const candidatesData = tokenEl.dataset.candidates;
  if (!candidatesData) return;
  
  const candidates = JSON.parse(candidatesData);
  const index = parseInt(tokenEl.dataset.index);
  
  elements.tooltipCandidates.innerHTML = '';
  
  candidates.forEach(c => {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-2 hover:bg-[#e6e0d0] rounded cursor-pointer group transition-colors border-b border-transparent border-dashed hover:border-[#bcaaa4] last:border-0';
    
    // Colorize confidence in tooltip
    const confColor = getConfidenceColorClass(c.confidence);
    
    // Create token span safely
    const tokenSpan = document.createElement('span');
    tokenSpan.className = 'font-serif text-[#2c1e14] text-lg group-hover:text-[#1a120b] whitespace-pre';
    tokenSpan.textContent = c.token;  // Safe text assignment
    
    // Create confidence span
    const confSpan = document.createElement('span');
    confSpan.className = `text-xs ${confColor} ml-4 font-serif`;
    confSpan.textContent = `${c.confidence.toFixed(1)}%`;
    
    // Append spans to div
    div.appendChild(tokenSpan);
    div.appendChild(confSpan);
    
    div.onclick = (e) => {
      e.stopPropagation(); // Prevent closing immediately
      retryGeneration(index, c.token);
    };
    
    elements.tooltipCandidates.appendChild(div);
  });
  
  // Add "Custom..." option at the bottom
  const customDiv = document.createElement('div');
  customDiv.className = 'flex items-center justify-between p-2 hover:bg-[#e6e0d0] rounded cursor-pointer group transition-colors border-t-2 border-[#d4c5b0] mt-1 pt-2';
  
  // Create custom option spans safely
  const customTextSpan = document.createElement('span');
  customTextSpan.className = 'font-serif text-[#5c4d3c] text-lg group-hover:text-[#1a120b]';
  customTextSpan.textContent = '✏️ Custom word...';
  
  const typeSpan = document.createElement('span');
  typeSpan.className = 'text-xs text-[#8c735a] ml-4 font-serif italic';
  typeSpan.textContent = 'type';
  
  customDiv.appendChild(customTextSpan);
  customDiv.appendChild(typeSpan);
  
  customDiv.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    // Don't let any other handlers run
    cancelTooltipHideTimer();
    // Show custom input without any chance of interference
    setTimeout(() => showCustomInput(index), 0);
  };
  
  elements.tooltipCandidates.appendChild(customDiv);
  
  // Position tooltip
  const rect = tokenEl.getBoundingClientRect();
  // Check for overflow on right edge
  const tooltipWidth = 250; // approx
  let left = rect.left;
  if (left + tooltipWidth > window.innerWidth) {
    left = window.innerWidth - tooltipWidth - 20;
  }
  
  elements.tooltip.style.left = `${left}px`;
  elements.tooltip.style.top = `${rect.bottom + 5}px`;
  elements.tooltip.classList.remove('hidden');
  
  activeTokenElement = tokenEl;
  
  // Ensure tooltip keeps itself open on hover
  elements.tooltip.onmouseover = cancelTooltipHideTimer;
  elements.tooltip.onmouseout = startTooltipHideTimer;
}

function hideTooltip() {
  if (elements.tooltip) elements.tooltip.classList.add('hidden');
  activeTokenElement = null;
}

// Show custom input field in tooltip
function showCustomInput(index) {
  // Make absolutely sure we're not hiding the tooltip
  cancelTooltipHideTimer();
  
  // Also ensure tooltip is visible
  if (elements.tooltip.classList.contains('hidden')) {
    elements.tooltip.classList.remove('hidden');
  }
  
  // Store the current height to prevent shrinking
  const currentHeight = elements.tooltip.offsetHeight;
  
  elements.tooltipCandidates.innerHTML = '';
  
  // Create input container
  const container = document.createElement('div');
  container.className = 'p-3';
  
  // Set minimum height to prevent tooltip from shrinking
  container.style.minHeight = (currentHeight - 40) + 'px'; // Subtract some padding
  
  // Input label
  const label = document.createElement('div');
  label.className = 'text-xs text-[#5c4d3c] font-serif mb-2';
  label.textContent = 'Type your alternative:';
  container.appendChild(label);
  
  // Text input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'w-full px-2 py-1 border border-[#d4c5b0] rounded text-[#2c1e14] font-serif text-base focus:outline-none focus:border-[#8c735a] bg-[#fffef8]';
  input.placeholder = 'Enter word...';
  container.appendChild(input);
  
  // Token preview
  const preview = document.createElement('div');
  preview.className = 'text-xs text-[#8c735a] font-mono mt-2 italic';
  preview.textContent = 'Tokens: []';
  container.appendChild(preview);
  
  // Buttons container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'flex gap-2 mt-3';
  
  // Apply button
  const applyBtn = document.createElement('button');
  applyBtn.className = 'px-3 py-1 bg-[#8d6e63] hover:bg-[#6d4c41] text-white text-sm rounded font-serif transition-colors';
  applyBtn.textContent = 'Apply';
  applyBtn.onclick = () => {
    const text = input.value.trim();
    if (text) {
      applyCustomToken(index, text);
    }
  };
  buttonContainer.appendChild(applyBtn);
  
  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'px-3 py-1 bg-[#d4c5b0] hover:bg-[#bcaaa4] text-[#5c4d3c] text-sm rounded font-serif transition-colors';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => {
    hideTooltip();
  };
  buttonContainer.appendChild(cancelBtn);
  
  container.appendChild(buttonContainer);
  elements.tooltipCandidates.appendChild(container);
  
  // Update preview as user types
  input.oninput = async () => {
    const text = input.value;
    if (text) {
      try {
        // Tokenize the input to show preview
        const tokens = await tokenizeText(text);
        preview.textContent = `Tokens: ${JSON.stringify(tokens)} (${tokens.length})`;
      } catch (err) {
        preview.textContent = `Error: ${err.message}`;
        console.error('[Tokenize Preview] Failed:', err);
      }
    } else {
      preview.textContent = 'Tokens: []';
    }
  };
  
  // Handle Enter key
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      applyBtn.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelBtn.click();
    }
  };
  
  // Focus input
  setTimeout(() => input.focus(), 50);
}

// Helper for tooltip colors (Old Book Theme)
function getConfidenceColorClass(conf) {
  if (conf >= 90) return 'text-[#1a1a1a] font-bold'; // Deep ink
  if (conf >= 70) return 'text-[#4a2c1d] font-semibold'; // Brown ink
  if (conf >= 50) return 'text-[#8d6e63]'; // Faded brown
  if (conf >= 30) return 'text-[#a14545] italic'; // Rust
  return 'text-[#c62828] italic font-bold'; // Blood red
}

// Tokenize text using the engine
async function tokenizeText(text) {
  if (!webllmManager.engine) {
    throw new Error('Engine not initialized');
  }
  
  try {
    // WebLLM stores the pipeline in a Map by model ID
    const pipeline = webllmManager.engine.loadedModelIdToPipeline.values().next().value;
    if (!pipeline || !pipeline.tokenizer) {
      throw new Error('Pipeline or tokenizer not found');
    }
    
    // Encode the text to token IDs
    const encoded = await pipeline.tokenizer.encode(text, false, false);
    
    // Decode each token ID back to its string representation
    const tokens = [];
    for (let i = 0; i < encoded.length; i++) {
      const decoded = await pipeline.tokenizer.decode(Int32Array.from([encoded[i]]), false, false);
      tokens.push(decoded);
    }
    
    return tokens;
  } catch (err) {
    console.error('[Tokenize] Error:', err);
    throw err;
  }
}

// Apply custom token(s)
async function applyCustomToken(index, text) {
  hideTooltip();
  
  // Tokenize the custom text
  const tokens = await tokenizeText(text);

  if (tokens.length === 0) return;

  // Similar to retryGeneration but potentially with multiple tokens
  if (isGenerating) {
    await stopGeneration();
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  generationId++;

  // Keep everything before the clicked position
  const keptTokens = allTokens.slice(0, index);
  const keptLogprobs = allLogprobs.slice(0, index);
  
  // For multi-token injection, we'll insert all tokens
  // The first token gets the original logprobs structure (preserving candidates)
  // Additional tokens get null logprobs
  const originalLogprobObj = allLogprobs[index];
  let firstTokenLogprobs = null;
  
  if (originalLogprobObj && originalLogprobObj.content && originalLogprobObj.content[0]) {
    firstTokenLogprobs = JSON.parse(JSON.stringify(originalLogprobObj));
    firstTokenLogprobs.content[0].token = tokens[0];
    // We don't have the exact logprob for custom text, so we'll leave it as is
    // This preserves the candidates list for further branching
  }
  
  // Update state with all new tokens
  allTokens = [...keptTokens, ...tokens];
  allLogprobs = [...keptLogprobs, firstTokenLogprobs, ...new Array(tokens.length - 1).fill(null)];

  // Re-render UI
  elements.heatmapText.innerHTML = '';
  allTokens.forEach((token, i) => {
    appendTokenToHeatmap(token, allLogprobs[i], i);
  });
  
  // Continue generation
  const prompt = elements.promptInput.value.trim();
  await runGenerationLoop(prompt, allTokens);
}

// Initialize WebLLM
async function initializeWebLLM(modelId) {
  try {
    updateStatus('Initializing WebLLM...', 'loading');
    if (elements.loadingOverlay) elements.loadingOverlay.classList.remove('hidden');
    
    // Dynamically import WebLLM
    const { CreateMLCEngine, prebuiltAppConfig } = await import(
      'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm'
    );

    if (!('gpu' in navigator)) throw new Error('WebGPU unavailable');
    
    const selectedModel = modelId || "Hermes-3-Llama-3.1-8B-q4f16_1-MLC";
    
    const progressCallback = (report) => {
      const progress = Math.round((report.progress || 0) * 100);
      if (elements.loadingProgress) elements.loadingProgress.style.width = `${progress}%`;
      if (elements.loadingProgressText) elements.loadingProgressText.textContent = `${progress}%`;
      
      // Clean up status text if loading from cache
      let statusText = report.text || `Loading... ${progress}%`;
      if (statusText.includes('Loading model from cache')) {
        const match = statusText.match(/\[(\d+\/\d+)\]/);
        if (match) {
          statusText = `Verifying cache: ${match[1]} checked...`;
        } else if (progress === 0) {
          statusText = 'Verifying cached model...';
        }
      }
      if (elements.loadingStatus) elements.loadingStatus.textContent = statusText;
    };

    const engine = await CreateMLCEngine(selectedModel, { initProgressCallback: progressCallback });

    webllmManager.engine = engine;
    window.webllmEngine = engine;

    // Warm up the engine with a tiny generation to ensure wasm bindings are ready
    // This prevents "VectorInt" errors when user clicks Write immediately after load
    if (elements.loadingStatus) elements.loadingStatus.textContent = 'Warming up...';
    try {
      // Do a minimal completion to initialize internal state
      const warmup = await engine.completions.create({
        prompt: 'Hi',
        max_tokens: 1,
        stream: false
      });
    } catch (warmupErr) {
      // Ignore warmup errors, the model should still work
      console.warn('Warmup generation failed (non-critical):', warmupErr.message);
    }

    // Now mark as fully ready
    webllmManager.loaded = true;

    if (elements.loadingOverlay) elements.loadingOverlay.classList.add('hidden');
    updateStatus('Ready', 'ready');
  } catch (error) {
    console.error(error);
    updateStatus(`Error: ${error.message}`, 'error');
    if (elements.loadingOverlay) elements.loadingOverlay.classList.add('hidden');
  }
}

// Start generation (wraps internal logic)
async function startGeneration() {
  // Check if model is ready
  if (!webllmManager.loaded || !webllmManager.engine) {
    updateStatus('Model not ready - please wait', 'error');
    return;
  }

  const topic = elements.promptInput.value.trim();
  if (!topic) {
    alert('Please enter a story topic');
    return;
  }

  // Reset state for fresh start
  allTokens = [];
  allLogprobs = [];
  elements.heatmapText.innerHTML = '';
  resetMetrics();

  // Increment generationId for new generation
  generationId++;

  await runGenerationLoop(topic, []);
}

// Retry generation from a specific point with a chosen token
async function retryGeneration(index, chosenToken) {
  hideTooltip();
  
  // Stop any ongoing generation first
  if (isGenerating) {
    await stopGeneration();
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Increment generation ID to invalidate any in-flight tokens
  generationId++;
  
  // Slice history to keep everything BEFORE the clicked token
  // If I click token at index 5, I want tokens 0-4, then replace 5 with chosenToken
  const keptTokens = allTokens.slice(0, index);
  const keptLogprobs = allLogprobs.slice(0, index);
  
  // Preserve the logprobs from the original position so we keep candidates and interactivity
  let newLogprobObj = null;
  const originalLogprobObj = allLogprobs[index];
  
  if (originalLogprobObj && originalLogprobObj.content && originalLogprobObj.content[0]) {
    // Deep clone to avoid mutating history
    newLogprobObj = JSON.parse(JSON.stringify(originalLogprobObj));
    
    // Update the main token info to match our choice
    newLogprobObj.content[0].token = chosenToken;
    
    // Try to find the specific logprob for this token from candidates
    // to make the confidence score correct
    if (newLogprobObj.content[0].top_logprobs) {
      const candidate = newLogprobObj.content[0].top_logprobs.find(c => c.token === chosenToken);
      if (candidate) {
        newLogprobObj.content[0].logprob = candidate.logprob;
        // We keep top_logprobs as is - they are still valid alternatives for this position
      }
    }
  }
  
  // Update state
  allTokens = [...keptTokens, chosenToken];
  allLogprobs = [...keptLogprobs, newLogprobObj];

  // Re-render UI
  elements.heatmapText.innerHTML = '';
  allTokens.forEach((token, i) => {
    appendTokenToHeatmap(token, allLogprobs[i], i);
  });
  
  // Use original prompt
  const prompt = elements.promptInput.value.trim();
  
  // Continue generation with the same original prompt
  // The history passed to the model will include the chosen token
  await runGenerationLoop(prompt, allTokens);
}

// Removed - using completions API only, no system prompts needed

// Core generation loop
async function runGenerationLoop(topic, currentHistoryTokens) {
  if (!webllmManager.loaded) return;
  
  // Capture the current generation ID
  const thisGenerationId = generationId;

  isGenerating = true;
  currentAbortController = new AbortController();
  
  elements.runButton.classList.add('hidden');
  elements.stopButton.classList.remove('hidden');
  updateStatus('Generating...', 'generating');
  
  const temperature = parseFloat(elements.tempSlider.value);
  const topP = parseFloat(elements.topPSlider.value);

  try {
    const engine = webllmManager.engine;
    
    // Build prompt for completions API
    let promptText;
    if (currentHistoryTokens.length > 0) {
      // Continue from existing tokens - but we need the original context!
      // The model needs to know what kind of story it's writing
      promptText = `Write a story about ${topic}:\n\n${currentHistoryTokens.join('')}`;
    } else {
      // Initial generation - start with a prompt
      promptText = `Write a story about ${topic}:\n\n`;
    }
    
    // Create completion
    const completionParams = {
      prompt: promptText,
      temperature,
      top_p: topP,
      max_tokens: 500,
      stream: true,
      logprobs: true,
      top_logprobs: 5,
      echo: false  // Don't echo the prompt back
    };
    
    let chunks;
    try {
      chunks = await engine.completions.create(completionParams);
    } catch (createError) {
      console.error(`[Generation] Failed to create completion:`, createError);
      throw createError;
    }

    let chunkCount = 0;

    // Timeout check for debugging stuck generations
    const timeoutId = setTimeout(() => {
      if (chunkCount === 0) {
        console.error(`[Generation] TIMEOUT: No chunks received after 5 seconds`);
      }
    }, 5000);

    try {
      for await (const chunk of chunks) {
        if (chunkCount === 0) {
          clearTimeout(timeoutId);
        }
        chunkCount++;

        // Check if this generation has been superseded
        if (thisGenerationId !== generationId) {
          break;
        }

        // Check for cancellation
        if (currentAbortController && currentAbortController.signal.aborted) {
          break;
        }

        const choice = chunk.choices?.[0];
        if (!choice) {
          continue;
        }

        // Completions API returns content in choice.text
        const content = choice.text || '';
        const logprobs = choice.logprobs;

        if (content) {
          // Add to state
          allTokens.push(content);
          if (logprobs) allLogprobs.push(logprobs);
          else allLogprobs.push(null);

          appendTokenToHeatmap(content, logprobs, allTokens.length - 1);
          updateMetrics();
        }
      }

      clearTimeout(timeoutId);

    } catch (iterError) {
      console.error(`[Generation] Error during streaming:`, iterError);
      clearTimeout(timeoutId);
      throw iterError;
    }
    
    // Only update status if this is still the current generation
    if (thisGenerationId === generationId) {
      updateStatus('Complete', 'complete');
    }
    
  } catch (error) {
    // Only show error if this is still the current generation
    if (thisGenerationId === generationId) {
      if (error.name === 'AbortError') {
        updateStatus('Cancelled', 'cancelled');
      } else {
        console.error(`Generation ${thisGenerationId} error:`, error);
        updateStatus(`Error: ${error.message}`, 'error');
      }
    }
  } finally {
    // Only update UI if this is still the current generation
    if (thisGenerationId === generationId) {
      isGenerating = false;
      elements.runButton.classList.remove('hidden');
      elements.stopButton.classList.add('hidden');
    }
  }
}

// Stop generation
async function stopGeneration() {
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }

  // Explicitly interrupt the engine to ensure it stops processing
  if (webllmManager.engine && typeof webllmManager.engine.interruptGenerate === 'function') {
    try {
      await webllmManager.engine.interruptGenerate();
    } catch (err) {
      // Ignore interruption errors
    }
  }

  isGenerating = false;
}

// Append token to heatmap
function appendTokenToHeatmap(token, logprobs, index) {
  const element = createTokenElement(token, logprobs, index);
  elements.heatmapText.appendChild(element);
  elements.heatmapText.scrollTop = elements.heatmapText.scrollHeight;
}

// Update metrics
function updateMetrics() {
  if (allLogprobs.length === 0) return;
  const metrics = calculateMetrics(allLogprobs, allTokens);
  const formatted = formatMetrics(metrics);

  // Update confidence
  const confidencePercent = (metrics.confidence * 100).toFixed(1);
  elements.confidenceValue.textContent = `${confidencePercent}%`;
  elements.confidenceBar.style.width = `${metrics.confidence * 100}%`;

  // Update confidence bar text
  const filledBars = Math.round(metrics.confidence * CONFIDENCE_BAR_LENGTH);
  const emptyBars = CONFIDENCE_BAR_LENGTH - filledBars;
  elements.confidenceBarText.textContent = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

  // Update other metrics
  elements.entropyValue.textContent = formatted.entropy;
  elements.logprobValue.textContent = formatted.logprob;
  elements.perplexityValue.textContent = formatted.perplexity;
  elements.varianceValue.textContent = formatted.variance;
  elements.topPValue.textContent = formatted.topP;
  elements.coherenceValue.textContent = formatted.coherence;
}

// Reset metrics
function resetMetrics() {
  elements.confidenceValue.textContent = '--';
  elements.confidenceBar.style.width = '0%';
  elements.confidenceBarText.textContent = '░'.repeat(CONFIDENCE_BAR_LENGTH);
  elements.entropyValue.textContent = '--';
  elements.logprobValue.textContent = '--';
  elements.perplexityValue.textContent = '--';
  elements.varianceValue.textContent = '--';
  elements.topPValue.textContent = '--';
  elements.coherenceValue.textContent = '--';
}

// Update status
function updateStatus(text, type = 'ready') {
  elements.status.textContent = text;
  elements.status.className = 'px-3 py-1 rounded-full text-sm font-medium';
  
  switch (type) {
    case 'loading':
      elements.status.classList.add('bg-blue-500/30', 'text-blue-200');
      break;
    case 'generating':
      elements.status.classList.add('bg-yellow-500/30', 'text-yellow-200');
      break;
    case 'complete':
      elements.status.classList.add('bg-green-500/30', 'text-green-200');
      break;
    case 'error':
      elements.status.classList.add('bg-red-500/30', 'text-red-200');
      break;
    case 'cancelled':
      elements.status.classList.add('bg-gray-500/30', 'text-gray-200');
      break;
    default:
      elements.status.classList.add('bg-purple-500/30', 'text-purple-200');
  }
}
