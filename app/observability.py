"""
OpenTelemetry configuration and instrumentation for SPOC-Shot application.
"""
import os
import logging
from opentelemetry import trace, metrics
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.requests import RequestsInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.sdk.resources import Resource

logger = logging.getLogger(__name__)

# Configuration
OTEL_EXPORTER_OTLP_ENDPOINT = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4317")
OTEL_SERVICE_NAME = os.getenv("OTEL_SERVICE_NAME", "spoc-shot")
OTEL_SERVICE_VERSION = os.getenv("OTEL_SERVICE_VERSION", "0.1.0")
ENABLE_OTEL = os.getenv("ENABLE_OTEL", "true").lower() == "true"

# Global instrumentation state
_instrumented = False

def setup_otel():
    """Initialize OpenTelemetry instrumentation."""
    global _instrumented
    
    if _instrumented or not ENABLE_OTEL:
        return
    
    # Create resource
    resource = Resource.create({
        "service.name": OTEL_SERVICE_NAME,
        "service.version": OTEL_SERVICE_VERSION,
    })
    
    # Setup tracing
    trace_provider = TracerProvider(resource=resource)
    
    # Add OTLP span exporter if endpoint is configured
    if OTEL_EXPORTER_OTLP_ENDPOINT:
        try:
            otlp_exporter = OTLPSpanExporter(endpoint=OTEL_EXPORTER_OTLP_ENDPOINT, insecure=True)
            span_processor = BatchSpanProcessor(otlp_exporter)
            trace_provider.add_span_processor(span_processor)
            logger.info(f"OpenTelemetry tracing configured with OTLP endpoint: {OTEL_EXPORTER_OTLP_ENDPOINT}")
        except Exception as e:
            logger.warning(f"Failed to configure OTLP trace exporter: {e}")
    
    trace.set_tracer_provider(trace_provider)
    
    # Setup metrics
    metric_readers = []
    
    # Pure OpenTelemetry metrics - no Prometheus
    
    # Add OTLP metrics exporter if endpoint is configured
    if OTEL_EXPORTER_OTLP_ENDPOINT:
        try:
            otlp_metric_exporter = OTLPMetricExporter(endpoint=OTEL_EXPORTER_OTLP_ENDPOINT, insecure=True)
            otlp_metric_reader = PeriodicExportingMetricReader(otlp_metric_exporter, export_interval_millis=10000)
            metric_readers.append(otlp_metric_reader)
            logger.info("OTLP metrics exporter configured")
        except Exception as e:
            logger.warning(f"Failed to configure OTLP metrics exporter: {e}")
    
    if metric_readers:
        meter_provider = MeterProvider(resource=resource, metric_readers=metric_readers)
        metrics.set_meter_provider(meter_provider)
    
    # Instrument logging
    LoggingInstrumentor().instrument(set_logging_format=True)
    
    # Instrument requests library
    RequestsInstrumentor().instrument()
    
    _instrumented = True
    logger.info("OpenTelemetry instrumentation initialized successfully")

def instrument_fastapi(app):
    """Instrument FastAPI application with OpenTelemetry."""
    if not ENABLE_OTEL:
        logger.info("OpenTelemetry disabled - skipping FastAPI instrumentation")
        return
    
    try:
        FastAPIInstrumentor.instrument_app(app)
        logger.info("FastAPI instrumented with OpenTelemetry")
    except Exception as e:
        logger.error(f"Failed to instrument FastAPI: {e}")

# Business-specific metrics for SPOC-Shot AI agent system
def get_metrics():
    """Get application-specific metrics instruments for business intelligence."""
    if not ENABLE_OTEL:
        return {}
    
    meter = metrics.get_meter(__name__)
    
    # Agent Performance Metrics
    agent_requests_total = meter.create_counter(
        "agent_requests_total",
        description="Total agent requests by mode and scenario",
        unit="1"
    )
    
    agent_success_rate = meter.create_histogram(
        "agent_success_rate", 
        description="Agent task completion success rate",
        unit="1"
    )
    
    agent_iterations = meter.create_histogram(
        "agent_iterations",
        description="Number of iterations before success/failure",
        unit="1"
    )
    
    agent_duration_seconds = meter.create_histogram(
        "agent_duration_seconds",
        description="End-to-end agent task duration",
        unit="s"
    )
    
    # Tool System Metrics
    tool_executions_total = meter.create_counter(
        "tool_executions_total",
        description="Tool execution attempts",
        unit="1"
    )
    
    tool_hints_applied = meter.create_counter(
        "tool_hints_applied", 
        description="Tool hints applied for recovery",
        unit="1"
    )
    
    tool_latency_seconds = meter.create_histogram(
        "tool_latency_seconds",
        description="Tool execution latency",
        unit="s"
    )
    
    # LLM Operations Metrics
    llm_requests_total = meter.create_counter(
        "llm_requests_total",
        description="LLM API requests",
        unit="1"
    )
    
    llm_tokens_consumed = meter.create_histogram(
        "llm_tokens_consumed",
        description="Tokens consumed per operation",
        unit="1"
    )
    
    llm_latency_seconds = meter.create_histogram(
        "llm_latency_seconds", 
        description="LLM API call latency",
        unit="s"
    )
    
    llm_costs_usd = meter.create_histogram(
        "llm_costs_usd",
        description="Estimated LLM costs in USD",
        unit="USD"
    )
    
    # Learning System Metrics
    learning_patterns_applied = meter.create_counter(
        "learning_patterns_applied",
        description="Learning pattern applications",
        unit="1"
    )
    
    conversation_memory_size = meter.create_histogram(
        "conversation_memory_size",
        description="Size of conversation memory",
        unit="1"
    )
    
    # Error Classification
    agent_errors_total = meter.create_counter(
        "agent_errors_total", 
        description="Agent errors by type",
        unit="1"
    )
    
    return {
        "agent_requests_total": agent_requests_total,
        "agent_success_rate": agent_success_rate,
        "agent_iterations": agent_iterations,
        "agent_duration_seconds": agent_duration_seconds,
        "tool_executions_total": tool_executions_total,
        "tool_hints_applied": tool_hints_applied,
        "tool_latency_seconds": tool_latency_seconds,
        "llm_requests_total": llm_requests_total,
        "llm_tokens_consumed": llm_tokens_consumed,
        "llm_latency_seconds": llm_latency_seconds,
        "llm_costs_usd": llm_costs_usd,
        "learning_patterns_applied": learning_patterns_applied,
        "conversation_memory_size": conversation_memory_size,
        "agent_errors_total": agent_errors_total
    }

# Get tracer for business context spans
def get_tracer():
    """Get tracer for business context instrumentation."""
    if not ENABLE_OTEL:
        return None
    return trace.get_tracer(__name__)

# Utility functions for business metrics
def classify_error(exception):
    """Classify exceptions into business-meaningful error types."""
    error_type = type(exception).__name__
    if "timeout" in str(exception).lower():
        return "llm_timeout"
    elif "json" in str(exception).lower() or "parse" in str(exception).lower():
        return "parsing_error"
    elif "validation" in str(exception).lower():
        return "validation_error"
    elif "tool" in str(exception).lower():
        return "tool_failure"
    else:
        return error_type

def calculate_llm_cost(tokens_used, model="gpt-4"):
    """Estimate LLM API costs based on token usage."""
    # Approximate costs per 1K tokens (as of 2024)
    cost_per_1k_tokens = {
        "gpt-4": 0.03,
        "gpt-3.5-turbo": 0.002,
        "gpt-4-turbo": 0.01
    }
    
    rate = cost_per_1k_tokens.get(model, 0.03)
    return (tokens_used / 1000) * rate