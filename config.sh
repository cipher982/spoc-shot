#!/bin/bash

# SPOC-Shot Configuration Helper
# ==============================

show_help() {
    echo "🔧 SPOC-Shot Configuration Helper"
    echo "================================="
    echo ""
    echo "Usage: ./config.sh [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  init          Initialize .env from .env.example"
    echo "  dev           Set up for development (WebLLM, port 8004)"
    echo "  prod          Set up for production (server mode, port 80)"
    echo "  hybrid        Set up for hybrid mode (both WebLLM and server)"
    echo "  port PORT     Change port number"
    echo "  show          Show current configuration"
    echo "  help          Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./config.sh init          # Create .env from template"
    echo "  ./config.sh dev           # Set up for development"
    echo "  ./config.sh port 3000     # Change port to 3000"
    echo "  ./config.sh show          # Show current settings"
}

init_config() {
    if [ -f .env ]; then
        echo "⚠️  .env file already exists"
        read -p "Overwrite? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ Cancelled"
            exit 0
        fi
    fi
    
    cp .env.example .env
    echo "✅ Created .env from .env.example"
    echo "📝 Edit .env to customize your configuration"
}

set_dev() {
    echo "🚧 Setting up development configuration..."
    sed -i '' 's/^PORT=.*/PORT=8004/' .env
    sed -i '' 's/^WEBLLM_MODE=.*/WEBLLM_MODE=webllm/' .env
    sed -i '' 's/^RELOAD=.*/RELOAD=true/' .env
    echo "✅ Development configuration set"
    show_config
}

set_prod() {
    echo "🚀 Setting up production configuration..."
    sed -i '' 's/^PORT=.*/PORT=80/' .env
    sed -i '' 's/^WEBLLM_MODE=.*/WEBLLM_MODE=server/' .env
    sed -i '' 's/^RELOAD=.*/RELOAD=false/' .env
    echo "✅ Production configuration set"
    show_config
}

set_hybrid() {
    echo "🔄 Setting up hybrid configuration..."
    sed -i '' 's/^PORT=.*/PORT=8004/' .env
    sed -i '' 's/^WEBLLM_MODE=.*/WEBLLM_MODE=hybrid/' .env
    sed -i '' 's/^RELOAD=.*/RELOAD=true/' .env
    echo "✅ Hybrid configuration set"
    show_config
}

set_port() {
    if [ -z "$1" ]; then
        echo "❌ Please specify a port number"
        echo "Usage: ./config.sh port 8004"
        exit 1
    fi
    
    echo "🔌 Setting port to $1..."
    sed -i '' "s/^PORT=.*/PORT=$1/" .env
    echo "✅ Port set to $1"
    show_config
}

show_config() {
    if [ ! -f .env ]; then
        echo "❌ No .env file found. Run './config.sh init' to create one."
        exit 1
    fi
    
    echo "📋 Current Configuration:"
    echo "========================"
    grep -v '^#' .env | grep -v '^$' | while read line; do
        echo "  $line"
    done
}

# Check if .env exists for commands that need it
check_env() {
    if [ ! -f .env ]; then
        echo "❌ No .env file found. Run './config.sh init' to create one."
        exit 1
    fi
}

# Main command handling
case "$1" in
    "init")
        init_config
        ;;
    "dev")
        check_env
        set_dev
        ;;
    "prod")
        check_env
        set_prod
        ;;
    "hybrid")
        check_env
        set_hybrid
        ;;
    "port")
        check_env
        set_port "$2"
        ;;
    "show")
        show_config
        ;;
    "help"|"--help"|"-h"|"")
        show_help
        ;;
    *)
        echo "❌ Unknown command: $1"
        echo "Run './config.sh help' for usage information"
        exit 1
        ;;
esac