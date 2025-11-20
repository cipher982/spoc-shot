// Centralized Confidence and Metrics Utilities - DRY Refactoring
// Eliminates duplicated confidence calculations and token processing

import { 
  CONFIDENCE_THRESHOLDS, 
  CONFIDENCE_CLASSES, 
  MIN_LOGPROB_CLAMP, 
  MAX_PERPLEXITY_DISPLAY,
  VALIDATION,
  MATH
} from './constants.js';

// ========================================
// CORE CONFIDENCE CALCULATIONS
// ========================================

/**
 * Convert logprob to confidence with clamping
 */
export function logprobToConfidence(logprob) {
  if (typeof logprob !== 'number' || !isFinite(logprob)) {
    return 0.5; // Default middle confidence for invalid values
  }
  
  const clampedLogprob = Math.max(logprob, MIN_LOGPROB_CLAMP);
  return Math.exp(clampedLogprob);
}

/**
 * Convert confidence to CSS class name
 */
export function confidenceToClass(confidence, isPunctuation = false) {
  if (isPunctuation) {
    return CONFIDENCE_CLASSES.PUNCTUATION;
  }
  
  if (confidence >= CONFIDENCE_THRESHOLDS.VERY_HIGH) {
    return CONFIDENCE_CLASSES.VERY_HIGH;
  } else if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    return CONFIDENCE_CLASSES.HIGH;
  } else if (confidence >= CONFIDENCE_THRESHOLDS.GOOD) {
    return CONFIDENCE_CLASSES.GOOD;
  } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return CONFIDENCE_CLASSES.MEDIUM;
  } else if (confidence >= CONFIDENCE_THRESHOLDS.LOW) {
    return CONFIDENCE_CLASSES.LOW;
  } else {
    return CONFIDENCE_CLASSES.VERY_LOW;
  }
}

/**
 * Check if token is punctuation
 */
export function isPunctuation(token) {
  return VALIDATION.PUNCTUATION_REGEX.test(token.trim());
}

/**
 * Process token with logprobs to get confidence and class
 */
export function processToken(token, logprobs) {
  let confidence = 0.5; // Default
  let logprob = Math.log(confidence);
  
  // Extract logprob from various possible structures
  if (logprobs) {
    if (logprobs.content && logprobs.content.length > 0) {
      logprob = logprobs.content[0].logprob;
    } else if (typeof logprobs === 'number') {
      logprob = logprobs;
    }
  }
  
  confidence = logprobToConfidence(logprob);
  const isTokenPunctuation = isPunctuation(token);
  const cssClass = confidenceToClass(confidence, isTokenPunctuation);
  
  return {
    token,
    confidence,
    logprob,
    cssClass,
    isPunctuation: isTokenPunctuation,
    confidencePercent: confidence * MATH.PERCENTAGE_MULTIPLIER
  };
}

// ========================================
// TOKEN ELEMENT CREATION
// ========================================

/**
 * Create a DOM element for a token with confidence styling
 * @param {string} token - The token text
 * @param {object} logprobs - The logprobs object
 * @param {number|boolean} indexOrOption - Index in sequence (for interactivity) or boolean for legacy tooltip
 */
export function createTokenElement(token, logprobs, indexOrOption = null) {
  const processed = processToken(token, logprobs);
  
  const span = document.createElement('span');
  span.textContent = processed.token;
  span.className = `token ${processed.cssClass}`;
  
  // Handle index for branching interactivity
  if (typeof indexOrOption === 'number') {
    span.dataset.index = indexOrOption;
  }
  
  // Extract and store candidates if available
  if (logprobs && logprobs.content && logprobs.content[0] && logprobs.content[0].top_logprobs) {
    const candidates = logprobs.content[0].top_logprobs.map(c => ({
      token: c.token,
      logprob: c.logprob,
      confidence: Math.exp(Math.max(c.logprob, MIN_LOGPROB_CLAMP)) * 100
    }));
    span.dataset.candidates = JSON.stringify(candidates);
    span.classList.add('cursor-pointer'); // Indicate interactivity
  }
  
  // Basic tooltip (title) - preserved for simple hovering
  // If indexOrOption is explicitly false, suppress it (legacy behavior support)
  if (indexOrOption !== false) {
    span.title = `${processed.confidencePercent.toFixed(1)}% confidence`;
  }
  
  return span;
}

/**
 * Create multiple token elements efficiently
 */
export function createTokenElements(tokens, logprobsArray) {
  const fragment = document.createDocumentFragment();
  
  tokens.forEach((token, index) => {
    const logprobs = logprobsArray && logprobsArray[index] ? logprobsArray[index] : null;
    const element = createTokenElement(token, logprobs, index); // Pass index!
    fragment.appendChild(element);
  });
  
  return fragment;
}

// ========================================
// METRICS CALCULATIONS
// ========================================

/**
 * Calculate comprehensive metrics from logprobs array
 */
export function calculateMetrics(logprobsArray, tokens = []) {
  if (!logprobsArray || logprobsArray.length === 0) {
    return getDefaultMetrics();
  }
  
  // Extract valid logprob values
  const validLogprobs = logprobsArray
    .filter(lp => lp && lp.content && lp.content.length > 0)
    .map(lp => lp.content[0].logprob)
    .filter(val => typeof val === 'number' && isFinite(val));
  
  if (validLogprobs.length === 0) {
    return getDefaultMetrics();
  }
  
  // Basic statistics
  const avgLogprob = validLogprobs.reduce((sum, val) => sum + val, 0) / validLogprobs.length;
  const minLogprob = Math.min(...validLogprobs);
  const maxLogprob = Math.max(...validLogprobs);
  
  // Convert to confidence values
  const confidences = validLogprobs.map(lp => logprobToConfidence(lp));
  const avgConfidence = confidences.reduce((sum, val) => sum + val, 0) / confidences.length;
  
  // Advanced metrics
  const perplexity = Math.min(Math.exp(-avgLogprob), MAX_PERPLEXITY_DISPLAY);
  const entropy = -avgLogprob; // Simplified entropy approximation
  
  // Variance calculation
  const variance = confidences.length > 1 ? 
    confidences.reduce((sum, val) => sum + Math.pow(val - avgConfidence, 2), 0) / confidences.length : 0;
  
  // Self-score (consistency measure)
  const selfScore = calculateSelfScore(validLogprobs);
  
  // Estimate effective top-p
  const topP = estimateTopP(validLogprobs);
  
  // Calibration score
  const calibration = calculateCalibration(confidences);
  
  // Coherence score
  const coherence = calculateCoherence(confidences);
  
  return {
    confidence: Math.min(avgConfidence, MATH.MAX_CONFIDENCE_DISPLAY),
    entropy: entropy,
    logprob: avgLogprob,
    minLogprob: minLogprob,
    maxLogprob: maxLogprob,
    perplexity: perplexity,
    selfScore: selfScore,
    variance: variance,
    topP: topP,
    calibration: calibration,
    coherence: coherence,
    tokenCount: tokens.length,
    validTokens: validLogprobs.length,
    confidenceDistribution: calculateConfidenceDistribution(confidences)
  };
}

/**
 * Get default metrics for error cases
 */
export function getDefaultMetrics() {
  return {
    confidence: 0,
    entropy: 0,
    logprob: 0,
    minLogprob: 0,
    maxLogprob: 0,
    perplexity: 1,
    selfScore: 0,
    variance: 0,
    topP: 0.9,
    calibration: 0,
    coherence: 0,
    tokenCount: 0,
    validTokens: 0,
    confidenceDistribution: [0, 0, 0, 0, 0]
  };
}

/**
 * Calculate self-score (consistency measure)
 */
function calculateSelfScore(logprobs) {
  if (logprobs.length === 0) return 0;
  
  const mean = logprobs.reduce((sum, val) => sum + val, 0) / logprobs.length;
  const consistent = logprobs.filter(val => Math.abs(val - mean) < 1.0).length;
  return Math.min(consistent / logprobs.length, 1.0);
}

/**
 * Estimate effective top-p from logprob distribution
 */
function estimateTopP(logprobs) {
  if (logprobs.length === 0) return 0.9;
  
  const mean = logprobs.reduce((sum, val) => sum + val, 0) / logprobs.length;
  const variance = logprobs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / logprobs.length;
  
  return Math.min(0.5 + variance * 0.1, 1.0);
}

/**
 * Calculate calibration score
 */
function calculateCalibration(confidences) {
  if (confidences.length === 0) return 0;
  
  const avgConfidence = confidences.reduce((sum, val) => sum + val, 0) / confidences.length;
  const variance = confidences.reduce((sum, val) => sum + Math.pow(val - avgConfidence, 2), 0) / confidences.length;
  
  return Math.max(0, 1 - variance * 2);
}

/**
 * Calculate coherence score (consistency of confidence)
 */
function calculateCoherence(confidences) {
  if (confidences.length < 2) return 1.0;
  
  let coherenceScore = 0;
  for (let i = 1; i < confidences.length; i++) {
    const diff = Math.abs(confidences[i] - confidences[i-1]);
    coherenceScore += Math.exp(-diff * 5); // Penalize large confidence jumps
  }
  
  return coherenceScore / (confidences.length - 1);
}

/**
 * Calculate confidence distribution for visualization
 */
function calculateConfidenceDistribution(confidences) {
  const bins = [0, 0, 0, 0, 0]; // 5 bins: 0-20%, 20-40%, 40-60%, 60-80%, 80-100%
  
  confidences.forEach(conf => {
    const bin = Math.min(Math.floor(conf * 5), 4);
    bins[bin]++;
  });
  
  return bins;
}

// ========================================
// FORMATTING UTILITIES
// ========================================

/**
 * Format metrics for display with consistent precision
 */
export function formatMetrics(metrics) {
  return {
    confidence: `${(metrics.confidence * MATH.PERCENTAGE_MULTIPLIER).toFixed(1)}%`,
    entropy: metrics.entropy.toFixed(2),
    logprob: metrics.logprob.toFixed(2),
    perplexity: metrics.perplexity.toFixed(2),
    selfScore: metrics.selfScore.toFixed(2),
    variance: metrics.variance.toFixed(3),
    topP: metrics.topP.toFixed(2),
    calibration: metrics.calibration.toFixed(2),
    coherence: metrics.coherence.toFixed(2)
  };
}

/**
 * Create ASCII confidence bar
 */
export function createConfidenceBar(confidence, length = 30) {
  const filledBars = Math.round(confidence * length);
  const emptyBars = length - filledBars;
  return '█'.repeat(filledBars) + '░'.repeat(emptyBars);
}

// ========================================
// VALIDATION UTILITIES
// ========================================

/**
 * Validate logprobs structure
 */
export function validateLogprobs(logprobs) {
  if (!logprobs) return false;
  if (Array.isArray(logprobs)) {
    return logprobs.every(lp => lp && lp.content && Array.isArray(lp.content));
  }
  return logprobs.content && Array.isArray(logprobs.content);
}

/**
 * Sanitize metrics for safe display
 */
export function sanitizeMetrics(metrics) {
  const sanitized = { ...metrics };
  
  // Ensure all numeric values are finite
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'number') {
      if (!isFinite(sanitized[key])) {
        sanitized[key] = 0;
      }
    }
  });
  
  // Clamp confidence to valid range
  sanitized.confidence = Math.max(0, Math.min(1, sanitized.confidence));
  
  // Clamp perplexity
  sanitized.perplexity = Math.min(sanitized.perplexity, MAX_PERPLEXITY_DISPLAY);
  
  return sanitized;
}
