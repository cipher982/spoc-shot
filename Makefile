# SPOC-Shot Demo Makefile
# =======================

.PHONY: help init dev prod hybrid port show clean install test run docker-build docker-run

# Default target
help:
	@echo "🔧 SPOC-Shot Configuration & Management"
	@echo "======================================"
	@echo ""
	@echo "Setup Commands:"
	@echo "  make init          Initialize .env from .env.example"
	@echo "  make install       Install dependencies with uv"
	@echo ""
	@echo "Configuration:"
	@echo "  make dev           Set up for development (WebLLM, port 8004)"
	@echo "  make prod          Set up for production (server mode, port 80)"
	@echo "  make hybrid        Set up for hybrid mode (both WebLLM and server)"
	@echo "  make port PORT=N   Change port number"
	@echo "  make show          Show current configuration"
	@echo ""
	@echo "Run Commands:"
	@echo "  make run           Start the demo server"
	@echo "  make test          Run tests and setup verification"
	@echo ""
	@echo "Docker Commands:"
	@echo "  make docker-build  Build Docker image"
	@echo "  make docker-run    Run with Docker Compose"
	@echo ""
	@echo "Maintenance:"
	@echo "  make clean         Clean temporary files"
	@echo ""
	@echo "Examples:"
	@echo "  make init && make dev && make run"
	@echo "  make port PORT=3000"

# Initialize configuration
init:
	@if [ -f .env ]; then \
		echo "⚠️  .env file already exists"; \
		read -p "Overwrite? (y/N): " confirm && [ "$$confirm" = "y" ]; \
	fi
	@cp .env.example .env
	@echo "✅ Created .env from .env.example"
	@echo "📝 Edit .env to customize your configuration"

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	@uv sync
	@echo "✅ Dependencies installed"

# Development configuration
dev: check-env
	@echo "🚧 Setting up development configuration..."
	@sed -i '' 's/^PORT=.*/PORT=8004/' .env
	@sed -i '' 's/^WEBLLM_MODE=.*/WEBLLM_MODE=webllm/' .env
	@sed -i '' 's/^RELOAD=.*/RELOAD=true/' .env
	@echo "✅ Development configuration set"
	@$(MAKE) show

# Production configuration
prod: check-env
	@echo "🚀 Setting up production configuration..."
	@sed -i '' 's/^PORT=.*/PORT=80/' .env
	@sed -i '' 's/^WEBLLM_MODE=.*/WEBLLM_MODE=server/' .env
	@sed -i '' 's/^RELOAD=.*/RELOAD=false/' .env
	@echo "✅ Production configuration set"
	@$(MAKE) show

# Hybrid configuration
hybrid: check-env
	@echo "🔄 Setting up hybrid configuration..."
	@sed -i '' 's/^PORT=.*/PORT=8004/' .env
	@sed -i '' 's/^WEBLLM_MODE=.*/WEBLLM_MODE=hybrid/' .env
	@sed -i '' 's/^RELOAD=.*/RELOAD=true/' .env
	@echo "✅ Hybrid configuration set"
	@$(MAKE) show

# Set port (usage: make port PORT=3000)
port: check-env
	@if [ -z "$(PORT)" ]; then \
		echo "❌ Please specify a port number"; \
		echo "Usage: make port PORT=8004"; \
		exit 1; \
	fi
	@echo "🔌 Setting port to $(PORT)..."
	@sed -i '' "s/^PORT=.*/PORT=$(PORT)/" .env
	@echo "✅ Port set to $(PORT)"
	@$(MAKE) show

# Show current configuration
show:
	@if [ ! -f .env ]; then \
		echo "❌ No .env file found. Run 'make init' to create one."; \
		exit 1; \
	fi
	@echo "📋 Current Configuration:"
	@echo "========================"
	@grep -v '^#' .env | grep -v '^$$' | sed 's/^/  /'

# Run the demo
run: check-env
	@echo "🚀 Starting SPOC-Shot demo..."
	@. ./.env && uv run uvicorn app.main:app --host $$HOST --port $$PORT $$([ "$$RELOAD" = "true" ] && echo "--reload" || echo "")

# Run tests
test: check-env
	@echo "🧪 Running setup verification..."
	@uv run python test_setup.py
	@echo "🧪 Running pytest..."
	@uv run pytest -q

# Docker commands
docker-build:
	@echo "🐋 Building Docker image..."
	@docker build -t spoc-shot .

docker-run:
	@echo "🐋 Running with Docker Compose..."
	@docker-compose up --build

# Clean temporary files
clean:
	@echo "🧹 Cleaning up..."
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@echo "✅ Cleanup complete"

# Check if .env exists
check-env:
	@if [ ! -f .env ]; then \
		echo "❌ No .env file found. Run 'make init' to create one."; \
		exit 1; \
	fi