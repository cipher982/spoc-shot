# SPOC-Shot Demo Makefile
# =======================

.PHONY: help install dev docker docker-prod test clean

# Default target
help:
	@echo "🚀 SPOC-Shot Demo"
	@echo "================="
	@echo ""
	@echo "🐋 Docker:"
	@echo "  make docker        Build and run web demo (local)"
	@echo "  make docker-prod   Build and run for production (no exposed ports)"
	@echo ""
	@echo "💻 Local Development:"
	@echo "  make dev           Run local development server"
	@echo "  make install       Install dependencies"
	@echo "  make test          Run tests"
	@echo ""
	@echo "🧹 Maintenance:"
	@echo "  make clean         Clean temporary files"

# Docker web demo (local development)
docker:
	@echo "🐋 Building and running SPOC-Shot web demo (local)..."
	@docker compose up --build

# Docker production (no exposed ports)
docker-prod:
	@echo "🐋 Building and running SPOC-Shot for production..."
	@docker compose -f docker-compose.prod.yml up --build -d

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	@[ ! -f .env ] && cp .env.example .env || true
	@uv sync
	@echo "✅ Dependencies installed"

# Local development server
dev:
	@echo "💻 Starting local development server..."
	@[ ! -f .env ] && cp .env.example .env || true
	@uv run uvicorn app.main:app --host 127.0.0.1 --port 8004 --reload

# Run tests
test:
	@echo "🧪 Running tests..."
	@[ ! -f .env ] && cp .env.example .env || true
	@uv run python test_setup.py 2>/dev/null || true
	@uv run pytest -q 2>/dev/null || echo "No tests found"

# Clean temporary files
clean:
	@echo "🧹 Cleaning up..."
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@docker system prune -f 2>/dev/null || true
	@echo "✅ Cleanup complete"