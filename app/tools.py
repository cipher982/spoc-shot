import json

def sql_query(column: str):
    """
    A dummy SQL query function that fails on a specific column name
    and provides a hint for the correct one.
    """
    if column == "conversions":
        return {"ok": False, "hint": "Did you mean 'convs'?"}
    elif column == "convs":
        return {"ok": True, "data": 12345}
    else:
        return {"ok": False, "hint": f"Column '{column}' not found."}

TOOL_REGISTRY = {
    "sql_query": sql_query
}

def get_tool_signature():
    """
    Returns a string describing the available tools.
    """
    return json.dumps({
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
    }, indent=2)

def run_tool(call: dict):
    """
    Runs a tool from the registry based on the provided call dictionary.
    """
    tool_name = call.get("name")
    if tool_name not in TOOL_REGISTRY:
        return {"ok": False, "hint": f"Tool '{tool_name}' not found."}
    
    tool_function = TOOL_REGISTRY[tool_name]
    tool_args = call.get("args", {})
    
    try:
        return tool_function(**tool_args)
    except TypeError as e:
        return {"ok": False, "hint": f"Invalid arguments for tool '{tool_name}': {e}"}
