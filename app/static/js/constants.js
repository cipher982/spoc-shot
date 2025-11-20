// Centralized Constants - DRY Refactoring
// All magic numbers, strings, and configuration values go here

// ========================================
// UI CONSTANTS
// ========================================

// Sparkline visualization
export const SPARKLINE_CHARS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
export const SPARKLINE_PLACEHOLDER = '░░░░░░'; // 6 characters
export const CONFIDENCE_BAR_LENGTH = 30; // ASCII confidence bar length
export const BUFFER_SIZE = 12; // Sparkline data points

// Token streaming/batching
export const BATCH_SIZE = 5; // Process tokens in batches of 5
export const BATCH_DELAY = 16; // ~60fps batching (milliseconds)

// UI update thresholds
export const UPDATE_THRESHOLD = 3; // Update UI every N tokens

// ========================================
// MODEL CONSTANTS
// ========================================

// WebLLM Model Configuration
export const DEFAULT_MODEL = "Hermes-3-Llama-3.1-8B-q4f16_1-MLC";
export const WEBLLM_CDN_URL = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@latest/+esm";

// Model Parameters
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_TOP_P = 0.9;
export const DEFAULT_MAX_TOKENS = null; // Use model default

// Logprob processing
export const MIN_LOGPROB_CLAMP = -10; // Clamp very low logprobs to prevent underflow
export const MAX_PERPLEXITY_DISPLAY = 1000; // Cap perplexity for display

// ========================================
// CONFIDENCE THRESHOLDS
// ========================================

// Token confidence classification
export const CONFIDENCE_THRESHOLDS = {
  VERY_HIGH: 0.9,
  HIGH: 0.7,
  GOOD: 0.5,
  MEDIUM: 0.3,
  LOW: 0.1,
  VERY_LOW: 0.0
};

// Confidence CSS classes mapping
export const CONFIDENCE_CLASSES = {
  VERY_HIGH: 'token-confidence-very-high',
  HIGH: 'token-confidence-high',
  GOOD: 'token-confidence-good',
  MEDIUM: 'token-confidence-medium',
  LOW: 'token-confidence-low',
  VERY_LOW: 'token-confidence-very-low',
  PUNCTUATION: 'token-punctuation'
};

// ========================================
// SCENARIO CONFIGURATIONS
// ========================================

// Scenario prompts
export const SCENARIO_PROMPTS = {
  creative_writer: "Write a short story about a robot learning to paint",
  riddle_solver: "What gets wetter the more it dries?",
  would_you_rather: "Would you rather have the ability to fly or be invisible?",
  quick_brainstorm: "Give me 5 creative uses for a paperclip",
  story_continues: "It was a dark and stormy night when suddenly..."
};

// System prompts for different modes
export const SYSTEM_PROMPTS = {
  creative_writer: "You are a creative writing assistant. Help users craft engaging stories, characters, and creative content.",
  riddle_solver: "You are a riddle master. Solve riddles with clear logic and explain your reasoning.",
  would_you_rather: "You are a thoughtful conversation partner. Help explore interesting hypothetical choices and their implications.",
  quick_brainstorm: "You are a creative brainstorming assistant. Generate innovative and practical ideas for various problems.",
  story_continues: "You are a storytelling assistant. Continue stories in engaging and creative ways.",
  multi_pass: "You are a helpful assistant that uses tools to answer questions. When you encounter an error, you'll need to make a separate tool call to fix it. Be concise and direct.",
  single_pass: "You are a helpful assistant with self-correction capabilities. When tools fail, analyze the error and try again with corrected parameters in the same conversation. Be adaptive and learn from failures."
};

// ========================================
// DOM ELEMENT IDS
// ========================================

// Common element IDs (centralized to prevent typos)
export const ELEMENT_IDS = {
  // Main controls
  RUN_BUTTON: 'run-button',
  STOP_BUTTON: 'stop-button',
  PROMPT_INPUT: 'prompt-input',
  SCENARIO_SELECT: 'scenario-select',
  
  // Parameter controls
  TEMP_SLIDER: 'temp-slider',
  TEMP_DISPLAY: 'temp-display',
  TOP_P_SLIDER: 'top-p-slider',
  TOP_P_DISPLAY: 'top-p-display',
  
  // Model loading
  MODEL_LOADING_PANEL: 'model-loading-panel',
  MODEL_STATUS: 'model-status',
  MODEL_PROGRESS_TEXT: 'model-progress-text',
  MODEL_PROGRESS_BAR: 'model-progress-bar',
  
  // Uncertainty analysis
  UNCERTAINTY_STATUS: 'uncertainty-status',
  HEATMAP_TEXT: 'heatmap-text',
  CONFIDENCE_BAR: 'confidence-bar',
  
  // Metrics
  CONFIDENCE_VALUE: 'confidence-value',
  ENTROPY_VALUE: 'entropy-value',
  LOGPROB_VALUE: 'logprob-value',
  PERPLEXITY_VALUE: 'perplexity-value',
  SELF_SCORE_VALUE: 'self-score-value',
  VARIANCE_VALUE: 'variance-value',
  TOP_P_VALUE: 'top-p-value',
  CALIBRATION_VALUE: 'calibration-value',
  COHERENCE_VALUE: 'coherence-value',
  
  // Variant analysis
  VARIANT_SECTION: 'variant-section',
  VARIANT_LIST: 'variant-list',
  SEMANTIC_ENTROPY: 'semantic-entropy',
  TOGGLE_VARIANTS: 'toggle-variants'
};

// ========================================
// STATUS MESSAGES
// ========================================

export const STATUS_MESSAGES = {
  IDLE: 'Idle',
  WAITING: 'Waiting for WebLLM',
  ANALYZING: 'Analyzing...',
  COMPLETE: 'Complete',
  ERROR: 'Error',
  CANCELLED: 'Cancelled',
  LOADING: 'Loading...'
};

// ========================================
// TIMING CONSTANTS
// ========================================

export const TIMING = {
  DEMO_DELAY_SHORT: 300,
  DEMO_DELAY_MEDIUM: 500,
  DEMO_DELAY_LONG: 1000,
  DEMO_DELAY_VERY_LONG: 1500,
  MODEL_LOADING_HIDE_DELAY: 1000,
  DEBOUNCE_DELAY: 1000
};

// ========================================
// ANIMATION/TRANSITION CONSTANTS
// ========================================

export const ANIMATION = {
  PROGRESS_TRANSITION: 'width 0.3s ease',
  FADE_DURATION: '0.2s',
  SLIDE_DURATION: '0.3s'
};

// ========================================
// MOCK DATA FOR DEMOS
// ========================================

export const MOCK_RESPONSES = {
  creative_writer: "ARIA-7 stared at the blank canvas, servos whirring with uncertainty. For the first time in her operational cycle, she felt something beyond calculation—an urge to create something beautiful.",
  riddle_solver: "A towel! The answer is a towel. It gets wetter as it performs its function of drying other things. The more it dries, the more water it absorbs, making it progressively wetter.",
  would_you_rather: "I'd choose the ability to fly. While invisibility offers stealth and privacy, flight provides freedom, new perspectives, and the pure joy of soaring above the world's limitations.",
  quick_brainstorm: "Here are 5 creative paperclip uses: 1) Smartphone stand (bend into triangle), 2) Zipper pull replacement, 3) Bookmark with decorative twist, 4) Cable organizer for desk setup, 5) Emergency lock pick for simple locks.",
  story_continues: "It was a dark and stormy night when suddenly the lighthouse keeper spotted a mysterious ship approaching the rocky shore. Its black sails caught no wind, yet it moved with purpose through the churning waters."
};

// ========================================
// VALIDATION PATTERNS
// ========================================

export const VALIDATION = {
  PUNCTUATION_REGEX: /^[.,!?;:\-—'"()[\]{}]+$/,
  WHITESPACE_REGEX: /(\s+)/,
  MIN_PROMPT_LENGTH: 1,
  MAX_PROMPT_LENGTH: 2000
};

// ========================================
// CALCULATION CONSTANTS
// ========================================

export const MATH = {
  TOKEN_ESTIMATE_RATIO: 4, // ~4 characters per token
  COST_PER_TOKEN: 0.00003, // Example cost
  PERCENTAGE_MULTIPLIER: 100,
  MAX_CONFIDENCE_DISPLAY: 1.0,
  MIN_CONFIDENCE_DISPLAY: 0.0
};

// ========================================
// CSS CLASSES (commonly used)
// ========================================

export const CSS_CLASSES = {
  HIDDEN: 'hidden',
  LOADING: 'loading',
  ERROR: 'error',
  SUCCESS: 'success',
  DEMO_OPACITY: 'demo-opacity',
  METRICS_LOADING: 'metrics-loading',
  ACTIVE: 'active'
};

// ========================================
// HTTP STATUS CODES
// ========================================

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500
};