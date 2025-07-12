// SPOC-Shot Demo JavaScript
import { LiveMetricsAnalyzer } from './analysis.js';

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 DOMContentLoaded fired - initializing SPOC-Shot');
  
  try {
    const runButton = document.getElementById('run-button');
    
    console.log('🔍 Element check:', {
      runButton: !!runButton
    });
  const scenarioSelect = document.getElementById('scenario-select');
  const promptInput = document.getElementById('prompt-input');

  // Slider elements
  const tempSlider = document.getElementById('temp-slider');
  const tempDisplay = document.getElementById('temp-display');
  const topPSlider = document.getElementById('top-p-slider');
  const topPDisplay = document.getElementById('top-p-display');

  // Setup slider event listeners for real-time display updates
  if (tempSlider && tempDisplay) {
    tempSlider.addEventListener('input', (e) => {
      tempDisplay.textContent = e.target.value;
    });
  }

  if (topPSlider && topPDisplay) {
    topPSlider.addEventListener('input', (e) => {
      topPDisplay.textContent = e.target.value;
    });
  }

  // No additional elements needed for simplified layout

  // WebLLM elements
  const modelLoadingPanel = document.getElementById('model-loading-panel');
  const modelStatus = document.getElementById('model-status');
  const modelProgressText = document.getElementById('model-progress-text');
  const modelProgressBar = document.getElementById('model-progress-bar');

  // --- State Management ---
  let currentScenario = 'creative_writer';
  let webllmEngine = null;
  let modelLoaded = false;
  
  // --- Utility Functions ---
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Scenario configurations
  const scenarioPrompts = {
    creative_writer: "Write a short story about a robot learning to paint",
    riddle_solver: "What gets wetter the more it dries?",
    would_you_rather: "Would you rather have the ability to fly or be invisible?",
    quick_brainstorm: "Give me 5 creative uses for a paperclip",
    story_continues: "It was a dark and stormy night when suddenly..."
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
        const progress = Math.round((report.progress || 0) * 100);
        modelProgressText.textContent = `${progress}%`;
        modelProgressBar.style.setProperty('--progress-width', `${progress}%`);
        modelStatus.textContent = report.text || `Loading model... ${progress}%`;
      };

      webllmEngine = await CreateMLCEngine(selectedModel, { initProgressCallback });
      
      // Make WebLLM engine globally available
      window.webllmEngine = webllmEngine;
      window.modelLoaded = true;
      
      // Update uncertainty tab status
      const uncertaintyStatus = document.getElementById('uncertainty-status');
      if (uncertaintyStatus) {
        uncertaintyStatus.textContent = 'WebLLM Ready';
        uncertaintyStatus.style.color = '';
      }
      
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
      console.log('🚀 Execute button clicked - Starting uncertainty analysis');
      startUncertaintyAnalysis();
    } catch (error) {
      console.error('❌ Error in execute button handler:', error);
      // Reset button state on error
      runButton.disabled = false;
      runButton.textContent = '🚀 Execute';
    }
  });

  // Uncertainty analysis is now handled by the main execute button

  // No additional setup needed for simplified layout

  // Simple uncertainty analysis - no more complex agent logic needed

  // No more tool execution needed for creative scenarios

  // Multi-pass logic removed - no longer needed for simple creative scenarios

  // Single-pass logic removed - no longer needed for simple creative scenarios

  // Tool simulation removed - no longer needed for creative scenarios

  const startUncertaintyAnalysis = async () => {
    const prompt = promptInput.value;
    const scenario = scenarioSelect.value;
    const temperature = parseFloat(document.getElementById('temp-slider')?.value || '0.7');
    const topP = parseFloat(document.getElementById('top-p-slider')?.value || '0.9');
    
    // Reset uncertainty UI
    resetUncertaintyUI();
    
    // Update main button state
    runButton.disabled = true;
    runButton.textContent = 'Analyzing...';
    
    try {
      // Always run single response analysis (simplified)
      await runSingleResponseAnalysis(prompt, scenario, temperature, topP);
    } catch (error) {
      console.error('Uncertainty analysis error:', error);
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
    const varianceValue = document.getElementById('variance-value');
    const topPValue = document.getElementById('top-p-value');
    const calibrationValue = document.getElementById('calibration-value');
    const coherenceValue = document.getElementById('coherence-value');
    const variantSection = document.getElementById('variant-section');
    
    if (!uncertaintyStatus || !heatmapText || !confidenceBar) {
      console.warn('Uncertainty UI elements not found - skipping idle state setup');
      return;
    }
    
    uncertaintyStatus.textContent = 'Idle';
    uncertaintyStatus.style.color = '#999';
    heatmapText.innerHTML = `<span style="color: #999; font-style: italic;">Waiting to analyze...</span>`;
    
    // Update ASCII bar - reset to empty state
    confidenceBar.textContent = '[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]';
    confidenceBar.classList.add('demo-opacity');
    
    if (confidenceValue) {
      confidenceValue.textContent = '--';
      confidenceValue.classList.add('metrics-loading');
    }
    if (entropyValue) {
      entropyValue.textContent = '--';
      entropyValue.classList.add('metrics-loading');
    }
    if (logprobValue) {
      logprobValue.textContent = '--';
      logprobValue.classList.add('metrics-loading');
    }
    if (perplexityValue) {
      perplexityValue.textContent = '--';
      perplexityValue.classList.add('metrics-loading');
    }
    if (selfScoreValue) {
      selfScoreValue.textContent = '--';
      selfScoreValue.classList.add('metrics-loading');
    }
    if (varianceValue) {
      varianceValue.textContent = '--';
      varianceValue.classList.add('metrics-loading');
    }
    if (topPValue) {
      topPValue.textContent = '--';
      topPValue.classList.add('metrics-loading');
    }
    if (calibrationValue) {
      calibrationValue.textContent = '--';
      calibrationValue.classList.add('metrics-loading');
    }
    if (coherenceValue) {
      coherenceValue.textContent = '--';
      coherenceValue.classList.add('metrics-loading');
    }
    if (variantSection) {
      variantSection.classList.add('hidden');
    }
  };

  const runSingleResponseAnalysis = async (prompt, scenario, temperature, topP) => {
    // Use existing WebLLM or simulate if not available
    if (modelLoaded && webllmEngine) {
      await runWebLLMUncertaintyAnalysis(prompt, scenario, temperature, topP);
    } else {
      await simulateUncertaintyAnalysis(prompt, scenario);
    }
  };

  const runMultiSampleAnalysis = async (prompt, scenario) => {
    document.getElementById('variant-section').classList.remove('hidden');
    
    // Simulate multiple responses and semantic entropy calculation
    await simulateMultiSampleAnalysis(prompt, scenario);
  };

  async function runWebLLMUncertaintyAnalysis(prompt, scenario, temperature = 0.7, topP = 0.9) {
    const systemPrompt = getSystemPromptForScenario(scenario);
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    // Initialize live metrics analyzer
    const liveMetrics = new LiveMetricsAnalyzer();
    liveMetrics.reset();

    try {
      // Clear existing heatmap
      const heatmapElement = document.getElementById('heatmap-text');
      heatmapElement.innerHTML = '';

      const chunks = await webllmEngine.chat.completions.create({
        messages,
        temperature: temperature,
        top_p: topP,
        stream: true,
        logprobs: true,
        top_logprobs: 1
      });

      let fullResponse = '';
      let tokens = [];
      let logprobs = [];

      for await (const chunk of chunks) {
        const choice = chunk.choices[0];
        const delta = choice?.delta;
        if (delta?.content) {
          fullResponse += delta.content;
          tokens.push(delta.content);
          
          // Logprobs are in choice.logprobs, NOT delta.logprobs
          const chunkLogprobs = choice?.logprobs;
          if (chunkLogprobs) {
            logprobs.push(chunkLogprobs);
          }
          
          appendTokenToHeatmap(delta.content, chunkLogprobs);
          
          // Calculate and update live metrics
          const currentMetrics = liveMetrics.addToken(delta.content, chunkLogprobs);
          
          // Update UI every N tokens to reduce flicker
          if (liveMetrics.shouldUpdateUI()) {
            updateLiveMetrics(currentMetrics);
          }
        }
      }

      // Final metrics update
      const finalMetrics = liveMetrics.getCurrentMetrics();
      updateLiveMetrics(finalMetrics);

      document.getElementById('uncertainty-status').textContent = 'Complete';
    } catch (error) {
      console.error('WebLLM uncertainty analysis failed:', error);
      
      // Fallback to simulation
      await simulateUncertaintyAnalysis(prompt, scenario);
    }
  }

  function appendTokenToHeatmap(token, logprobs) {
    const heatmapElement = document.getElementById('heatmap-text');
    const span = document.createElement('span');
    
    // Check if token is punctuation
    const isPunctuation = /^[.,!?;:\-—'"()[\]{}]+$/.test(token.trim());
    
    span.textContent = token;

    let confidence = 0.5; // Default middle confidence
    let logprob = Math.log(confidence);

    if (!logprobs) {
      throw new Error(`No logprobs provided for token: ${JSON.stringify(token)}`);
    }
    if (!logprobs.content || logprobs.content.length === 0) {
      throw new Error(`Invalid logprobs structure for token ${JSON.stringify(token)}: ${JSON.stringify(logprobs)}`);
    }
    
    logprob = logprobs.content[0].logprob;
    confidence = Math.exp(logprob);

    // Assign class based on confidence level
    if (isPunctuation) {
      span.className = 'token token-punctuation';
    } else if (confidence >= 0.9) {
      span.className = 'token token-confidence-very-high';
    } else if (confidence >= 0.7) {
      span.className = 'token token-confidence-high';
    } else if (confidence >= 0.5) {
      span.className = 'token token-confidence-good';
    } else if (confidence >= 0.3) {
      span.className = 'token token-confidence-medium';
    } else if (confidence >= 0.1) {
      span.className = 'token token-confidence-low';
    } else {
      span.className = 'token token-confidence-very-low';
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
    await sleep(1000);
    
    const responses = {
      creative_writer: "ARIA-7 stared at the blank canvas, servos whirring with uncertainty. For the first time in her operational cycle, she felt something beyond calculation—an urge to create something beautiful.",
      riddle_solver: "A towel! The answer is a towel. It gets wetter as it performs its function of drying other things. The more it dries, the more water it absorbs, making it progressively wetter.",
      would_you_rather: "I'd choose the ability to fly. While invisibility offers stealth and privacy, flight provides freedom, new perspectives, and the pure joy of soaring above the world's limitations.",
      quick_brainstorm: "Here are 5 creative paperclip uses: 1) Smartphone stand (bend into triangle), 2) Zipper pull replacement, 3) Bookmark with decorative twist, 4) Cable organizer for desk setup, 5) Emergency lock pick for simple locks.",
      story_continues: "It was a dark and stormy night when suddenly the lighthouse keeper spotted a mysterious ship approaching the rocky shore. Its black sails caught no wind, yet it moved with purpose through the churning waters."
    };
    
    const response = responses[scenario] || responses.creative_writer;
    
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

  function updateLiveMetrics(metrics) {
    // Update all metric displays with live values
    document.getElementById('confidence-value').textContent = `${(metrics.confidence * 100).toFixed(1)}`;
    document.getElementById('entropy-value').textContent = metrics.entropy.toFixed(2);
    document.getElementById('logprob-value').textContent = metrics.logprob.toFixed(2);
    document.getElementById('perplexity-value').textContent = metrics.perplexity.toFixed(2);
    document.getElementById('self-score-value').textContent = metrics.selfScore.toFixed(2);
    document.getElementById('variance-value').textContent = metrics.variance.toFixed(3);
    document.getElementById('top-p-value').textContent = metrics.topP.toFixed(2);
    
    // Update calibration and coherence if they exist
    const calibrationElement = document.getElementById('calibration-value');
    if (calibrationElement) {
      calibrationElement.textContent = metrics.calibration.toFixed(2);
    }
    
    const coherenceElement = document.getElementById('coherence-value');
    if (coherenceElement) {
      coherenceElement.textContent = metrics.coherence.toFixed(2);
    }

    // Update ASCII confidence bar
    const barElement = document.getElementById('confidence-bar');
    if (barElement) {
      const filledBars = Math.round(metrics.confidence * 30); // 30 character bar
      const emptyBars = 30 - filledBars;
      barElement.textContent = '█'.repeat(filledBars) + '░'.repeat(emptyBars);
    }
  }

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

    // Update distribution chart (only if elements exist)
    const distBars = document.querySelectorAll('.dist-bar');
    if (distBars.length > 0) {
      const distBins = [0, 0, 0, 0, 0]; // 5 bins: 0-20%, 20-40%, etc
      confidences.forEach(conf => {
        const bin = Math.min(Math.floor(conf * 5), 4);
        distBins[bin]++;
      });

      const maxBin = Math.max(...distBins);
      distBins.forEach((count, i) => {
        if (distBars[i]) {
          const height = maxBin > 0 ? (count / maxBin) * 100 : 0;
          distBars[i].style.height = `${height}%`;
          distBars[i].className = `dist-bar dist-bar-${i + 1}`;
        }
      });
    }

    // Generate dynamic sparklines (simplified for now)
    updateSparklines(logprobValues);
  }

  function updateSparklines(values) {
    // This is a placeholder - in real implementation, you'd update based on historical data
    // For now, we'll just use the existing static sparklines
  }


  const getSystemPromptForScenario = (scenario) => {
    const prompts = {
      creative_writer: "You are a creative writing assistant. Help users craft engaging stories, characters, and creative content.",
      riddle_solver: "You are a riddle master. Solve riddles with clear logic and explain your reasoning.",
      would_you_rather: "You are a thoughtful conversation partner. Help explore interesting hypothetical choices and their implications.",
      quick_brainstorm: "You are a creative brainstorming assistant. Generate innovative and practical ideas for various problems.",
      story_continues: "You are a storytelling assistant. Continue stories in engaging and creative ways."
    };
    return prompts[scenario] || prompts.creative_writer;
  };

  const generateVariants = (scenario) => {
    const variants = {
      creative_writer: [
        { text: "ARIA-7 stared at the blank canvas, servos whirring with uncertainty...", count: 3 },
        { text: "The old painting robot had never seen colors quite like these before...", count: 2 }
      ],
      riddle_solver: [
        { text: "A towel! It absorbs water and gets wetter as it dries other things.", count: 4 },
        { text: "The answer is a towel - it gets wetter while drying something else.", count: 1 }
      ],
      would_you_rather: [
        { text: "Flying offers freedom and exploration, while invisibility provides privacy and stealth...", count: 2 },
        { text: "I'd choose flying - the joy of soaring above the world seems incredible!", count: 2 },
        { text: "Invisibility appeals more - imagine the adventures and observations possible!", count: 1 }
      ],
      quick_brainstorm: [
        { text: "1. Lock pick 2. Zipper pull 3. Phone stand 4. Bookmark 5. Cable organizer", count: 3 },
        { text: "Jewelry making, emergency electronics repair, art projects, office tools, cleaning aid", count: 2 }
      ],
      story_continues: [
        { text: "...the lighthouse keeper spotted a mysterious ship approaching the rocky shore.", count: 3 },
        { text: "...Emma realized the old mansion held secrets far stranger than she'd imagined.", count: 2 }
      ]
    };
    return variants[scenario] || variants.creative_writer;
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