// Model Catalog Module
// Fetches and organizes WebLLM's available models for the selector UI

// Cache for the loaded catalog
let catalogCache = null;
let catalogPromise = null;

// Known reasoning models that output <think> tags
const REASONING_MODEL_PATTERNS = [
  /^DeepSeek-R1-Distill/i,
];

// Models with optional thinking mode (user can enable)
const OPTIONAL_THINKING_PATTERNS = [
  /^Qwen3-/i,
];

// Quantizations known to have issues in WebLLM 0.2.79
// q4f32 has binding errors, q0f16/q0f32 can be unstable
const PROBLEMATIC_QUANTIZATIONS = [
  /q4f32/i,
  /q0f16/i,
  /q0f32/i,
];

// Model family detection patterns
const MODEL_FAMILIES = {
  'Llama': /^(Llama|Hermes|TinyLlama)/i,
  'Qwen': /^Qwen/i,
  'DeepSeek': /^DeepSeek/i,
  'Phi': /^Phi/i,
  'Gemma': /^gemma/i,
  'Mistral': /^(Mistral|OpenHermes|NeuralHermes|WizardMath)/i,
  'SmolLM': /^SmolLM/i,
  'StableLM': /^stablelm/i,
  'RedPajama': /^RedPajama/i,
  'Other': /.*/,
};

// Size tier thresholds (in MB)
const SIZE_TIERS = {
  'Tiny': { max: 1000, label: '< 1 GB', icon: '🪶' },
  'Small': { min: 1000, max: 3000, label: '1-3 GB', icon: '📖' },
  'Medium': { min: 3000, max: 6000, label: '3-6 GB', icon: '📚' },
  'Large': { min: 6000, label: '6+ GB', icon: '📜' },
};

/**
 * Lazily fetch and parse the WebLLM model catalog
 * @returns {Promise<Object>} The parsed catalog
 */
export async function getModelCatalog() {
  // Return cached if available
  if (catalogCache) {
    return catalogCache;
  }

  // Return existing promise if fetch is in progress
  if (catalogPromise) {
    return catalogPromise;
  }

  // Start fetching
  catalogPromise = fetchAndParseCatalog();
  catalogCache = await catalogPromise;
  catalogPromise = null;
  
  return catalogCache;
}

/**
 * Fetch the catalog from WebLLM
 */
async function fetchAndParseCatalog() {
  try {
    // Dynamically import WebLLM to get the prebuilt config
    const { prebuiltAppConfig } = await import(
      'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm'
    );

    const models = prebuiltAppConfig.model_list;
    
    // Parse and enrich model data
    const enrichedModels = models
      .filter(m => m.model_type !== 1) // Filter out embedding models (ModelType.embedding = 1)
      .map(model => enrichModel(model));

    // Organize by family
    const families = {};
    for (const model of enrichedModels) {
      if (!families[model.family]) {
        families[model.family] = [];
      }
      families[model.family].push(model);
    }

    // Create lookup map
    const byId = {};
    for (const model of enrichedModels) {
      byId[model.model_id] = model;
    }

    return {
      all: enrichedModels,
      families,
      byId,
      familyNames: Object.keys(families).sort(),
    };
  } catch (error) {
    console.error('[ModelCatalog] Failed to fetch catalog:', error);
    throw error;
  }
}

/**
 * Enrich a model record with derived properties
 */
function enrichModel(model) {
  const family = detectFamily(model.model_id);
  const sizeTier = detectSizeTier(model.vram_required_MB);
  const isReasoning = isReasoningModel(model.model_id);
  const hasOptionalThinking = hasOptionalThinkingMode(model.model_id);
  const isProblematic = hasProblematicQuantization(model.model_id);
  
  // Extract human-readable size from model_id (e.g., "8B", "0.5B")
  const sizeMatch = model.model_id.match(/(\d+\.?\d*)[Bb]/);
  const parameterSize = sizeMatch ? sizeMatch[1] + 'B' : null;
  
  // Extract quantization info (e.g., "q4f16_1", "q4f32_1")
  const quantMatch = model.model_id.match(/(q\d+f\d+(?:_\d+)?)/i);
  const quantization = quantMatch ? quantMatch[1] : null;

  return {
    ...model,
    family,
    sizeTier,
    sizeTierInfo: SIZE_TIERS[sizeTier],
    isReasoning,
    hasOptionalThinking,
    isProblematic,
    parameterSize,
    quantization,
    vramGB: model.vram_required_MB ? (model.vram_required_MB / 1024).toFixed(1) : null,
    displayName: formatDisplayName(model.model_id),
  };
}

/**
 * Detect model family from model_id
 */
function detectFamily(modelId) {
  for (const [family, pattern] of Object.entries(MODEL_FAMILIES)) {
    if (pattern.test(modelId)) {
      return family;
    }
  }
  return 'Other';
}

/**
 * Detect size tier from VRAM requirement
 */
function detectSizeTier(vramMB) {
  if (!vramMB) return 'Small';
  
  if (vramMB < SIZE_TIERS.Tiny.max) return 'Tiny';
  if (vramMB < SIZE_TIERS.Small.max) return 'Small';
  if (vramMB < SIZE_TIERS.Medium.max) return 'Medium';
  return 'Large';
}

/**
 * Check if model is a known reasoning model
 */
export function isReasoningModel(modelId) {
  return REASONING_MODEL_PATTERNS.some(pattern => pattern.test(modelId));
}

/**
 * Check if model has optional thinking mode
 */
export function hasOptionalThinkingMode(modelId) {
  return OPTIONAL_THINKING_PATTERNS.some(pattern => pattern.test(modelId));
}

/**
 * Check if model has a problematic quantization
 */
export function hasProblematicQuantization(modelId) {
  return PROBLEMATIC_QUANTIZATIONS.some(pattern => pattern.test(modelId));
}

/**
 * Format model_id into a display-friendly name
 */
function formatDisplayName(modelId) {
  // Remove -MLC suffix and quantization for cleaner display
  return modelId
    .replace(/-MLC(-\d+k)?$/, '')
    .replace(/-q\d+f\d+(?:_\d+)?/i, '')
    .replace(/-Instruct/i, '')
    .replace(/-it$/i, '');
}

/**
 * Search models by query string
 */
export function searchModels(catalog, query) {
  if (!query || !query.trim()) {
    return catalog.all;
  }
  
  const lowerQuery = query.toLowerCase();
  
  return catalog.all.filter(model => {
    return (
      model.model_id.toLowerCase().includes(lowerQuery) ||
      model.displayName.toLowerCase().includes(lowerQuery) ||
      model.family.toLowerCase().includes(lowerQuery)
    );
  });
}

/**
 * Filter models by criteria
 */
export function filterModels(catalog, { family = null, sizeTier = null, lowResourceOnly = false } = {}) {
  let results = catalog.all;
  
  if (family && family !== 'All') {
    results = results.filter(m => m.family === family);
  }
  
  if (sizeTier && sizeTier !== 'All') {
    results = results.filter(m => m.sizeTier === sizeTier);
  }
  
  if (lowResourceOnly) {
    results = results.filter(m => m.low_resource_required);
  }
  
  return results;
}

/**
 * Get recent models from localStorage
 */
export function getRecentModels(limit = 5) {
  try {
    const stored = localStorage.getItem('storyteller_recent_models');
    if (!stored) return [];
    
    const recent = JSON.parse(stored);
    return recent.slice(0, limit);
  } catch (e) {
    console.warn('[ModelCatalog] Failed to load recent models:', e);
    return [];
  }
}

/**
 * Add a model to recent history
 */
export function addToRecentModels(modelId) {
  try {
    const recent = getRecentModels(10);
    
    // Remove if already exists (will be re-added at front)
    const filtered = recent.filter(id => id !== modelId);
    
    // Add to front
    filtered.unshift(modelId);
    
    // Keep only last 5
    const trimmed = filtered.slice(0, 5);
    
    localStorage.setItem('storyteller_recent_models', JSON.stringify(trimmed));
  } catch (e) {
    console.warn('[ModelCatalog] Failed to save recent model:', e);
  }
}

/**
 * Clear recent models history
 */
export function clearRecentModels() {
  try {
    localStorage.removeItem('storyteller_recent_models');
  } catch (e) {
    console.warn('[ModelCatalog] Failed to clear recent models:', e);
  }
}

// Export constants for UI use
export { MODEL_FAMILIES, SIZE_TIERS };

