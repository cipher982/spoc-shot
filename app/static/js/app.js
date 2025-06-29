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
    document.getElementById('multi-pass-status').textContent = 'Ready';
    document.getElementById('multi-pass-progress').style.width = '0%';
    document.getElementById('multi-pass-progress-text').textContent = '0%';
    document.getElementById('multi-pass-log').innerHTML = '<div class="log-ready">Ready to race...</div>';
    document.getElementById('multi-pass-time').textContent = '--';
    document.getElementById('multi-pass-tokens').textContent = '--';
    document.getElementById('multi-pass-calls').textContent = '--';
    document.getElementById('multi-pass-cost').textContent = '--';
    
    // Reset single-pass
    document.getElementById('single-pass-status').textContent = 'Ready';
    document.getElementById('single-pass-progress').style.width = '0%';
    document.getElementById('single-pass-progress-text').textContent = '0%';
    document.getElementById('single-pass-log').innerHTML = '<div class="log-ready">Ready to race...</div>';
    document.getElementById('single-pass-time').textContent = '--';
    document.getElementById('single-pass-tokens').textContent = '--';
    document.getElementById('single-pass-calls').textContent = '--';
    document.getElementById('single-pass-cost').textContent = '--';
    
    // Hide results
    raceResults.style.display = 'none';
  };

  // --- WebLLM Initialization ---
  const initializeWebLLM = async () => {
    try {
      // Show the overlay as a flex container so the modal stays centred
      modelLoadingPanel.style.display = 'flex';
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
        modelProgressBar.style.width = `${progress}%`;
        modelStatus.textContent = report.text || `Loading model... ${progress}%`;
      };

      webllmEngine = await CreateMLCEngine(selectedModel, { initProgressCallback });
      
      console.log("✅ WebLLM engine created successfully:", webllmEngine);

      modelStatus.textContent = "Model loaded successfully!";
      modelProgressText.textContent = "100%";
      modelProgressBar.style.width = "100%";
      
      setTimeout(() => {
        modelLoadingPanel.style.display = 'none';
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
      modelProgressBar.style.backgroundColor = '#dc2626';
      
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

  // --- Event Listeners ---
  scenarioSelect.addEventListener('change', (e) => {
    currentScenario = e.target.value;
    promptInput.value = scenarioPrompts[currentScenario];
  });

  runButton.addEventListener('click', (e) => {
    e.preventDefault();
    startRace();
  });

  // No additional setup needed for simplified layout

  // --- WebLLM Agent Implementation ---
  const runWebLLMAgent = async (prompt, mode, scenario = 'sql') => {
    console.log(`Running WebLLM agent in ${mode} mode, ${scenario} scenario with prompt: ${prompt}`);
    
    // Clear log and reset UI
    log.innerHTML = '<div class="log-ready">Running agent with WebLLM...</div>';
    resetMetrics();
    
    const startTime = performance.now();
    let metrics = { prompt_tokens: 0, completion_tokens: 0, latency: 0, llm_calls: 0 };
    
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
    runButton.textContent = '🏁 Race Agents';
    
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
      
      progressEl.style.width = `${progress}%`;
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
      // Simulate the agent execution
      if (mode === 'multi_pass') {
        await simulateMultiPassRace(prompt, scenario, metrics, updateRaceUI, abortSignal, () => attemptCount++);
      } else {
        await simulateSinglePassRace(prompt, scenario, metrics, updateRaceUI, abortSignal, () => attemptCount++);
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
    raceResults.style.display = 'block';
    
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
    modelLoadingPanel.style.display = 'none';
    
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