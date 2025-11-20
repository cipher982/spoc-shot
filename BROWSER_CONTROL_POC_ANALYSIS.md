# Browser-Based LLM Control POC - Analysis & Timeline

## Current State

### ✅ What's Already Built

1. **WebLLM Integration** ✅
   - WebLLM engine initialized and working in browser
   - Supports tool calling (function calling) via OpenAI-compatible API
   - Located in: `app/static/js/webllm.js`, `app/static/js/app.js`

2. **Tool Infrastructure** ✅
   - Tool definitions already exist: `app/static/js/config.js` (TOOL_DEFINITIONS)
   - Tool execution logic exists: `app/static/js/modules/race.js` (executeRealTool)
   - Server-side tool execution endpoint: `app/main.py` (`/execute_tool`)
   - Available tools:
     - `sql_query` - Database queries
     - `web_search` - Web search
     - `analyze_data` - Data analysis
     - `solve_equation` - Math solver

3. **Tool Calling Pattern** ✅
   - Already implemented in `race.js`:
     ```javascript
     const response = await webllmEngine.chat.completions.create({
       messages: messages,
       tools: this.getToolDefinitions()
     });
     
     const toolCall = response.choices[0].message.tool_calls?.[0];
     if (toolCall) {
       const result = await this.executeRealTool(toolCall.function.name, ...);
       // Continue conversation with tool result
     }
     ```

### ❌ What's Missing

1. **Current Flow Doesn't Use Tools**
   - The main uncertainty analysis flow (`runWebLLMUncertaintyAnalysis` in `app.js`) only generates text
   - No tool calling integrated into the main UI flow
   - Tools are only used in the "race" comparison feature

2. **UI Doesn't Show Tool Calls**
   - No visualization for tool calls/results in the main interface
   - Need to add UI elements to show:
     - Tool call being made
     - Tool execution status
     - Tool results
     - Conversation continuation

3. **Conversation Loop**
   - Need to handle multi-turn conversations with tool results
   - Currently stops after first response

## POC Implementation Plan

### Phase 1: Basic Tool Calling (2-4 hours)

**Goal**: Enable LLM to call tools instead of just answering questions

**Changes Needed**:

1. **Modify `runWebLLMUncertaintyAnalysis` in `app.js`**:
   ```javascript
   // Add tools parameter to WebLLM call
   const chunks = await webllmEngine.chat.completions.create({
     messages,
     temperature: temperature,
     top_p: topP,
     stream: true,
     logprobs: true,
     top_logprobs: 1,
     tools: getToolDefinitions() // ADD THIS
   });
   
   // Check for tool calls in response
   // Handle tool execution
   // Continue conversation with tool results
   ```

2. **Add tool execution handler**:
   - Reuse `executeRealTool` pattern from `race.js`
   - Or call server endpoint `/execute_tool` for server-side execution

3. **Update system prompts**:
   - Modify scenario prompts to encourage tool usage
   - Add instructions for when to use tools

### Phase 2: UI Updates (2-3 hours)

**Goal**: Show tool calls and results in the UI

**Changes Needed**:

1. **Add tool call visualization**:
   - Show tool name and arguments being called
   - Display execution status (calling... / success / error)
   - Show tool results

2. **Update heatmap area**:
   - Show tool calls inline with text generation
   - Or add separate "Tool Calls" section

3. **Add conversation history**:
   - Show full conversation including tool calls/results
   - Allow user to see the reasoning process

### Phase 3: Multi-Turn Conversations (1-2 hours)

**Goal**: Handle multiple tool calls in sequence

**Changes Needed**:

1. **Conversation state management**:
   - Maintain message history
   - Add tool results to conversation
   - Continue generation after tool execution

2. **Loop handling**:
   - Detect when LLM wants to call another tool
   - Continue until final answer or max iterations

### Phase 4: Enhanced Tools (Optional, 2-4 hours)

**Goal**: Add more interesting control capabilities

**Ideas**:
- DOM manipulation tools (change UI elements)
- Browser API tools (localStorage, geolocation, etc.)
- Visual tools (drawing, charts)
- File operations (read/write files)
- Network tools (API calls)

## Quick POC Estimate

### Minimal Viable POC (4-6 hours)
- ✅ Enable tool calling in main flow
- ✅ Basic tool execution (client-side or server)
- ✅ Simple UI showing tool calls
- ✅ Single tool call → result → final answer

### Full POC (8-12 hours)
- ✅ Everything above
- ✅ Multi-turn conversations
- ✅ Better UI/UX
- ✅ Error handling
- ✅ 2-3 additional tools

## Implementation Details

### Option A: Client-Side Tool Execution
**Pros**: 
- No server dependency
- Faster (no network latency)
- Works offline

**Cons**:
- Limited to browser APIs
- Can't access server resources

**Implementation**: Reuse `executeRealTool` from `race.js`

### Option B: Server-Side Tool Execution  
**Pros**:
- Can access server resources
- More secure
- Can use existing Python tools

**Cons**:
- Requires network call
- Server dependency

**Implementation**: Use `/execute_tool` endpoint

### Option C: Hybrid
**Best of both worlds**: Execute simple tools client-side, complex ones server-side

## Code Locations

### Key Files to Modify:
1. `app/static/js/app.js` - Main uncertainty analysis function
2. `app/static/js/config.js` - Tool definitions (already exists)
3. `app/templates/index.html` - UI updates
4. `app/static/js/modules/race.js` - Reference implementation for tool calling

### Functions to Reuse:
- `getToolDefinitions()` from `config.js`
- `executeRealTool()` pattern from `race.js`
- Tool execution logic from `race.js` lines 385-480

## Example Flow

```
User: "What's the conversion rate?"
  ↓
LLM: [calls sql_query tool]
  ↓
Tool: Returns conversion data
  ↓
LLM: "Based on the database query, the conversion rate is 3.4%..."
```

## Next Steps

1. **Start with Phase 1** - Get basic tool calling working
2. **Test with existing tools** - sql_query, web_search
3. **Add UI feedback** - Show what's happening
4. **Iterate** - Add more tools, improve UX

## Risk Assessment

**Low Risk** ✅:
- WebLLM already supports tool calling
- Infrastructure exists
- Reference implementation available

**Medium Risk** ⚠️:
- Model size (Qwen3-0.6B) may have limited tool calling capability
- May need to test with different models
- Streaming + tool calls might need special handling

**Mitigation**:
- Test with current model first
- Can upgrade to larger model if needed
- Can fall back to non-streaming for tool calls

## Implementation Status

### ✅ Phase 1 Complete: Basic Tool Calling Demo

**What's Been Built**:
- New "Tool Calling Demo" section added to the webpage
- Full tool calling implementation with:
  - User input area with example prompts
  - Conversation log showing user/assistant messages
  - Tool calls visualization with status indicators
  - Multi-turn conversation support
  - Error handling and validation

**Files Created/Modified**:
- `app/templates/index.html` - Added tool calling demo section
- `app/static/js/tool-calling-demo.js` - Complete tool calling implementation
- `app/static/css/components/unified.css` - Styling for demo section

**Features**:
- ✅ Tool calling with WebLLM
- ✅ Tool execution (sql_query, web_search, analyze_data, solve_equation)
- ✅ Conversation history management
- ✅ Multi-turn conversations (up to 5 iterations)
- ✅ Visual feedback for tool calls and results
- ✅ Example prompts for quick testing
- ✅ Error handling and validation

**Next Steps**:
- Test with actual WebLLM model
- Validate tool calling works with Qwen3-0.6B
- If model doesn't support tool calling well, consider:
  - Upgrading to larger model
  - Using server-side LLM for tool calling
  - Hybrid approach

## Conclusion

**Timeline**: 4-6 hours for basic POC, 8-12 hours for full POC

**Feasibility**: HIGH ✅ - Most infrastructure already exists, just needs integration

**Status**: ✅ **Basic POC Complete** - Tool calling demo section implemented and ready for testing

**Recommendation**: Test the demo section to validate tool calling works with the current model. If successful, integrate into main flow.

