// Centralized Configuration - DRY Refactoring
// All configuration objects and settings in one place

import { 
  DEFAULT_MODEL, 
  DEFAULT_TEMPERATURE, 
  DEFAULT_TOP_P, 
  SYSTEM_PROMPTS, 
  SCENARIO_PROMPTS,
  WEBLLM_CDN_URL,
  MOCK_RESPONSES
} from './constants.js';

// ========================================
// WEBLLM CONFIGURATION
// ========================================

export const WEBLLM_CONFIG = {
  model: DEFAULT_MODEL,
  cdnUrl: WEBLLM_CDN_URL,
  defaultOptions: {
    temperature: DEFAULT_TEMPERATURE,
    top_p: DEFAULT_TOP_P,
    stream: true,
    logprobs: true,
    top_logprobs: 1
  },
  initProgressCallback: null, // Set dynamically
  timeout: 300000 // 5 minutes
};

// ========================================
// TOOL DEFINITIONS
// ========================================

export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'sql_query',
      description: 'Query database for specific information',
      parameters: {
        type: 'object',
        properties: {
          table: { type: 'string', description: 'Database table name' },
          column: { type: 'string', description: 'Column to query' },
          query: { type: 'string', description: 'SQL query string' }
        },
        required: ['table', 'column']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'web_search',
      description: 'Search the web for information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_data',
      description: 'Analyze dataset for trends and insights',
      parameters: {
        type: 'object',
        properties: {
          dataset: { type: 'string', description: 'Dataset name to analyze' },
          metric: { type: 'string', description: 'Specific metric to analyze' }
        },
        required: ['dataset']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'solve_equation',
      description: 'Solve mathematical equations',
      parameters: {
        type: 'object',
        properties: {
          equation: { type: 'string', description: 'Mathematical equation to solve' }
        },
        required: ['equation']
      }
    }
  }
];

// ========================================
// SCENARIO CONFIGURATIONS
// ========================================

export const SCENARIO_CONFIG = {
  creative_writer: {
    name: '✍️ Creative Writer',
    prompt: SCENARIO_PROMPTS.creative_writer,
    systemPrompt: SYSTEM_PROMPTS.creative_writer,
    mockResponse: MOCK_RESPONSES.creative_writer,
    maxTokens: null,
    temperature: 0.8,
    topP: 0.9
  },
  riddle_solver: {
    name: '🧩 Riddle Solver',
    prompt: SCENARIO_PROMPTS.riddle_solver,
    systemPrompt: SYSTEM_PROMPTS.riddle_solver,
    mockResponse: MOCK_RESPONSES.riddle_solver,
    maxTokens: 200,
    temperature: 0.3,
    topP: 0.7
  },
  would_you_rather: {
    name: '🤔 Would You Rather',
    prompt: SCENARIO_PROMPTS.would_you_rather,
    systemPrompt: SYSTEM_PROMPTS.would_you_rather,
    mockResponse: MOCK_RESPONSES.would_you_rather,
    maxTokens: 300,
    temperature: 0.7,
    topP: 0.8
  },
  quick_brainstorm: {
    name: '💡 Quick Brainstorm',
    prompt: SCENARIO_PROMPTS.quick_brainstorm,
    systemPrompt: SYSTEM_PROMPTS.quick_brainstorm,
    mockResponse: MOCK_RESPONSES.quick_brainstorm,
    maxTokens: 250,
    temperature: 0.9,
    topP: 0.95
  },
  story_continues: {
    name: '📖 Story Continues',
    prompt: SCENARIO_PROMPTS.story_continues,
    systemPrompt: SYSTEM_PROMPTS.story_continues,
    mockResponse: MOCK_RESPONSES.story_continues,
    maxTokens: 400,
    temperature: 0.8,
    topP: 0.9
  }
};

// ========================================
// AGENT CONFIGURATIONS
// ========================================

export const AGENT_CONFIG = {
  multi_pass: {
    name: 'Multi-Pass Agent',
    systemPrompt: SYSTEM_PROMPTS.multi_pass,
    maxAttempts: 3,
    tools: TOOL_DEFINITIONS,
    separateToolCalls: true
  },
  single_pass: {
    name: 'Single-Pass Agent',
    systemPrompt: SYSTEM_PROMPTS.single_pass,
    maxAttempts: 2,
    tools: TOOL_DEFINITIONS,
    conversational: true
  }
};

// ========================================
// MOCK DATA CONFIGURATIONS
// ========================================

export const MOCK_DATABASE = {
  analytics: {
    conversions: 1247,
    users: 8832,
    sessions: 12409,
    revenue: 45230.50,
    bounce_rate: 0.34,
    avg_session_duration: 8.3,
    page_views: 89543
  },
  sales: {
    total_sales: 156890.25,
    orders: 2847,
    refunds: 123,
    avg_order_value: 55.12
  }
};

export const MOCK_SEARCH_RESULTS = {
  'climate change': [
    {
      title: 'IPCC Climate Report 2024',
      snippet: 'Global temperatures rose 1.2°C above pre-industrial levels',
      url: 'https://ipcc.ch/report2024'
    },
    {
      title: 'Arctic Ice Data',
      snippet: 'Sea ice extent decreased by 13% per decade since 1979',
      url: 'https://nsidc.org/arctic'
    },
    {
      title: 'Climate Policy Updates',
      snippet: 'New international agreements target carbon neutrality by 2050',
      url: 'https://unfccc.int/policy'
    }
  ],
  'ai research': [
    {
      title: 'Nature: AI Breakthrough 2024',
      snippet: 'Large language models achieve human-level performance on complex reasoning',
      url: 'https://nature.com/ai2024'
    },
    {
      title: 'AI Safety Progress',
      snippet: 'New alignment techniques show 90% improvement in safety metrics',
      url: 'https://aisafety.org/progress'
    },
    {
      title: 'Machine Learning Advances',
      snippet: 'Novel architectures reduce computational requirements by 40%',
      url: 'https://arxiv.org/ml-advances'
    }
  ]
};

export const MOCK_ANALYSIS_DATA = {
  users: {
    trend: '+12%',
    peak_time: '2-4 PM',
    active_days: 'weekdays'
  },
  engagement: {
    avg_session: '8.3 min',
    bounce_rate: '34%',
    retention: '67%'
  },
  performance: {
    load_time: '1.2s',
    success_rate: '99.1%',
    errors: '0.9%'
  }
};

// ========================================
// RESPONSE VARIANTS FOR SEMANTIC ENTROPY
// ========================================

export const RESPONSE_VARIANTS = {
  creative_writer: [
    {
      text: "ARIA-7 stared at the blank canvas, servos whirring with uncertainty...",
      count: 3
    },
    {
      text: "The old painting robot had never seen colors quite like these before...",
      count: 2
    }
  ],
  riddle_solver: [
    {
      text: "A towel! It absorbs water and gets wetter as it dries other things.",
      count: 4
    },
    {
      text: "The answer is a towel - it gets wetter while drying something else.",
      count: 1
    }
  ],
  would_you_rather: [
    {
      text: "Flying offers freedom and exploration, while invisibility provides privacy and stealth...",
      count: 2
    },
    {
      text: "I'd choose flying - the joy of soaring above the world seems incredible!",
      count: 2
    },
    {
      text: "Invisibility appeals more - imagine the adventures and observations possible!",
      count: 1
    }
  ],
  quick_brainstorm: [
    {
      text: "1. Lock pick 2. Zipper pull 3. Phone stand 4. Bookmark 5. Cable organizer",
      count: 3
    },
    {
      text: "Jewelry making, emergency electronics repair, art projects, office tools, cleaning aid",
      count: 2
    }
  ],
  story_continues: [
    {
      text: "...the lighthouse keeper spotted a mysterious ship approaching the rocky shore.",
      count: 3
    },
    {
      text: "...Emma realized the old mansion held secrets far stranger than she'd imagined.",
      count: 2
    }
  ]
};

// ========================================
// API CONFIGURATIONS
// ========================================

export const API_CONFIG = {
  endpoints: {
    config: '/api/config',
    execute_tool: '/execute_tool',
    chat: '/v1/chat/completions'
  },
  timeouts: {
    config: 5000,
    tool: 30000,
    chat: 120000
  },
  retries: {
    max: 3,
    delay: 1000
  }
};

// ========================================
// VALIDATION CONFIGURATIONS
// ========================================

export const VALIDATION_CONFIG = {
  prompt: {
    minLength: 1,
    maxLength: 2000,
    required: true
  },
  temperature: {
    min: 0.1,
    max: 2.0,
    step: 0.1,
    default: 0.7
  },
  topP: {
    min: 0.1,
    max: 1.0,
    step: 0.05,
    default: 0.9
  }
};

// ========================================
// CONFIGURATION UTILITIES
// ========================================

/**
 * Get scenario configuration
 */
export function getScenarioConfig(scenario) {
  return SCENARIO_CONFIG[scenario] || SCENARIO_CONFIG.creative_writer;
}

/**
 * Get agent configuration
 */
export function getAgentConfig(agentType) {
  return AGENT_CONFIG[agentType] || AGENT_CONFIG.single_pass;
}

/**
 * Build WebLLM message array
 */
export function buildMessages(prompt, scenario) {
  const config = getScenarioConfig(scenario);
  return [
    {
      role: 'system',
      content: config.systemPrompt
    },
    {
      role: 'user',
      content: prompt
    }
  ];
}

/**
 * Build WebLLM options with scenario defaults
 */
export function buildWebLLMOptions(scenario, overrides = {}) {
  const config = getScenarioConfig(scenario);
  return {
    ...WEBLLM_CONFIG.defaultOptions,
    temperature: config.temperature,
    top_p: config.topP,
    max_tokens: config.maxTokens,
    ...overrides
  };
}

/**
 * Get tool definitions for agent type
 */
export function getToolDefinitions(agentType = 'single_pass') {
  const config = getAgentConfig(agentType);
  return config.tools;
}

/**
 * Validate input parameters
 */
export function validateInput(prompt, temperature, topP) {
  const errors = [];
  
  // Validate prompt
  if (!prompt || prompt.length < VALIDATION_CONFIG.prompt.minLength) {
    errors.push('Prompt is required');
  } else if (prompt.length > VALIDATION_CONFIG.prompt.maxLength) {
    errors.push(`Prompt must be less than ${VALIDATION_CONFIG.prompt.maxLength} characters`);
  }
  
  // Validate temperature
  if (temperature < VALIDATION_CONFIG.temperature.min || temperature > VALIDATION_CONFIG.temperature.max) {
    errors.push(`Temperature must be between ${VALIDATION_CONFIG.temperature.min} and ${VALIDATION_CONFIG.temperature.max}`);
  }
  
  // Validate top-p
  if (topP < VALIDATION_CONFIG.topP.min || topP > VALIDATION_CONFIG.topP.max) {
    errors.push(`Top-p must be between ${VALIDATION_CONFIG.topP.min} and ${VALIDATION_CONFIG.topP.max}`);
  }
  
  return errors;
}

/**
 * Get mock response for scenario
 */
export function getMockResponse(scenario) {
  const config = getScenarioConfig(scenario);
  return config.mockResponse;
}

/**
 * Get response variants for semantic entropy calculation
 */
export function getResponseVariants(scenario) {
  return RESPONSE_VARIANTS[scenario] || RESPONSE_VARIANTS.creative_writer;
}