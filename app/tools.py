import json
import time
import random

def sql_query(column: str):
    """A dummy SQL query function that fails on a specific column name and provides a hint for the correct one."""
    time.sleep(0.5)  # Simulate database latency
    if column == "conversions":
        return {"ok": False, "hint": "Did you mean 'convs'?"}
    elif column == "convs":
        return {"ok": True, "data": 12345}
    else:
        return {"ok": False, "hint": f"Column '{column}' not found."}

def web_search(query: str):
    """Simulates web search results."""
    time.sleep(1.2)  # Simulate network latency
    
    if "climate change" in query.lower():
        if "recent" not in query.lower():
            return {"ok": False, "hint": "Try searching for 'recent climate change data' for more current results"}
        else:
            return {
                "ok": True, 
                "data": {
                    "results": [
                        {"title": "2024 Climate Report", "snippet": "Global temperatures rose 1.2°C above pre-industrial levels"},
                        {"title": "Arctic Ice Data", "snippet": "Sea ice extent decreased by 13% per decade since 1979"}
                    ]
                }
            }
    elif "ai research" in query.lower():
        return {
            "ok": True,
            "data": {
                "results": [
                    {"title": "Latest AI Breakthroughs", "snippet": "LLMs achieve 95% accuracy on reasoning benchmarks"},
                    {"title": "AI Safety Progress", "snippet": "New alignment techniques show promising results"}
                ]
            }
        }
    else:
        return {"ok": False, "hint": f"No results found for '{query}'. Try more specific terms."}

def analyze_data(dataset: str, operation: str):
    """Simulates data analysis operations."""
    time.sleep(0.8)  # Simulate processing time
    
    if dataset == "user_metrics":
        if operation == "trend":
            return {
                "ok": True,
                "data": {
                    "trend": "upward",
                    "growth_rate": "15% monthly",
                    "key_metric": "Daily Active Users: 50,000"
                }
            }
        elif operation == "summary":
            return {"ok": False, "hint": "Try 'trend' analysis for user_metrics dataset"}
    elif dataset == "sales_data":
        if operation == "correlation":
            return {
                "ok": True,
                "data": {
                    "correlation_strength": 0.85,
                    "insight": "Strong correlation between marketing spend and revenue"
                }
            }
    else:
        return {"ok": False, "hint": f"Dataset '{dataset}' not found. Try 'user_metrics' or 'sales_data'"}
    
    return {"ok": False, "hint": f"Operation '{operation}' not supported for dataset '{dataset}'"}

def solve_equation(equation: str, step: str):
    """Simulates step-by-step math problem solving."""
    time.sleep(0.6)  # Simulate calculation time
    
    if "2x + 5 = 15" in equation:
        if step == "isolate":
            return {"ok": False, "hint": "First 'simplify' the equation by moving constants"}
        elif step == "simplify":
            return {
                "ok": True,
                "data": {
                    "result": "2x = 10",
                    "explanation": "Subtracted 5 from both sides"
                }
            }
        elif step == "calculate":
            return {
                "ok": True,
                "data": {
                    "result": "x = 5",
                    "explanation": "Divided both sides by 2"
                }
            }
    elif "x^2 - 4 = 0" in equation:
        if step == "factor":
            return {
                "ok": True,
                "data": {
                    "result": "(x-2)(x+2) = 0",
                    "explanation": "Used difference of squares formula"
                }
            }
    
    return {"ok": False, "hint": f"Try breaking down the equation '{equation}' with steps like 'simplify', 'isolate', or 'calculate'"}

TOOL_REGISTRY = {
    "sql_query": sql_query,
    "web_search": web_search,
    "analyze_data": analyze_data,
    "solve_equation": solve_equation
}

def get_tool_signature(scenario="sql"):
    """Returns the tool signature for different scenarios."""
    signatures = {
        "sql": {
            "name": "sql_query",
            "description": "Query the company database.",
            "parameters": {
                "type": "object",
                "properties": {
                    "column": {
                        "type": "string",
                        "description": "The column to query, e.g., 'users', 'revenue', 'convs'."
                    }
                },
                "required": ["column"]
            }
        },
        "research": {
            "name": "web_search",
            "description": "Search the web for information",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Search query to execute"
                    }
                },
                "required": ["query"]
            }
        },
        "data_analysis": {
            "name": "analyze_data",
            "description": "Analyze dataset and generate insights",
            "parameters": {
                "type": "object",
                "properties": {
                    "dataset": {
                        "type": "string",
                        "description": "Dataset to analyze, e.g., 'user_metrics', 'sales_data'"
                    },
                    "operation": {
                        "type": "string",
                        "description": "Analysis operation, e.g., 'trend', 'correlation', 'summary'"
                    }
                },
                "required": ["dataset", "operation"]
            }
        },
        "math_tutor": {
            "name": "solve_equation",
            "description": "Solve mathematical equations step by step",
            "parameters": {
                "type": "object",
                "properties": {
                    "equation": {
                        "type": "string",
                        "description": "Mathematical equation to solve"
                    },
                    "step": {
                        "type": "string",
                        "description": "Which step to solve, e.g., 'simplify', 'isolate', 'calculate'"
                    }
                },
                "required": ["equation", "step"]
            }
        }
    }
    
    return json.dumps(signatures.get(scenario, signatures["sql"]), indent=2)

def run_tool(call: dict):
    """Runs a tool from the registry based on the provided call dictionary."""
    tool_name = call.get("name")
    if tool_name not in TOOL_REGISTRY:
        return {"ok": False, "hint": f"Tool '{tool_name}' not found."}
    
    tool_function = TOOL_REGISTRY[tool_name]
    tool_args = call.get("args", {})
    
    try:
        return tool_function(**tool_args)
    except TypeError as e:
        return {"ok": False, "hint": f"Invalid arguments for tool '{tool_name}': {e}"}
