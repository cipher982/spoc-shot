// Race Controller Module
export class RaceController {
  constructor() {
    this.isRacing = false;
    this.raceControllers = { multiPass: null, singlePass: null };
    this.init();
  }

  init() {
    const runButton = document.getElementById('run-button');
    if (runButton) {
      runButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.startRace();
      });
    }

    // Initialize scenario selector
    const scenarioSelect = document.getElementById('scenario-select');
    const promptInput = document.getElementById('prompt-input');
    
    if (scenarioSelect && promptInput) {
      scenarioSelect.addEventListener('change', (e) => {
        const scenarioPrompts = {
          sql: "How many conversions did we get this week?",
          research: "What are the latest developments in climate change research?",
          data_analysis: "Analyze the user engagement trends from our metrics data",
          math_tutor: "Solve the equation: 2x + 5 = 15"
        };
        promptInput.value = scenarioPrompts[e.target.value];
      });
    }

    console.log('✅ Race controller initialized');
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
      raceResults.style.display = 'none';
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
    if (elements.progress) elements.progress.style.width = `${data.progress}%`;
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
      // Simulate agent execution
      if (mode === 'multi_pass') {
        await this.simulateMultiPassRace(prompt, scenario, metrics, updateUI, abortSignal, () => attemptCount++);
      } else {
        await this.simulateSinglePassRace(prompt, scenario, metrics, updateUI, abortSignal, () => attemptCount++);
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

  async simulateMultiPassRace(prompt, scenario, metrics, updateUI, abortSignal, incrementAttempt) {
    let attemptNumber = 0;
    let lastHint = null;
    
    while (true) {
      if (abortSignal?.aborted) throw new Error('Race cancelled');
      
      attemptNumber++;
      incrementAttempt();
      updateUI('propose');
      await this.sleep(800 + Math.random() * 400);
      
      if (abortSignal?.aborted) throw new Error('Race cancelled');
      
      metrics.llm_calls += 1;
      metrics.prompt_tokens += 150;
      metrics.completion_tokens += 50;
      
      const toolCall = { 
        name: this.getToolForScenario(scenario), 
        args: this.getSmartArgsForScenario(scenario, attemptNumber, lastHint) 
      };
      updateUI('execute', { call: toolCall });
      await this.sleep(500 + Math.random() * 300);
      
      if (abortSignal?.aborted) throw new Error('Race cancelled');
      
      const result = this.simulateToolCall(toolCall, scenario);
      updateUI('tool_result', { result });
      
      if (!result.ok && result.hint) {
        lastHint = result.hint;
      }
      
      if (result.ok) {
        updateUI('propose');
        await this.sleep(600 + Math.random() * 400);
        
        if (abortSignal?.aborted) throw new Error('Race cancelled');
        
        metrics.llm_calls += 1;
        metrics.prompt_tokens += 100;
        metrics.completion_tokens += 30;
        updateUI('success');
        return;
      } else {
        await this.sleep(300);
      }
    }
  }

  async simulateSinglePassRace(prompt, scenario, metrics, updateUI, abortSignal, incrementAttempt) {
    let attemptNumber = 0;
    let lastHint = null;
    
    while (true) {
      if (abortSignal?.aborted) throw new Error('Race cancelled');
      
      attemptNumber++;
      incrementAttempt();
      updateUI('propose');
      await this.sleep(600 + Math.random() * 200);
      
      if (abortSignal?.aborted) throw new Error('Race cancelled');
      
      metrics.llm_calls += 1;
      metrics.prompt_tokens += 120;
      metrics.completion_tokens += 45;
      
      const toolCall = { 
        name: this.getToolForScenario(scenario), 
        args: this.getSmartArgsForScenario(scenario, attemptNumber, lastHint) 
      };
      updateUI('execute', { call: toolCall });
      await this.sleep(400 + Math.random() * 200);
      
      if (abortSignal?.aborted) throw new Error('Race cancelled');
      
      const result = this.simulateToolCall(toolCall, scenario);
      updateUI('tool_result', { result });
      
      if (!result.ok && result.hint) {
        lastHint = result.hint;
      }
      
      if (result.ok) {
        await this.sleep(200);
        
        if (abortSignal?.aborted) throw new Error('Race cancelled');
        
        metrics.completion_tokens += 25;
        updateUI('success');
        return;
      } else {
        updateUI('patch');
        await this.sleep(100);
      }
    }
  }

  simulateToolCall(toolCall, scenario = 'sql') {
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
    }
    
    // Add other scenarios as needed
    return { ok: true, data: "Success" };
  }

  getToolForScenario(scenario) {
    const tools = {
      sql: 'sql_query',
      research: 'web_search',
      data_analysis: 'analyze_data',
      math_tutor: 'solve_equation'
    };
    return tools[scenario] || 'sql_query';
  }

  getSmartArgsForScenario(scenario, attemptNumber, lastHint) {
    if (scenario === 'sql') {
      if (attemptNumber === 1) {
        return { column: 'conversions' };
      } else if (lastHint && lastHint.includes("'convs'")) {
        return { column: 'convs' };
      } else {
        return { column: 'conversions' };
      }
    }
    return { column: 'conversions' };
  }

  showRaceResults(results) {
    const raceResults = document.getElementById('race-results');
    if (!raceResults) return;

    raceResults.style.display = 'block';
    
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