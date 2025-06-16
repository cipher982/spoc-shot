#!/usr/bin/env python3
"""Test script to verify the SPOC-Shot setup"""

import os
import sys
import importlib

def test_imports():
    """Test that all required modules can be imported"""
    required_modules = [
        ('fastapi', 'fastapi'),
        ('openai', 'openai'), 
        ('sse_starlette', 'sse_starlette'),
        ('uvicorn', 'uvicorn'),
        ('dotenv', 'dotenv')
    ]
    
    print("Testing imports...")
    for display_name, import_name in required_modules:
        try:
            importlib.import_module(import_name)
            print(f"✅ {display_name}")
        except ImportError as e:
            print(f"❌ {display_name}: {e}")
            assert False, f"Failed to import {display_name}: {e}"
    print("All imports successful")
    assert True

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
    
    missing_files = []
    for file_path in required_files:
        if os.path.exists(file_path):
            print(f"✅ {file_path}")
        else:
            print(f"❌ {file_path}")
            missing_files.append(file_path)
    
    assert not missing_files, f"Missing required files: {missing_files}"
    print("All required files present")
    assert True

def test_webllm_mode():
    """Test WebLLM mode configuration"""
    print("\nTesting WebLLM mode...")
    
    # Set WebLLM mode
    os.environ['WEBLLM_MODE'] = 'webllm'
    
    try:
        from app.agent import WEBLLM_MODE, client
        print(f"✅ WEBLLM_MODE = {WEBLLM_MODE}")
        
        assert WEBLLM_MODE == 'webllm', f"Expected WEBLLM_MODE to be 'webllm', got {WEBLLM_MODE}"
        
        if WEBLLM_MODE == 'webllm' and client is None:
            print("✅ Client correctly disabled in WebLLM mode")
        else:
            print(f"⚠️  Client state: {client}")
            
        print("WebLLM mode test passed")
        assert True
    except Exception as e:
        print(f"❌ WebLLM mode test failed: {e}")
        assert False, f"WebLLM mode test failed: {e}"

def main():
    print("🧠 SPOC-Shot Setup Test\n")
    
    tests = [
        test_imports,
        test_app_structure, 
        test_webllm_mode
    ]
    
    for test in tests:
        test()
        print()
    
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

if __name__ == "__main__":
    sys.exit(main())