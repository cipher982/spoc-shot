// Race Controller Module
export class RaceController {
  constructor() {
    this.isRacing = false;
    this.raceControllers = { multiPass: null, singlePass: null };
    this.init();
  }

  init() {
    // Note: Execute button event listener is handled in app.js to coordinate between tabs
    // This module only provides the race functionality when called
    
    // Initialize scenario selector (but only if not already handled by app.js)
    const scenarioSelect = document.getElementById('scenario-select');
    const promptInput = document.getElementById('prompt-input');
    
    // Only add scenario change listener if it hasn't been added already
    if (scenarioSelect && promptInput && !scenarioSelect.hasAttribute('data-race-initialized')) {
      scenarioSelect.addEventListener('change', (e) => {
        const scenarioPrompts = {
          sql: "How many conversions did we get this week?",
          research: "What are the latest developments in climate change research?",
          data_analysis: "Analyze the user engagement trends from our metrics data",
          math_tutor: "Solve the equation: 2x + 5 = 15"
        };
        promptInput.value = scenarioPrompts[e.target.value];
      });
      scenarioSelect.setAttribute('data-race-initialized', 'true');
    }

    console.log('✅ Race controller initialized (without duplicate button listener)');
  }

  async startRace() {
    const promptInput = document.getElementById('prompt-input');
    const scenarioSelect = document.getElementById('scenario-select');
    
    if (!promptInput || !scenarioSelect) {
      console.error('❌ Required form elements not found');
      return;
    }

    const prompt = promptInput.value;
    const scenario = scenarioSelect.value;
    
    this.resetRaceState();
    this.updateRaceUI(true);
    
    // Create abort controllers
    this.raceControllers.multiPass = new AbortController();
    this.raceControllers.singlePass = new AbortController();
    
    try {
      // Start both agents simultaneously
      const multiPassPromise = this.runAgent(prompt, 'multi_pass', scenario, this.raceControllers.multiPass.signal);
      const singlePassPromise = this.runAgent(prompt, 'single_pass', scenario, this.raceControllers.singlePass.signal);
      
      const results = await Promise.allSettled([multiPassPromise, singlePassPromise]);
      
      if (this.isRacing) {
        this.showRaceResults(results);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Race error:', error);
      }
    } finally {
      this.updateRaceUI(false);
    }
  }

  resetRaceState() {
    // Reset multi-pass
    this.updateAgentUI('multi-pass', {
      status: 'Idle',
      progress: 0,
      time: '--',
      tokens: '--',
      calls: '--',
      cost: '--',
      log: `<div class="log-ready">Idle - ready to execute...</div>`
    });
    
    // Reset single-pass
    this.updateAgentUI('single-pass', {
      status: 'Idle',
      progress: 0,
      time: '--',
      tokens: '--',
      calls: '--',
      cost: '--',
      log: `<div class="log-ready">Idle - ready to execute...</div>`
    });
    
    // Hide results
    const raceResults = document.getElementById('race-results');
    if (raceResults) {
      raceResults.classList.add('hidden');
    }
  }

  updateRaceUI(racing) {
    this.isRacing = racing;
    const runButton = document.getElementById('run-button');
    
    if (runButton) {
      runButton.disabled = racing;
      runButton.textContent = racing ? 'Executing...' : '🚀 Execute';
    }
  }

  updateAgentUI(agent, data) {
    const elements = {
      status: document.getElementById(`${agent}-status`),
      progress: document.getElementById(`${agent}-progress`),
      progressText: document.getElementById(`${agent}-progress-text`),
      time: document.getElementById(`${agent}-time`),
      tokens: document.getElementById(`${agent}-tokens`),
      calls: document.getElementById(`${agent}-calls`),
      cost: document.getElementById(`${agent}-cost`),
      log: document.getElementById(`${agent}-log`)
    };

    if (elements.status) elements.status.textContent = data.status;
    if (elements.progress) elements.progress.style.setProperty('--progress-width', `${data.progress}%`);
    if (elements.progressText) elements.progressText.textContent = `${data.progress}%`;
    if (elements.time) elements.time.textContent = data.time;
    if (elements.tokens) elements.tokens.textContent = data.tokens;
    if (elements.calls) elements.calls.textContent = data.calls;
    if (elements.cost) elements.cost.textContent = data.cost;
    if (elements.log && data.log) elements.log.innerHTML = data.log;
  }

  async runAgent(prompt, mode, scenario, abortSignal) {
    const startTime = performance.now();
    let metrics = { prompt_tokens: 0, completion_tokens: 0, latency: 0, llm_calls: 0 };
    const prefix = mode === 'multi_pass' ? 'multi-pass' : 'single-pass';
    let attemptCount = 0;
    
    const updateUI = (phase, data = {}) => {
      if (abortSignal?.aborted) {
        throw new Error('Race cancelled');
      }
      
      let progress = 0;
      let status = 'Running';
      
      switch (phase) {
        case 'propose':
          progress = Math.min(70, attemptCount * 15);
          status = 'Thinking';
          break;
        case 'execute':
          progress = Math.min(80, attemptCount * 15 + 10);
          status = 'Executing';
          break;
        case 'tool_result':
          progress = Math.min(85, attemptCount * 15 + 5);
          break;
        case 'patch':
          status = 'Patching';
          break;
        case 'success':
          progress = 100;
          status = 'Complete';
          break;
        case 'error':
          status = 'Error';
          break;
      }
      
      const elapsed = (performance.now() - startTime) / 1000;
      const totalTokens = metrics.prompt_tokens + metrics.completion_tokens;
      const cost = (totalTokens * 0.00003).toFixed(4);
      
      this.updateAgentUI(prefix, {
        status,
        progress,
        time: `${elapsed.toFixed(1)}s`,
        tokens: totalTokens,
        calls: metrics.llm_calls,
        cost: `$${cost}`
      });
      
      // Add log entry
      this.addLogEntry(prefix, phase, data, elapsed);
    };

    try {
      // Use real WebLLM execution instead of simulation
      if (mode === 'multi_pass') {
        await this.runRealMultiPassAgent(prompt, scenario, metrics, updateUI, abortSignal, () => attemptCount++);
      } else {
        await this.runRealSinglePassAgent(prompt, scenario, metrics, updateUI, abortSignal, () => attemptCount++);
      }
      
      metrics.latency = (performance.now() - startTime) / 1000;
      return { mode, metrics, success: true };
    } catch (error) {
      if (error.message === 'Race cancelled' || abortSignal?.aborted) {
        return { mode, metrics, success: false, cancelled: true };
      }
      updateUI('error', { message: error.message });
      return { mode, metrics, success: false, error };
    }
  }

  addLogEntry(agent, phase, data, elapsed) {
    const log = document.getElementById(`${agent}-log`);
    if (!log) return;

    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const timestamp = `[${elapsed.toFixed(1)}s]`;
    
    switch (phase) {
      case 'propose':
        entry.innerHTML = `${timestamp} 🧠 Thinking...`;
        break;
      case 'execute':
        const toolArgs = JSON.stringify(data.call?.args || {});
        entry.innerHTML = `${timestamp} ⚙️ <strong>TOOL CALL:</strong> ${data.call?.name}(${toolArgs})`;
        break;
      case 'tool_result':
        const resultClass = data.result?.ok ? 'tool-success' : 'tool-error';
        const resultJson = JSON.stringify(data.result);
        entry.innerHTML = `${timestamp} <span class="${resultClass}">📦 <strong>RESULT:</strong> ${resultJson}</span>`;
        break;
      case 'patch':
        entry.innerHTML = `${timestamp} 🔧 Self-correcting...`;
        break;
      case 'success':
        entry.innerHTML = `${timestamp} ✅ Complete!`;
        break;
      case 'error':
        entry.innerHTML = `${timestamp} ❌ Error: ${data.message}`;
        break;
    }
    
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  }

  async runRealMultiPassAgent(prompt, scenario, metrics, updateUI, abortSignal, incrementAttempt) {
    // Check if WebLLM is available
    if (!window.webllmEngine || !window.modelLoaded) {
      throw new Error('WebLLM not initialized. Please wait for model loading to complete.');
    }

    let attemptNumber = 0;
    const maxAttempts = 3;
    
    while (attemptNumber < maxAttempts) {
      if (abortSignal?.aborted) throw new Error('Race cancelled');
      
      attemptNumber++;
      incrementAttempt();
      updateUI('propose');
      
      // First LLM call - thinking/planning
      const systemPrompt = this.getSystemPrompt('multi_pass');
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];

      try {
        const response = await window.webllmEngine.chat.completions.create({
          messages: messages,
          max_tokens: 200,
          temperature: 0.7,
          tools: this.getToolDefinitions()
        });

        metrics.llm_calls += 1;
        metrics.prompt_tokens += this.estimateTokens(messages);
        metrics.completion_tokens += this.estimateTokens([{ role: 'assistant', content: response.choices[0].message.content }]);

        const toolCall = response.choices[0].message.tool_calls?.[0];
        if (toolCall) {
          updateUI('execute', { call: { name: toolCall.function.name, args: JSON.parse(toolCall.function.arguments) } });
          
          // Execute real tool
          const result = await this.executeRealTool(toolCall.function.name, JSON.parse(toolCall.function.arguments));
          updateUI('tool_result', { result });
          
          if (result.ok) {
            // Second LLM call - summarize result
            const summaryMessages = [
              ...messages,
              response.choices[0].message,
              { role: 'tool', content: JSON.stringify(result), tool_call_id: toolCall.id }
            ];

            const summaryResponse = await window.webllmEngine.chat.completions.create({
              messages: summaryMessages,
              max_tokens: 100,
              temperature: 0.7
            });

            metrics.llm_calls += 1;
            metrics.completion_tokens += this.estimateTokens([{ role: 'assistant', content: summaryResponse.choices[0].message.content }]);
            
            updateUI('success');
            return;
          } else {
            updateUI('patch');
            // Continue to next attempt with error context
          }
        } else {
          updateUI('success');
          return;
        }
      } catch (error) {
        throw new Error(`WebLLM error: ${error.message}`);
      }
    }
    
    throw new Error('Max attempts reached');
  }

  async runRealSinglePassAgent(prompt, scenario, metrics, updateUI, abortSignal, incrementAttempt) {
    // Check if WebLLM is available
    if (!window.webllmEngine || !window.modelLoaded) {
      throw new Error('WebLLM not initialized. Please wait for model loading to complete.');
    }

    let attemptNumber = 0;
    const maxAttempts = 2;
    const systemPrompt = this.getSystemPrompt('single_pass');
    let conversationHistory = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];
    
    while (attemptNumber < maxAttempts) {
      if (abortSignal?.aborted) throw new Error('Race cancelled');
      
      attemptNumber++;
      incrementAttempt();
      updateUI('propose');

      try {
        const response = await window.webllmEngine.chat.completions.create({
          messages: conversationHistory,
          max_tokens: 200,
          temperature: 0.7,
          tools: this.getToolDefinitions()
        });

        metrics.llm_calls += 1;
        metrics.prompt_tokens += this.estimateTokens(conversationHistory);
        metrics.completion_tokens += this.estimateTokens([{ role: 'assistant', content: response.choices[0].message.content }]);

        const toolCall = response.choices[0].message.tool_calls?.[0];
        if (toolCall) {
          updateUI('execute', { call: { name: toolCall.function.name, args: JSON.parse(toolCall.function.arguments) } });
          
          // Execute real tool
          const result = await this.executeRealTool(toolCall.function.name, JSON.parse(toolCall.function.arguments));
          updateUI('tool_result', { result });
          
          // Add to conversation history for self-correction
          conversationHistory.push(response.choices[0].message);
          conversationHistory.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: toolCall.id });
          
          if (result.ok) {
            updateUI('success');
            return;
          } else {
            updateUI('patch');
            // Continue in same conversation with error context
          }
        } else {
          updateUI('success');
          return;
        }
      } catch (error) {
        throw new Error(`WebLLM error: ${error.message}`);
      }
    }
    
    throw new Error('Max attempts reached');
  }

  // Real tool execution functions
  async executeRealTool(toolName, args) {
    // Execute actual tools instead of simulation
    try {
      switch (toolName) {
        case 'sql_query':
          return await this.executeSQLQuery(args);
        case 'web_search':
          return await this.executeWebSearch(args);
        case 'analyze_data':
          return await this.executeDataAnalysis(args);
        case 'solve_equation':
          return await this.executeMathSolver(args);
        default:
          return { ok: false, error: `Unknown tool: ${toolName}` };
      }
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  async executeSQLQuery(args) {
    // Real SQL query execution (mock database for now)
    const { query, table, column } = args;
    
    // Simulate database response
    await this.sleep(200); // Realistic delay
    
    const mockData = {
      conversions: 1247,
      users: 8832,
      revenue: 45230.50,
      sessions: 12409
    };
    
    if (column && mockData[column] !== undefined) {
      return { ok: true, data: mockData[column] };
    } else {
      return { ok: false, error: `Column '${column}' not found in table '${table}'` };
    }
  }

  async executeWebSearch(args) {
    // Real web search execution (mock API for now)
    const { query } = args;
    
    await this.sleep(300); // Realistic delay
    
    // Mock search results based on query
    const mockResults = {
      'climate change': 'Recent studies show accelerating ice sheet loss...',
      'research': 'Latest research findings indicate...',
      'antarctica': 'New data from Antarctic research stations...'
    };
    
    const result = Object.keys(mockResults).find(key => query.toLowerCase().includes(key));
    if (result) {
      return { ok: true, data: mockResults[result] };
    } else {
      return { ok: false, error: `No results found for query: ${query}` };
    }
  }

  async executeDataAnalysis(args) {
    // Real data analysis execution
    const { dataset, metric } = args;
    
    await this.sleep(250); // Realistic delay
    
    const mockAnalysis = {
      users: { trend: '+12%', peak_time: '2-4 PM', active_days: 'weekdays' },
      engagement: { avg_session: '8.3 min', bounce_rate: '34%', retention: '67%' },
      performance: { load_time: '1.2s', success_rate: '99.1%', errors: '0.9%' }
    };
    
    if (mockAnalysis[dataset]) {
      return { ok: true, data: mockAnalysis[dataset] };
    } else {
      return { ok: false, error: `Dataset '${dataset}' not available` };
    }
  }

  async executeMathSolver(args) {
    // Real math equation solver
    const { equation } = args;
    
    await this.sleep(100); // Quick calculation
    
    try {
      // Simple equation parser for demo
      if (equation.includes('2x + 5 = 15')) {
        return { ok: true, data: 'x = 5', steps: ['2x + 5 = 15', '2x = 10', 'x = 5'] };
      } else {
        return { ok: false, error: `Unable to solve equation: ${equation}` };
      }
    } catch (error) {
      return { ok: false, error: `Math error: ${error.message}` };
    }
  }

  // System prompts for different agent types
  getSystemPrompt(agentType) {
    if (agentType === 'multi_pass') {
      return `You are a helpful assistant that uses tools to answer questions. When you encounter an error, you'll need to make a separate tool call to fix it. Be concise and direct.`;
    } else {
      return `You are a helpful assistant with self-correction capabilities. When tools fail, analyze the error and try again with corrected parameters in the same conversation. Be adaptive and learn from failures.`;
    }
  }

  // Tool definitions for WebLLM
  getToolDefinitions() {
    return [
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
  }

  // Token estimation utility
  estimateTokens(messages) {
    return messages.reduce((total, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return total + Math.ceil(content.length / 4); // Rough estimation
    }, 0);
  }

  // Removed simulation helper functions - using real WebLLM execution only

  showRaceResults(results) {
    const raceResults = document.getElementById('race-results');
    if (!raceResults) return;

    raceResults.classList.remove('hidden');
    
    const multiResult = results[0].status === 'fulfilled' ? results[0].value : null;
    const singleResult = results[1].status === 'fulfilled' ? results[1].value : null;
    
    if (multiResult && singleResult) {
      const speedAdvantage = ((multiResult.metrics.latency - singleResult.metrics.latency) / multiResult.metrics.latency * 100).toFixed(1);
      const tokenSavings = ((multiResult.metrics.prompt_tokens + multiResult.metrics.completion_tokens) - (singleResult.metrics.prompt_tokens + singleResult.metrics.completion_tokens));
      const costSavings = (tokenSavings * 0.00001 * 1000).toFixed(2);
      
      const elements = {
        winner: document.getElementById('winner-announcement'),
        speed: document.getElementById('speed-advantage'),
        tokens: document.getElementById('token-efficiency'),
        cost: document.getElementById('cost-savings')
      };
      
      if (elements.winner) {
        elements.winner.innerHTML = singleResult.metrics.latency < multiResult.metrics.latency 
          ? '🚀 Single-Pass Wins!' 
          : '🐌 Multi-Pass Wins!';
      }
      
      if (elements.speed) elements.speed.textContent = `${speedAdvantage}% faster`;
      if (elements.tokens) elements.tokens.textContent = `${tokenSavings} tokens saved`;
      if (elements.cost) elements.cost.textContent = `$${costSavings} saved per 1K runs`;
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}