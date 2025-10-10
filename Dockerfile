FROM python:3.12-slim

WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install uv and curl for healthchecks
RUN pip install uv && \
    apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

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

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://127.0.0.1:8000/ || exit 1

# Run the application with environment variables
CMD ["sh", "-c", "uv run uvicorn app.main:app --host $HOST --port $PORT"]