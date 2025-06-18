#!/usr/bin/env python3
"""Debug script to test the agent conversation history"""

import asyncio
import json
from app.agent import solve_multi_pass

async def debug_agent():
    print("🔍 DEBUG: Testing agent conversation history")
    print("=" * 50)
    
    events = []
    async for event in solve_multi_pass("How many conversions did we get this week?"):
        events.append(event)
        print(f"Event: {event['phase']}")
        
        if event['phase'] == 'model_response':
            print(f"  Model said: {repr(event['content'])}")
        elif event['phase'] == 'execute':
            print(f"  Tool call: {event['call']}")
        elif event['phase'] == 'tool_result':
            print(f"  Tool result: {event['result']}")
        
        # Stop after a few attempts to avoid infinite loop
        if len([e for e in events if e['phase'] == 'execute']) >= 3:
            print("🛑 Stopping after 3 tool calls to avoid infinite loop")
            break
    
    print("\n" + "=" * 50)
    print("🧠 CONVERSATION ANALYSIS:")
    print("=" * 50)
    
    tool_calls = [e for e in events if e['phase'] == 'execute']
    for i, call_event in enumerate(tool_calls):
        print(f"Call {i+1}: {call_event['call']}")

if __name__ == "__main__":
    asyncio.run(debug_agent())