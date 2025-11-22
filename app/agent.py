import json
import time
import openai
import uuid
# Removed unused imports for storyteller transition
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

# --- Simple System Prompts for Creative Scenarios ---
CREATIVE_SYSTEM_PROMPTS = {
    "creative_writer": "You are a creative writing assistant. Help users craft engaging stories, characters, and creative content.",
    "riddle_solver": "You are a riddle master. Solve riddles with clear logic and explain your reasoning.",
    "would_you_rather": "You are a thoughtful conversation partner. Help explore interesting hypothetical choices and their implications.",
    "quick_brainstorm": "You are a creative brainstorming assistant. Generate innovative and practical ideas for various problems.",
    "story_continues": "You are a storytelling assistant. Continue stories in engaging and creative ways."
}


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


