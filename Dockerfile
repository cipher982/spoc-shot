FROM python:3.12-slim

WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install uv
RUN pip install uv

# Install Python dependencies
RUN uv sync --frozen

# Copy application code
COPY app/ ./app/
COPY main.py ./

# Set default environment variables
ENV HOST=0.0.0.0
ENV PORT=8004
ENV WEBLLM_MODE=webllm
ENV PYTHONPATH=/app

# Expose port (will be overridden by ENV)
EXPOSE ${PORT}

# Run the application with environment variables
CMD ["sh", "-c", "uv run uvicorn app.main:app --host $HOST --port $PORT"]