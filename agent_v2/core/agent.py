"""
Core Agent Framework - Base Agent Class

This module provides the foundation for all agent implementations in SPOC-Shot v2.
It addresses the memory and learning issues found in the original implementation.
"""

import uuid
import time
import json
import logging
from abc import ABC, abstractmethod
from typing import Dict, Any, List, Optional, AsyncGenerator, Union
from dataclasses import dataclass, field
from enum import Enum

logger = logging.getLogger(__name__)


class AgentPhase(Enum):
    """Agent execution phases for UI feedback."""
    INITIALIZE = "initialize"
    THINK = "think"
    PLAN = "plan"
    EXECUTE = "execute"
    OBSERVE = "observe"
    LEARN = "learn"
    SUCCESS = "success"
    FAILURE = "failure"
    ERROR = "error"


@dataclass
class Message:
    """Standardized message format for agent conversations."""
    role: str  # system, user, assistant, tool
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class ToolCall:
    """Standardized tool call format."""
    name: str
    args: Dict[str, Any]
    id: str = field(default_factory=lambda: str(uuid.uuid4()))


@dataclass
class ToolResult:
    """Standardized tool result format."""
    success: bool
    data: Any = None
    error: Optional[str] = None
    hint: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @property
    def ok(self) -> bool:
        """Legacy compatibility with existing tool system."""
        return self.success


@dataclass
class LearningPattern:
    """Extracted learning pattern from agent failures."""
    pattern_type: str  # hint, error_correction, tool_sequence
    context: str
    solution: str
    confidence: float
    usage_count: int = 0
    success_rate: float = 0.0


@dataclass
class AgentResult:
    """Final result of agent execution."""
    success: bool
    answer: Optional[str] = None
    error: Optional[str] = None
    metrics: Dict[str, Any] = field(default_factory=dict)
    conversation: List[Message] = field(default_factory=list)
    learning_patterns: List[LearningPattern] = field(default_factory=list)


class ConversationMemory:
    """Advanced conversation memory with learning capabilities."""
    
    def __init__(self, session_id: str):
        self.session_id = session_id
        self.messages: List[Message] = []
        self.learned_patterns: List[LearningPattern] = []
        self.context: Dict[str, Any] = {}
    
    def add_message(self, message: Message) -> None:
        """Add message to conversation history."""
        self.messages.append(message)
        logger.debug(f"Added message: {message.role} - {message.content[:100]}...")
    
    def get_messages(self, role: Optional[str] = None) -> List[Message]:
        """Get messages, optionally filtered by role."""
        if role:
            return [msg for msg in self.messages if msg.role == role]
        return self.messages.copy()
    
    def get_last_tool_result(self) -> Optional[ToolResult]:
        """Get the most recent tool result from conversation."""
        for message in reversed(self.messages):
            if message.role == "tool":
                try:
                    result_data = json.loads(message.content)
                    return ToolResult(
                        success=result_data.get("ok", result_data.get("success", False)),
                        data=result_data.get("data"),
                        error=result_data.get("error"),
                        hint=result_data.get("hint")
                    )
                except (json.JSONDecodeError, KeyError):
                    continue
        return None
    
    def extract_learning_pattern(self, tool_call: ToolCall, tool_result: ToolResult) -> Optional[LearningPattern]:
        """Extract learning pattern from failed tool interaction."""
        if tool_result.success or not tool_result.hint:
            return None
        
        pattern = LearningPattern(
            pattern_type="hint",
            context=f"Tool '{tool_call.name}' with args {tool_call.args}",
            solution=tool_result.hint,
            confidence=0.8  # Initial confidence
        )
        
        # Check if we already have this pattern
        for existing in self.learned_patterns:
            if existing.context == pattern.context:
                existing.usage_count += 1
                return existing
        
        self.learned_patterns.append(pattern)
        logger.info(f"Learned new pattern: {pattern.solution}")
        return pattern
    
    def get_relevant_patterns(self, tool_call: ToolCall) -> List[LearningPattern]:
        """Get relevant learned patterns for a tool call."""
        relevant = []
        context = f"Tool '{tool_call.name}' with args {tool_call.args}"
        
        for pattern in self.learned_patterns:
            if pattern.pattern_type == "hint" and tool_call.name in pattern.context:
                relevant.append(pattern)
        
        return sorted(relevant, key=lambda p: p.confidence, reverse=True)
    
    def format_for_llm(self) -> List[Dict[str, str]]:
        """Format conversation for LLM consumption."""
        return [
            {"role": msg.role, "content": msg.content}
            for msg in self.messages
        ]


class BaseAgent(ABC):
    """
    Base agent class providing common functionality for all agent implementations.
    
    This addresses the memory and learning issues in the original implementation by:
    1. Providing persistent conversation memory
    2. Extracting and applying learning patterns
    3. Standardizing tool interactions
    4. Improving error handling and recovery
    """
    
    def __init__(self, name: str, scenario: str = "default"):
        self.name = name
        self.scenario = scenario
        self.session_id = f"{name}-{uuid.uuid4()}"
        self.memory = ConversationMemory(self.session_id)
        self.metrics = {"llm_calls": 0, "tool_calls": 0, "total_tokens": 0}
        self.start_time: Optional[float] = None
        
    @abstractmethod
    async def execute(self, prompt: str, tools: List[str]) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute the agent with given prompt and available tools."""
        pass
    
    @abstractmethod
    def get_system_prompt(self) -> str:
        """Get the system prompt for this agent."""
        pass
    
    async def yield_phase(self, phase: AgentPhase, **kwargs) -> Dict[str, Any]:
        """Yield a phase update for UI feedback."""
        update = {
            "phase": phase.value,
            "metrics": self.metrics.copy(),
            "session_id": self.session_id,
            "timestamp": time.time(),
            **kwargs
        }
        return update
    
    def should_apply_learning(self, tool_call: ToolCall) -> Optional[str]:
        """Check if we should apply learned patterns to avoid repeating mistakes."""
        patterns = self.memory.get_relevant_patterns(tool_call)
        
        if not patterns:
            return None
        
        # Check if current tool call matches a failed pattern
        last_result = self.memory.get_last_tool_result()
        if last_result and not last_result.success and last_result.hint:
            # We have a recent failure with a hint - agent should have learned
            for pattern in patterns:
                if pattern.solution in last_result.hint:
                    return f"LEARNING ALERT: Previous attempt failed with hint '{last_result.hint}'. Apply learned pattern: {pattern.solution}"
        
        return None
    
    def record_tool_interaction(self, tool_call: ToolCall, tool_result: ToolResult) -> None:
        """Record a tool interaction and extract learning patterns."""
        self.metrics["tool_calls"] += 1
        
        # Add tool call and result to memory
        self.memory.add_message(Message(
            role="assistant", 
            content=f"TOOL_CALL: {json.dumps({'name': tool_call.name, 'args': tool_call.args})}",
            metadata={"tool_call": True}
        ))
        
        self.memory.add_message(Message(
            role="tool",
            content=json.dumps({
                "ok": tool_result.success,
                "data": tool_result.data,
                "error": tool_result.error,
                "hint": tool_result.hint
            })
        ))
        
        # Extract learning pattern if applicable
        if not tool_result.success:
            pattern = self.memory.extract_learning_pattern(tool_call, tool_result)
            if pattern:
                logger.info(f"Extracted learning pattern: {pattern.solution}")
    
    def build_context_prompt(self, original_prompt: str, tools_signature: str) -> str:
        """Build context-aware prompt including learned patterns."""
        base_prompt = f"{tools_signature}\n\nUser Prompt: {original_prompt}"
        
        # Add learning context if we have relevant patterns
        if self.memory.learned_patterns:
            learning_context = "\n\nLEARNED PATTERNS (apply these to avoid repeating mistakes):\n"
            for pattern in self.memory.learned_patterns[-3:]:  # Last 3 patterns
                learning_context += f"- {pattern.solution}\n"
            base_prompt = learning_context + base_prompt
        
        return base_prompt
    
    def finalize_metrics(self) -> Dict[str, Any]:
        """Finalize and return metrics."""
        if self.start_time:
            self.metrics["latency"] = time.time() - self.start_time
        return self.metrics.copy()


class MultiPassAgent(BaseAgent):
    """
    Enhanced multi-pass agent with improved memory management.
    
    This is a refactored version of the original multi-pass agent that:
    - Uses the new memory system
    - Applies learned patterns
    - Has better error recovery
    """
    
    def get_system_prompt(self) -> str:
        return """
You are an intelligent agent that learns from your mistakes and applies learned patterns.

CRITICAL RULES:
1. Look at your conversation history BEFORE making tool calls
2. If you see a previous tool failure with a hint, USE THAT HINT in your next attempt
3. Never repeat the exact same failed tool call
4. Learn from patterns and apply them consistently

When you see a tool result with "hint", that hint tells you exactly what to do next.
Example: If hint says "Did you mean 'convs'?", use 'convs' in your next tool call.

Format tool calls as: TOOL_CALL: {"name": "tool_name", "args": {"param": "value"}}
"""
    
    async def execute(self, prompt: str, tools: List[str]) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute multi-pass agent with enhanced memory management."""
        self.start_time = time.time()
        
        # Initialize conversation
        self.memory.add_message(Message(role="system", content=self.get_system_prompt()))
        self.memory.add_message(Message(role="user", content=prompt))
        
        attempt = 0
        max_attempts = 10  # Prevent infinite loops
        
        while attempt < max_attempts:
            attempt += 1
            yield await self.yield_phase(AgentPhase.THINK, attempt=attempt)
            
            # Apply learning patterns to improve next attempt
            if attempt > 1:
                learning_alert = self.should_apply_learning(
                    ToolCall(name="any", args={})  # Generic check
                )
                if learning_alert:
                    yield await self.yield_phase(AgentPhase.LEARN, message=learning_alert)
            
            # TODO: Implement actual LLM call here
            # This would integrate with the existing OpenAI client
            
            break  # Placeholder - remove when implementing LLM integration
        
        yield await self.yield_phase(AgentPhase.SUCCESS, answer="Implementation placeholder")


class SinglePassAgent(BaseAgent):
    """
    Enhanced single-pass agent with continuous context management.
    
    This maintains conversation state more effectively than the original
    single-pass implementation.
    """
    
    def get_system_prompt(self) -> str:
        return """
You are a single-pass agent that maintains continuous context and learns from failures.

CRITICAL RULES:
1. Maintain conversation context across all interactions
2. Learn from tool failures immediately and apply fixes
3. Use hints from tool results to correct your approach
4. Build on previous attempts rather than starting fresh

You excel at continuous reasoning and context retention.
Format tool calls as: TOOL_CALL: {"name": "tool_name", "args": {"param": "value"}}
"""
    
    async def execute(self, prompt: str, tools: List[str]) -> AsyncGenerator[Dict[str, Any], None]:
        """Execute single-pass agent with continuous context."""
        self.start_time = time.time()
        
        # Implementation similar to MultiPassAgent but with different strategy
        yield await self.yield_phase(AgentPhase.THINK)
        # TODO: Implement actual execution logic
        yield await self.yield_phase(AgentPhase.SUCCESS, answer="Implementation placeholder")