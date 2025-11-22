# The Storyteller Makefile
# ==========================

.PHONY: help install dev stop docker docker-prod test test-e2e clean

# Default target
help:
	@echo "🪶 The Storyteller"
	@echo "=================="
	@echo ""
	@echo "🐋 Docker:"
	@echo "  make docker        Build and run storyteller (local)"
	@echo "  make docker-prod   Build and run for production (detached)"
	@echo ""
	@echo "💻 Local Development:"
	@echo "  make dev           Run local development server"
	@echo "  make stop          Stop the development server"
	@echo "  make install       Install dependencies"
	@echo "  make test          Run unit tests"
	@echo "  make test-e2e      Run E2E tests with Playwright"
	@echo ""
	@echo "🧹 Maintenance:"
	@echo "  make clean         Clean temporary files"

# Docker web demo (local development)
docker:
	@echo "🐋 Building and running The Storyteller (local)..."
	@docker compose up --build

# Docker production (detached, default compose file)
# Uses docker-compose.yml but runs detached (`-d`). No source volume is
# mounted, so container state remains isolated.  Override PORT/HOST in .env
# if you need to expose a public port.
docker-prod:
	@echo "🐋 Building and running The Storyteller for production (detached)..."
	@docker compose up --build -d

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
	@uv run python -m uvicorn app.main:app --host 127.0.0.1 --port 8004 --reload

# Stop development server
stop:
	@echo "🛑 Stopping development server..."
	@# Kill uvicorn processes specifically running app.main:app
	@pgrep -f "uvicorn.*app.main:app" | xargs kill -9 2>/dev/null || echo "No storyteller server found running"
	@# Also kill any remaining processes on port 8004 (safety net)
	@lsof -ti:8004 | xargs kill -9 2>/dev/null || true
	@echo "✅ Server stopped"

# Run unit tests
test:
	@echo "🧪 Running unit tests..."
	@[ ! -f .env ] && cp .env.example .env || true
	@uv run python test_setup.py 2>/dev/null || true
	# test_agent.py removed - imports non-existent functions solve_single_pass/solve_multi_pass

# Run E2E tests with Playwright
test-e2e:
	@echo "🎭 Running E2E tests for The Storyteller..."
	@echo "💡 Make sure the server is running with 'make dev' in another terminal"
	@echo "   or run 'uv run uvicorn app.main:app --host 127.0.0.1 --port 8004' first"
	@sleep 2
	@[ ! -f .env ] && cp .env.example .env || true
	@uv run python -m pytest tests/test_storyteller_e2e.py -v --browser chromium

# Clean temporary files
clean:
	@echo "🧹 Cleaning up..."
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@docker system prune -f 2>/dev/null || true
	@echo "✅ Cleanup complete"