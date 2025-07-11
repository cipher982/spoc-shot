// SPOC-Shot Demo JavaScript
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOMContentLoaded fired - initializing SPOC-Shot');
  
  try {
    const runButton = document.getElementById('run-button');
    
    console.log('🔍 Element check:', {
      runButton: !!runButton
    });
  const scenarioSelect = document.getElementById('scenario-select');
  const promptInput = document.getElementById('prompt-input');
  const codeView = document.getElementById('code-view');
  const multiPassTemplate = document.getElementById('multi-pass-code');
  const singlePassTemplate = document.getElementById('single-pass-code');

  // Race results
  const raceResults = document.getElementById('race-results');

  // No additional elements needed for simplified layout

  // WebLLM elements
  const modelLoadingPanel = document.getElementById('model-loading-panel');
  const modelStatus = document.getElementById('model-status');
  const modelProgressText = document.getElementById('model-progress-text');
  const modelProgressBar = document.getElementById('model-progress-bar');

  // --- State Management ---
  let currentScenario = 'sql';
  let webllmEngine = null;
  let modelLoaded = false;

  // Scenario configurations
  const scenarioPrompts = {
    sql: "How many conversions did we get this week?",
    research: "What are the latest developments in climate change research?",
    data_analysis: "Analyze the user engagement trends from our metrics data",
    math_tutor: "Solve the equation: 2x + 5 = 15"
  };

  const updateCodeView = () => {
    // Show multi-pass by default
    codeView.innerHTML = multiPassTemplate.innerHTML;
  };

  // Simplified functions for new layout
  const resetRaceState = () => {
    // Reset multi-pass
    document.getElementById('multi-pass-status').textContent = 'Idle';
    document.getElementById('multi-pass-progress').style.setProperty('--progress-width', '0%');
    document.getElementById('multi-pass-progress-text').textContent = '0%';
    document.getElementById('multi-pass-log').innerHTML = '<div class="log-ready">Idle - ready to execute...</div>';
    document.getElementById('multi-pass-time').textContent = '--';
    document.getElementById('multi-pass-tokens').textContent = '--';
    document.getElementById('multi-pass-calls').textContent = '--';
    document.getElementById('multi-pass-cost').textContent = '--';
    
    // Reset single-pass
    document.getElementById('single-pass-status').textContent = 'Idle';
    document.getElementById('single-pass-progress').style.setProperty('--progress-width', '0%');
    document.getElementById('single-pass-progress-text').textContent = '0%';
    document.getElementById('single-pass-log').innerHTML = '<div class="log-ready">Idle - ready to execute...</div>';
    document.getElementById('single-pass-time').textContent = '--';
    document.getElementById('single-pass-tokens').textContent = '--';
    document.getElementById('single-pass-calls').textContent = '--';
    document.getElementById('single-pass-cost').textContent = '--';
    
    // Hide results
    raceResults.classList.add('hidden');
  };

  // --- WebLLM Initialization ---
  const initializeWebLLM = async () => {
    try {
      // Show the overlay as a flex container so the modal stays centred
      modelLoadingPanel.classList.remove('hidden');
      runButton.disabled = true;
      
      console.log("🔍 Starting WebLLM initialization...");
      
      modelStatus.textContent = "Loading WebLLM library...";
      
      // 1️⃣ Dynamically import WebLLM (fixes race condition)
      const { CreateMLCEngine, prebuiltAppConfig } = await import(
        'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.79/+esm'
      );
      console.log("✅ WebLLM 0.2.79 loaded");

      // 2️⃣ Check WebGPU
      modelStatus.textContent = "Checking WebGPU support...";
      if (!('gpu' in navigator)) {
        throw new Error('WebGPU unavailable on this browser');
      }
      console.log("✅ WebGPU ready");

      // 3️⃣ Verify model in catalogue
      modelStatus.textContent = "Verifying model availability...";
      const selectedModel = "Qwen3-0.6B-q4f16_1-MLC"; // No mlc-ai/ prefix
      const found = prebuiltAppConfig.model_list.some((m) => m.model_id === selectedModel);
      
      if (!found) {
        const qwen3Models = prebuiltAppConfig.model_list
          .filter(m => m.model_id.startsWith("Qwen3"))
          .map(m => m.model_id);
        console.log("Available Qwen3 models:", qwen3Models);
        throw new Error(`${selectedModel} missing from catalogue`);
      }
      console.log(`✅ Model found in catalogue: ${selectedModel}`);

      // 4️⃣ Load the model
      modelStatus.textContent = "Loading model...";
      console.log("🔄 Creating MLC Engine with model:", selectedModel);
      
      const initProgressCallback = (report) => {
        console.log("📊 Progress:", report);
        const progress = Math.round((report.progress || 0) * 100);
        modelProgressText.textContent = `${progress}%`;
        modelProgressBar.style.setProperty('--progress-width', `${progress}%`);
        modelStatus.textContent = report.text || `Loading model... ${progress}%`;
      };

      webllmEngine = await CreateMLCEngine(selectedModel, { initProgressCallback });
      
      // Make WebLLM engine globally available
      window.webllmEngine = webllmEngine;
      window.modelLoaded = true;
      
      console.log("✅ WebLLM engine created successfully:", webllmEngine);

      modelStatus.textContent = "Model loaded successfully!";
      modelProgressText.textContent = "100%";
      modelProgressBar.style.setProperty('--progress-width', '100%');
      
      setTimeout(() => {
        modelLoadingPanel.classList.add('hidden');
        runButton.disabled = false;
        modelLoaded = true;
      }, 1000);

    } catch (error) {
      console.error("❌ WebLLM initialization failed:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      
      modelStatus.textContent = `Error: ${error.message}`;
      modelProgressBar.classList.add('progress-error');
      
      // Show helpful error message without popup
      setTimeout(() => {
        // Update the overlay to show error
        const panel = modelLoadingPanel.querySelector('div');
        panel.innerHTML = `
          <div class="text-center">
            <div class="error-title">⚠️ WebLLM Unavailable</div>
            <div class="error-message">
              <strong>Most likely cause:</strong> WebGPU not enabled in Chrome<br><br>
            </div>
            <button onclick="location.reload()" class="retry-button">
              Retry
            </button>
            <button onclick="enableDemoMode()" class="demo-button">
              View Demo UI
            </button>
          </div>
        `;
        
        // Also update the main UI
        runButton.disabled = true;
        runButton.textContent = 'WebLLM Required';
        runButton.className = 'run-button-disabled';
      }, 1000);
    }
  };

  // Initialize modules (will be loaded as ES6 modules later)

  // --- Event Listeners ---
  scenarioSelect.addEventListener('change', (e) => {
    currentScenario = e.target.value;
    promptInput.value = scenarioPrompts[currentScenario];
  });

  runButton.addEventListener('click', (e) => {
    e.preventDefault();
    
    try {
      // Check which tab is active
      const activeTab = document.querySelector('.tab-button.active');
      const isUncertaintyTab = activeTab && activeTab.id === 'uncertainty-tab';
      
      console.log('🚀 Execute button clicked - Active tab:', isUncertaintyTab ? 'uncertainty' : 'race');
      
      if (isUncertaintyTab) {
        // Call the uncertainty analyzer's method if available, otherwise fallback to local implementation
        if (window.SPOCShot && window.SPOCShot.modules && window.SPOCShot.modules.uncertainty) {
          console.log('📊 Using uncertainty module');
          window.SPOCShot.modules.uncertainty.startAnalysis();
        } else {
          console.log('📊 Using fallback uncertainty analysis');
          startUncertaintyAnalysis(); // Fallback to local implementation
        }
      } else {
        // Call the race controller's method if available, otherwise fallback to local implementation
        if (window.SPOCShot && window.SPOCShot.modules && window.SPOCShot.modules.race) {
          console.log('🏁 Using race module');
          window.SPOCShot.modules.race.startRace();
        } else {
          console.log('🏁 Using fallback race implementation');
          startRace(); // Fallback to local implementation
        }
      }
    } catch (error) {
      console.error('❌ Error in execute button handler:', error);
      // Reset button state on error
      runButton.disabled = false;
      runButton.textContent = '🚀 Execute';
    }
  });

  // Uncertainty analysis is now handled by the main execute button

  // No additional setup needed for simplified layout

  // --- WebLLM Agent Implementation ---
  const runWebLLMAgent = async (prompt, mode, scenario = 'sql', metrics = null, updateUI = null, abortSignal = null, incrementAttempt = null) => {
    console.log(`Running WebLLM agent in ${mode} mode, ${scenario} scenario with prompt: ${prompt}`);
    
    // Check if WebLLM is available
    if (!webllmEngine || !modelLoaded) {
      throw new Error('WebLLM not initialized. Please wait for model loading to complete.');
    }
    
    // If no custom metrics/UI provided, use default behavior
    if (!metrics) {
      log.innerHTML = '<div class="log-ready">Running agent with WebLLM...</div>';
      resetMetrics();
      metrics = { prompt_tokens: 0, completion_tokens: 0, latency: 0, llm_calls: 0 };
      const startTime = performance.now();
      
      try {
        if (mode === 'multi_pass') {
          await runMultiPassWebLLM(prompt, metrics, startTime, scenario);
        } else {
          await runSinglePassWebLLM(prompt, metrics, startTime, scenario);
        }
      } catch (error) {
        console.error('WebLLM agent error:', error);
        handleSseMessage({
          phase: 'error',
          message: `WebLLM error: ${error.message}`,
          metrics: metrics
        });
      } finally {
        runButton.disabled = false;
        runButton.textContent = 'Run Agent';
      }
      return;
    }
    
    // Race mode with custom UI callbacks
    const startTime = performance.now();
    let attemptNumber = 0;
    const maxAttempts = mode === 'multi_pass' ? 3 : 2;
    
    if (mode === 'multi_pass') {
      // Multi-pass: separate LLM calls for each attempt
      while (attemptNumber < maxAttempts) {
        if (abortSignal?.aborted) throw new Error('Race cancelled');
        
        attemptNumber++;
        if (incrementAttempt) incrementAttempt();
        if (updateUI) updateUI('propose');
        
        const systemPrompt = `You are a helpful assistant that uses tools to answer questions. When you encounter an error, you'll need to make a separate tool call to fix it.`;
        const messages = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ];

        try {
          const response = await webllmEngine.chat.completions.create({
            messages: messages,
            max_tokens: 200,
            temperature: 0.7,
            tools: getToolDefinitionsForScenario(scenario)
          });

          metrics.llm_calls += 1;
          metrics.prompt_tokens += estimateTokens(messages);
          metrics.completion_tokens += estimateTokens([{ role: 'assistant', content: response.choices[0].message.content }]);

          const toolCall = response.choices[0].message.tool_calls?.[0];
          if (toolCall) {
            if (updateUI) updateUI('execute', { call: { name: toolCall.function.name, args: JSON.parse(toolCall.function.arguments) } });
            
            // Execute real tool via backend
            const result = await executeRealToolCall(toolCall.function.name, JSON.parse(toolCall.function.arguments));
            if (updateUI) updateUI('tool_result', { result });
            
            if (result.ok) {
              // Second LLM call for summary
              const summaryMessages = [
                ...messages,
                response.choices[0].message,
                { role: 'tool', content: JSON.stringify(result), tool_call_id: toolCall.id }
              ];

              const summaryResponse = await webllmEngine.chat.completions.create({
                messages: summaryMessages,
                max_tokens: 100,
                temperature: 0.7
              });

              metrics.llm_calls += 1;
              metrics.completion_tokens += estimateTokens([{ role: 'assistant', content: summaryResponse.choices[0].message.content }]);
              
              if (updateUI) updateUI('success');
              return;
            } else {
              if (updateUI) updateUI('patch');
              // Continue to next attempt
            }
          } else {
            if (updateUI) updateUI('success');
            return;
          }
        } catch (error) {
          throw new Error(`WebLLM error: ${error.message}`);
        }
      }
    } else {
      // Single-pass: conversation continues in same context
      const systemPrompt = `You are a helpful assistant with self-correction capabilities. When tools fail, analyze the error and try again with corrected parameters in the same conversation.`;
      let conversationHistory = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ];
      
      while (attemptNumber < maxAttempts) {
        if (abortSignal?.aborted) throw new Error('Race cancelled');
        
        attemptNumber++;
        if (incrementAttempt) incrementAttempt();
        if (updateUI) updateUI('propose');

        try {
          const response = await webllmEngine.chat.completions.create({
            messages: conversationHistory,
            max_tokens: 200,
            temperature: 0.7,
            tools: getToolDefinitionsForScenario(scenario)
          });

          metrics.llm_calls += 1;
          metrics.prompt_tokens += estimateTokens(conversationHistory);
          metrics.completion_tokens += estimateTokens([{ role: 'assistant', content: response.choices[0].message.content }]);

          const toolCall = response.choices[0].message.tool_calls?.[0];
          if (toolCall) {
            if (updateUI) updateUI('execute', { call: { name: toolCall.function.name, args: JSON.parse(toolCall.function.arguments) } });
            
            // Execute real tool
            const result = await executeRealToolCall(toolCall.function.name, JSON.parse(toolCall.function.arguments));
            if (updateUI) updateUI('tool_result', { result });
            
            // Add to conversation history
            conversationHistory.push(response.choices[0].message);
            conversationHistory.push({ role: 'tool', content: JSON.stringify(result), tool_call_id: toolCall.id });
            
            if (result.ok) {
              if (updateUI) updateUI('success');
              return;
            } else {
              if (updateUI) updateUI('patch');
              // Continue in same conversation
            }
          } else {
            if (updateUI) updateUI('success');
            return;
          }
        } catch (error) {
          throw new Error(`WebLLM error: ${error.message}`);
        }
      }
    }
    
    throw new Error('Max attempts reached');
  };

  // Helper functions for real execution
  const getToolDefinitionsForScenario = (scenario) => {
    const toolDefinitions = {
      sql: [{
        type: 'function',
        function: {
          name: 'sql_query',
          description: 'Query database for specific information',
          parameters: {
            type: 'object',
            properties: {
              column: { type: 'string', description: 'Column to query' },
              table: { type: 'string', description: 'Table name', default: 'analytics' }
            },
            required: ['column']
          }
        }
      }],
      research: [{
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
      }],
      data_analysis: [{
        type: 'function',
        function: {
          name: 'analyze_data',
          description: 'Analyze dataset for trends and insights',
          parameters: {
            type: 'object',
            properties: {
              dataset: { type: 'string', description: 'Dataset name' },
              operation: { type: 'string', description: 'Analysis operation' }
            },
            required: ['dataset']
          }
        }
      }],
      math_tutor: [{
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
      }]
    };
    
    return toolDefinitions[scenario] || toolDefinitions.sql;
  };

  const executeRealToolCall = async (toolName, args) => {
    // Execute tools via backend API
    try {
      const response = await fetch('/execute_tool', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: toolName, args: args })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      return { ok: false, error: `Tool execution failed: ${error.message}` };
    }
  };

  const estimateTokens = (messages) => {
    return messages.reduce((total, msg) => {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      return total + Math.ceil(content.length / 4); // Rough estimation
    }, 0);
  };

  const runMultiPassWebLLM = async (prompt, metrics, startTime, scenario = 'sql') => {
    const requestId = `spoc-shot-${Date.now()}`;
    
    // Simulate the multi-pass logic
    let attempt = 0;
    
    // First LLM call - MOVE MESSAGES OUTSIDE LOOP!
    const systemPrompt = `You are an intelligent agent that learns from your mistakes and applies learned patterns.

CRITICAL RULES:
1. Look at your conversation history BEFORE making tool calls
2. If you see a previous tool failure with a hint, USE THAT HINT in your next attempt
3. Never repeat the exact same failed tool call
4. Learn from patterns and apply them consistently

Your task: Answer "How many conversions did we get this week?" using the sql_query tool.
- The tool takes a single argument: column
- Tool results come back as "TOOL_RESULT: {json data}"
- If you get a hint like "Did you mean 'convs'?", use 'convs' in your next tool call
- Format: TOOL_CALL: {"name": "sql_query", "args": {"column": "your_guess"}}

DO NOT repeat failed attempts! Always learn from the conversation history.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    while (true) {
      attempt++;
      handleSseMessage({ phase: 'propose', metrics });
      
      // DEBUG: Log attempt number
      console.log(`🔄 Starting Multi-Pass attempt ${attempt}`);

      // DEBUG: Compact logging
      console.log(`🔍 Attempt ${attempt}: ${messages.length} messages`);
      if (messages.length > 3) {
        const lastMsg = messages[messages.length-1];
        if (lastMsg.content.startsWith('TOOL_RESULT:')) {
          try {
            const result = JSON.parse(lastMsg.content.replace('TOOL_RESULT: ', ''));
            console.log(`   Last hint: ${result.hint || 'none'}`);
          } catch (e) {
            console.log(`   Last hint: none`);
          }
        }
      }

      const completion = await webllmEngine.chat.completions.create({
        messages,
        temperature: 0.0,
        // Note: WebLLM might handle request_id differently
      });

      metrics.llm_calls += 1;
      metrics.prompt_tokens += completion.usage?.prompt_tokens || 0;
      metrics.completion_tokens += completion.usage?.completion_tokens || 0;
      
      const response = completion.choices[0].message.content;
      handleSseMessage({ phase: 'model_response', content: response, metrics });
      
      // Check for tool call
      if (response.includes('TOOL_CALL:')) {
        const toolCallStr = response.split('TOOL_CALL:')[1].trim();
        try {
          const toolCall = JSON.parse(toolCallStr);
          handleSseMessage({ phase: 'execute', call: toolCall, metrics });
          
          // Execute tool (client-side simulation)
          const result = simulateToolCall(toolCall, scenario);
          handleSseMessage({ phase: 'tool_result', result, metrics });
          
          if (result.ok) {
            // Success - make final LLM call for answer
            messages.push({ role: 'assistant', content: response });
            messages.push({ role: 'user', content: `TOOL_RESULT: ${JSON.stringify(result)}` });
            
            handleSseMessage({ phase: 'propose', metrics });
            const finalCompletion = await webllmEngine.chat.completions.create({
              messages,
              temperature: 0.0,
            });
            
            // Don't increment llm_calls for same request_id (simulating KV cache)
            metrics.prompt_tokens += finalCompletion.usage?.prompt_tokens || 0;
            metrics.completion_tokens += finalCompletion.usage?.completion_tokens || 0;
            
            const finalAnswer = finalCompletion.choices[0].message.content;
            metrics.latency = (performance.now() - startTime) / 1000;
            handleSseMessage({ phase: 'success', answer: finalAnswer, metrics, debug: { attempt } });
            return;
          } else {
            // Tool failed, continue loop
            messages.push({ role: 'assistant', content: response });
            messages.push({ role: 'user', content: `TOOL_RESULT: ${JSON.stringify(result)}` });
            
            // DEBUG: Compact failure logging
            console.log(`❌ Attempt ${attempt} failed. Added hint: ${result.hint || 'none'}`);
            
            handleSseMessage({ phase: 'failure', message: 'Tool execution failed. Retrying...', metrics });
          }
        } catch (e) {
          handleSseMessage({ phase: 'failure', message: `Invalid tool call: ${e.message}`, metrics });
          break;
        }
      } else {
        metrics.latency = (performance.now() - startTime) / 1000;
        handleSseMessage({ phase: 'success', answer: response, metrics });
        return;
      }
    }
    
    // Continue loop - no max attempts
  };

  const runSinglePassWebLLM = async (prompt, metrics, startTime, scenario = 'sql') => {
    const requestId = `spoc-shot-${Date.now()}`;
    let attempt = 0;
    
    // Single-pass logic
    while (true) {
      attempt++;
      console.log(`🔄 Starting Single-Pass attempt ${attempt}`);
      handleSseMessage({ phase: 'propose', metrics });
      
      const systemPrompt = `You are an agent designed for a specific demo. Your ONLY purpose is to answer the user's question about "conversions".
1. You will be given a TOOL_SIGNATURE for the sql_query tool. It is the only tool you can use.
2. The tool takes a single argument: column.
3. The user's question is "How many conversions did we get this week?". Infer the column name from this question.
4. Your first action MUST be to call the tool. Output a TOOL_CALL in JSON format.
5. If the EXEC_RESULT you receive is a failure, you MUST use the 'hint' to immediately try a new TOOL_CALL with the corrected column name.
6. If the EXEC_RESULT is successful, provide a one-sentence answer summarizing the data.
Example of a tool call:
TOOL_CALL: {"name": "sql_query", "args": {"column": "conversions"}}`;

      const toolSignature = `TOOL_SIGNATURE: {
  "name": "sql_query",
  "description": "Query the company database.",
  "parameters": {
    "type": "object",
    "properties": {
      "column": {
        "type": "string",
        "description": "The column to query, e.g., 'users', 'revenue', 'convs'."
      }
    },
    "required": ["column"]
  }
}`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${toolSignature}\n\nUser Prompt: ${prompt}` }
      ];

      const completion = await webllmEngine.chat.completions.create({
        messages,
        temperature: 0.0,
      });

      metrics.llm_calls += 1;
      metrics.prompt_tokens += completion.usage?.prompt_tokens || 0;
      metrics.completion_tokens += completion.usage?.completion_tokens || 0;
      
      const response = completion.choices[0].message.content;
      handleSseMessage({ phase: 'model_response', content: response, metrics });
      
      // Check for tool call
      if (response.includes('TOOL_CALL:')) {
        const toolCallStr = response.split('TOOL_CALL:')[1].trim();
        try {
          const toolCall = JSON.parse(toolCallStr);
          handleSseMessage({ phase: 'execute', call: toolCall, metrics });
          
          // Execute tool
          const result = simulateToolCall(toolCall, scenario);
          handleSseMessage({ phase: 'tool_result', result, metrics });
          
          if (result.ok) {
            // Success - generate final answer (simulating continued generation)
            messages.push({ role: 'assistant', content: response });
            messages.push({ role: 'user', content: `TOOL_RESULT: ${JSON.stringify(result)}` });
            
            const finalCompletion = await webllmEngine.chat.completions.create({
              messages,
              temperature: 0.0,
            });
            
            // In true single-pass, this would be continuation, not new call
            metrics.prompt_tokens += finalCompletion.usage?.prompt_tokens || 0;
            metrics.completion_tokens += finalCompletion.usage?.completion_tokens || 0;
            
            const finalAnswer = finalCompletion.choices[0].message.content;
            metrics.latency = (performance.now() - startTime) / 1000;
            handleSseMessage({ phase: 'success', answer: finalAnswer, metrics, debug: { attempt } });
            return;
          } else {
            // Tool failed - show patch phase and continue
            handleSseMessage({ phase: 'patch', message: 'Tool execution failed. Attempting to self-patch.', metrics });
            messages.push({ role: 'assistant', content: response });
            messages.push({ role: 'user', content: `TOOL_RESULT: ${JSON.stringify(result)}` });
          }
        } catch (e) {
          handleSseMessage({ phase: 'failure', message: `Invalid tool call: ${e.message}`, metrics });
          break;
        }
      } else {
        metrics.latency = (performance.now() - startTime) / 1000;
        handleSseMessage({ phase: 'success', answer: response, metrics });
        return;
      }
    }
    
    // Continue loop - no max attempts
  };

  // Simulate the tool execution client-side
  const simulateToolCall = (toolCall, scenario = 'sql') => {
    const args = toolCall.args || toolCall.arguments || {};
    
    if (scenario === 'sql') {
      const column = args.column;
      if (column === "conversions") {
        return { ok: false, hint: "Did you mean 'convs'?" };
      } else if (column === "convs") {
        return { ok: true, data: 12345 };
      } else {
        return { ok: false, hint: `Column '${column}' not found.` };
      }
    } else if (scenario === 'research') {
      const query = args.query || "";
      if (query.toLowerCase().includes("climate change")) {
        if (!query.toLowerCase().includes("recent")) {
          return { ok: false, hint: "Try searching for 'recent climate change data' for more current results" };
        } else {
          return {
            ok: true,
            data: {
              results: [
                { title: "2024 Climate Report", snippet: "Global temperatures rose 1.2°C above pre-industrial levels" },
                { title: "Arctic Ice Data", snippet: "Sea ice extent decreased by 13% per decade since 1979" }
              ]
            }
          };
        }
      } else {
        return { ok: false, hint: `No results found for '${query}'. Try more specific terms.` };
      }
    } else if (scenario === 'data_analysis') {
      const dataset = args.dataset;
      const operation = args.operation;
      if (dataset === "user_metrics" && operation === "trend") {
        return {
          ok: true,
          data: {
            trend: "upward",
            growth_rate: "15% monthly",
            key_metric: "Daily Active Users: 50,000"
          }
        };
      } else {
        return { ok: false, hint: `Try 'trend' analysis for 'user_metrics' dataset` };
      }
    } else if (scenario === 'math_tutor') {
      const equation = args.equation;
      const step = args.step;
      if (equation.includes("2x + 5 = 15")) {
        if (step === "simplify") {
          return {
            ok: true,
            data: {
              result: "2x = 10",
              explanation: "Subtracted 5 from both sides"
            }
          };
        } else if (step === "calculate") {
          return {
            ok: true,
            data: {
              result: "x = 5",
              explanation: "Divided both sides by 2"
            }
          };
        } else {
          return { ok: false, hint: "First 'simplify' the equation by moving constants" };
        }
      } else {
        return { ok: false, hint: `Try breaking down the equation with steps like 'simplify' or 'calculate'` };
      }
    }
    
    return { ok: false, hint: "Unknown tool or scenario" };
  };

  // --- Racing Functionality ---
  let raceControllers = { multiPass: null, singlePass: null };
  let isRacing = false;
  
  const startRace = async () => {
    const prompt = promptInput.value;
    const scenario = scenarioSelect.value;
    
    // Reset race state
    resetRaceState();
    
    // Update UI for racing state
    isRacing = true;
    runButton.disabled = true;
    runButton.textContent = 'Racing...';
    
    // Create abort controllers for cancellation
    raceControllers.multiPass = new AbortController();
    raceControllers.singlePass = new AbortController();
    
    try {
      // Start both agents simultaneously
      const multiPassPromise = runRaceAgent(prompt, 'multi_pass', scenario, raceControllers.multiPass.signal);
      const singlePassPromise = runRaceAgent(prompt, 'single_pass', scenario, raceControllers.singlePass.signal);
      
      const results = await Promise.allSettled([multiPassPromise, singlePassPromise]);
      
      // Only show results if race wasn't cancelled
      if (isRacing) {
        showRaceResults(results);
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Race error:', error);
      }
    } finally {
      stopRace();
    }
  };
  
  const stopRace = (cancelled = false) => {
    if (isRacing && cancelled) {
      // Cancel both agents
      if (raceControllers.multiPass) raceControllers.multiPass.abort();
      if (raceControllers.singlePass) raceControllers.singlePass.abort();
      
      // Update status to cancelled only if actually cancelled
      document.getElementById('multi-pass-status').textContent = 'Cancelled';
      document.getElementById('single-pass-status').textContent = 'Cancelled';
    }
    
    // Reset UI state
    isRacing = false;
    runButton.disabled = false;
    runButton.textContent = '🚀 Execute';
    
    // Reset controllers
    raceControllers = { multiPass: null, singlePass: null };
  };


  const runRaceAgent = async (prompt, mode, scenario, abortSignal) => {
    const startTime = performance.now();
    let metrics = { prompt_tokens: 0, completion_tokens: 0, latency: 0, llm_calls: 0 };
    const prefix = mode === 'multi_pass' ? 'multi-pass' : 'single-pass';
    let attemptCount = 0;
    let isComplete = false;
    
    const statusEl = document.getElementById(`${prefix}-status`);
    const progressEl = document.getElementById(`${prefix}-progress`);
    const progressTextEl = document.getElementById(`${prefix}-progress-text`);
    const logEl = document.getElementById(`${prefix}-log`);
    const timeEl = document.getElementById(`${prefix}-time`);
    const tokensEl = document.getElementById(`${prefix}-tokens`);
    const callsEl = document.getElementById(`${prefix}-calls`);
    
    const updateRaceUI = (phase, data = {}) => {
      // Check if cancelled
      if (abortSignal?.aborted) {
        throw new Error('Race cancelled');
      }
      
      // Better progress calculation based on actual progress
      let progress = 0;
      if (phase === 'success') {
        progress = 100;
        isComplete = true;
      } else if (phase === 'execute' || phase === 'tool_result') {
        // Each attempt represents progress towards solution
        progress = Math.min(80, attemptCount * 15 + 10);
      } else if (phase === 'propose') {
        progress = Math.min(70, attemptCount * 15);
      } else if (phase === 'patch') {
        progress = Math.min(85, attemptCount * 15 + 5);
      }
      
      progressEl.style.setProperty('--progress-width', `${progress}%`);
      progressTextEl.textContent = `${progress}%`;
      
      const elapsed = (performance.now() - startTime) / 1000;
      timeEl.textContent = `${elapsed.toFixed(1)}s`;
      const totalTokens = metrics.prompt_tokens + metrics.completion_tokens;
      tokensEl.textContent = totalTokens;
      callsEl.textContent = metrics.llm_calls;
      
      // Update cost
      const costEl = document.getElementById(`${prefix}-cost`);
      if (costEl) {
        const cost = (totalTokens * 0.00003).toFixed(4);
        costEl.textContent = `$${cost}`;
      }
      
      // Add log entry
      const entry = document.createElement('div');
      entry.className = 'log-entry';
      const timestamp = `[${elapsed.toFixed(1)}s]`;
      
      switch (phase) {
        case 'propose':
          entry.innerHTML = `${timestamp} 🧠 Thinking...`;
          statusEl.textContent = 'Thinking';
          break;
        case 'execute':
          const toolArgs = JSON.stringify(data.call?.args || {});
          entry.innerHTML = `${timestamp} ⚙️ <strong>TOOL CALL:</strong> ${data.call?.name}(${toolArgs})`;
          statusEl.textContent = 'Executing';
          break;
        case 'tool_result':
          const resultClass = data.result?.ok ? 'tool-success' : 'tool-error';
          const resultJson = JSON.stringify(data.result);
          entry.innerHTML = `${timestamp} <span class="${resultClass}">📦 <strong>TOOL RESPONSE:</strong> ${resultJson}</span>`;
          break;
        case 'patch':
          entry.innerHTML = `${timestamp} 🔧 Self-correcting...`;
          statusEl.textContent = 'Patching';
          break;
        case 'success':
          entry.innerHTML = `${timestamp} ✅ Complete!`;
          statusEl.textContent = 'Complete';
          statusEl.className = 'agent-status agent-status-success';
          break;
        case 'error':
          entry.innerHTML = `${timestamp} ❌ Error: ${data.message}`;
          statusEl.textContent = 'Error';
          statusEl.className = 'agent-status agent-status-error';
          break;
      }
      
      logEl.appendChild(entry);
      logEl.scrollTop = logEl.scrollHeight;
    };
    
    try {
      // Use real WebLLM execution
      if (mode === 'multi_pass') {
        await runWebLLMAgent(prompt, 'multi_pass', scenario, metrics, updateRaceUI, abortSignal, () => attemptCount++);
      } else {
        await runWebLLMAgent(prompt, 'single_pass', scenario, metrics, updateRaceUI, abortSignal, () => attemptCount++);
      }
      
      metrics.latency = (performance.now() - startTime) / 1000;
      return { mode, metrics, success: true };
    } catch (error) {
      if (error.message === 'Race cancelled' || abortSignal?.aborted) {
        return { mode, metrics, success: false, cancelled: true };
      }
      updateRaceUI('error', { message: error.message });
      return { mode, metrics, success: false, error };
    }
  };

  const simulateMultiPassRace = async (prompt, scenario, metrics, updateUI, abortSignal, incrementAttempt) => {
    let attemptNumber = 0;
    let lastHint = null;
    
    while (true) {
      if (abortSignal?.aborted) throw new Error('Race cancelled');
      
      attemptNumber++;
      incrementAttempt();
      updateUI('propose');
      await sleep(800 + Math.random() * 400); // Variable delay
      
      if (abortSignal?.aborted) throw new Error('Race cancelled');
      
      metrics.llm_calls += 1;
      metrics.prompt_tokens += 150;
      metrics.completion_tokens += 50;
      
      // Learn from previous failures
      const toolCall = { 
        name: getToolForScenario(scenario), 
        args: getSmartArgsForScenario(scenario, attemptNumber, lastHint) 
      };
      updateUI('execute', { call: toolCall });
      await sleep(500 + Math.random() * 300);
      
      if (abortSignal?.aborted) throw new Error('Race cancelled');
      
      const result = simulateToolCall(toolCall, scenario);
      updateUI('tool_result', { result });
      
      // Save hint for next attempt
      if (!result.ok && result.hint) {
        lastHint = result.hint;
      }
      
      if (result.ok) {
        updateUI('propose');
        await sleep(600 + Math.random() * 400);
        
        if (abortSignal?.aborted) throw new Error('Race cancelled');
        
        metrics.llm_calls += 1; // Separate final call
        metrics.prompt_tokens += 100;
        metrics.completion_tokens += 30;
        updateUI('success');
        return;
      } else {
        await sleep(300);
      }
    }
  };

  const simulateSinglePassRace = async (prompt, scenario, metrics, updateUI, abortSignal, incrementAttempt) => {
    let attemptNumber = 0;
    let lastHint = null;
    
    while (true) {
      if (abortSignal?.aborted) throw new Error('Race cancelled');
      
      attemptNumber++;
      incrementAttempt();
      updateUI('propose');
      await sleep(600 + Math.random() * 200); // Faster due to KV cache
      
      if (abortSignal?.aborted) throw new Error('Race cancelled');
      
      metrics.llm_calls += 1;
      metrics.prompt_tokens += 120; // Lower due to context reuse
      metrics.completion_tokens += 45;
      
      // Learn from previous failures
      const toolCall = { 
        name: getToolForScenario(scenario), 
        args: getSmartArgsForScenario(scenario, attemptNumber, lastHint) 
      };
      updateUI('execute', { call: toolCall });
      await sleep(400 + Math.random() * 200);
      
      if (abortSignal?.aborted) throw new Error('Race cancelled');
      
      const result = simulateToolCall(toolCall, scenario);
      updateUI('tool_result', { result });
      
      // Save hint for next attempt
      if (!result.ok && result.hint) {
        lastHint = result.hint;
      }
      
      if (result.ok) {
        // Single-pass continues in same context
        await sleep(200);
        
        if (abortSignal?.aborted) throw new Error('Race cancelled');
        
        metrics.completion_tokens += 25; // Less tokens for final answer
        updateUI('success');
        return;
      } else {
        updateUI('patch');
        await sleep(100); // Faster recovery
      }
    }
  };

  const getToolForScenario = (scenario) => {
    const tools = {
      sql: 'sql_query',
      research: 'web_search',
      data_analysis: 'analyze_data',
      math_tutor: 'solve_equation'
    };
    return tools[scenario] || 'sql_query';
  };

  const getArgsForScenario = (scenario) => {
    const args = {
      sql: { column: 'conversions' },
      research: { query: 'climate change' },
      data_analysis: { dataset: 'user_metrics', operation: 'summary' },
      math_tutor: { equation: '2x + 5 = 15', step: 'isolate' }
    };
    return args[scenario] || { column: 'conversions' };
  };

  // Smart version that learns from hints
  const getSmartArgsForScenario = (scenario, attemptNumber, lastHint) => {
    if (scenario === 'sql') {
      if (attemptNumber === 1) {
        return { column: 'conversions' }; // First attempt - will fail
      } else if (lastHint && lastHint.includes("'convs'")) {
        return { column: 'convs' }; // Learn from hint
      } else {
        return { column: 'conversions' }; // Fallback
      }
    } else if (scenario === 'research') {
      if (attemptNumber === 1) {
        return { query: 'climate change' }; // First attempt - will fail
      } else if (lastHint && lastHint.includes('recent')) {
        return { query: 'recent climate change data' }; // Learn from hint
      } else {
        return { query: 'climate change' }; // Fallback
      }
    } else if (scenario === 'data_analysis') {
      if (attemptNumber === 1) {
        return { dataset: 'user_metrics', operation: 'summary' }; // First attempt - will fail
      } else if (lastHint && lastHint.includes('trend')) {
        return { dataset: 'user_metrics', operation: 'trend' }; // Learn from hint
      } else {
        return { dataset: 'user_metrics', operation: 'summary' }; // Fallback
      }
    } else if (scenario === 'math_tutor') {
      if (attemptNumber === 1) {
        return { equation: '2x + 5 = 15', step: 'isolate' }; // First attempt - will fail
      } else if (lastHint && lastHint.includes('simplify')) {
        return { equation: '2x + 5 = 15', step: 'simplify' }; // Learn from hint
      } else {
        return { equation: '2x + 5 = 15', step: 'isolate' }; // Fallback
      }
    }
    
    // Default fallback
    return getArgsForScenario(scenario);
  };

  const showRaceResults = (results) => {
    raceResults.classList.remove('hidden');
    
    const multiResult = results[0].status === 'fulfilled' ? results[0].value : null;
    const singleResult = results[1].status === 'fulfilled' ? results[1].value : null;
    
    if (multiResult && singleResult) {
      const speedAdvantage = ((multiResult.metrics.latency - singleResult.metrics.latency) / multiResult.metrics.latency * 100).toFixed(1);
      const tokenSavings = ((multiResult.metrics.prompt_tokens + multiResult.metrics.completion_tokens) - (singleResult.metrics.prompt_tokens + singleResult.metrics.completion_tokens));
      const costSavings = (tokenSavings * 0.00001 * 1000).toFixed(2); // Rough cost estimate
      
      document.getElementById('winner-announcement').innerHTML = 
        singleResult.metrics.latency < multiResult.metrics.latency 
          ? '🚀 Single-Pass Wins!' 
          : '🐌 Multi-Pass Wins!';
      
      document.getElementById('speed-advantage').textContent = `${speedAdvantage}% faster`;
      document.getElementById('token-efficiency').textContent = `${tokenSavings} tokens saved`;
      document.getElementById('cost-savings').textContent = `$${costSavings} saved per 1K runs`;
    }
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // --- Uncertainty Analysis Functions ---
  const startUncertaintyAnalysis = async () => {
    const prompt = promptInput.value;
    const scenario = scenarioSelect.value;
    
    // Reset uncertainty UI
    resetUncertaintyUI();
    
    // Update main button state
    runButton.disabled = true;
    runButton.textContent = 'Analyzing...';
    
    try {
      // Always run single response analysis (simplified)
      await runSingleResponseAnalysis(prompt, scenario);
    } catch (error) {
      console.error('Uncertainty analysis error:', error);
      updateUncertaintyLog('error', `Analysis failed: ${error.message}`);
    } finally {
      runButton.disabled = false;
      runButton.textContent = '🚀 Execute';
    }
  };

  const resetUncertaintyUI = () => {
    // Add null checks to prevent errors
    const uncertaintyStatus = document.getElementById('uncertainty-status');
    const heatmapText = document.getElementById('heatmap-text');
    const confidenceBar = document.getElementById('confidence-bar');
    const confidenceValue = document.getElementById('confidence-value');
    const entropyValue = document.getElementById('entropy-value');
    const logprobValue = document.getElementById('logprob-value');
    const perplexityValue = document.getElementById('perplexity-value');
    const selfScoreValue = document.getElementById('self-score-value');
    const uncertaintyLog = document.getElementById('uncertainty-log');
    const variantSection = document.getElementById('variant-section');
    
    if (!uncertaintyStatus || !heatmapText || !confidenceBar) {
      console.warn('Uncertainty UI elements not found - skipping reset');
      return;
    }
    
    uncertaintyStatus.textContent = 'Analyzing...';
    heatmapText.innerHTML = 'Analyzing token-level confidence...';
    
    // Reset ASCII bar to empty
    confidenceBar.textContent = '[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]';
    
    if (confidenceValue) confidenceValue.textContent = '--';
    if (entropyValue) entropyValue.textContent = '--';
    if (logprobValue) logprobValue.textContent = '--';
    if (perplexityValue) perplexityValue.textContent = '--';
    if (selfScoreValue) selfScoreValue.textContent = '--';
    if (uncertaintyLog) uncertaintyLog.innerHTML = '<div class="log-ready">Starting uncertainty analysis...</div>';
    if (variantSection) variantSection.classList.add('hidden');
  };

  const setUncertaintyIdle = () => {
    // Add null checks to prevent errors during initialization
    const uncertaintyStatus = document.getElementById('uncertainty-status');
    const heatmapText = document.getElementById('heatmap-text');
    const confidenceBar = document.getElementById('confidence-bar');
    const confidenceValue = document.getElementById('confidence-value');
    const entropyValue = document.getElementById('entropy-value');
    const logprobValue = document.getElementById('logprob-value');
    const perplexityValue = document.getElementById('perplexity-value');
    const selfScoreValue = document.getElementById('self-score-value');
    const uncertaintyLog = document.getElementById('uncertainty-log');
    const variantSection = document.getElementById('variant-section');
    
    if (!uncertaintyStatus || !heatmapText || !confidenceBar) {
      console.warn('Uncertainty UI elements not found - skipping idle state setup');
      return;
    }
    
    uncertaintyStatus.textContent = 'Idle';
    heatmapText.innerHTML = `
      <span class="token token-confidence-high" title="Demo: High confidence">[Demo]</span>
      <span class="token token-confidence-very-high" title="Demo: High confidence">Model</span>
      <span class="token token-confidence-good" title="Demo: Good confidence">uncertainty</span>
      <span class="token token-confidence-medium" title="Demo: Medium confidence">analysis</span>
      <span class="token token-confidence-low" title="Demo: Low confidence">visualizes</span>
      <span class="token token-confidence-very-low" title="Demo: Very low confidence">token-level</span>
      <span class="token token-confidence-very-high" title="Demo: High confidence">confidence...</span>
    `;
    
    // Update ASCII bar - it's text content, not width
    confidenceBar.textContent = '[████████████████████████░░░░░░]';
    confidenceBar.classList.add('demo-opacity');
    
    if (confidenceValue) {
      confidenceValue.textContent = '75%';
      confidenceValue.classList.add('metrics-loading');
    }
    if (entropyValue) {
      entropyValue.textContent = '1.45';
      entropyValue.classList.add('metrics-loading');
    }
    if (logprobValue) {
      logprobValue.textContent = '-2.31';
      logprobValue.classList.add('metrics-loading');
    }
    if (perplexityValue) {
      perplexityValue.textContent = '3.82';
      perplexityValue.classList.add('metrics-loading');
    }
    if (selfScoreValue) {
      selfScoreValue.textContent = '0.72';
      selfScoreValue.classList.add('metrics-loading');
    }
    if (uncertaintyLog) {
      uncertaintyLog.innerHTML = `
        <div class="log-ready">Idle - ready to execute...</div>
        <div class="log-entry" style="opacity: 0.3">[Demo] 🔍 Analyzing model confidence...</div>
        <div class="log-entry log-response" style="opacity: 0.3">[Demo] 💬 Token perplexity calculated</div>
        <div class="log-entry" style="opacity: 0.3">[Demo] ✅ Analysis complete!</div>
      `;
    }
    if (variantSection) {
      variantSection.classList.add('hidden');
    }
  };

  const runSingleResponseAnalysis = async (prompt, scenario) => {
    updateUncertaintyLog('info', 'Running single response analysis...');
    
    // Use existing WebLLM or simulate if not available
    if (modelLoaded && webllmEngine) {
      await runWebLLMUncertaintyAnalysis(prompt, scenario);
    } else {
      await simulateUncertaintyAnalysis(prompt, scenario);
    }
  };

  const runMultiSampleAnalysis = async (prompt, scenario) => {
    updateUncertaintyLog('info', 'Running multi-sample analysis (N=5)...');
    document.getElementById('variant-section').classList.remove('hidden');
    
    // Simulate multiple responses and semantic entropy calculation
    await simulateMultiSampleAnalysis(prompt, scenario);
  };

  async function runWebLLMUncertaintyAnalysis(prompt, scenario) {
    const systemPrompt = getSystemPromptForScenario(scenario);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    updateUncertaintyLog('info', 'Generating response with logprobs...');

    // Clear existing heatmap
    const heatmapElement = document.getElementById('heatmap-text');
    heatmapElement.innerHTML = '';

    const chunks = await webllmEngine.chat.completions.create({
      messages,
      temperature: 0.1,
      stream: true,
      logprobs: true,
      top_logprobs: 1  // Request at least one for confidence
    });

    let fullResponse = '';
    let tokens = [];
    let logprobs = [];

    for await (const chunk of chunks) {
      const delta = chunk.choices[0]?.delta;
      if (delta?.content) {
        fullResponse += delta.content;
        tokens.push(delta.content);
        if (delta.logprobs) {
          logprobs.push(delta.logprobs);
        }
        appendTokenToHeatmap(delta.content, delta.logprobs);
      }
    }

    updateUncertaintyLog('response', fullResponse);

    // After streaming, compute and update sequence metrics
    updateSequenceLevelMetrics(tokens, logprobs);

    document.getElementById('uncertainty-status').textContent = 'Complete';
  }

  function appendTokenToHeatmap(token, logprobs) {
    const heatmapElement = document.getElementById('heatmap-text');
    const span = document.createElement('span');
    
    // Check if token is punctuation
    const isPunctuation = /^[.,!?;:\-—'"()[\]{}]+$/.test(token.trim());
    
    span.textContent = token;

    let confidence = 0.5; // Default middle confidence
    let logprob = Math.log(confidence);

    if (logprobs && logprobs.content && logprobs.content.length > 0) {
      logprob = logprobs.content[0].logprob;
      confidence = Math.exp(logprob);
    } else {
      // Fallback simulation
      confidence = 0.3 + Math.random() * 0.7;
      logprob = Math.log(confidence);
    }

    // Assign class based on confidence level
    if (isPunctuation) {
      span.className = 'token token-punctuation';
    } else if (confidence > 0.7) {
      span.className = 'token token-high-confidence';
    } else if (confidence > 0.4) {
      span.className = 'token token-medium-confidence';
    } else {
      span.className = 'token token-low-confidence';
    }

    // Add tooltip with confidence info
    span.title = `${(confidence * 100).toFixed(1)}% confidence (logprob: ${logprob.toFixed(3)})`;

    heatmapElement.appendChild(span);

    // Smooth scroll to show new tokens
    const container = heatmapElement.closest('.heatmap-container');
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  const simulateUncertaintyAnalysis = async (prompt, scenario) => {
    // Simulate analysis for demo purposes
    updateUncertaintyLog('info', 'Generating response...');
    await sleep(1000);
    
    const responses = {
      sql: "Based on our database query, we had 1,247 conversions this week, representing a 15% increase from last week.",
      research: "Recent climate research shows accelerating ice sheet loss in Antarctica, with new studies indicating a 20% faster melting rate than previously estimated.",
      data_analysis: "User engagement analysis reveals a 12% increase in daily active users, with peak activity occurring between 2-4 PM on weekdays.",
      math_tutor: "To solve 2x + 5 = 15: First, subtract 5 from both sides: 2x = 10. Then divide by 2: x = 5."
    };
    
    const response = responses[scenario] || responses.sql;
    updateUncertaintyLog('response', response);
    
    // Simulate token heatmap
    await sleep(500);
    simulateTokenHeatmap(response);
    
    // Simulate sequence metrics
    await sleep(300);
    updateSequenceLevelMetrics(response.split(/(\s+)/), []); // Simulate logprobs
    
    document.getElementById('uncertainty-status').textContent = 'Complete';
  };

  const simulateMultiSampleAnalysis = async (prompt, scenario) => {
    // Simulate 5 different responses
    const variants = generateVariants(scenario);
    
    updateUncertaintyLog('info', 'Generating 5 response variants...');
    await sleep(1500);
    
    // Calculate semantic entropy
    const semanticEntropy = 1.8 + Math.random() * 0.7;
    document.getElementById('semantic-entropy').textContent = `Semantic Entropy: ${semanticEntropy.toFixed(2)}`;
    
    // Populate variant list
    const variantList = document.getElementById('variant-list');
    variantList.innerHTML = variants.map(v => 
      `<div class="variant-item">
         <span class="variant-text">${v.text}</span>
         <span class="variant-count">${v.count}x</span>
       </div>`
    ).join('');
    
    // Set up toggle functionality
    document.getElementById('toggle-variants').addEventListener('click', () => {
      const list = document.getElementById('variant-list');
      const button = document.getElementById('toggle-variants');
      if (list.classList.contains('hidden')) {
        list.classList.remove('hidden');
        button.textContent = 'Hide Variants';
      } else {
        list.classList.add('hidden');
        button.textContent = 'Show Variants';
      }
    });
    
    updateUncertaintyLog('info', 'Multi-sample analysis complete');
  };

  const processTokenLogprobs = (logprobs) => {
    // Process actual logprobs from model
    const tokens = logprobs.content || [];
    const heatmapHTML = tokens.map(tokenData => {
      const logprob = tokenData.logprob;
      const confidence = Math.exp(logprob); // Convert to probability
      
      // Map confidence to CSS classes instead of inline styles
      const getConfidenceClass = (conf) => {
        if (conf >= 0.9) return 'token-confidence-very-high';
        if (conf >= 0.7) return 'token-confidence-high';
        if (conf >= 0.5) return 'token-confidence-good';
        if (conf >= 0.3) return 'token-confidence-medium';
        if (conf >= 0.1) return 'token-confidence-low';
        return 'token-confidence-very-low';
      };
      
      const confidenceClass = getConfidenceClass(confidence);
      return `<span class="token ${confidenceClass}" title="LogProb: ${logprob.toFixed(3)}">${tokenData.token}</span>`;
    }).join('');
    
    document.getElementById('heatmap-text').innerHTML = heatmapHTML;
  };

  const simulateTokenHeatmap = (text) => {
    // Simulate token-level confidence for demo
    const tokens = text.split(/(\s+)/);
    const heatmapHTML = tokens.map(token => {
      if (token.trim() === '') return token; // Preserve whitespace
      
      const confidence = 0.3 + Math.random() * 0.7; // Random confidence
      const logprob = Math.log(confidence);
      
      // Map confidence to CSS classes instead of inline styles
      const getConfidenceClass = (conf) => {
        if (conf >= 0.9) return 'token-confidence-very-high';
        if (conf >= 0.7) return 'token-confidence-high';
        if (conf >= 0.5) return 'token-confidence-good';
        if (conf >= 0.3) return 'token-confidence-medium';
        if (conf >= 0.1) return 'token-confidence-low';
        return 'token-confidence-very-low';
      };
      
      const confidenceClass = getConfidenceClass(confidence);
      return `<span class="token ${confidenceClass}" title="Simulated LogProb: ${logprob.toFixed(3)}">${token}</span>`;
    }).join('');
    
    document.getElementById('heatmap-text').innerHTML = heatmapHTML;
  };

  function updateSequenceLevelMetrics(tokens, logprobs) {
    // Calculate metrics
    let totalLogprob = 0;
    let totalEntropy = 0;
    let minLogprob = 0;
    let confidences = [];
    let logprobValues = [];

    for (let i = 0; i < tokens.length; i++) {
      let logprob = -2.0; // Default low confidence
      if (logprobs[i] && logprobs[i].content && logprobs[i].content.length > 0) {
        logprob = logprobs[i].content[0].logprob;
      }
      totalLogprob += logprob;
      totalEntropy += -logprob * Math.exp(logprob);
      minLogprob = Math.min(minLogprob, logprob);
      logprobValues.push(logprob);
      confidences.push(Math.exp(logprob));
    }

    const avgLogprob = totalLogprob / tokens.length;
    const avgEntropy = totalEntropy / tokens.length;
    const perplexity = Math.exp(-avgLogprob);
    const selfScore = Math.exp(avgLogprob);
    const overallConfidence = Math.exp(avgLogprob);
    
    // Calculate variance
    const variance = confidences.reduce((acc, conf) => {
      const diff = conf - overallConfidence;
      return acc + (diff * diff);
    }, 0) / confidences.length;
    
    // Calculate top-p (cumulative probability of top tokens)
    const topP = confidences.filter(c => c > 0.1).length / confidences.length;

    // Update values
    document.getElementById('confidence-value').textContent = `${(overallConfidence * 100).toFixed(1)}%`;
    document.getElementById('entropy-value').textContent = avgEntropy.toFixed(2);
    document.getElementById('logprob-value').textContent = minLogprob.toFixed(2);
    document.getElementById('perplexity-value').textContent = perplexity.toFixed(2);
    document.getElementById('self-score-value').textContent = selfScore.toFixed(2);
    document.getElementById('variance-value').textContent = variance.toFixed(3);
    document.getElementById('top-p-value').textContent = topP.toFixed(2);

    // Update ASCII confidence bar
    const barElement = document.getElementById('confidence-bar');
    if (barElement) {
      const filledBars = Math.round(overallConfidence * 32); // 32 character bar
      const emptyBars = 32 - filledBars;
      barElement.textContent = '[' + '█'.repeat(filledBars) + '░'.repeat(emptyBars) + ']';
    }

    // Update distribution chart
    const distBins = [0, 0, 0, 0, 0]; // 5 bins: 0-20%, 20-40%, etc
    confidences.forEach(conf => {
      const bin = Math.min(Math.floor(conf * 5), 4);
      distBins[bin]++;
    });

    const distBars = document.querySelectorAll('.dist-bar');
    const maxBin = Math.max(...distBins);
    distBins.forEach((count, i) => {
      const height = maxBin > 0 ? (count / maxBin) * 100 : 0;
      distBars[i].style.height = `${height}%`;
      distBars[i].className = `dist-bar dist-bar-${i + 1}`;
    });

    // Generate dynamic sparklines (simplified for now)
    updateSparklines(logprobValues);
  }

  function updateSparklines(values) {
    // This is a placeholder - in real implementation, you'd update based on historical data
    // For now, we'll just use the existing static sparklines
  }

  const updateUncertaintyLog = (type, message) => {
    const log = document.getElementById('uncertainty-log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    
    const timestamp = new Date().toLocaleTimeString();
    const icons = { info: '🔍', response: '💬', error: '❌' };
    const icon = icons[type] || 'ℹ️';
    
    entry.innerHTML = `[${timestamp}] ${icon} ${message}`;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
  };

  const getSystemPromptForScenario = (scenario) => {
    const prompts = {
      sql: "You are a SQL analysis assistant. Answer questions about database queries clearly and concisely.",
      research: "You are a research assistant. Provide accurate, well-sourced information on the requested topic.",
      data_analysis: "You are a data analyst. Interpret metrics and trends, providing clear insights.",
      math_tutor: "You are a math tutor. Solve problems step-by-step with clear explanations."
    };
    return prompts[scenario] || prompts.sql;
  };

  const generateVariants = (scenario) => {
    const variants = {
      sql: [
        { text: "We recorded 1,247 conversions this week (15% increase)", count: 3 },
        { text: "This week's conversions total 1,245 (14.8% growth)", count: 2 }
      ],
      research: [
        { text: "Antarctic ice loss accelerated 20% beyond projections", count: 2 },
        { text: "New studies show 22% faster Antarctic melting rates", count: 2 },
        { text: "Ice sheet dynamics indicate 18% acceleration in loss", count: 1 }
      ],
      data_analysis: [
        { text: "Daily active users increased 12% with 2-4 PM peak", count: 3 },
        { text: "User engagement up 11.8%, peak at 2-4 PM weekdays", count: 2 }
      ],
      math_tutor: [
        { text: "Subtract 5, then divide by 2: x = 5", count: 4 },
        { text: "2x = 10, therefore x = 5", count: 1 }
      ]
    };
    return variants[scenario] || variants.sql;
  };


  // Simplified message handling for new UI - no longer needed

  // --- App Initialization ---
  const initializeApp = async () => {
    try {
      // Check server configuration
      const configResponse = await fetch('/api/config');
      const config = await configResponse.json();
      
      console.log('Server config:', config);
      
      if (config.server_available) {
        // Server mode available - initialize WebLLM as enhancement
        console.log('Server available, initializing WebLLM as enhancement...');
        initializeWebLLM();
      } else {
        // WebLLM required mode
        console.log('Server not available, WebLLM required...');
        modelStatus.textContent = "Server not available. WebLLM required for inference.";
        initializeWebLLM();
      }
    } catch (error) {
      console.error('Failed to check server config:', error);
      // Assume WebLLM required
      initializeWebLLM();
    }
  };

  // --- Demo Mode (when WebLLM fails) ---
  window.enableDemoMode = () => {
    modelLoadingPanel.classList.add('hidden');
    
    // Show demo notice
    const demoNotice = document.createElement('div');
    demoNotice.className = 'demo-notice';
    demoNotice.innerHTML = `
      <div class="demo-notice-title">📖 Demo UI Mode</div>
      <div class="demo-notice-text">
        WebLLM is unavailable, but you can explore the interface design.<br>
        For full functionality, try a WebGPU-compatible browser.
      </div>
    `;
    document.querySelector('.main-container').insertBefore(demoNotice, document.querySelector('.agent-comparison'));
    
    // Enable button for demo purposes (shows error when clicked)
    runButton.disabled = false;
    runButton.textContent = 'Demo Mode - Click to See Error';
    runButton.className = 'run-button-demo';
  };

  // --- Initial Setup ---
  updateCodeView();
  resetRaceState();
  setUncertaintyIdle();
  
  // Check server configuration and initialize accordingly
  initializeApp();
    
  } catch (error) {
    console.error('❌ Error during SPOC-Shot initialization:', error);
    console.error('📍 Stack trace:', error.stack);
    
    // Show error to user
    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-notice';
    errorMsg.innerHTML = `
      <h3 class="error-title">⚠️ Initialization Error</h3>
      <p class="error-message">Something went wrong while loading SPOC-Shot. Please refresh the page.</p>
      <details class="error-details">
        <summary class="error-summary">Technical Details</summary>
        <pre class="error-stack">${error.message}\n\n${error.stack}</pre>
      </details>
    `;
    document.body.insertBefore(errorMsg, document.body.firstChild);
  }
});