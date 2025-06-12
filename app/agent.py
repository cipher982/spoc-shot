import json
import time
import openai
import uuid
import app.tools as T
import app.verifier as V
import os
from typing import List, Dict, Any, AsyncGenerator
import logging

logger = logging.getLogger(__name__)

# --- Configuration ---
# Point the OpenAI client to the vLLM server running on 'cube'
# and instantiate the new client, which is required for openai >= 1.0.0
client = openai.AsyncOpenAI(
    base_url="http://cube:8000/v1",
    api_key="none", # vLLM doesn't require an API key
)
MODEL_NAME = "local-7b"

logger.info(f"Connecting to vLLM server at: {client.base_url}")

# --- Prompts ---
SYSTEM_PROMPT_MULTI_PASS = """
You are an expert agent that uses tools to answer questions.
When you need to use a tool, you must output a `TOOL_CALL` in a specific JSON format.
Example:
TOOL_CALL: {"name": "sql_query", "args": {"column": "users"}}

After the tool is executed, you will receive an `EXEC_RESULT`.
Based on this result, you must decide if the task is complete or if you need to try again.
If the task is complete, respond with the final answer.
If the task is not complete, analyze the `EXEC_RESULT` and attempt a new `TOOL_CALL`.
Your final answer should be a concise summary of the tool's successful output.
"""

SYSTEM_PROMPT_SINGLE_PASS = """
You are an expert agent that uses tools to answer questions.
Your task is to answer the user's prompt.
You will be given a `TOOL_SIGNATURE` that you can call by outputting a `TOOL_CALL` in JSON format.
Example:
TOOL_CALL: {"name": "sql_query", "args": {"column": "users"}}

After the `TOOL_CALL` is executed, you will receive an `EXEC_RESULT`.
If the `EXEC_RESULT` indicates a failure, you MUST NOT apologize. Instead, you MUST analyze the error and immediately attempt a new `TOOL_CALL` with corrected arguments.
If the `EXEC_RESULT` is successful, provide a concise, final answer to the user based on the result.
"""

# --- Metrics Tracking ---
def get_token_counts(completion: Dict[str, Any]) -> Dict[str, int]:
    """Extracts token counts from a completion object."""
    if completion and hasattr(completion, 'usage'):
        return {
            "prompt": completion.usage.prompt_tokens,
            "completion": completion.usage.completion_tokens,
            "total": completion.usage.total_tokens,
        }
    return {"prompt": 0, "completion": 0, "total": 0}

# --- Multi-Pass Agent (Baseline) ---
async def solve_multi_pass(prompt: str, max_retries: int = 3) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Orchestrates the classic multi-pass loop (ReAct):
    1. First LLM call to get a tool call.
    2. Execute the tool.
    3. If it fails, start a new loop (another LLM call).
    4. If it succeeds, make a final LLM call to get the answer.
    """
    req_id = f"spoc-shot-{uuid.uuid4()}"
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_MULTI_PASS},
        {"role": "user", "content": prompt}
    ]
    start_time = time.perf_counter()
    metrics = {"tokens": 0, "latency": 0, "llm_calls": 0}

    for attempt in range(max_retries):
        logger.info(f"[Multi-Pass] Attempt {attempt + 1}/{max_retries}")
        yield {"phase": "propose", "metrics": metrics}
        
        try:
            logger.info("[Multi-Pass] Calling OpenAI API...")
            logger.info(f"--- Request to vLLM Server ({client.base_url}) ---")
            logger.info(json.dumps(messages, indent=2))
            logger.info("-------------------------------------------------")
            completion = await client.chat.completions.create(
                model=MODEL_NAME,
                messages=messages,
                temperature=0.0,
                extra_body={"request_id": req_id},
            )
            logger.info(f"--- Response from vLLM Server ---")
            logger.info(str(completion))
            logger.info("-----------------------------------")
            metrics["llm_calls"] += 1
            token_counts = get_token_counts(completion)
            metrics["tokens"] += token_counts["total"]
            response_text = completion.choices[0].message.content
            messages.append({"role": "assistant", "content": response_text})
            yield {"phase": "model_response", "content": response_text, "metrics": metrics}
            logger.info(f"[Multi-Pass] Received model response: {response_text}")

        except openai.APIError as e:
            logger.error(f"[Multi-Pass] OpenAI API Error: {e}", exc_info=True)
            yield {"phase": "error", "message": f"vLLM server error: {e}"}
            return

        if "TOOL_CALL:" in response_text:
            tool_call_str = response_text.split("TOOL_CALL:", 1)[1].strip()
            try:
                logger.info(f"[Multi-Pass] Parsing tool call: {tool_call_str}")
                call_data = json.loads(tool_call_str)
                yield {"phase": "execute", "call": call_data, "metrics": metrics}
                
                logger.info(f"[Multi-Pass] Executing tool: {call_data}")
                result = T.run_tool(call_data)
                logger.info(f"[Multi-Pass] Tool result: {result}")
                yield {"phase": "tool_result", "result": result, "metrics": metrics}

                messages.append({"role": "tool", "content": json.dumps(result)})

                if V.verify(result):
                    logger.info("[Multi-Pass] Tool execution successful. Generating final answer.")
                    yield {"phase": "propose", "metrics": metrics}
                    final_completion = await client.chat.completions.create(
                        model=MODEL_NAME,
                        messages=messages,
                        extra_body={"request_id": req_id},
                    )
                    metrics["llm_calls"] += 1
                    token_counts = get_token_counts(final_completion)
                    metrics["tokens"] += token_counts["total"]
                    final_answer = final_completion.choices[0].message.content
                    
                    metrics["latency"] = time.perf_counter() - start_time
                    logger.info(f"[Multi-Pass] Final answer: {final_answer}")
                    yield {"phase": "success", "answer": final_answer, "metrics": metrics}
                    return
                else:
                    logger.warning("[Multi-Pass] Tool execution failed verification.")
                    yield {"phase": "failure", "message": "Tool execution failed verification.", "metrics": metrics}
            except (json.JSONDecodeError, KeyError) as e:
                logger.error(f"[Multi-Pass] Failed to parse tool call: {e}", exc_info=True)
                yield {"phase": "failure", "message": f"Invalid tool call format: {e}", "metrics": metrics}
                messages.append({"role": "tool", "content": json.dumps({"error": "Invalid tool call format"})})
        else:
            metrics["latency"] = time.perf_counter() - start_time
            yield {"phase": "success", "answer": response_text, "metrics": metrics}
            return

    yield {"phase": "error", "message": "Agent failed after multiple attempts."}


# --- Single-Pass Agent (SPOC) ---
async def solve_single_pass(prompt: str, max_retries: int = 3) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Orchestrates a single-pass loop with self-patching.
    """
    req_id = f"spoc-shot-{uuid.uuid4()}"
    tool_signature = f"TOOL_SIGNATURE: {T.get_tool_signature()}"
    full_prompt = f"{tool_signature}\n\nUser Prompt: {prompt}"
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT_SINGLE_PASS},
        {"role": "user", "content": full_prompt}
    ]
    start_time = time.perf_counter()
    metrics = {"tokens": 0, "latency": 0, "llm_calls": 0}
    
    metrics["llm_calls"] = 1
    logger.info("[Single-Pass] Starting single-pass agent.")
    yield {"phase": "propose", "metrics": metrics}

    try:
        logger.info("[Single-Pass] Calling OpenAI API (streaming)...")
        logger.info(f"--- Request to vLLM Server ({client.base_url}) ---")
        logger.info(json.dumps(messages, indent=2))
        logger.info("-------------------------------------------------")
        stream = await client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            stream=True,
            temperature=0.0,
            stop=["\nEXEC_RESULT"],
            extra_body={"request_id": req_id},
        )
    except openai.APIError as e:
        logger.error(f"[Single-Pass] OpenAI API Error: {e}", exc_info=True)
        yield {"phase": "error", "message": f"vLLM server error: {e}"}
        return

    buffer = ""
    retries = 0
    while retries < max_retries:
        async for chunk in stream:
            token = chunk.choices[0].delta.content or ""
            buffer += token
            
            if "TOOL_CALL:" in buffer:
                tool_call_str = buffer.split("TOOL_CALL:", 1)[1].strip()
                try:
                    logger.info(f"[Single-Pass] Parsing tool call: {tool_call_str}")
                    call_data = json.loads(tool_call_str)
                    
                    messages.append({"role": "assistant", "content": buffer})
                    
                    yield {"phase": "execute", "call": call_data, "metrics": metrics}
                    logger.info(f"[Single-Pass] Executing tool: {call_data}")
                    result = T.run_tool(call_data)
                    logger.info(f"[Single-Pass] Tool result: {result}")
                    yield {"phase": "tool_result", "result": result, "metrics": metrics}

                    if V.verify(result):
                        logger.info("[Single-Pass] Tool execution successful. Generating final answer.")
                        messages.append({"role": "tool", "content": f"EXEC_RESULT: {json.dumps(result)}"})
                        
                        final_stream = await client.chat.completions.create(
                            model=MODEL_NAME,
                            messages=messages,
                            stream=True,
                            extra_body={"request_id": req_id},
                        )
                        
                        final_answer = ""
                        async for final_chunk in final_stream:
                            final_token = final_chunk.choices[0].delta.content or ""
                            final_answer += final_token
                        
                        metrics["tokens"] = len(str(messages)) + len(final_answer)
                        metrics["latency"] = time.perf_counter() - start_time
                        yield {"phase": "success", "answer": final_answer, "metrics": metrics}
                        return
                    else:
                        logger.warning("[Single-Pass] Tool execution failed. Attempting to self-patch.")
                        yield {"phase": "patch", "message": "Tool execution failed. Attempting to self-patch.", "metrics": metrics}
                        messages.append({"role": "tool", "content": f"EXEC_RESULT: {json.dumps(result)}"})
                        buffer = ""
                        retries += 1
                        break 
                except (json.JSONDecodeError, KeyError):
                    logger.warning(f"[Single-Pass] Incomplete JSON, continuing to stream. Buffer: {buffer}")
                    continue
        else:
            break
            
    if "TOOL_CALL:" not in buffer:
        metrics["latency"] = time.perf_counter() - start_time
        yield {"phase": "success", "answer": buffer, "metrics": metrics}
        return

    yield {"phase": "error", "message": "Agent failed to self-patch after multiple attempts."}
