#!/usr/bin/env python3
"""Test script to verify the SPOC-Shot setup"""

import os
import sys
import importlib

def test_imports():
    """Test that all required modules can be imported"""
    required_modules = [
        'fastapi',
        'openai', 
        'sse_starlette',
        'uvicorn',
        'dotenv'
    ]
    
    print("Testing imports...")
    for module in required_modules:
        try:
            importlib.import_module(module.replace('-', '_'))
            print(f"✅ {module}")
        except ImportError as e:
            print(f"❌ {module}: {e}")
            return False
    return True

def test_app_structure():
    """Test that the app structure is correct"""
    print("\nTesting app structure...")
    
    required_files = [
        'app/main.py',
        'app/agent.py', 
        'app/tools.py',
        'app/verifier.py',
        'app/templates/index.html',
        'pyproject.toml',
        'Dockerfile',
        'docker-compose.yml'
    ]
    
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path}")
            return False
    return True

def test_webllm_mode():
    """Test WebLLM mode configuration"""
    print("\nTesting WebLLM mode...")
    
    # Set WebLLM mode
    os.environ['WEBLLM_MODE'] = 'webllm'
    
    try:
        from app.agent import WEBLLM_MODE, client
        print(f"✅ WEBLLM_MODE = {WEBLLM_MODE}")
        
        if WEBLLM_MODE == 'webllm' and client is None:
            print("✅ Client correctly disabled in WebLLM mode")
        else:
            print(f"⚠️  Client state: {client}")
            
        return True
    except Exception as e:
        print(f"❌ WebLLM mode test failed: {e}")
        return False

def main():
    print("🧠 SPOC-Shot Setup Test\n")
    
    tests = [
        test_imports,
        test_app_structure, 
        test_webllm_mode
    ]
    
    results = []
    for test in tests:
        results.append(test())
        print()
    
    if all(results):
        print("🎉 All tests passed! Your SPOC-Shot setup is ready for deployment.")
        print("\nNext steps:")
        print("1. Run: WEBLLM_MODE=webllm uv run uvicorn app.main:app --host 0.0.0.0 --port 8001")
        print("2. Open: http://localhost:8001")
        print("3. WebLLM will initialize automatically (requires WebGPU browser)")
        print("\n🔧 Recent fixes:")
        print("• Removed annoying popup dialogs")
        print("• Fixed model loading panel positioning")
        print("• Added graceful degradation with demo mode")
        print("• Better error messaging and retry options")
        return 0
    else:
        print("❌ Some tests failed. Please check the setup.")
        return 1

if __name__ == "__main__":
    sys.exit(main())