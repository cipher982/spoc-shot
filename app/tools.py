import json
import time
import random
from app.observability import get_metrics

# Initialize observability
business_metrics = get_metrics()

def sql_query(column: str):
    """A dummy SQL query function that fails on a specific column name and provides a hint for the correct one."""
    start_time = time.time()
    success = False
    hint_applied = False
    
    time.sleep(0.5)  # Simulate database latency
    
    if column == "conversions":
        hint_applied = True
        result = {"ok": False, "hint": "Did you mean 'convs'?"}
    elif column == "convs":
        success = True
        result = {"ok": True, "data": 12345}
    else:
        result = {"ok": False, "hint": f"Column '{column}' not found."}
    
    # Record tool metrics
    duration = time.time() - start_time
    if business_metrics and business_metrics.enabled:
        business_metrics.record_tool_execution(
            tool_name="sql_query",
            scenario="sql",
            success=success,
            latency=duration,
            hint_applied=hint_applied,
            hint_type="column_fix" if hint_applied else ""
        )
    
    return result

def web_search(query: str):
    """Simulates web search results."""
    start_time = time.time()
    success = False
    hint_applied = False
    
    time.sleep(1.2)  # Simulate network latency
    
    if "climate change" in query.lower():
        if "recent" not in query.lower():
            hint_applied = True
            result = {"ok": False, "hint": "Try searching for 'recent climate change data' for more current results"}
        else:
            success = True
            result = {
                "ok": True, 
                "data": {
                    "results": [
                        {"title": "2024 Climate Report", "snippet": "Global temperatures rose 1.2°C above pre-industrial levels"},
                        {"title": "Arctic Ice Data", "snippet": "Sea ice extent decreased by 13% per decade since 1979"}
                    ]
                }
            }
    elif "ai research" in query.lower():
        success = True
        result = {
            "ok": True,
            "data": {
                "results": [
                    {"title": "Latest AI Breakthroughs", "snippet": "LLMs achieve 95% accuracy on reasoning benchmarks"},
                    {"title": "AI Safety Progress", "snippet": "New alignment techniques show promising results"}
                ]
            }
        }
    else:
        result = {"ok": False, "hint": f"No results found for '{query}'. Try more specific terms."}
    
    # Record tool metrics
    duration = time.time() - start_time
    if business_metrics and business_metrics.enabled:
        business_metrics.record_tool_execution(
            tool_name="web_search",
            scenario="research",
            success=success,
            latency=duration,
            hint_applied=hint_applied,
            hint_type="specificity" if hint_applied else ""
        )
    
    return result

def analyze_data(dataset: str, operation: str):
    """Simulates data analysis operations."""
    start_time = time.time()
    success = False
    hint_applied = False
    
    time.sleep(0.8)  # Simulate processing time
    
    if dataset == "user_metrics":
        if operation == "trend":
            success = True
            result = {
                "ok": True,
                "data": {
                    "trend": "upward",
                    "growth_rate": "15% monthly",
                    "key_metric": "Daily Active Users: 50,000"
                }
            }
        elif operation == "summary":
            hint_applied = True
            result = {"ok": False, "hint": "Try 'trend' analysis for user_metrics dataset"}
        else:
            result = {"ok": False, "hint": f"Operation '{operation}' not supported for dataset '{dataset}'"}
    elif dataset == "sales_data":
        if operation == "correlation":
            success = True
            result = {
                "ok": True,
                "data": {
                    "correlation_strength": 0.85,
                    "insight": "Strong correlation between marketing spend and revenue"
                }
            }
        else:
            result = {"ok": False, "hint": f"Operation '{operation}' not supported for dataset '{dataset}'"}
    else:
        result = {"ok": False, "hint": f"Dataset '{dataset}' not found. Try 'user_metrics' or 'sales_data'"}
    
    # Record tool metrics
    duration = time.time() - start_time
    if business_metrics and business_metrics.enabled:
        business_metrics.record_tool_execution(
            tool_name="analyze_data",
            scenario="data_analysis",
            success=success,
            latency=duration,
            hint_applied=hint_applied,
            hint_type="operation_mismatch" if hint_applied else ""
        )
    
    return result

def solve_equation(equation: str, step: str):
    """Simulates step-by-step math problem solving."""
    start_time = time.time()
    success = False
    hint_applied = False
    
    time.sleep(0.6)  # Simulate calculation time
    
    if "2x + 5 = 15" in equation:
        if step == "isolate":
            hint_applied = True
            result = {"ok": False, "hint": "First 'simplify' the equation by moving constants"}
        elif step == "simplify":
            success = True
            result = {
                "ok": True,
                "data": {
                    "result": "2x = 10",
                    "explanation": "Subtracted 5 from both sides"
                }
            }
        elif step == "calculate":
            success = True
            result = {
                "ok": True,
                "data": {
                    "result": "x = 5",
                    "explanation": "Divided both sides by 2"
                }
            }
        else:
            result = {"ok": False, "hint": f"Try breaking down the equation '{equation}' with steps like 'simplify', 'isolate', or 'calculate'"}
    elif "x^2 - 4 = 0" in equation:
        if step == "factor":
            success = True
            result = {
                "ok": True,
                "data": {
                    "result": "(x-2)(x+2) = 0",
                    "explanation": "Used difference of squares formula"
                }
            }
        else:
            result = {"ok": False, "hint": f"Try breaking down the equation '{equation}' with steps like 'simplify', 'isolate', or 'calculate'"}
    else:
        result = {"ok": False, "hint": f"Try breaking down the equation '{equation}' with steps like 'simplify', 'isolate', or 'calculate'"}
    
    # Record tool metrics
    duration = time.time() - start_time
    if business_metrics and business_metrics.enabled:
        business_metrics.record_tool_execution(
            tool_name="solve_equation",
            scenario="math_tutoring",
            success=success,
            latency=duration,
            hint_applied=hint_applied,
            hint_type="step_sequence" if hint_applied else ""
        )
    
    return result

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
