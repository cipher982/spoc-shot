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
import math
from dotenv import load_dotenv
from app.observability import (
    get_metrics,
    get_tracer,
    calculate_llm_cost,
)

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Initialize observability
business_metrics = get_metrics()
tracer = get_tracer()

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
        logger.info(
            f"Server mode enabled. Connecting to vLLM server at: {VLLM_BASE_URL}"
        )
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

CRITICAL: You MUST learn from tool failures and use the hints provided!

1.  You MUST use the `sql_query` tool. It is the only tool available.
2.  The `sql_query` tool takes a single argument: `column`.
3.  The user's question is "How many conversions did we get this week?". You should infer the correct column name from this.
4.  Your first action MUST be to call the tool with what you think the column name is. Output a `TOOL_CALL` in JSON format.
5.  After you receive the tool result, if it failed (ok: false), READ THE HINT CAREFULLY and use it to correct your next tool call.
6.  If the result is successful (ok: true), provide a one-sentence answer summarizing the data.

IMPORTANT: Look at the conversation history! If you see previous failed attempts, learn from them.
If you see a hint like "Did you mean 'convs'?", use that exact suggestion in your next tool call.

Example flow:
- First try: TOOL_CALL: {"name": "sql_query", "args": {"column": "conversions"}}
- If you get {"ok": false, "hint": "Did you mean 'convs'?"} then your next call should be:
- TOOL_CALL: {"name": "sql_query", "args": {"column": "convs"}}

DO NOT repeat the same failed tool call! Always learn from the hint!
"""

SYSTEM_PROMPT_SINGLE_PASS = """
You are an agent designed for a specific demo. Your ONLY purpose is to answer the user's question about "conversions".

CRITICAL: You MUST learn from tool failures and use the hints provided!

1.  You will be given a `TOOL_SIGNATURE` for the `sql_query` tool. It is the only tool you can use.
2.  The tool takes a single argument: `column`.
3.  The user's question is "How many conversions did we get this week?". Infer the column name from this question.
4.  Your first action MUST be to call the tool. Output a `TOOL_CALL` in JSON format.
5.  If the tool result is a failure (ok: false), you MUST READ THE HINT and use it to correct your next tool call.
6.  If the tool result is successful (ok: true), provide a one-sentence answer summarizing the data.

IMPORTANT: Look at the conversation history! If you see previous failed attempts, learn from them.
If you see a hint like "Did you mean 'convs'?", use that exact suggestion in your next tool call.

Example flow:
- First try: TOOL_CALL: {"name": "sql_query", "args": {"column": "conversions"}}
- If you get {"ok": false, "hint": "Did you mean 'convs'?"} then your next call should be:
- TOOL_CALL: {"name": "sql_query", "args": {"column": "convs"}}

DO NOT repeat the same failed tool call! Always learn from the hint!
"""


# --- Metrics Tracking ---
def get_token_counts(completion: Dict[str, Any]) -> Dict[str, int]:
    if completion and hasattr(completion, "usage"):
        return {
            "prompt": completion.usage.prompt_tokens,
            "completion": completion.usage.completion_tokens,
            "total": completion.usage.total_tokens,
        }
    return {"prompt": 0, "completion": 0, "total": 0}


def get_tool_args(call_data: Dict[str, Any]) -> Dict[str, Any]:
    """Safely gets the arguments from a tool call, checking for both 'args' and 'arguments'."""
    return call_data.get("args", call_data.get("arguments", {}))


def extract_uncertainty_data(
    completion: Any,
) -> (str, List[Dict[str, Any]], Dict[str, float]):
    """Extract tokens and simple uncertainty metrics from a chat completion."""
    try:
        token_logprobs = completion.choices[0].logprobs.content
    except Exception:
        token_logprobs = None

    if not token_logprobs:
        text = completion.choices[0].message.content
        return text, [], {}

    tokens = []
    text = ""
    entropy_sum = 0.0
    min_logprob = float("inf")

    for item in token_logprobs:
        token = item.token
        lp = item.logprob
        top = [
            {"token": t.token, "logprob": t.logprob}
            for t in getattr(item, "top_logprobs", [])
        ]
        tokens.append({"token": token, "logprob": lp, "top_logprobs": top})
        text += token
        entropy_sum += -lp
        if lp < min_logprob:
            min_logprob = lp

    count = len(tokens)
    metrics = {
        "entropy_avg": entropy_sum / count if count else 0.0,
        "min_logprob": min_logprob if count else 0.0,
        "ppl": math.exp(entropy_sum / count) if count else float("inf"),
    }

    return text, tokens, metrics


