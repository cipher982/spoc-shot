// Standalone Logit/Token Visualization
// Reuses existing visualization logic with modern Tailwind UI

import { webllmManager } from './webllm.js';
import { 
  processToken, 
  createTokenElement, 
  calculateMetrics, 
  formatMetrics 
} from './confidence-utils.js';
import { 
  CONFIDENCE_THRESHOLDS,
  CONFIDENCE_BAR_LENGTH 
} from './constants.js';

// DOM Elements
const elements = {
  loadingOverlay: document.getElementById('loading-overlay'),
  loadingStatus: document.getElementById('loading-status'),
  loadingProgress: document.getElementById('loading-progress'),
  loadingProgressText: document.getElementById('loading-progress-text'),
  promptInput: document.getElementById('prompt-input'),
  tempSlider: document.getElementById('temp-slider'),
  tempDisplay: document.getElementById('temp-display'),
  topPSlider: document.getElementById('top-p-slider'),
  topPDisplay: document.getElementById('top-p-display'),
  runButton: document.getElementById('run-button'),
  stopButton: document.getElementById('stop-button'),
  status: document.getElementById('status'),
  heatmapText: document.getElementById('heatmap-text'),
  confidenceValue: document.getElementById('confidence-value'),
  confidenceBar: document.getElementById('confidence-bar'),
  confidenceBarText: document.getElementById('confidence-bar-text'),
  entropyValue: document.getElementById('entropy-value'),
  logprobValue: document.getElementById('logprob-value'),
  perplexityValue: document.getElementById('perplexity-value'),
  varianceValue: document.getElementById('variance-value'),
  topPValue: document.getElementById('top-p-value'),
  coherenceValue: document.getElementById('coherence-value'),
  tooltip: document.getElementById('token-tooltip'),
  tooltipCandidates: document.getElementById('tooltip-candidates')
};

// State
let currentAbortController = null;
let isGenerating = false;
let allTokens = [];
let allLogprobs = [];
let activeTokenElement = null;
let generationId = 0; // Track generation attempts to prevent race conditions

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  await initializeWebLLM();
});

// Setup event listeners
function setupEventListeners() {
  // Parameter sliders
  elements.tempSlider.addEventListener('input', (e) => {
    elements.tempDisplay.textContent = e.target.value;
  });
  
  elements.topPSlider.addEventListener('input', (e) => {
    elements.topPDisplay.textContent = e.target.value;
  });

  // Run button
  elements.runButton.addEventListener('click', () => {
    if (!isGenerating) {
      startGeneration();
    }
  });

  // Stop button
  elements.stopButton.addEventListener('click', () => {
    stopGeneration();
  });

  // Enter key to generate
  elements.promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!isGenerating) {
        startGeneration();
      }
    }
  });

  // Token interactions (delegation)
  elements.heatmapText.addEventListener('mouseover', handleTokenHover);
  elements.heatmapText.addEventListener('mouseout', handleTokenMouseOut);
  elements.heatmapText.addEventListener('click', handleTokenClick);
  
  // Close tooltip on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.token') && !e.target.closest('#token-tooltip')) {
      hideTooltip();
    }
  });
  
  // Hide tooltip on scroll (but not if we're in custom input mode)
  elements.heatmapText.addEventListener('scroll', () => {
    // Check if we're currently showing the custom input
    const customInput = elements.tooltip.querySelector('input[type="text"]');
    if (!customInput) {
      hideTooltip();
    }
  });
}

// Handle token hover to show tooltip
function handleTokenHover(e) {
  const tokenEl = e.target.closest('.token');
  if (!tokenEl || !tokenEl.dataset.candidates) return;
  
  // Don't update if we're already hovering this one
  if (activeTokenElement === tokenEl && !elements.tooltip.classList.contains('hidden')) return;
  
  showTooltip(tokenEl);
}

// Handle token mouse out
function handleTokenMouseOut(e) {
  // We check relatedTarget to see where the mouse went.
  // If it went to the tooltip itself, we don't hide it (to allow clicking).
  // But if it went to the container or another element, we hide it.
  const toElement = e.relatedTarget;
  
  // If moving to the tooltip or its children, don't hide
  if (toElement && toElement.closest('#token-tooltip')) return;
  
  // If moving between tokens, handleTokenHover will pick it up, but we can hide the current one temporarily or let hover handle it
  // Ideally, we want a slight delay or just hide if it's not another token
  
  // Simple behavior: Hide unless we are over the tooltip
  // To make it user friendly for clicking, we might need a small delay or check
  
  // Actually, for the "click to branch" workflow, purely hover-based hiding is tricky because 
  // the user needs to move the mouse FROM the token TO the tooltip.
  // So we need a delay.
  
  startTooltipHideTimer();
}

let tooltipHideTimer = null;

function startTooltipHideTimer() {
  if (tooltipHideTimer) clearTimeout(tooltipHideTimer);
  tooltipHideTimer = setTimeout(() => {
    hideTooltip();
  }, 300); // 300ms delay to allow moving to tooltip
}

function cancelTooltipHideTimer() {
  if (tooltipHideTimer) {
    clearTimeout(tooltipHideTimer);
    tooltipHideTimer = null;
  }
}

// Handle token click
function handleTokenClick(e) {
  const tokenEl = e.target.closest('.token');
  if (!tokenEl || !tokenEl.dataset.candidates) return;
  
  // Click locks the tooltip (cancels hide timer) or toggles it
  cancelTooltipHideTimer();
  showTooltip(tokenEl);
}

// Show tooltip
function showTooltip(tokenEl) {
  cancelTooltipHideTimer();
  
  const candidatesData = tokenEl.dataset.candidates;
  if (!candidatesData) return;
  
  const candidates = JSON.parse(candidatesData);
  const index = parseInt(tokenEl.dataset.index);
  
  elements.tooltipCandidates.innerHTML = '';
  
  candidates.forEach(c => {
    const div = document.createElement('div');
    div.className = 'flex items-center justify-between p-2 hover:bg-[#e6e0d0] rounded cursor-pointer group transition-colors border-b border-transparent border-dashed hover:border-[#bcaaa4] last:border-0';
    
    // Colorize confidence in tooltip
    const confColor = getConfidenceColorClass(c.confidence);
    
    div.innerHTML = `
      <span class="font-serif text-[#2c1e14] text-lg group-hover:text-[#1a120b] whitespace-pre">${c.token}</span>
      <span class="text-xs ${confColor} ml-4 font-serif">${c.confidence.toFixed(1)}%</span>
    `;
    
    div.onclick = (e) => {
      e.stopPropagation(); // Prevent closing immediately
      retryGeneration(index, c.token);
    };
    
    elements.tooltipCandidates.appendChild(div);
  });
  
  // Add "Custom..." option at the bottom
  const customDiv = document.createElement('div');
  customDiv.className = 'flex items-center justify-between p-2 hover:bg-[#e6e0d0] rounded cursor-pointer group transition-colors border-t-2 border-[#d4c5b0] mt-1 pt-2';
  customDiv.innerHTML = `
    <span class="font-serif text-[#5c4d3c] text-lg group-hover:text-[#1a120b]">✏️ Custom word...</span>
    <span class="text-xs text-[#8c735a] ml-4 font-serif italic">type</span>
  `;
  
  customDiv.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    // Don't let any other handlers run
    cancelTooltipHideTimer();
    // Show custom input without any chance of interference
    setTimeout(() => showCustomInput(index), 0);
  };
  
  elements.tooltipCandidates.appendChild(customDiv);
  
  // Position tooltip
  const rect = tokenEl.getBoundingClientRect();
  // Check for overflow on right edge
  const tooltipWidth = 250; // approx
  let left = rect.left;
  if (left + tooltipWidth > window.innerWidth) {
    left = window.innerWidth - tooltipWidth - 20;
  }
  
  elements.tooltip.style.left = `${left}px`;
  elements.tooltip.style.top = `${rect.bottom + 5}px`;
  elements.tooltip.classList.remove('hidden');
  
  activeTokenElement = tokenEl;
  
  // Ensure tooltip keeps itself open on hover
  elements.tooltip.onmouseover = cancelTooltipHideTimer;
  elements.tooltip.onmouseout = startTooltipHideTimer;
}

function hideTooltip() {
  if (elements.tooltip) elements.tooltip.classList.add('hidden');
  activeTokenElement = null;
}

// Show custom input field in tooltip
function showCustomInput(index) {
  // Make absolutely sure we're not hiding the tooltip
  cancelTooltipHideTimer();
  
  // Also ensure tooltip is visible
  if (elements.tooltip.classList.contains('hidden')) {
    elements.tooltip.classList.remove('hidden');
  }
  
  // Store the current height to prevent shrinking
  const currentHeight = elements.tooltip.offsetHeight;
  
  elements.tooltipCandidates.innerHTML = '';
  
  // Create input container
  const container = document.createElement('div');
  container.className = 'p-3';
  
  // Set minimum height to prevent tooltip from shrinking
  container.style.minHeight = (currentHeight - 40) + 'px'; // Subtract some padding
  
  // Input label
  const label = document.createElement('div');
  label.className = 'text-xs text-[#5c4d3c] font-serif mb-2';
  label.textContent = 'Type your alternative:';
  container.appendChild(label);
  
  // Text input
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'w-full px-2 py-1 border border-[#d4c5b0] rounded text-[#2c1e14] font-serif text-base focus:outline-none focus:border-[#8c735a] bg-[#fffef8]';
  input.placeholder = 'Enter word...';
  container.appendChild(input);
  
  // Token preview
  const preview = document.createElement('div');
  preview.className = 'text-xs text-[#8c735a] font-mono mt-2 italic';
  preview.textContent = 'Tokens: []';
  container.appendChild(preview);
  
  // Buttons container
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'flex gap-2 mt-3';
  
  // Apply button
  const applyBtn = document.createElement('button');
  applyBtn.className = 'px-3 py-1 bg-[#8d6e63] hover:bg-[#6d4c41] text-white text-sm rounded font-serif transition-colors';
  applyBtn.textContent = 'Apply';
  applyBtn.onclick = () => {
    const text = input.value.trim();
    if (text) {
      applyCustomToken(index, text);
    }
  };
  buttonContainer.appendChild(applyBtn);
  
  // Cancel button
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'px-3 py-1 bg-[#d4c5b0] hover:bg-[#bcaaa4] text-[#5c4d3c] text-sm rounded font-serif transition-colors';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.onclick = () => {
    hideTooltip();
  };
  buttonContainer.appendChild(cancelBtn);
  
  container.appendChild(buttonContainer);
  elements.tooltipCandidates.appendChild(container);
  
  // Update preview as user types
  input.oninput = async () => {
    const text = input.value;
    if (text) {
      try {
        // Tokenize the input to show preview
        const tokens = await tokenizeText(text);
        preview.textContent = `Tokens: ${JSON.stringify(tokens)} (${tokens.length})`;
      } catch (err) {
        preview.textContent = `Error: ${err.message}`;
        console.error('[Tokenize Preview] Failed:', err);
      }
    } else {
      preview.textContent = 'Tokens: []';
    }
  };
  
  // Handle Enter key
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      applyBtn.click();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      cancelBtn.click();
    }
  };
  
  // Focus input
  setTimeout(() => input.focus(), 50);
}

// Helper for tooltip colors (Old Book Theme)
function getConfidenceColorClass(conf) {
  if (conf >= 90) return 'text-[#1a1a1a] font-bold'; // Deep ink
  if (conf >= 70) return 'text-[#4a2c1d] font-semibold'; // Brown ink
  if (conf >= 50) return 'text-[#8d6e63]'; // Faded brown
  if (conf >= 30) return 'text-[#a14545] italic'; // Rust
  return 'text-[#c62828] italic font-bold'; // Blood red
}

// Tokenize text using the engine
async function tokenizeText(text) {
  if (!webllmManager.engine) {
    throw new Error('Engine not initialized');
  }
  
  try {
    // WebLLM stores the pipeline in a Map by model ID
    const pipeline = webllmManager.engine.loadedModelIdToPipeline.values().next().value;
    if (!pipeline || !pipeline.tokenizer) {
      throw new Error('Pipeline or tokenizer not found');
    }
    
    // Encode the text to token IDs
    const encoded = await pipeline.tokenizer.encode(text, false, false);
    
    // Decode each token ID back to its string representation
    const tokens = [];
    for (let i = 0; i < encoded.length; i++) {
      const decoded = await pipeline.tokenizer.decode(Int32Array.from([encoded[i]]), false, false);
      tokens.push(decoded);
    }
    
    return tokens;
  } catch (err) {
    console.error('[Tokenize] Error:', err);
    throw err;
  }
}

// Apply custom token(s)
async function applyCustomToken(index, text) {
  hideTooltip();
  
  // Tokenize the custom text
  const tokens = await tokenizeText(text);
  console.log(`[Custom] User typed: "${text}" → Tokens:`, tokens);
  
  if (tokens.length === 0) return;
  
  // Similar to retryGeneration but potentially with multiple tokens
  if (isGenerating) {
    console.log('[Custom] Stopping current generation before applying');
    await stopGeneration();
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  generationId++;
  
  // Keep everything before the clicked position
  const keptTokens = allTokens.slice(0, index);
  const keptLogprobs = allLogprobs.slice(0, index);
  
  console.log('[Custom] Kept tokens:', keptTokens);
  console.log('[Custom] Injecting tokens:', tokens);
  
  // For multi-token injection, we'll insert all tokens
  // The first token gets the original logprobs structure (preserving candidates)
  // Additional tokens get null logprobs
  const originalLogprobObj = allLogprobs[index];
  let firstTokenLogprobs = null;
  
  if (originalLogprobObj && originalLogprobObj.content && originalLogprobObj.content[0]) {
    firstTokenLogprobs = JSON.parse(JSON.stringify(originalLogprobObj));
    firstTokenLogprobs.content[0].token = tokens[0];
    // We don't have the exact logprob for custom text, so we'll leave it as is
    // This preserves the candidates list for further branching
  }
  
  // Update state with all new tokens
  allTokens = [...keptTokens, ...tokens];
  allLogprobs = [...keptLogprobs, firstTokenLogprobs, ...new Array(tokens.length - 1).fill(null)];
  
  console.log('[Custom] New token history:', allTokens);
  console.log('[Custom] Total tokens:', allTokens.length);
  
  // Re-render UI
  elements.heatmapText.innerHTML = '';
  allTokens.forEach((token, i) => {
    appendTokenToHeatmap(token, allLogprobs[i], i);
  });
  
  // Continue generation
  const prompt = elements.promptInput.value.trim();
  await runGenerationLoop(prompt, allTokens);
}

// Initialize WebLLM
async function initializeWebLLM() {
  try {
    updateStatus('Initializing WebLLM...', 'loading');
    if (elements.loadingOverlay) elements.loadingOverlay.classList.remove('hidden');
    
    // Dynamically import WebLLM
    const { CreateMLCEngine, prebuiltAppConfig } = await import(
      'https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@latest/+esm'
    );

    if (!('gpu' in navigator)) throw new Error('WebGPU unavailable');
    
    const selectedModel = "Hermes-3-Llama-3.1-8B-q4f16_1-MLC";
    
    const progressCallback = (report) => {
      const progress = Math.round((report.progress || 0) * 100);
      if (elements.loadingProgress) elements.loadingProgress.style.width = `${progress}%`;
      if (elements.loadingProgressText) elements.loadingProgressText.textContent = `${progress}%`;
      
      // Clean up status text if loading from cache
      let statusText = report.text || `Loading... ${progress}%`;
      if (statusText.includes('Loading model from cache')) {
        const match = statusText.match(/\[(\d+\/\d+)\]/);
        if (match) {
          statusText = `Verifying cache: ${match[1]} checked...`;
        } else if (progress === 0) {
          statusText = 'Verifying cached model...';
        }
      }
      if (elements.loadingStatus) elements.loadingStatus.textContent = statusText;
    };

    const engine = await CreateMLCEngine(selectedModel, { initProgressCallback: progressCallback });
    
    webllmManager.engine = engine;
    webllmManager.loaded = true;
    window.webllmEngine = engine;

    if (elements.loadingOverlay) elements.loadingOverlay.classList.add('hidden');
    updateStatus('Ready', 'ready');
  } catch (error) {
    console.error(error);
    updateStatus(`Error: ${error.message}`, 'error');
    if (elements.loadingOverlay) elements.loadingOverlay.classList.add('hidden');
  }
}

// Start generation (wraps internal logic)
async function startGeneration() {
  const topic = elements.promptInput.value.trim();
  if (!topic) {
    alert('Please enter a story topic');
    return;
  }
  
  // Reset state for fresh start
  allTokens = [];
  allLogprobs = [];
  elements.heatmapText.innerHTML = '';
  resetMetrics();
  
  await runGenerationLoop(topic, []);
}

// Retry generation from a specific point with a chosen token
async function retryGeneration(index, chosenToken) {
  hideTooltip();
  
  // CRITICAL: Stop any ongoing generation first
  if (isGenerating) {
    console.log('[Retry] Stopping current generation before retry');
    await stopGeneration();
    // Wait a bit for the generation to actually stop
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Increment generation ID to invalidate any in-flight tokens
  generationId++;
  
  // Slice history to keep everything BEFORE the clicked token
  // If I click token at index 5, I want tokens 0-4, then replace 5 with chosenToken
  console.log(`[Retry] Generation ${generationId}: Splice at index ${index}. Replacing with: "${chosenToken}"`);
  
  const keptTokens = allTokens.slice(0, index);
  const keptLogprobs = allLogprobs.slice(0, index);
  
  console.log('[Retry] Kept tokens:', keptTokens);
  
  // Preserve the logprobs from the original position so we keep candidates and interactivity
  let newLogprobObj = null;
  const originalLogprobObj = allLogprobs[index];
  
  if (originalLogprobObj && originalLogprobObj.content && originalLogprobObj.content[0]) {
    // Deep clone to avoid mutating history
    newLogprobObj = JSON.parse(JSON.stringify(originalLogprobObj));
    
    // Update the main token info to match our choice
    newLogprobObj.content[0].token = chosenToken;
    
    // Try to find the specific logprob for this token from candidates
    // to make the confidence score correct
    if (newLogprobObj.content[0].top_logprobs) {
      const candidate = newLogprobObj.content[0].top_logprobs.find(c => c.token === chosenToken);
      if (candidate) {
        newLogprobObj.content[0].logprob = candidate.logprob;
        // We keep top_logprobs as is - they are still valid alternatives for this position
      }
    }
  }
  
  // Update state
  allTokens = [...keptTokens, chosenToken];
  allLogprobs = [...keptLogprobs, newLogprobObj];
  
  console.log('[Retry] New token history:', allTokens);
  console.log('[Retry] Joined history text:', allTokens.join(''));
  
  // Re-render UI
  elements.heatmapText.innerHTML = '';
  allTokens.forEach((token, i) => {
    appendTokenToHeatmap(token, allLogprobs[i], i);
  });
  
  // Use original prompt
  const prompt = elements.promptInput.value.trim();
  
  // Continue generation with the same original prompt
  // The history passed to the model will include the chosen token
  await runGenerationLoop(prompt, allTokens);
}

// Removed - using completions API only, no system prompts needed

// Core generation loop
async function runGenerationLoop(topic, currentHistoryTokens) {
  if (!webllmManager.loaded) return;
  
  // Capture the current generation ID
  const thisGenerationId = generationId;
  
  console.log(`[GenLoop ${thisGenerationId}] Starting with currentHistoryTokens.length:`, currentHistoryTokens.length);
  console.log(`[GenLoop ${thisGenerationId}] Topic:`, topic);
  
  isGenerating = true;
  currentAbortController = new AbortController();
  
  console.log(`[GenLoop ${thisGenerationId}] Created new AbortController`);
  console.log(`[GenLoop ${thisGenerationId}] AbortController.signal.aborted:`, currentAbortController.signal.aborted);
  
  elements.runButton.classList.add('hidden');
  elements.stopButton.classList.remove('hidden');
  updateStatus('Generating...', 'generating');
  
  const temperature = parseFloat(elements.tempSlider.value);
  const topP = parseFloat(elements.topPSlider.value);

  try {
    const engine = webllmManager.engine;
    
    // Build prompt for completions API
    let promptText;
    if (currentHistoryTokens.length > 0) {
      // Continue from existing tokens - but we need the original context!
      // The model needs to know what kind of story it's writing
      promptText = `Write a story about ${topic}:\n\n${currentHistoryTokens.join('')}`;
    } else {
      // Initial generation - start with a prompt
      promptText = `Write a story about ${topic}:\n\n`;
    }
    
    console.log(`[GenLoop ${thisGenerationId}] Using completions API`);
    console.log(`[GenLoop ${thisGenerationId}] Prompt: "${promptText}"`);
    
    // Create completion
    const completionParams = {
      prompt: promptText,
      temperature,
      top_p: topP,
      max_tokens: 500,
      stream: true,
      logprobs: true,
      top_logprobs: 5,
      echo: false  // Don't echo the prompt back
    };
    
    console.log(`[GenLoop ${thisGenerationId}] Completion params:`, completionParams);
    
    let chunks;
    try {
      chunks = await engine.completions.create(completionParams);
      console.log(`[GenLoop ${thisGenerationId}] Chunks created successfully`);
      console.log(`[GenLoop ${thisGenerationId}] Chunks type:`, typeof chunks);
      console.log(`[GenLoop ${thisGenerationId}] Is async iterable:`, chunks && typeof chunks[Symbol.asyncIterator] === 'function');
    } catch (createError) {
      console.error(`[GenLoop ${thisGenerationId}] Failed to create chunks:`, createError);
      throw createError;
    }

    let chunkCount = 0;
    console.log(`[GenLoop ${thisGenerationId}] Starting to iterate chunks...`);
    
    // Add a timeout check
    const timeoutId = setTimeout(() => {
      console.error(`[GenLoop ${thisGenerationId}] TIMEOUT: No chunks received after 5 seconds`);
      console.error(`[GenLoop ${thisGenerationId}] Chunks object:`, chunks);
      console.error(`[GenLoop ${thisGenerationId}] thisGenerationId:`, thisGenerationId, 'vs generationId:', generationId);
      console.error(`[GenLoop ${thisGenerationId}] isGenerating:`, isGenerating);
      console.error(`[GenLoop ${thisGenerationId}] AbortController aborted:`, currentAbortController?.signal?.aborted);
      // Check if it's a non-streaming response
      if (chunks && chunks.choices) {
        console.error(`[GenLoop ${thisGenerationId}] Looks like non-streaming response:`, chunks);
      }
    }, 5000);
    
    console.log(`[GenLoop ${thisGenerationId}] About to enter for-await loop...`);
    
    try {
      for await (const chunk of chunks) {
        if (chunkCount === 0) {
          console.log(`[GenLoop ${thisGenerationId}] First chunk received!`);
          clearTimeout(timeoutId); // Clear timeout on first chunk
        }
        chunkCount++;
        
        console.log(`[GenLoop ${thisGenerationId}] Received chunk ${chunkCount}`);
        
        // Debug log for first few chunks
        if (chunkCount <= 3) {
          console.log(`[GenLoop ${thisGenerationId}] Chunk ${chunkCount} details:`, JSON.stringify(chunk, null, 2));
        }
        
        // Check if this generation has been superseded
        if (thisGenerationId !== generationId) {
          console.log(`[GenLoop ${thisGenerationId}] Cancelled - newer generation ${generationId} started`);
          break;
        }
        
        // Check for cancellation
        if (currentAbortController && currentAbortController.signal.aborted) {
          console.log(`[GenLoop ${thisGenerationId}] Aborted detected in loop`);
          break;
        }

        const choice = chunk.choices?.[0];
        if (!choice) {
          console.warn(`[GenLoop ${thisGenerationId}] No choice in chunk ${chunkCount}`);
          continue;
        }
        
        // Completions API returns content in choice.text
        const content = choice.text || '';
        const logprobs = choice.logprobs;
        
        if (content) {
          // Completions API may return multiple tokens at once
          console.log(`[GenLoop ${thisGenerationId}] Chunk ${chunkCount}: "${content}"`);
          
          // Add to state
          allTokens.push(content);
          if (logprobs) allLogprobs.push(logprobs);
          else allLogprobs.push(null);
          
          appendTokenToHeatmap(content, logprobs, allTokens.length - 1);
          updateMetrics();
        }
      }
      
      console.log(`[GenLoop ${thisGenerationId}] Finished processing ${chunkCount} chunks`);
      clearTimeout(timeoutId); // Clear timeout if we finished normally
      
    } catch (iterError) {
      console.error(`[GenLoop ${thisGenerationId}] Error in chunk iteration:`, iterError);
      clearTimeout(timeoutId); // Clear timeout on error
      throw iterError;
    }
    
    // Only update status if this is still the current generation
    if (thisGenerationId === generationId) {
      updateStatus('Complete', 'complete');
    }
    
  } catch (error) {
    // Only show error if this is still the current generation
    if (thisGenerationId === generationId) {
      if (error.name === 'AbortError') {
        updateStatus('Cancelled', 'cancelled');
      } else {
        console.error(`Generation ${thisGenerationId} error:`, error);
        updateStatus(`Error: ${error.message}`, 'error');
      }
    }
  } finally {
    // Only update UI if this is still the current generation
    if (thisGenerationId === generationId) {
      isGenerating = false;
      elements.runButton.classList.remove('hidden');
      elements.stopButton.classList.add('hidden');
    }
  }
}

// Stop generation
async function stopGeneration() {
  console.log('[stopGeneration] Called');
  if (currentAbortController) {
    console.log('[stopGeneration] Aborting controller');
    currentAbortController.abort();
    currentAbortController = null;
  }
  
  // Explicitly interrupt the engine to ensure it stops processing
  if (webllmManager.engine && typeof webllmManager.engine.interruptGenerate === 'function') {
    try {
      console.log('[stopGeneration] Calling engine.interruptGenerate()');
      await webllmManager.engine.interruptGenerate();
      console.log('[stopGeneration] Engine interrupted successfully');
    } catch (err) {
      console.warn('[stopGeneration] Error interrupting engine:', err);
    }
  }
  
  isGenerating = false;
}

// Append token to heatmap
function appendTokenToHeatmap(token, logprobs, index) {
  const element = createTokenElement(token, logprobs, index);
  elements.heatmapText.appendChild(element);
  elements.heatmapText.scrollTop = elements.heatmapText.scrollHeight;
}

// Update metrics
function updateMetrics() {
  if (allLogprobs.length === 0) return;
  const metrics = calculateMetrics(allLogprobs, allTokens);
  const formatted = formatMetrics(metrics);

  // Update confidence
  const confidencePercent = (metrics.confidence * 100).toFixed(1);
  elements.confidenceValue.textContent = `${confidencePercent}%`;
  elements.confidenceBar.style.width = `${metrics.confidence * 100}%`;

  // Update confidence bar text
  const filledBars = Math.round(metrics.confidence * CONFIDENCE_BAR_LENGTH);
  const emptyBars = CONFIDENCE_BAR_LENGTH - filledBars;
  elements.confidenceBarText.textContent = '█'.repeat(filledBars) + '░'.repeat(emptyBars);

  // Update other metrics
  elements.entropyValue.textContent = formatted.entropy;
  elements.logprobValue.textContent = formatted.logprob;
  elements.perplexityValue.textContent = formatted.perplexity;
  elements.varianceValue.textContent = formatted.variance;
  elements.topPValue.textContent = formatted.topP;
  elements.coherenceValue.textContent = formatted.coherence;
}

// Reset metrics
function resetMetrics() {
  elements.confidenceValue.textContent = '--';
  elements.confidenceBar.style.width = '0%';
  elements.confidenceBarText.textContent = '░'.repeat(CONFIDENCE_BAR_LENGTH);
  elements.entropyValue.textContent = '--';
  elements.logprobValue.textContent = '--';
  elements.perplexityValue.textContent = '--';
  elements.varianceValue.textContent = '--';
  elements.topPValue.textContent = '--';
  elements.coherenceValue.textContent = '--';
}

// Update status
function updateStatus(text, type = 'ready') {
  elements.status.textContent = text;
  elements.status.className = 'px-3 py-1 rounded-full text-sm font-medium';
  
  switch (type) {
    case 'loading':
      elements.status.classList.add('bg-blue-500/30', 'text-blue-200');
      break;
    case 'generating':
      elements.status.classList.add('bg-yellow-500/30', 'text-yellow-200');
      break;
    case 'complete':
      elements.status.classList.add('bg-green-500/30', 'text-green-200');
      break;
    case 'error':
      elements.status.classList.add('bg-red-500/30', 'text-red-200');
      break;
    case 'cancelled':
      elements.status.classList.add('bg-gray-500/30', 'text-gray-200');
      break;
    default:
      elements.status.classList.add('bg-purple-500/30', 'text-purple-200');
  }
}
