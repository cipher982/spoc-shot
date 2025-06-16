import json
import time
import openai
import uuid
import app.tools as T
import app.verifier as V
import os
from typing import List, Dict, Any, AsyncGenerator
import logging
import asyncio
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# --- Configuration ---
VLLM_BASE_URL = os.getenv("VLLM_BASE_URL", "http://cube:8000/v1")
WEBLLM_MODE = os.getenv("WEBLLM_MODE", "hybrid").lower()  # hybrid, server, webllm

# Initialize OpenAI client for server mode
client = None
if WEBLLM_MODE in ["hybrid", "server"]:
    try:
        client = openai.AsyncOpenAI(
            base_url=VLLM_BASE_URL,
            api_key="none",
        )
        MODEL_NAME = os.getenv("MODEL_NAME", "local-7b")
        logger.info(f"Server mode enabled. Connecting to vLLM server at: {VLLM_BASE_URL}")
    except Exception as e:
        logger.warning(f"Failed to initialize vLLM client: {e}")
        if WEBLLM_MODE == "server":
            raise
        logger.info("Falling back to WebLLM-only mode")
        WEBLLM_MODE = "webllm"
        
if WEBLLM_MODE == "webllm":
    logger.info("WebLLM-only mode enabled. Server-side inference disabled.")

# --- Prompts ---
SYSTEM_PROMPT_MULTI_PASS = """
You are an agent designed for a specific demo. Your ONLY purpose is to answer the user's question about "conversions".
1.  You MUST use the `sql_query` tool. It is the only tool available.
2.  The `sql_query` tool takes a single argument: `column`.
3.  The user's question is "How many conversions did we get this week?". You should infer the correct column name from this.
4.  Your first action MUST be to call the tool with what you think the column name is. Output a `TOOL_CALL` in JSON format.
5.  After you receive the `EXEC_RESULT`, if it failed, analyze the 'hint' and call the tool again with the corrected column name.
6.  If the result is successful, provide a one-sentence answer summarizing the data.
Example of a tool call:
TOOL_CALL: {"name": "sql_query", "args": {"column": "your_best_guess"}}
"""

SYSTEM_PROMPT_SINGLE_PASS = """
You are an agent designed for a specific demo. Your ONLY purpose is to answer the user's question about "conversions".
1.  You will be given a `TOOL_SIGNATURE` for the `sql_query` tool. It is the only tool you can use.
2.  The tool takes a single argument: `column`.
3.  The user's question is "How many conversions did we get this week?". Infer the column name from this question.
4.  Your first action MUST be to call the tool. Output a `TOOL_CALL` in JSON format.
5.  If the `EXEC_RESULT` you receive is a failure, you MUST use the 'hint' to immediately try a new `TOOL_CALL` with the corrected column name.
6.  If the `EXEC_RESULT` is successful, provide a one-sentence answer summarizing the data.
Example of a tool call:
TOOL_CALL: {"name": "sql_query", "args": {"column": "conversions"}}
"""

# --- Metrics Tracking ---
def get_token_counts(completion: Dict[str, Any]) -> Dict[str, int]:
    if completion and hasattr(completion, 'usage'):
        return {
            "prompt": completion.usage.prompt_tokens,
            "completion": completion.usage.completion_tokens,
            "total": completion.usage.total_tokens,
        }
    return {"prompt": 0, "completion": 0, "total": 0}

def get_tool_args(call_data: Dict[str, Any]) -> Dict[str, Any]:
    """Safely gets the arguments from a tool call, checking for both 'args' and 'arguments'."""
    return call_data.get("args", call_data.get("arguments", {}))

# --- Multi-Pass Agent (Baseline) ---
async def solve_multi_pass(prompt: str, scenario: str = "sql") -> AsyncGenerator[Dict[str, Any], None]:
    if WEBLLM_MODE == "webllm":
        yield {"phase": "error", "message": "Server-side inference disabled. Please use WebLLM mode in the browser."}
        return
        
    if not client:
        yield {"phase": "error", "message": "vLLM client not initialized. Check server configuration."}
        return
    req_id = f"spoc-shot-{uuid.uuid4()}"
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_MULTI_PASS},
        {"role": "user", "content": prompt}
    ]
    start_time = time.perf_counter()
    metrics = {"prompt_tokens": 0, "completion_tokens": 0, "latency": 0, "llm_calls": 0}

    while True:
        yield {"phase": "propose", "metrics": metrics}
        
        try:
            logger.info("[Multi-Pass] Simulating network latency...")
            await asyncio.sleep(2)
            logger.info("[Multi-Pass] Calling OpenAI API...")
            completion = await client.chat.completions.create(
                model=MODEL_NAME,
                messages=messages,
                temperature=0.0,
                extra_body={"request_id": req_id},
            )
            metrics["llm_calls"] += 1
            token_counts = get_token_counts(completion)
            metrics["prompt_tokens"] += token_counts["prompt"]
            metrics["completion_tokens"] += token_counts["completion"]
            response_text = completion.choices[0].message.content
            messages.append({"role": "assistant", "content": response_text})
            yield {"phase": "model_response", "content": response_text, "metrics": metrics}

        except openai.APIError as e:
            yield {"phase": "error", "message": f"vLLM server error: {e}"}
            return

        if "TOOL_CALL:" in response_text:
            tool_call_str = response_text.split("TOOL_CALL:", 1)[1].strip()
            try:
                call_data = json.loads(tool_call_str)
                call_data["args"] = get_tool_args(call_data) # Standardize the args key
                yield {"phase": "execute", "call": call_data, "metrics": metrics}
                result = T.run_tool(call_data)
                yield {"phase": "tool_result", "result": result, "metrics": metrics}
                messages.append({"role": "tool", "content": json.dumps(result)})

                if V.verify(result):
                    yield {"phase": "propose", "metrics": metrics}
                    logger.info("[Multi-Pass] Simulating network latency for final answer...")
                    await asyncio.sleep(2)
                    final_completion = await client.chat.completions.create(
                        model=MODEL_NAME,
                        messages=messages,
                        extra_body={"request_id": req_id},
                    )
                    # This call reuses the same request_id to resume generation
                    # so we don't count it as a new LLM call for the metrics.
                    token_counts = get_token_counts(final_completion)
                    metrics["prompt_tokens"] += token_counts["prompt"]
                    metrics["completion_tokens"] += token_counts["completion"]
                    final_answer = final_completion.choices[0].message.content
                    metrics["latency"] = time.perf_counter() - start_time
                    yield {"phase": "success", "answer": final_answer, "metrics": metrics}
                    return
                else:
                    yield {"phase": "failure", "message": "Tool execution failed verification.", "metrics": metrics}
            except (json.JSONDecodeError, KeyError) as e:
                yield {"phase": "failure", "message": f"Invalid tool call format: {e}", "metrics": metrics}
                messages.append({"role": "tool", "content": json.dumps({"error": "Invalid tool call format"})})
        else:
            metrics["latency"] = time.perf_counter() - start_time
            yield {"phase": "success", "answer": response_text, "metrics": metrics}
            return


# --- Single-Pass Agent (SPOC) ---
async def solve_single_pass(prompt: str, scenario: str = "sql") -> AsyncGenerator[Dict[str, Any], None]:
    if WEBLLM_MODE == "webllm":
        yield {"phase": "error", "message": "Server-side inference disabled. Please use WebLLM mode in the browser."}
        return
        
    if not client:
        yield {"phase": "error", "message": "vLLM client not initialized. Check server configuration."}
        return
    req_id = f"spoc-shot-{uuid.uuid4()}"
    tool_signature = f"TOOL_SIGNATURE: {T.get_tool_signature(scenario)}"
    full_prompt = f"{tool_signature}\n\nUser Prompt: {prompt}"
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_SINGLE_PASS},
        {"role": "user", "content": full_prompt}
    ]
    start_time = time.perf_counter()
    metrics = {"prompt_tokens": 0, "completion_tokens": 0, "latency": 0, "llm_calls": 0}

    while True:
        yield {"phase": "propose", "metrics": metrics}
        
        try:
            logger.info("[Single-Pass] Processing request...")
            logger.info("[Single-Pass] Simulating network latency...")
            await asyncio.sleep(2)
            logger.info("[Single-Pass] Calling OpenAI API...")
            
            completion = await client.chat.completions.create(
                model=MODEL_NAME,
                messages=messages,
                temperature=0.0,
                extra_body={"request_id": req_id},
            )
            metrics["llm_calls"] += 1
            token_counts = get_token_counts(completion)
            metrics["prompt_tokens"] += token_counts["prompt"]
            metrics["completion_tokens"] += token_counts["completion"]
            response_text = completion.choices[0].message.content
            messages.append({"role": "assistant", "content": response_text})
            yield {"phase": "model_response", "content": response_text, "metrics": metrics}

        except openai.APIError as e:
            yield {"phase": "error", "message": f"vLLM server error: {e}"}
            return

        if "TOOL_CALL:" in response_text:
            tool_call_str = response_text.split("TOOL_CALL:", 1)[1].strip()
            try:
                call_data = json.loads(tool_call_str)
                call_data["args"] = get_tool_args(call_data) # Standardize the args key
                yield {"phase": "execute", "call": call_data, "metrics": metrics}
                result = T.run_tool(call_data)
                yield {"phase": "tool_result", "result": result, "metrics": metrics}
                messages.append({"role": "tool", "content": json.dumps(result)})

                if V.verify(result):
                    # In a true single-pass, the model would generate the final answer
                    # after the successful tool call in the same response.
                    # For this demo, we'll simulate that by making one final call.
                    logger.info("[Single-Pass] Tool successful. Generating final answer...")
                    logger.info("[Single-Pass] Simulating network latency for final answer...")
                    await asyncio.sleep(2)
                    final_completion = await client.chat.completions.create(
                        model=MODEL_NAME,
                        messages=messages,
                        extra_body={"request_id": req_id},
                    )
                    # This call reuses the same request_id to resume generation,
                    # so we treat it as a continuation rather than a new LLM
                    # call for metric purposes.
                    token_counts = get_token_counts(final_completion)
                    metrics["prompt_tokens"] += token_counts["prompt"]
                    metrics["completion_tokens"] += token_counts["completion"]
                    final_answer = final_completion.choices[0].message.content
                    metrics["latency"] = time.perf_counter() - start_time
                    yield {"phase": "success", "answer": final_answer, "metrics": metrics}
                    return
                else:
                    yield {"phase": "patch", "message": "Tool execution failed. Attempting to self-patch.", "metrics": metrics}
            except (json.JSONDecodeError, KeyError) as e:
                yield {"phase": "failure", "message": f"Invalid tool call format: {e}", "metrics": metrics}
                messages.append({"role": "tool", "content": json.dumps({"error": "Invalid tool call format"})})
        else:
            metrics["latency"] = time.perf_counter() - start_time
            yield {"phase": "success", "answer": response_text, "metrics": metrics}
            return
