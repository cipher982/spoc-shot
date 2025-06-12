# SPOC-Shot Demo

This project demonstrates a simple dashboard comparing a traditional multi-pass
agent loop against a single-pass (SPOC-style) loop. The backend uses
`openai.AsyncOpenAI` pointed at a vLLM server. Run your vLLM server with the
`--openai-api-server` flag and set `base_url` accordingly. The default
configuration in `app/agent.py` uses `http://cube:8000/v1`, but you can override
it by setting the `VLLM_BASE_URL` environment variable.

The single-pass agent reuses the same `request_id` when generating a follow-up
answer after a tool call. Because this continuation shares the cached state we
do **not** count it as an additional LLM call in the metrics.

## Running the tests

Install `pytest` and run the suite. The tests expect a reachable vLLM server and
will connect using the same `VLLM_BASE_URL` configuration.

```bash
pip install pytest
pytest -q
```
