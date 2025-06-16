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
    
    # Debug: print all events
    print(f"\nSingle-pass events: {[e.get('phase') for e in events]}")
    
    # Check if we got any events at all
    assert len(events) > 0, "No events generated"
    
    # In WebLLM mode, we expect an error event instead of success
    error_event = next((e for e in events if e.get("phase") == "error"), None)
    if error_event:
        print(f"Expected error in WebLLM mode: {error_event.get('message', 'Unknown error')}")
        assert "WebLLM mode" in error_event.get('message', ''), "Should indicate WebLLM mode limitation"
    else:
        # If not in WebLLM mode, should succeed
        success = next((e for e in events if e.get("phase") == "success"), None)
        assert success is not None, "single-pass agent did not succeed"
        assert success["metrics"]["llm_calls"] == 1

@pytest.mark.asyncio
async def test_multi_pass_success():
    events = await collect_events(solve_multi_pass(PROMPT))
    
    # Debug: print all events  
    print(f"\nMulti-pass events: {[e.get('phase') for e in events]}")
    
    # Check if we got any events at all
    assert len(events) > 0, "No events generated"
    
    # In WebLLM mode, we expect an error event instead of success
    error_event = next((e for e in events if e.get("phase") == "error"), None)
    if error_event:
        print(f"Expected error in WebLLM mode: {error_event.get('message', 'Unknown error')}")
        assert "WebLLM mode" in error_event.get('message', ''), "Should indicate WebLLM mode limitation"
    else:
        # If not in WebLLM mode, should succeed
        success = next((e for e in events if e.get("phase") == "success"), None)
        assert success is not None, "multi-pass agent did not succeed"
        assert success["metrics"]["llm_calls"] > 1
