"""
Custom middleware for detailed request tracking and observability.
"""
import time
import logging
import json
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.observability import get_metrics, get_tracer

logger = logging.getLogger(__name__)

class ObservabilityMiddleware(BaseHTTPMiddleware):
    """
    Middleware to track detailed request metrics and create spans for all requests.
    """
    
    def __init__(self, app):
        super().__init__(app)
        # Get metrics instruments
        self.business_metrics = get_metrics()
        self.tracer = get_tracer()
        
        # Create additional metrics for general HTTP requests
        if self.business_metrics:  # Only if metrics are enabled
            from opentelemetry import metrics
            meter = metrics.get_meter(__name__)
            
            self.http_requests_counter = meter.create_counter(
                "http_requests_total",
                description="Total number of HTTP requests",
                unit="1"
            )
            
            self.http_request_duration = meter.create_histogram(
                "http_request_duration_seconds",
                description="Duration of HTTP requests in seconds",
                unit="s"
            )
            
            self.http_request_size = meter.create_histogram(
                "http_request_size_bytes",
                description="Size of HTTP requests in bytes",
                unit="By"
            )
            
            self.http_response_size = meter.create_histogram(
                "http_response_size_bytes",
                description="Size of HTTP responses in bytes",
                unit="By"
            )
        
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process each HTTP request with detailed tracking.
        """
        start_time = time.time()
        
        # Extract request details
        method = request.method
        path = request.url.path
        user_agent = request.headers.get("user-agent", "")
        client_ip = self._get_client_ip(request)
        content_length = int(request.headers.get("content-length", 0))
        
        # Create span for the request if tracing is enabled
        span_name = f"{method} {path}"
        if self.tracer:
            with self.tracer.start_as_current_span(span_name) as span:
                span.set_attribute("http.method", method)
                span.set_attribute("http.url", str(request.url))
                span.set_attribute("http.user_agent", user_agent)
                span.set_attribute("http.client_ip", client_ip)
                span.set_attribute("http.request_size", content_length)
                
                response = await self._process_request(request, call_next, start_time, span)
                
                span.set_attribute("http.status_code", response.status_code)
                span.set_attribute("http.response_size", len(response.body) if hasattr(response, 'body') else 0)
                
                if response.status_code >= 400:
                    span.set_attribute("error", True)
                    
                return response
        else:
            return await self._process_request(request, call_next, start_time)
    
    async def _process_request(self, request: Request, call_next: Callable, start_time: float, span=None) -> Response:
        """
        Process the request and record metrics.
        """
        method = request.method
        path = request.url.path
        user_agent = request.headers.get("user-agent", "")
        client_ip = self._get_client_ip(request)
        content_length = int(request.headers.get("content-length", 0))
        
        try:
            # Call the actual endpoint
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Get response size
            response_size = 0
            if hasattr(response, 'body'):
                response_size = len(response.body)
            elif hasattr(response, 'content'):
                response_size = len(response.content)
            
            # Record metrics
            if self.http_requests_counter:
                self.http_requests_counter.add(1, {
                    "method": method,
                    "endpoint": path,
                    "status_code": str(response.status_code),
                    "status_class": f"{response.status_code // 100}xx"
                })
                
                self.http_request_duration.record(duration, {
                    "method": method,
                    "endpoint": path,
                    "status_code": str(response.status_code)
                })
                
                if content_length > 0:
                    self.http_request_size.record(content_length, {
                        "method": method,
                        "endpoint": path
                    })
                
                if response_size > 0:
                    self.http_response_size.record(response_size, {
                        "method": method,
                        "endpoint": path
                    })
            
            # Log request details
            log_data = {
                "timestamp": time.time(),
                "method": method,
                "path": path,
                "status_code": response.status_code,
                "duration_ms": round(duration * 1000, 2),
                "client_ip": client_ip,
                "user_agent": user_agent,
                "request_size": content_length,
                "response_size": response_size
            }
            
            # Log at different levels based on status code
            if response.status_code >= 500:
                logger.error(f"HTTP {response.status_code} - {json.dumps(log_data)}")
            elif response.status_code >= 400:
                logger.warning(f"HTTP {response.status_code} - {json.dumps(log_data)}")
            else:
                logger.info(f"HTTP {response.status_code} - {json.dumps(log_data)}")
            
            return response
            
        except Exception as e:
            duration = time.time() - start_time
            
            # Record error metrics
            if self.business_metrics and self.business_metrics.enabled:
                self.business_metrics.record_error(
                    error_type="middleware_exception",
                    mode="unknown",
                    scenario="unknown"
                )
            
            # Log the error
            error_data = {
                "timestamp": time.time(),
                "method": method,
                "path": path,
                "duration_ms": round(duration * 1000, 2),
                "client_ip": client_ip,
                "user_agent": user_agent,
                "error": str(e),
                "error_type": type(e).__name__
            }
            
            logger.error(f"Request failed - {json.dumps(error_data)}", exc_info=True)
            
            # Re-raise the exception
            raise e
    
    def _get_client_ip(self, request: Request) -> str:
        """
        Extract client IP address from request headers.
        """
        # Check for forwarded headers first (for reverse proxies)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip.strip()
        
        # Fall back to direct client IP
        if request.client and request.client.host:
            return request.client.host
        
        return "unknown"