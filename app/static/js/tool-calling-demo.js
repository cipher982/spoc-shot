// Tool Calling Demo Module
import { getToolDefinitions } from './config.js';

class ToolCallingDemo {
  constructor() {
    this.isRunning = false;
    this.abortController = null;
    this.conversationHistory = [];
    this.supportedModels = null; // Cache the list when we get it
    
    if (this.initializeElements()) {
      this.attachEventListeners();
      this.showInitialInfo();
    } else {
      console.error('Tool Calling Demo: Failed to initialize - elements not found');
    }
  }

  /**
   * Show initial information about the tool calling implementation
   */
  showInitialInfo() {
    // Clear default placeholder
    const placeholder = this.toolCallsContainer?.querySelector('.tool-demo-placeholder');
    if (placeholder) {
      placeholder.remove();
    }
    
    // Add info message
    const infoDiv = document.createElement('div');
    infoDiv.className = 'tool-demo-info';
    infoDiv.innerHTML = `
      <strong>ℹ️ Tool Calling Implementation</strong><br>
      This demo uses Hermes-3's custom XML-based function calling format.<br>
      The model will call tools when it needs data or calculations.<br>
      <br>
      <em>Note: This implementation works around WebLLM's standard JSON format by using custom prompting.</em>
    `;
    
    if (this.toolCallsContainer) {
      this.toolCallsContainer.appendChild(infoDiv);
    }
  }

  /**
   * Extract list of models that support tool calling from WebLLM error message
   * @param {Error} error - The error from WebLLM
   * @returns {string[]} Array of model names that support tool calling
   */
  extractSupportedModelsFromError(error) {
    if (!error || !error.message) return [];
    
    // Error format: "Currently, models that support function calling are: Model1, Model2, Model3"
    const match = error.message.match(/models that support function calling are:\s*(.+?)(?:\.|$)/i);
    if (match) {
      const models = match[1]
        .split(',')
        .map(m => m.trim())
        .filter(m => m.length > 0);
      
      // Cache it for future use
      this.supportedModels = models;
      return models;
    }
    
    return [];
  }

  /**
   * Get all available models from WebLLM's model list
   * @returns {Promise<string[]>} Array of all available model IDs
   */
  async getAllAvailableModels() {
    try {
      // Try to get prebuiltAppConfig from the already loaded WebLLM
      if (window.webllmEngine && window.webllmEngine.prebuiltAppConfig) {
        return window.webllmEngine.prebuiltAppConfig.model_list.map(m => m.model_id);
      }
      
      // If not available, try to import WebLLM to get the config
      const { prebuiltAppConfig } = await import(
        'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@latest/+esm'
      );
      return prebuiltAppConfig.model_list.map(m => m.model_id);
    } catch (error) {
      console.warn('Could not get available models:', error);
      return [];
    }
  }

  initializeElements() {
    this.promptInput = document.getElementById('tool-demo-prompt');
    this.runButton = document.getElementById('tool-demo-run');
    this.stopButton = document.getElementById('tool-demo-stop');
    this.clearButton = document.getElementById('tool-demo-clear');
    this.status = document.getElementById('tool-demo-status');
    this.log = document.getElementById('tool-demo-log');
    this.toolCallsContainer = document.getElementById('tool-demo-tool-calls');
    
    // Check if all required elements exist
    if (!this.promptInput || !this.runButton || !this.stopButton || !this.clearButton || 
        !this.status || !this.log || !this.toolCallsContainer) {
      console.error('Tool Calling Demo: Missing required DOM elements', {
        promptInput: !!this.promptInput,
        runButton: !!this.runButton,
        stopButton: !!this.stopButton,
        clearButton: !!this.clearButton,
        status: !!this.status,
        log: !!this.log,
        toolCallsContainer: !!this.toolCallsContainer
      });
      return false;
    }
    return true;
  }

  attachEventListeners() {
    if (!this.runButton || !this.stopButton || !this.clearButton) {
      console.error('Tool Calling Demo: Cannot attach event listeners - elements not initialized');
      return;
    }
    
    this.runButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.runDemo();
    });
    this.stopButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.stopDemo();
    });
    this.clearButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.clearDemo();
    });
    
    // Allow Enter+Shift for new line, Enter alone to submit
    this.promptInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !this.isRunning) {
        e.preventDefault();
        this.runDemo();
      }
    });

    // Example prompt buttons
    document.querySelectorAll('.example-prompt').forEach(button => {
      button.addEventListener('click', () => {
        const prompt = button.getAttribute('data-prompt');
        this.promptInput.value = prompt;
        this.promptInput.focus();
      });
    });
  }

  async runDemo() {
    console.log('runDemo called', { isRunning: this.isRunning, hasPromptInput: !!this.promptInput });
    
    if (this.isRunning) {
      console.log('Already running, skipping');
      return;
    }
    
    if (!this.promptInput) {
      console.error('Prompt input not found');
      alert('Error: Prompt input not found. Please refresh the page.');
      return;
    }
    
    const prompt = this.promptInput.value.trim();
    if (!prompt) {
      alert('Please enter a prompt');
      return;
    }

    // Check if WebLLM is ready
    if (!window.webllmEngine || !window.modelLoaded) {
      this.status.textContent = 'WebLLM not ready';
      this.status.style.color = '#cc0000';
      alert('WebLLM is not ready. Please wait for the model to load.');
      return;
    }

    // Check if tools are available
    try {
      if (!getToolDefinitions) {
        throw new Error('getToolDefinitions not available - import may have failed');
      }
      const tools = getToolDefinitions();
      if (!tools || tools.length === 0) {
        throw new Error('No tools available');
      }
    } catch (error) {
      console.error('❌ Tool config error:', error);
      this.status.textContent = 'Tool config error';
      this.status.style.color = '#cc0000';
      alert(`Error loading tools: ${error.message}`);
      return;
    }

    this.isRunning = true;
    this.abortController = new AbortController();
    
    this.runButton.disabled = true;
    this.runButton.textContent = 'Running...';
    this.stopButton.classList.remove('hidden');
    this.status.textContent = 'Running...';
    this.status.style.color = '#0066cc';

    // Add user message to conversation
    this.addMessage('user', prompt);
    
    try {
      await this.executeWithTools(prompt);
    } catch (error) {
      if (error.name === 'AbortError') {
        this.addMessage('system', 'Generation cancelled by user.');
        this.status.textContent = 'Cancelled';
      } else {
        console.error('Tool calling demo error:', error);
        this.addMessage('system', `Error: ${error.message}`);
        this.status.textContent = 'Error';
        this.status.style.color = '#cc0000';
      }
    } finally {
      this.isRunning = false;
      this.runButton.disabled = false;
      this.runButton.textContent = '🚀 Run with Tools';
      this.stopButton.classList.add('hidden');
      if (this.status.textContent === 'Running...') {
        this.status.textContent = 'Complete';
        this.status.style.color = '#006600';
      }
    }
  }

  stopDemo() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  clearDemo() {
    this.conversationHistory = [];
    this.log.innerHTML = '';
    this.toolCallsContainer.innerHTML = '<div class="tool-demo-placeholder">No tool calls yet. Tools will appear here when the LLM decides to use them.</div>';
    this.status.textContent = 'Ready';
    this.status.style.color = '';
  }

  async executeWithTools(prompt) {
    // Hermes-3 uses XML-based function calling format
    const toolDefinitions = getToolDefinitions();
    const toolsXML = toolDefinitions.map(tool => {
      const func = tool.function;
      const params = Object.entries(func.parameters.properties || {})
        .map(([name, prop]) => `  ${name}: ${prop.type} - ${prop.description}`)
        .join('\n');
      return `<tool>
  name: ${func.name}
  description: ${func.description}
  parameters:
${params}
</tool>`;
    }).join('\n\n');

    const systemPrompt = `You are a function-calling AI assistant. You have access to the following tools:

<tools>
${toolsXML}
</tools>

When you need to use a tool, you MUST respond with a tool call in this XML format:
<tool_call>
{"name": "tool_name", "arguments": {"param": "value"}}
</tool_call>

IMPORTANT: 
- Output the tool call in the exact XML format shown above
- The JSON inside must be valid and properly formatted
- Do not add any text before or after the tool_call tags
- After receiving results, provide a helpful answer to the user

You must use tools when the user asks questions that require data, calculations, or information lookup.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...this.conversationHistory.map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: prompt }
    ];

    const maxIterations = 5;
    let iteration = 0;

    try {
      while (iteration < maxIterations) {
      if (this.abortController?.signal.aborted) {
        throw new DOMException('Cancelled', 'AbortError');
      }

      iteration++;
      this.status.textContent = `Thinking... (iteration ${iteration})`;

      // Call WebLLM without tools parameter (using custom XML format in prompt)
      try {
        const response = await window.webllmEngine.chat.completions.create({
          messages: messages,
          temperature: 0.1, // Very low temperature for more deterministic tool calling
          stream: false
        });

        if (!response || !response.choices || response.choices.length === 0) {
          throw new Error('Invalid response from WebLLM');
        }

        const assistantMessage = response.choices[0].message;
        const content = assistantMessage.content || '';

        // Parse XML-based tool calls from Hermes-3 format
        const toolCalls = this.parseHermesToolCalls(content);

        // If no tool calls found, treat as final response
        if (toolCalls.length === 0) {
          if (content.trim()) {
            this.addMessage('assistant', content);
            messages.push({ role: 'assistant', content: content });
          }
          this.status.textContent = 'Complete';
          return;
        }

        // Execute tool calls
        for (const toolCall of toolCalls) {
          const toolName = toolCall.name;
          const toolArgs = toolCall.arguments;

          this.addToolCall(toolName, toolArgs, 'calling');

          try {
            const toolResult = await this.executeTool(toolName, toolArgs);
            
            this.addToolCall(toolName, toolArgs, toolResult.ok ? 'success' : 'error', toolResult);

            // Add tool result to conversation in Hermes format
            const toolResultMessage = `<tool_response>
${JSON.stringify(toolResult, null, 2)}
</tool_response>`;
            
            messages.push({ 
              role: 'user', 
              content: toolResultMessage
            });
            this.conversationHistory.push({ role: 'user', content: toolResultMessage });

          } catch (error) {
            this.addToolCall(toolName, toolArgs, 'error', { ok: false, error: error.message });
            const errorMessage = `<tool_response>
${JSON.stringify({ ok: false, error: error.message }, null, 2)}
</tool_response>`;
            messages.push({
              role: 'user',
              content: errorMessage
            });
          }
        }
      } catch (error) {
        // Re-throw cancellation errors
        if (this.isFatalError(error)) {
          throw error;
        }
        
        // Log and continue for other errors
        console.error('Error in iteration:', error);
        this.addMessage('system', `Error: ${error.message}`);
      }
    }

    this.addMessage('system', 'Reached maximum iterations. Stopping.');
  } catch (error) {
    // Handle unsupported model errors (though less likely with custom XML format)
    if (this.isUnsupportedModelError(error)) {
        // Extract supported models from WebLLM's error message
        const supportedModels = this.extractSupportedModelsFromError(error);
        
        // Also get all available models for context
        const allModels = await this.getAllAvailableModels();
        const hermesModels = allModels.filter(m => m.includes('Hermes'));
        const qwenModels = allModels.filter(m => m.includes('Qwen'));
        
        this.addMessage('system', `❌ ERROR: Tool calling not supported`);
        this.addMessage('system', `The current model doesn't support function calling.`);
        
        if (supportedModels.length > 0) {
          this.addMessage('system', `Supported models (extracted from WebLLM): ${supportedModels.join(', ')}`);
        } else {
          this.addMessage('system', `Could not extract supported models from error.`);
        }
        
        this.status.textContent = 'Tool calling not supported';
        this.status.style.color = '#cc0000';
        
        // Show helpful error notice with extracted models
        const errorDiv = document.createElement('div');
        errorDiv.className = 'tool-demo-error-notice';
        
        let modelsList = '';
        if (supportedModels.length > 0) {
          modelsList = supportedModels.map(m => `• ${m}`).join('<br>');
        } else {
          modelsList = '• (Could not extract from error message)';
        }
        
        let contextInfo = '';
        if (hermesModels.length > 0 || qwenModels.length > 0) {
          contextInfo = `<br><br><strong>Available model families:</strong><br>`;
          if (hermesModels.length > 0) {
            contextInfo += `Hermes models: ${hermesModels.length} available<br>`;
          }
          if (qwenModels.length > 0) {
            contextInfo += `Qwen models: ${qwenModels.length} available<br>`;
          }
        }
        
        errorDiv.innerHTML = `
          <strong>⚠️ Tool Calling Not Supported</strong><br>
          The current model doesn't support function calling.<br>
          <br>
          <strong>Supported models (extracted from WebLLM error):</strong><br>
          ${modelsList}<br>
          ${contextInfo}
          <br>
          <em>Note: Tool calling requires specific models. The main uncertainty analysis will still work with Qwen3-0.6B.</em>
        `;
        this.toolCallsContainer.innerHTML = '';
        this.toolCallsContainer.appendChild(errorDiv);
        
        throw error;
    }
    
    // Re-throw any other unhandled errors
    throw error;
    }
  }

  /**
   * Parse Hermes-3 XML-based tool calls
   * Expected format: <tool_call>{"name": "tool_name", "arguments": {...}}</tool_call>
   */
  parseHermesToolCalls(content) {
    const toolCalls = [];
    
    // Match <tool_call>...</tool_call> tags
    const toolCallRegex = /<tool_call>([\s\S]*?)<\/tool_call>/g;
    let match;
    
    while ((match = toolCallRegex.exec(content)) !== null) {
      const toolCallContent = match[1].trim();
      
      try {
        // Try to parse as JSON
        const parsed = JSON.parse(toolCallContent);
        
        if (parsed.name && parsed.arguments) {
          toolCalls.push({
            name: parsed.name,
            arguments: parsed.arguments
          });
        } else {
          console.warn('Tool call missing name or arguments:', parsed);
        }
      } catch (e) {
        console.warn('Failed to parse tool call JSON:', toolCallContent, e);
        
        // Try to extract function call from plain text like "sql_query(get_conversion_rate)"
        const textMatch = toolCallContent.match(/^(\w+)\(([^)]*)\)/);
        if (textMatch) {
          const funcName = textMatch[1];
          const funcArgs = textMatch[2];
          
          // Try to parse args as a simple parameter
          toolCalls.push({
            name: funcName,
            arguments: { query: funcArgs } // Generic fallback
          });
        }
      }
    }
    
    // Fallback: If no XML tags found, try to detect plain function calls
    if (toolCalls.length === 0) {
      const plainCallRegex = /\b(sql_query|web_search|analyze_data|solve_equation)\s*\(([^)]*)\)/g;
      let plainMatch;
      
      while ((plainMatch = plainCallRegex.exec(content)) !== null) {
        const funcName = plainMatch[1];
        const funcArgs = plainMatch[2].trim();
        
        // Try to intelligently parse the argument based on function type
        let parsedArgs = {};
        if (funcName === 'sql_query') {
          parsedArgs = { table: 'analytics', column: funcArgs.replace(/['"]/g, '') };
        } else if (funcName === 'web_search') {
          parsedArgs = { query: funcArgs.replace(/['"]/g, '') };
        } else if (funcName === 'analyze_data') {
          parsedArgs = { dataset: funcArgs.replace(/['"]/g, '') };
        } else if (funcName === 'solve_equation') {
          parsedArgs = { equation: funcArgs.replace(/['"]/g, '') };
        }
        
        toolCalls.push({
          name: funcName,
          arguments: parsedArgs
        });
      }
    }
    
    return toolCalls;
  }

  /**
   * Check if error is fatal (should not retry)
   */
  isFatalError(error) {
    return error.name === 'AbortError' ||
           error.name === 'DOMException' ||
           error.name === 'UnsupportedModelIdError';
  }

  /**
   * Check if error indicates unsupported model
   */
  isUnsupportedModelError(error) {
    if (!error?.message) return false;
    return error.message.includes('not supported for ChatCompletionRequest.tools') ||
           (error.message.includes('tools') && error.message.includes('not supported'));
  }

  async executeTool(toolName, args) {
    // Simulate realistic delays
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    switch (toolName) {
      case 'sql_query':
        await delay(200);
        const { table = 'analytics', column } = args;
        const mockData = {
          conversions: 1247,
          users: 8832,
          revenue: 45230.50,
          sessions: 12409,
          bounce_rate: 0.34
        };
        if (column && mockData[column.toLowerCase()] !== undefined) {
          return { ok: true, data: mockData[column.toLowerCase()] };
        }
        return { ok: false, error: `Column '${column}' not found. Available: ${Object.keys(mockData).join(', ')}` };

      case 'web_search':
        await delay(300);
        const { query } = args;
        const mockResults = {
          'climate change': {
            results: [
              { title: 'IPCC Climate Report 2024', snippet: 'Global temperatures rose 1.2°C above pre-industrial levels' },
              { title: 'Arctic Ice Data', snippet: 'Sea ice extent decreased by 13% per decade since 1979' }
            ]
          },
          'research': {
            results: [
              { title: 'Latest Research Findings', snippet: 'New studies show promising results in AI safety' }
            ]
          }
        };
        const result = Object.keys(mockResults).find(key => query.toLowerCase().includes(key));
        if (result) {
          return { ok: true, data: mockResults[result] };
        }
        return { ok: false, error: `No results found for: ${query}` };

      case 'analyze_data':
        await delay(250);
        const { dataset } = args;
        const mockAnalysis = {
          users: { trend: '+12%', peak_time: '2-4 PM', active_days: 'weekdays' },
          engagement: { avg_session: '8.3 min', bounce_rate: '34%', retention: '67%' },
          performance: { load_time: '1.2s', success_rate: '99.1%', errors: '0.9%' }
        };
        if (mockAnalysis[dataset]) {
          return { ok: true, data: mockAnalysis[dataset] };
        }
        return { ok: false, error: `Dataset '${dataset}' not available. Try: users, engagement, performance` };

      case 'solve_equation':
        await delay(100);
        const { equation } = args;
        // Simple equation solver
        if (equation.includes('2x + 5 = 15')) {
          return { ok: true, data: 'x = 5', steps: ['2x + 5 = 15', '2x = 10', 'x = 5'] };
        } else if (equation.includes('x + 3 = 7')) {
          return { ok: true, data: 'x = 4', steps: ['x + 3 = 7', 'x = 4'] };
        }
        return { ok: false, error: `Unable to solve: ${equation}. Try: "2x + 5 = 15" or "x + 3 = 7"` };

      default:
        return { ok: false, error: `Unknown tool: ${toolName}` };
    }
  }

  addMessage(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `tool-demo-message ${role}-message`;
    
    const label = document.createElement('span');
    label.className = 'message-label';
    label.textContent = role.toUpperCase() + ':';
    
    const messageContent = document.createElement('span');
    messageContent.className = 'message-content';
    messageContent.textContent = content;
    
    messageDiv.appendChild(label);
    messageDiv.appendChild(messageContent);
    this.log.appendChild(messageDiv);
    this.log.scrollTop = this.log.scrollHeight;

    // Add to conversation history
    this.conversationHistory.push({ role, content });
  }

  addToolCall(toolName, args, status, result = null) {
    // Remove placeholder if it exists
    const placeholder = this.toolCallsContainer.querySelector('.tool-demo-placeholder');
    if (placeholder) {
      placeholder.remove();
    }

    const toolCallDiv = document.createElement('div');
    toolCallDiv.className = `tool-call-item tool-call-${status}`;
    
    const toolHeader = document.createElement('div');
    toolHeader.className = 'tool-call-header';
    
    const toolNameSpan = document.createElement('span');
    toolNameSpan.className = 'tool-name';
    toolNameSpan.textContent = `🔧 ${toolName}`;
    
    const statusSpan = document.createElement('span');
    statusSpan.className = `tool-status tool-status-${status}`;
    statusSpan.textContent = status === 'calling' ? '⏳ Calling...' : 
                            status === 'success' ? '✅ Success' : '❌ Error';
    
    toolHeader.appendChild(toolNameSpan);
    toolHeader.appendChild(statusSpan);
    
    const argsDiv = document.createElement('div');
    argsDiv.className = 'tool-args';
    argsDiv.textContent = `Args: ${JSON.stringify(args, null, 2)}`;
    
    toolCallDiv.appendChild(toolHeader);
    toolCallDiv.appendChild(argsDiv);
    
    if (result) {
      const resultDiv = document.createElement('div');
      resultDiv.className = 'tool-result';
      resultDiv.textContent = `Result: ${JSON.stringify(result, null, 2)}`;
      toolCallDiv.appendChild(resultDiv);
    }
    
    this.toolCallsContainer.appendChild(toolCallDiv);
    this.toolCallsContainer.scrollTop = this.toolCallsContainer.scrollHeight;
  }
}

// Initialize when DOM is ready
function initializeToolCallingDemo() {
  console.log('Initializing Tool Calling Demo...');
  
  const checkElements = () => {
    const promptInput = document.getElementById('tool-demo-prompt');
    const runButton = document.getElementById('tool-demo-run');
    const found = !!(promptInput && runButton);
    console.log('Element check:', { promptInput: !!promptInput, runButton: !!runButton, found });
    return found;
  };
  
  // Try immediately if DOM is ready
  if (checkElements()) {
    try {
      console.log('Creating ToolCallingDemo instance...');
      window.toolCallingDemo = new ToolCallingDemo();
      console.log('Tool Calling Demo initialized successfully', window.toolCallingDemo);
      return;
    } catch (error) {
      console.error('Tool Calling Demo initialization error:', error);
      console.error(error.stack);
      return;
    }
  }
  
  // Wait for elements to be available
  let attempts = 0;
  const checkInterval = setInterval(() => {
    attempts++;
    if (checkElements()) {
      clearInterval(checkInterval);
      try {
        console.log('Creating ToolCallingDemo instance after wait...');
        window.toolCallingDemo = new ToolCallingDemo();
        console.log('Tool Calling Demo initialized successfully', window.toolCallingDemo);
      } catch (error) {
        console.error('Tool Calling Demo initialization error:', error);
        console.error(error.stack);
      }
    } else if (attempts > 100) {
      clearInterval(checkInterval);
      console.error('Tool Calling Demo: Timeout waiting for DOM elements');
    }
  }, 100);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeToolCallingDemo);
} else {
  initializeToolCallingDemo();
}

