# Tool Calling Fix - Hermes-3 Custom Format

## Problem
The tool calling demo was failing with error:
```
ToolCallOutputParseError: Internal error: error encountered when parsing outputMessage for function calling. 
Got outputMessage: sql_query(get_conversion_rate)
Got error: SyntaxError: Unexpected token 's', "sql_query("... is not valid JSON
```

## Root Cause
**Hermes-3-Llama-3.1-8B** uses a **custom XML-based function calling format** (from Nous Research), not the standard OpenAI JSON format that WebLLM's `tools` parameter expects.

### Format Differences:

**Standard OpenAI Format (what WebLLM expects):**
```json
{
  "name": "sql_query",
  "arguments": {"table": "analytics", "column": "conversions"}
}
```

**Hermes-3 Format (XML-based):**
```xml
<tool_call>
{"name": "sql_query", "arguments": {"table": "analytics", "column": "conversions"}}
</tool_call>
```

When using WebLLM's `tools` parameter with Hermes-3, the model outputs plain text like `sql_query(get_conversion_rate)` which fails JSON parsing.

## Solution
Implemented custom Hermes-3 function calling support:

### 1. Custom System Prompt
- Removed WebLLM's `tools` parameter
- Created explicit XML-based prompt with `<tools>` and `<tool_call>` tags
- Instructs model to use Hermes-3's expected format

### 2. Custom Parser (`parseHermesToolCalls`)
Handles multiple formats:
- **Primary:** XML `<tool_call>` tags with JSON inside
- **Fallback:** Plain text function calls like `sql_query(get_conversion_rate)`
- Intelligently parses arguments based on function type

### 3. Tool Response Format
Uses `<tool_response>` XML tags for consistency with Hermes-3 format

### 4. UI Improvements
- Added informational message explaining custom implementation
- Removed misleading JSON parsing error messages
- Cleaner error handling

## Files Modified
- `app/static/js/tool-calling-demo.js` - Main implementation
- `app/static/css/components/unified.css` - Info message styling

## Testing
Try these prompts:
- "What's the conversion rate?"
- "Search for climate change data"
- "Solve 2x + 5 = 15"
- "Analyze user engagement trends"

## Future Improvements
- Consider supporting models with native OpenAI-format tool calling (e.g., specific Qwen variants)
- Add model selection UI to switch between tool calling implementations
- Document which models support which format

