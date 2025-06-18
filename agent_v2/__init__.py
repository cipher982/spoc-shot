"""
SPOC-Shot v2 Agent Framework

A first-principles rewrite of the SPOC-Shot agent system with:
- Enhanced memory management
- Learning from failures
- Better tool integration
- Extensible architecture
"""

from .core.agent import BaseAgent, MultiPassAgent, SinglePassAgent, ConversationMemory
from .core.tools import tool_registry, BaseTool, ToolRegistry

__version__ = "2.0.0"
__all__ = [
    "BaseAgent", 
    "MultiPassAgent", 
    "SinglePassAgent", 
    "ConversationMemory",
    "tool_registry",
    "BaseTool",
    "ToolRegistry"
]