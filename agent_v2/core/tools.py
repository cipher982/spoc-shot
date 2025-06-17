"""
Enhanced Tool System for SPOC-Shot v2

This module provides a more sophisticated tool system with:
- Rich metadata and documentation
- Automatic hint generation
- Tool categorization and discovery
- Learning-based tool suggestions
"""

import json
import time
import inspect
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, Callable, Type
from dataclasses import dataclass, field
from enum import Enum


class ToolCategory(Enum):
    """Tool categories for organization and discovery."""
    DATABASE = "database"
    WEB_SEARCH = "web_search"
    DATA_ANALYSIS = "data_analysis"
    MATH = "math"
    FILE_SYSTEM = "file_system"
    API = "api"
    UTILITY = "utility"


@dataclass
class ToolExample:
    """Example usage of a tool."""
    description: str
    args: Dict[str, Any]
    expected_result: Dict[str, Any]


@dataclass
class ToolMetadata:
    """Rich metadata for tools."""
    category: ToolCategory
    description: str
    examples: List[ToolExample] = field(default_factory=list)
    common_errors: Dict[str, str] = field(default_factory=dict)
    learning_hints: Dict[str, str] = field(default_factory=dict)
    tags: List[str] = field(default_factory=list)
    version: str = "1.0"


class BaseTool(ABC):
    """Base class for all tools in the system."""
    
    def __init__(self, name: str, metadata: ToolMetadata):
        self.name = name
        self.metadata = metadata
        self._call_count = 0
        self._success_count = 0
    
    @abstractmethod
    async def execute(self, **kwargs) -> Dict[str, Any]:
        """Execute the tool with given arguments."""
        pass
    
    def get_json_schema(self) -> Dict[str, Any]:
        """Generate JSON schema for this tool."""
        sig = inspect.signature(self.execute)
        properties = {}
        required = []
        
        for param_name, param in sig.parameters.items():
            if param_name == 'kwargs':
                continue
                
            param_info = {
                "type": self._python_type_to_json_type(param.annotation),
                "description": f"Parameter {param_name}"
            }
            
            properties[param_name] = param_info
            
            if param.default is inspect.Parameter.empty:
                required.append(param_name)
        
        return {
            "name": self.name,
            "description": self.metadata.description,
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required
            }
        }
    
    def _python_type_to_json_type(self, python_type) -> str:
        """Convert Python type to JSON schema type."""
        type_mapping = {
            str: "string",
            int: "integer",
            float: "number",
            bool: "boolean",
            list: "array",
            dict: "object"
        }
        return type_mapping.get(python_type, "string")
    
    def get_hint_for_error(self, args: Dict[str, Any], error: Exception) -> Optional[str]:
        """Generate contextual hint for an error."""
        # Check for common error patterns
        error_str = str(error).lower()
        
        for pattern, hint in self.metadata.common_errors.items():
            if pattern.lower() in error_str:
                return hint
        
        # Check for learning hints based on arguments
        for arg_pattern, hint in self.metadata.learning_hints.items():
            if any(arg_pattern in str(value).lower() for value in args.values()):
                return hint
        
        return None
    
    def record_execution(self, success: bool) -> None:
        """Record execution statistics."""
        self._call_count += 1
        if success:
            self._success_count += 1
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate for this tool."""
        if self._call_count == 0:
            return 0.0
        return self._success_count / self._call_count


class SQLQueryTool(BaseTool):
    """Enhanced SQL query tool with better error handling and hints."""
    
    def __init__(self):
        metadata = ToolMetadata(
            category=ToolCategory.DATABASE,
            description="Query the company database for various metrics and data.",
            examples=[
                ToolExample(
                    description="Query conversion data",
                    args={"column": "convs"},
                    expected_result={"ok": True, "data": 12345}
                )
            ],
            common_errors={
                "column not found": "Check if the column name is spelled correctly. Common columns: 'convs', 'users', 'revenue'",
                "conversions": "The column 'conversions' doesn't exist. Did you mean 'convs'?"
            },
            learning_hints={
                "conversions": "Did you mean 'convs'?",
                "conversion": "The correct column name is 'convs', not 'conversion' or 'conversions'"
            },
            tags=["database", "analytics", "metrics"]
        )
        super().__init__("sql_query", metadata)
        
        # Simulated database schema
        self.schema = {
            "convs": {"type": "integer", "description": "Conversion count"},
            "users": {"type": "integer", "description": "User count"},
            "revenue": {"type": "float", "description": "Revenue amount"},
            "clicks": {"type": "integer", "description": "Click count"},
            "impressions": {"type": "integer", "description": "Impression count"}
        }
    
    async def execute(self, column: str) -> Dict[str, Any]:
        """Execute SQL query for specified column."""
        time.sleep(0.5)  # Simulate database latency
        
        # Validate column exists
        if column not in self.schema:
            error_msg = f"Column '{column}' not found"
            hint = self.get_hint_for_error({"column": column}, Exception(error_msg))
            
            self.record_execution(False)
            return {
                "ok": False,
                "error": error_msg,
                "hint": hint,
                "available_columns": list(self.schema.keys())
            }
        
        # Simulate successful query
        self.record_execution(True)
        return {
            "ok": True,
            "data": self._generate_sample_data(column),
            "column_info": self.schema[column]
        }
    
    def _generate_sample_data(self, column: str) -> Any:
        """Generate realistic sample data for the column."""
        data_map = {
            "convs": 12345,
            "users": 87650,
            "revenue": 156789.50,
            "clicks": 234567,
            "impressions": 1234567
        }
        return data_map.get(column, 0)


class WebSearchTool(BaseTool):
    """Enhanced web search tool with smart query suggestions."""
    
    def __init__(self):
        metadata = ToolMetadata(
            category=ToolCategory.WEB_SEARCH,
            description="Search the web for information and recent data.",
            examples=[
                ToolExample(
                    description="Search for recent climate data",
                    args={"query": "recent climate change data"},
                    expected_result={"ok": True, "data": {"results": [{"title": "2024 Climate Report", "snippet": "..."}]}}
                )
            ],
            common_errors={
                "no results": "Try more specific search terms or add 'recent' for current information"
            },
            learning_hints={
                "climate change": "Try searching for 'recent climate change data' for current results",
                "old data": "Add 'recent' or '2024' to get current information"
            },
            tags=["search", "web", "research"]
        )
        super().__init__("web_search", metadata)
    
    async def execute(self, query: str) -> Dict[str, Any]:
        """Execute web search with given query."""
        time.sleep(1.2)  # Simulate network latency
        
        # Check for patterns that should return specific results
        query_lower = query.lower()
        
        if "climate change" in query_lower:
            if "recent" not in query_lower:
                self.record_execution(False)
                return {
                    "ok": False,
                    "hint": "Try searching for 'recent climate change data' for more current results",
                    "query": query
                }
            else:
                self.record_execution(True)
                return {
                    "ok": True,
                    "data": {
                        "results": [
                            {"title": "2024 Climate Report", "snippet": "Global temperatures rose 1.2°C above pre-industrial levels"},
                            {"title": "Arctic Ice Data", "snippet": "Sea ice extent decreased by 13% per decade since 1979"}
                        ]
                    },
                    "query": query
                }
        
        elif "ai research" in query_lower:
            self.record_execution(True)
            return {
                "ok": True,
                "data": {
                    "results": [
                        {"title": "Latest AI Breakthroughs", "snippet": "LLMs achieve 95% accuracy on reasoning benchmarks"},
                        {"title": "AI Safety Progress", "snippet": "New alignment techniques show promising results"}
                    ]
                },
                "query": query
            }
        
        else:
            hint = f"No results found for '{query}'. Try more specific terms."
            self.record_execution(False)
            return {
                "ok": False,
                "hint": hint,
                "query": query
            }


class ToolRegistry:
    """Enhanced tool registry with advanced features."""
    
    def __init__(self):
        self.tools: Dict[str, BaseTool] = {}
        self.categories: Dict[ToolCategory, List[str]] = {}
        self._initialize_default_tools()
    
    def _initialize_default_tools(self):
        """Initialize the registry with default tools."""
        # Register default tools
        self.register_tool(SQLQueryTool())
        self.register_tool(WebSearchTool())
    
    def register_tool(self, tool: BaseTool) -> None:
        """Register a new tool in the registry."""
        self.tools[tool.name] = tool
        
        # Update category index
        category = tool.metadata.category
        if category not in self.categories:
            self.categories[category] = []
        
        if tool.name not in self.categories[category]:
            self.categories[category].append(tool.name)
    
    def get_tool(self, name: str) -> Optional[BaseTool]:
        """Get a tool by name."""
        return self.tools.get(name)
    
    def get_tools_by_category(self, category: ToolCategory) -> List[BaseTool]:
        """Get all tools in a specific category."""
        tool_names = self.categories.get(category, [])
        return [self.tools[name] for name in tool_names]
    
    def get_all_tools(self) -> List[BaseTool]:
        """Get all registered tools."""
        return list(self.tools.values())
    
    def get_tool_signature(self, scenario: str = "sql") -> str:
        """Get tool signature for a specific scenario."""
        # Map scenarios to specific tools
        scenario_tools = {
            "sql": ["sql_query"],
            "research": ["web_search"],
            "data_analysis": ["sql_query", "web_search"],
            "all": list(self.tools.keys())
        }
        
        tool_names = scenario_tools.get(scenario, ["sql_query"])
        tools_schemas = []
        
        for tool_name in tool_names:
            if tool_name in self.tools:
                schema = self.tools[tool_name].get_json_schema()
                tools_schemas.append(schema)
        
        return json.dumps(tools_schemas, indent=2)
    
    async def execute_tool(self, tool_name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a tool with error handling and hint generation."""
        tool = self.get_tool(tool_name)
        if not tool:
            return {
                "ok": False,
                "error": f"Tool '{tool_name}' not found",
                "available_tools": list(self.tools.keys())
            }
        
        try:
            result = await tool.execute(**args)
            return result
        except Exception as e:
            hint = tool.get_hint_for_error(args, e)
            tool.record_execution(False)
            return {
                "ok": False,
                "error": str(e),
                "hint": hint,
                "tool": tool_name,
                "args": args
            }
    
    def get_tool_analytics(self) -> Dict[str, Any]:
        """Get analytics about tool usage and performance."""
        analytics = {
            "total_tools": len(self.tools),
            "categories": {cat.value: len(tools) for cat, tools in self.categories.items()},
            "tool_performance": {}
        }
        
        for name, tool in self.tools.items():
            analytics["tool_performance"][name] = {
                "call_count": tool._call_count,
                "success_rate": tool.success_rate,
                "category": tool.metadata.category.value
            }
        
        return analytics


# Global tool registry instance
tool_registry = ToolRegistry()


# Legacy compatibility functions
def run_tool(call: Dict[str, Any]) -> Dict[str, Any]:
    """Legacy compatibility function for existing code."""
    import asyncio
    
    tool_name = call.get("name")
    tool_args = call.get("args", {})
    
    return asyncio.run(tool_registry.execute_tool(tool_name, tool_args))


def get_tool_signature(scenario: str = "sql") -> str:
    """Legacy compatibility function for existing code."""
    return tool_registry.get_tool_signature(scenario)