import json
import time
import openai
import uuid
import app.tools as T
import app.verifier as V
import os

# Point the OpenAI client to the local vLLM server
openai.api_base = os.getenv("OPENAI_BASE_URL", "http://localhost:8000/v1")
openai.api_key = os.getenv("OPENAI_API_KEY", "none")

SYSTEM_PROMPT = """
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

def solve(prompt: str, max_retries: int = 3):
    """
    Orchestrates the propose -> execute -> verify loop.
    This function is a generator that yields events for the frontend to consume.
    """
    req_id = str(uuid.uuid4()) # Unique ID for the generation request
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": prompt}
    ]
    start_time = time.perf_counter()

    for attempt in range(max_retries):
        yield {"phase": "attempt", "idx": attempt + 1}

        # Use a generator to stream the response from the LLM
        try:
            stream = openai.ChatCompletion.create(
                model="local-7b",  # Matches --served-model-name in vLLM
                messages=messages,
                stream=True,
                request_id=req_id, # Use the same request_id to maintain context
                temperature=0.0,
            )
        except openai.error.APIError as e:
            yield {"phase": "error", "message": f"vLLM server error: {e}"}
            return

        buffer = ""
        tool_call_found = False
        for chunk in stream:
            token = chunk.choices[0].delta.get("content", "")
            buffer += token
            yield {"phase": "stream", "token": token}

            # Check if a complete TOOL_CALL is in the buffer
            if "TOOL_CALL:" in buffer:
                try:
                    # Extract the JSON part of the tool call
                    tool_call_str = buffer.split("TOOL_CALL:", 1)[1].strip()
                    call_data = json.loads(tool_call_str)
                    tool_call_found = True
                    
                    # Add the agent's thought process to the message history
                    messages.append({"role": "assistant", "content": buffer})
                    
                    # Execute the tool
                    yield {"phase": "tool_call", "call": call_data}
                    result = T.run_tool(call_data)
                    yield {"phase": "tool_result", "result": result}

                    # Verify the result
                    if V.verify(result):
                        # If successful, prepare for final answer generation
                        messages.append({"role": "tool", "content": json.dumps(result)})
                        # Let the model generate the final answer
                        final_answer_stream = openai.ChatCompletion.create(
                            model="local-7b",
                            messages=messages,
                            stream=True,
                            request_id=req_id,
                        )
                        final_answer_buffer = ""
                        for final_chunk in final_answer_stream:
                            final_token = final_chunk.choices[0].delta.get("content", "")
                            final_answer_buffer += final_token
                            yield {"phase": "stream", "token": final_token}
                        
                        latency = time.perf_counter() - start_time
                        yield {"phase": "done", "answer": final_answer_buffer, "latency": f"{latency:.2f}s"}
                        return
                    else:
                        # If failed, add the failure as context and let the loop continue
                        messages.append({"role": "tool", "content": json.dumps(result)})
                        break # Break from token stream to start next attempt

                except (json.JSONDecodeError, KeyError):
                    # Incomplete JSON, continue accumulating tokens
                    continue
        
        if not tool_call_found and buffer:
             messages.append({"role": "assistant", "content": buffer})


    yield {"phase": "error", "message": "Agent failed to produce a valid tool call after multiple attempts."}
