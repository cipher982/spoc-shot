// WebLLM engine state.
//
// logit-viz.js drives model loading/generation directly, wiring the runtime
// engine into this singleton and reads back `engine` / `loaded` here. The
// former WebLLMManager methods (initialize, generateResponse,
// generateStreamingResponse, calculateBasicMetrics) were dead code and have
// been removed.
export const webllmManager = {
  engine: null,
  loaded: false,
};