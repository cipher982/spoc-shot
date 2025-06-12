import pytest
import asyncio
from app.agent import solve_multi_pass, solve_single_pass

PROMPT = "How many conversions did we get this week?"

async def collect_events(generator):
    events = []
    async for event in generator:
        events.append(event)
    return events

@pytest.mark.asyncio
async def test_single_pass_success():
    events = await collect_events(solve_single_pass(PROMPT))
    success = next((e for e in events if e.get("phase") == "success"), None)
    assert success is not None, "single-pass agent did not succeed"
    # Should only count one LLM call when using request_id continuation
    assert success["metrics"]["llm_calls"] == 1

@pytest.mark.asyncio
async def test_multi_pass_success():
    events = await collect_events(solve_multi_pass(PROMPT))
    success = next((e for e in events if e.get("phase") == "success"), None)
    assert success is not None, "multi-pass agent did not succeed"
    # Baseline requires more than one LLM call due to the retry loop
    assert success["metrics"]["llm_calls"] > 1
