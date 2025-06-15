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

# Set environment variables
ENV WEBLLM_MODE=webllm
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8001

# Run the application
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]