// Uncertainty Analysis and Metrics Calculation
import { logger } from './utils.js';
import { webllmManager } from './webllm.js';
import { uiManager } from './ui.js';

export class UncertaintyAnalyzer {
  constructor() {
    this.previousMetrics = null;
  }

  async runAnalysis(prompt, scenario, options = {}) {
    uiManager.updateLog('info', 'Starting uncertainty analysis...');
    uiManager.updateStatus('Running');
    uiManager.showRunButton(false);
    uiManager.clearHeatmap();

    try {
      // Get WebLLM response with streaming and logprobs
      const response = await webllmManager.generateStreamingResponse(
        this.buildMessages(prompt, scenario),
        {
          temperature: options.temperature || 0.7,
          top_p: options.topP || 0.9
        },
        (token, logprobs) => {
          // Real-time token visualization
          uiManager.appendTokenToHeatmap(token, logprobs);
        }
      );

      // Calculate comprehensive metrics
      const metrics = this.calculateMetrics(response);
      
      // Update UI with results
      uiManager.updateMetrics(metrics);
      uiManager.updateLog('success', `Analysis complete! Generated ${response.tokens.length} tokens`);
      uiManager.updateStatus('Complete');
      
      // Store for delta calculations
      this.previousMetrics = { ...metrics };
      
      return { response, metrics };

    } catch (error) {
      logger.error('❌ Uncertainty analysis failed:', error);
      uiManager.updateLog('error', `Analysis failed: ${error.message}`);
      uiManager.updateStatus('Error');
      throw error;
    } finally {
      uiManager.showRunButton(true);
    }
  }

  buildMessages(prompt, scenario) {
    const systemPrompts = {
      sql: "You are a SQL expert. Provide clear, accurate SQL queries with explanations.",
      research: "You are a research assistant. Provide thorough, well-sourced information.",
      data_analysis: "You are a data analyst. Provide insightful analysis with clear methodology.",
      math_tutor: "You are a math tutor. Explain concepts step-by-step with examples."
    };

    return [
      {
        role: "system",
        content: systemPrompts[scenario] || systemPrompts.sql
      },
      {
        role: "user", 
        content: prompt
      }
    ];
  }

  calculateMetrics(response) {
    const { tokens, logprobs } = response;
    
    if (!logprobs || logprobs.length === 0) {
      return this.getDefaultMetrics();
    }

    // Extract valid logprob values
    const validLogprobs = logprobs
      .filter(lp => lp && lp.content && lp.content.length > 0)
      .map(lp => lp.content[0].logprob)
      .filter(val => !isNaN(val) && isFinite(val));

    if (validLogprobs.length === 0) {
      return this.getDefaultMetrics();
    }

    // Basic metrics
    const avgLogprob = validLogprobs.reduce((sum, val) => sum + val, 0) / validLogprobs.length;
    const minLogprob = Math.min(...validLogprobs);
    const maxLogprob = Math.max(...validLogprobs);
    
    // Derived metrics
    const perplexity = Math.exp(-avgLogprob);
    const confidence = Math.exp(Math.max(avgLogprob, -10)); // Clamp very low values
    const entropy = -avgLogprob; // Simplified entropy approximation
    
    // Variance calculation
    const variance = validLogprobs.length > 1 ? 
      validLogprobs.reduce((sum, val) => sum + Math.pow(val - avgLogprob, 2), 0) / validLogprobs.length : 0;

    // Advanced metrics
    const selfScore = this.calculateSelfScore(validLogprobs);
    const topP = this.estimateTopP(logprobs);
    const calibration = this.calculateCalibration(validLogprobs);
    const coherence = this.calculateCoherence(tokens, validLogprobs);

    return {
      confidence: Math.min(confidence, 1.0),
      entropy: entropy,
      logprob: avgLogprob,
      perplexity: Math.min(perplexity, 1000), // Cap at 1000 for display
      selfScore: selfScore,
      variance: variance,
      topP: topP,
      calibration: calibration,
      coherence: coherence,
      tokenCount: tokens.length,
      validTokens: validLogprobs.length
    };
  }

  calculateSelfScore(logprobs) {
    // Self-evaluation score based on logprob distribution
    const mean = logprobs.reduce((sum, val) => sum + val, 0) / logprobs.length;
    const consistency = logprobs.filter(val => Math.abs(val - mean) < 1.0).length / logprobs.length;
    return Math.min(consistency, 1.0);
  }

  estimateTopP(logprobs) {
    // Estimate effective top-p from logprob distribution
    if (!logprobs || logprobs.length === 0) return 0.9;
    
    // Simple approximation based on logprob variance
    const validLogprobs = logprobs
      .filter(lp => lp && lp.content && lp.content.length > 0)
      .map(lp => lp.content[0].logprob);
    
    if (validLogprobs.length === 0) return 0.9;
    
    const variance = validLogprobs.reduce((sum, val, _, arr) => {
      const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
      return sum + Math.pow(val - mean, 2);
    }, 0) / validLogprobs.length;
    
    return Math.min(0.5 + variance * 0.1, 1.0);
  }

  calculateCalibration(logprobs) {
    // Measure how well-calibrated the confidence is
    const confidences = logprobs.map(lp => Math.exp(Math.max(lp, -10)));
    const avgConfidence = confidences.reduce((sum, val) => sum + val, 0) / confidences.length;
    
    // Simple calibration measure (higher is better calibrated)
    const variance = confidences.reduce((sum, val) => sum + Math.pow(val - avgConfidence, 2), 0) / confidences.length;
    return Math.max(0, 1 - variance * 2);
  }

  calculateCoherence(tokens, logprobs) {
    // Measure semantic coherence based on token confidence patterns
    if (tokens.length < 2) return 1.0;
    
    const confidences = logprobs.map(lp => Math.exp(Math.max(lp, -10)));
    
    // Look for consistent confidence patterns (less variance = more coherent)
    let coherenceScore = 0;
    for (let i = 1; i < confidences.length; i++) {
      const diff = Math.abs(confidences[i] - confidences[i-1]);
      coherenceScore += Math.exp(-diff * 5); // Penalize large confidence jumps
    }
    
    return coherenceScore / (confidences.length - 1);
  }

  getDefaultMetrics() {
    return {
      confidence: 0,
      entropy: 0,
      logprob: 0,
      perplexity: 1,
      selfScore: 0,
      variance: 0,
      topP: 0.9,
      calibration: 0,
      coherence: 0,
      tokenCount: 0,
      validTokens: 0
    };
  }
}

// Singleton instance
export const uncertaintyAnalyzer = new UncertaintyAnalyzer();