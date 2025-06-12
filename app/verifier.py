def verify(result: dict) -> bool:
    """
    Checks if the result of a tool execution was successful.
    A successful result must be a dictionary with an 'ok' key set to True.
    """
    return isinstance(result, dict) and result.get("ok", False) is True
