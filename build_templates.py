#!/usr/bin/env python3
"""
Simple template builder for SPOC-Shot
Combines partial templates into the main template
"""

import os
from pathlib import Path

def read_file(path):
    """Read file content"""
    try:
        with open(path, 'r') as f:
            return f.read()
    except FileNotFoundError:
        print(f"Warning: {path} not found")
        return ""

def build_template():
    """Build the final template from partials"""
    
    # Read the clean template
    template = read_file('app/templates/index_clean.html')
    
    # Read partial templates
    race_content = read_file('app/templates/partials/race_content.html')
    uncertainty_content = read_file('app/templates/partials/uncertainty_content.html')
    
    # Replace placeholders
    template = template.replace(
        '          <!-- Race content will be inserted here by the build process -->',
        race_content
    )
    
    template = template.replace(
        '          <!-- Uncertainty content will be inserted here by the build process -->',
        uncertainty_content
    )
    
    # Write the final template
    with open('app/templates/index.html', 'w') as f:
        f.write(template)
    
    print("✅ Template built successfully!")
    print("📄 Generated: app/templates/index.html")

if __name__ == "__main__":
    build_template()