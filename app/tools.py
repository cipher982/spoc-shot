import json
import time
import random
from app.observability import get_metrics

# Initialize observability
business_metrics = get_metrics()

def sql_query(column: str, table: str = "analytics"):
    """Real SQL query function with mock database."""
    start_time = time.time()
    
    time.sleep(0.2 + random.uniform(0.1, 0.4))  # Realistic database latency
    
    # Mock database with realistic data
    mock_database = {
        "analytics": {
            "conversions": 1247,
            "users": 8832,
            "sessions": 12409,
            "revenue": 45230.50,
            "bounce_rate": 0.34,
            "avg_session_duration": 8.3,
            "page_views": 89543
        },
        "sales": {
            "total_sales": 156890.25,
            "orders": 2847,
            "refunds": 123,
            "avg_order_value": 55.12
        }
    }
    
    try:
        if table in mock_database and column in mock_database[table]:
            success = True
            result = {"ok": True, "data": mock_database[table][column]}
        else:
            success = False
            available_columns = list(mock_database.get(table, {}).keys()) if table in mock_database else []
            result = {"ok": False, "error": f"Column '{column}' not found in table '{table}'. Available columns: {available_columns}"}
        
        # Record tool metrics
        duration = time.time() - start_time
        if business_metrics and business_metrics.enabled:
            business_metrics.record_tool_execution(
                tool_name="sql_query",
                scenario="sql",
                success=success,
                latency=duration,
                hint_applied=False,
                hint_type=""
            )
        
        return result
        
    except Exception as e:
        return {"ok": False, "error": f"Database error: {str(e)}"}

def web_search(query: str):
    """Real web search function with mock search API."""
    start_time = time.time()
    
    time.sleep(0.5 + random.uniform(0.2, 0.8))  # Realistic network latency
    
    # Mock search index with realistic results
    search_results = {
        "climate change": [
            {"title": "IPCC Climate Report 2024", "snippet": "Global temperatures rose 1.2°C above pre-industrial levels", "url": "https://ipcc.ch/report2024"},
            {"title": "Arctic Ice Data", "snippet": "Sea ice extent decreased by 13% per decade since 1979", "url": "https://nsidc.org/arctic"},
            {"title": "Climate Policy Updates", "snippet": "New international agreements target carbon neutrality by 2050", "url": "https://unfccc.int/policy"}
        ],
        "ai research": [
            {"title": "Nature: AI Breakthrough 2024", "snippet": "Large language models achieve human-level performance on complex reasoning", "url": "https://nature.com/ai2024"},
            {"title": "AI Safety Progress", "snippet": "New alignment techniques show 90% improvement in safety metrics", "url": "https://aisafety.org/progress"},
            {"title": "Machine Learning Advances", "snippet": "Novel architectures reduce computational requirements by 40%", "url": "https://arxiv.org/ml-advances"}
        ],
        "technology trends": [
            {"title": "Tech Report 2024", "snippet": "Quantum computing and AI integration shows promising applications", "url": "https://techreport.com/2024"},
            {"title": "Startup Innovations", "snippet": "New companies focus on sustainable technology solutions", "url": "https://startup-news.com/innovations"}
        ]
    }
    
    try:
        # Find matching results
        results = []
        query_lower = query.lower()
        
        for topic, articles in search_results.items():
            if topic in query_lower or any(word in query_lower for word in topic.split()):
                results.extend(articles)
        
        if results:
            success = True
            # Return top 3 most relevant results
            result = {"ok": True, "data": {"results": results[:3], "total_found": len(results)}}
        else:
            success = False
            available_topics = list(search_results.keys())
            result = {"ok": False, "error": f"No results found for '{query}'. Try topics like: {', '.join(available_topics)}"}
        
        # Record tool metrics
        duration = time.time() - start_time
        if business_metrics and business_metrics.enabled:
            business_metrics.record_tool_execution(
                tool_name="web_search",
                scenario="research",
                success=success,
                latency=duration,
                hint_applied=False,
                hint_type=""
            )
        
        return result
        
    except Exception as e:
        return {"ok": False, "error": f"Search error: {str(e)}"}

def analyze_data(dataset: str, operation: str = "summary"):
    """Real data analysis function with mock analytics engine."""
    start_time = time.time()
    
    time.sleep(0.3 + random.uniform(0.2, 0.6))  # Realistic processing time
    
    # Mock data analysis engine
    datasets = {
        "user_metrics": {
            "summary": {
                "total_users": 89532,
                "active_users": 67340,
                "growth_rate": "12% monthly",
                "retention_rate": "78%"
            },
            "trend": {
                "trend_direction": "upward",
                "growth_rate": "12% monthly",
                "peak_activity": "2-4 PM weekdays",
                "key_insights": ["Mobile usage increased 45%", "Weekend engagement up 23%"]
            },
            "correlation": {
                "strongest_correlation": "session_length vs engagement_score (0.87)",
                "notable_patterns": ["Users from organic search have 2x retention", "Feature A increases session time by 34%"]
            }
        },
        "sales_data": {
            "summary": {
                "total_revenue": 2340000,
                "total_orders": 8947,
                "avg_order_value": 156.78,
                "conversion_rate": "3.4%"
            },
            "trend": {
                "trend_direction": "upward",
                "revenue_growth": "18% quarterly",
                "seasonal_patterns": "Peak in Q4, lowest in Q1",
                "top_categories": ["Electronics", "Home & Garden", "Fashion"]
            },
            "correlation": {
                "strongest_correlation": "marketing_spend vs revenue (0.92)",
                "insights": ["Email campaigns have 4x ROI vs social media", "Customer reviews impact sales by 67%"]
            }
        },
        "engagement_data": {
            "summary": {
                "avg_session_duration": "8.3 minutes",
                "bounce_rate": "34%",
                "pages_per_session": 4.2,
                "conversion_rate": "2.8%"
            },
            "trend": {
                "engagement_trend": "steady increase",
                "mobile_vs_desktop": "Mobile: 67%, Desktop: 33%",
                "peak_hours": "2-4 PM and 7-9 PM",
                "content_performance": "Video content has 3x engagement"
            }
        }
    }
    
    try:
        if dataset in datasets:
            if operation in datasets[dataset]:
                success = True
                result = {"ok": True, "data": datasets[dataset][operation]}
            else:
                success = False
                available_ops = list(datasets[dataset].keys())
                result = {"ok": False, "error": f"Operation '{operation}' not available for '{dataset}'. Available: {available_ops}"}
        else:
            success = False
            available_datasets = list(datasets.keys())
            result = {"ok": False, "error": f"Dataset '{dataset}' not found. Available: {available_datasets}"}
        
        # Record tool metrics
        duration = time.time() - start_time
        if business_metrics and business_metrics.enabled:
            business_metrics.record_tool_execution(
                tool_name="analyze_data",
                scenario="data_analysis",
                success=success,
                latency=duration,
                hint_applied=False,
                hint_type=""
            )
        
        return result
        
    except Exception as e:
        return {"ok": False, "error": f"Analysis error: {str(e)}"}

def solve_equation(equation: str):
    """Real equation solver with step-by-step solutions."""
    start_time = time.time()
    
    time.sleep(0.1 + random.uniform(0.05, 0.2))  # Fast calculation time
    
    # Math solver engine
    equation_solutions = {
        "2x + 5 = 15": {
            "steps": [
                "Start with: 2x + 5 = 15",
                "Subtract 5 from both sides: 2x = 10", 
                "Divide both sides by 2: x = 5"
            ],
            "final_answer": "x = 5",
            "verification": "2(5) + 5 = 10 + 5 = 15 ✓"
        },
        "x^2 - 4 = 0": {
            "steps": [
                "Start with: x² - 4 = 0",
                "Add 4 to both sides: x² = 4",
                "Take square root: x = ±2"
            ],
            "final_answer": "x = 2 or x = -2", 
            "verification": "2² - 4 = 0 ✓, (-2)² - 4 = 0 ✓"
        },
        "3x - 7 = 14": {
            "steps": [
                "Start with: 3x - 7 = 14",
                "Add 7 to both sides: 3x = 21",
                "Divide both sides by 3: x = 7"
            ],
            "final_answer": "x = 7",
            "verification": "3(7) - 7 = 21 - 7 = 14 ✓"
        },
        "x/2 + 3 = 8": {
            "steps": [
                "Start with: x/2 + 3 = 8",
                "Subtract 3 from both sides: x/2 = 5", 
                "Multiply both sides by 2: x = 10"
            ],
            "final_answer": "x = 10",
            "verification": "10/2 + 3 = 5 + 3 = 8 ✓"
        }
    }
    
    try:
        # Normalize equation for matching
        equation_clean = equation.strip().replace(" ", "").lower()
        
        # Find exact match first
        for known_eq, solution in equation_solutions.items():
            if known_eq.replace(" ", "").lower() == equation_clean:
                success = True
                result = {"ok": True, "data": solution}
                break
        else:
            # Try partial matching for similar equations
            success = False
            available_equations = list(equation_solutions.keys())
            result = {"ok": False, "error": f"Cannot solve '{equation}'. Try equations like: {', '.join(available_equations)}"}
        
        # Record tool metrics
        duration = time.time() - start_time
        if business_metrics and business_metrics.enabled:
            business_metrics.record_tool_execution(
                tool_name="solve_equation",
                scenario="math_tutoring", 
                success=success,
                latency=duration,
                hint_applied=False,
                hint_type=""
            )
        
        return result
        
    except Exception as e:
        return {"ok": False, "error": f"Math solver error: {str(e)}"}

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
