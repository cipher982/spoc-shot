from fastapi import FastAPI, Request, HTTPException
from sse_starlette.sse import EventSourceResponse
from app.agent import solve
import json
import asyncio

app = FastAPI()

@app.post("/solve")
async def solve_sse(request: Request):
    """
    Handles the POST request to solve a prompt and streams the response.
    """
    try:
        data = await request.json()
        prompt = data.get("prompt")
        if not prompt:
            raise HTTPException(status_code=400, detail="Prompt not provided.")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON.")

    async def event_generator():
        """
        A generator function that yields server-sent events.
        """
        for row in solve(prompt):
            yield {"data": json.dumps(row)}
            await asyncio.sleep(0.01) # Small delay to keep the event loop responsive

    return EventSourceResponse(event_generator())

@app.get("/")
async def read_index():
    """
    Serves the main HTML page for the demo.
    """
    try:
        with open("app/templates/index.html") as f:
            return f.read()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="index.html not found.")

# This is a simple way to serve the HTML without a full static file setup.
# For a real application, you would use StaticFiles.
from fastapi.responses import HTMLResponse

@app.get("/", response_class=HTMLResponse)
async def get_index(request: Request):
    return await read_index()
