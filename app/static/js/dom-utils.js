// Centralized DOM Utilities - DRY Refactoring
// Eliminates repeated DOM manipulation patterns

import { ELEMENT_IDS, CSS_CLASSES } from './constants.js';

// ========================================
// CORE DOM UTILITIES
// ========================================

/**
 * Safe element getter with optional error handling
 */
export function getElement(id, required = false) {
  const element = document.getElementById(id);
  if (!element && required) {
    console.error(`Required element not found: ${id}`);
  }
  return element;
}

/**
 * Get multiple elements by IDs
 */
export function getElements(ids) {
  const elements = {};
  ids.forEach(id => {
    elements[id] = getElement(id);
  });
  return elements;
}

/**
 * Safe text content update
 */
export function setText(elementOrId, text) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  if (element) {
    element.textContent = text;
  }
}

/**
 * Safe HTML content update
 */
export function setHTML(elementOrId, html) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  if (element) {
    element.innerHTML = html;
  }
}

/**
 * Safe attribute update
 */
export function setAttribute(elementOrId, attribute, value) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  if (element) {
    element.setAttribute(attribute, value);
  }
}

/**
 * Safe style property update
 */
export function setStyle(elementOrId, property, value) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  if (element) {
    element.style.setProperty(property, value);
  }
}

// ========================================
// CLASS MANIPULATION UTILITIES
// ========================================

/**
 * Add class if element exists
 */
export function addClass(elementOrId, className) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  if (element) {
    element.classList.add(className);
  }
}

/**
 * Remove class if element exists
 */
export function removeClass(elementOrId, className) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  if (element) {
    element.classList.remove(className);
  }
}

/**
 * Toggle class if element exists
 */
export function toggleClass(elementOrId, className) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  if (element) {
    element.classList.toggle(className);
  }
}

/**
 * Check if element has class
 */
export function hasClass(elementOrId, className) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  return element ? element.classList.contains(className) : false;
}

// ========================================
// VISIBILITY UTILITIES
// ========================================

/**
 * Show element (remove hidden class)
 */
export function show(elementOrId) {
  removeClass(elementOrId, CSS_CLASSES.HIDDEN);
}

/**
 * Hide element (add hidden class)
 */
export function hide(elementOrId) {
  addClass(elementOrId, CSS_CLASSES.HIDDEN);
}

/**
 * Toggle visibility
 */
export function toggleVisibility(elementOrId) {
  toggleClass(elementOrId, CSS_CLASSES.HIDDEN);
}

/**
 * Check if element is visible
 */
export function isVisible(elementOrId) {
  return !hasClass(elementOrId, CSS_CLASSES.HIDDEN);
}

// ========================================
// FORM UTILITIES
// ========================================

/**
 * Get input value safely
 */
export function getValue(elementOrId) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  return element ? element.value : '';
}

/**
 * Set input value safely
 */
export function setValue(elementOrId, value) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  if (element) {
    element.value = value;
  }
}

/**
 * Enable/disable element
 */
export function setEnabled(elementOrId, enabled) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  if (element) {
    element.disabled = !enabled;
  }
}

// ========================================
// BULK UPDATE UTILITIES
// ========================================

/**
 * Update multiple text elements at once
 */
export function updateTexts(updates) {
  Object.entries(updates).forEach(([id, text]) => {
    setText(id, text);
  });
}

/**
 * Update multiple element properties at once
 */
export function updateElements(updates) {
  Object.entries(updates).forEach(([id, properties]) => {
    const element = getElement(id);
    if (element && properties) {
      Object.entries(properties).forEach(([prop, value]) => {
        switch (prop) {
          case 'text':
            element.textContent = value;
            break;
          case 'html':
            element.innerHTML = value;
            break;
          case 'value':
            element.value = value;
            break;
          case 'disabled':
            element.disabled = value;
            break;
          case 'hidden':
            element.classList.toggle(CSS_CLASSES.HIDDEN, value);
            break;
          default:
            if (prop.startsWith('class-')) {
              const className = prop.replace('class-', '');
              element.classList.toggle(className, value);
            } else if (prop.startsWith('style-')) {
              const styleProp = prop.replace('style-', '');
              element.style.setProperty(styleProp, value);
            } else {
              element.setAttribute(prop, value);
            }
        }
      });
    }
  });
}

// ========================================
// COMMON UI ELEMENT COLLECTIONS
// ========================================

/**
 * Get all commonly used elements at once
 */
export function getCommonElements() {
  return {
    // Main controls
    runButton: getElement(ELEMENT_IDS.RUN_BUTTON),
    stopButton: getElement(ELEMENT_IDS.STOP_BUTTON),
    promptInput: getElement(ELEMENT_IDS.PROMPT_INPUT),
    scenarioSelect: getElement(ELEMENT_IDS.SCENARIO_SELECT),
    
    // Parameter controls
    tempSlider: getElement(ELEMENT_IDS.TEMP_SLIDER),
    tempDisplay: getElement(ELEMENT_IDS.TEMP_DISPLAY),
    topPSlider: getElement(ELEMENT_IDS.TOP_P_SLIDER),
    topPDisplay: getElement(ELEMENT_IDS.TOP_P_DISPLAY),
    
    // Model loading
    modelLoadingPanel: getElement(ELEMENT_IDS.MODEL_LOADING_PANEL),
    modelStatus: getElement(ELEMENT_IDS.MODEL_STATUS),
    modelProgressText: getElement(ELEMENT_IDS.MODEL_PROGRESS_TEXT),
    modelProgressBar: getElement(ELEMENT_IDS.MODEL_PROGRESS_BAR),
    
    // Analysis display
    uncertaintyStatus: getElement(ELEMENT_IDS.UNCERTAINTY_STATUS),
    heatmapText: getElement(ELEMENT_IDS.HEATMAP_TEXT),
    confidenceBar: getElement(ELEMENT_IDS.CONFIDENCE_BAR)
  };
}

/**
 * Get all metric elements
 */
export function getMetricElements() {
  return {
    confidence: getElement(ELEMENT_IDS.CONFIDENCE_VALUE),
    entropy: getElement(ELEMENT_IDS.ENTROPY_VALUE),
    logprob: getElement(ELEMENT_IDS.LOGPROB_VALUE),
    perplexity: getElement(ELEMENT_IDS.PERPLEXITY_VALUE),
    selfScore: getElement(ELEMENT_IDS.SELF_SCORE_VALUE),
    variance: getElement(ELEMENT_IDS.VARIANCE_VALUE),
    topP: getElement(ELEMENT_IDS.TOP_P_VALUE),
    calibration: getElement(ELEMENT_IDS.CALIBRATION_VALUE),
    coherence: getElement(ELEMENT_IDS.COHERENCE_VALUE)
  };
}

// ========================================
// EVENT UTILITIES
// ========================================

/**
 * Add event listener with error handling
 */
export function addEventListener(elementOrId, event, handler, options = {}) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  if (element) {
    element.addEventListener(event, handler, options);
    return true;
  }
  return false;
}

/**
 * Add event listeners to multiple elements
 */
export function addEventListeners(listeners) {
  listeners.forEach(({ element, event, handler, options }) => {
    addEventListener(element, event, handler, options);
  });
}

// ========================================
// SCROLL UTILITIES
// ========================================

/**
 * Scroll element to bottom
 */
export function scrollToBottom(elementOrId) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  if (element) {
    element.scrollTop = element.scrollHeight;
  }
}

/**
 * Scroll element to top
 */
export function scrollToTop(elementOrId) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  if (element) {
    element.scrollTop = 0;
  }
}

// ========================================
// VALIDATION UTILITIES
// ========================================

/**
 * Check if element exists and is visible
 */
export function isElementReady(elementOrId) {
  const element = typeof elementOrId === 'string' ? getElement(elementOrId) : elementOrId;
  return element && !hasClass(element, CSS_CLASSES.HIDDEN);
}

/**
 * Wait for element to be ready
 */
export function waitForElement(elementId, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function check() {
      const element = getElement(elementId);
      if (element) {
        resolve(element);
      } else if (Date.now() - startTime > timeout) {
        reject(new Error(`Element ${elementId} not found within ${timeout}ms`));
      } else {
        setTimeout(check, 100);
      }
    }
    
    check();
  });
}

// ========================================
// PERFORMANCE UTILITIES
// ========================================

/**
 * Batch DOM updates to minimize reflows
 */
export function batchUpdate(updateFunction) {
  requestAnimationFrame(() => {
    updateFunction();
  });
}

/**
 * Create document fragment for efficient DOM manipulation
 */
export function createFragment() {
  return document.createDocumentFragment();
}

/**
 * Append multiple elements to parent efficiently
 */
export function appendElements(parent, elements) {
  const fragment = createFragment();
  elements.forEach(element => fragment.appendChild(element));
  parent.appendChild(fragment);
}