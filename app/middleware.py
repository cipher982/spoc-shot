"""
Custom middleware for detailed request tracking and observability.
"""

import ipaddress
import json
import logging
import os
import time
from ipaddress import IPv4Network, IPv6Network
from typing import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.observability import get_metrics, get_tracer

logger = logging.getLogger(__name__)

MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", str(1024 * 1024)))

_TRUSTED_PROXY_NETWORKS: tuple[IPv4Network | IPv6Network, ...] = (
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("::1/128"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
)


def _parse_ip(raw: str) -> ipaddress.IPv4Address | ipaddress.IPv6Address | None:
    candidate = raw.strip()
    if not candidate:
        return None
    if "%" in candidate:
        candidate = candidate.split("%", 1)[0]
    try:
        ip = ipaddress.ip_address(candidate)
    except ValueError:
        return None
    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped is not None:
        return ip.ipv4_mapped
    return ip


def _is_trusted_proxy_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return any(ip in net for net in _TRUSTED_PROXY_NETWORKS)


def _parse_content_length(request: Request) -> tuple[int, Response | None]:
    raw = request.headers.get("content-length")
    if raw is None or not raw.strip():
        return 0, None
    try:
        length = int(raw.strip())
    except ValueError:
        return 0, JSONResponse({"detail": "Invalid Content-Length header"}, status_code=400)
    if length < 0:
        return 0, JSONResponse({"detail": "Invalid Content-Length header"}, status_code=400)
    if length > MAX_CONTENT_LENGTH:
        return 0, JSONResponse({"detail": "Payload too large"}, status_code=413)
    return length, None


def _get_route_label(request: Request, status_code: int) -> str:
    route = request.scope.get("route")
    route_path = getattr(route, "path", None)
    if isinstance(route_path, str) and route_path:
        return route_path
    if request.url.path == "/static" or request.url.path.startswith("/static/"):
        return "/static/{path}"
    if status_code == 404:
        return "__unmatched__"
    return "__unmatched__"


class ObservabilityMiddleware(BaseHTTPMiddleware):
    """
    Middleware to track detailed request metrics and create spans for all requests.
    """

    def __init__(self, app):
        super().__init__(app)
        # Get metrics instruments
        self.business_metrics = get_metrics()
        self.tracer = get_tracer()

        self.http_requests_counter = None
        self.http_request_duration = None
        self.http_request_size = None
        self.http_response_size = None

        # Create additional metrics for general HTTP requests
        if self.business_metrics and self.business_metrics.enabled:
            from opentelemetry import metrics

            meter = metrics.get_meter(__name__)

            self.http_requests_counter = meter.create_counter(
                "http_requests_total",
                description="Total number of HTTP requests",
                unit="1",
            )

            self.http_request_duration = meter.create_histogram(
                "http_request_duration_seconds",
                description="Duration of HTTP requests in seconds",
                unit="s",
            )

            self.http_request_size = meter.create_histogram(
                "http_request_size_bytes",
                description="Size of HTTP requests in bytes",
                unit="By",
            )

            self.http_response_size = meter.create_histogram(
                "http_response_size_bytes",
                description="Size of HTTP responses in bytes",
                unit="By",
            )

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process each HTTP request with detailed tracking.
        """
        content_length, error_response = _parse_content_length(request)
        if error_response is not None:
            return error_response

        start_time = time.time()

        # Extract request details
        method = request.method
        user_agent = request.headers.get("user-agent", "")
        client_ip = self._get_client_ip(request)

        # Create span for the request if tracing is enabled
        if self.tracer:
            with self.tracer.start_as_current_span(f"HTTP {method}") as span:
                span.set_attribute("http.method", method)
                span.set_attribute("http.user_agent", user_agent)
                span.set_attribute("http.client_ip", client_ip)
                span.set_attribute("http.request_size", content_length)

                response, route_label = await self._process_request(
                    request,
                    call_next,
                    start_time,
                    content_length=content_length,
                    client_ip=client_ip,
                    span=span,
                )

                span.update_name(f"{method} {route_label}")
                span.set_attribute("http.route", route_label)
                span.set_attribute("http.status_code", response.status_code)
                span.set_attribute("http.response_size", len(response.body) if hasattr(response, "body") else 0)

                if response.status_code >= 400:
                    span.set_attribute("error", True)

                return response

        response, _route_label = await self._process_request(
            request,
            call_next,
            start_time,
            content_length=content_length,
            client_ip=client_ip,
        )
        return response

    async def _process_request(
        self,
        request: Request,
        call_next: Callable,
        start_time: float,
        *,
        content_length: int = 0,
        client_ip: str = "unknown",
        span=None,
    ) -> tuple[Response, str]:
        """
        Process the request and record metrics.
        """
        method = request.method
        user_agent = request.headers.get("user-agent", "")

        try:
            # Call the actual endpoint
            response = await call_next(request)
            route_label = _get_route_label(request, response.status_code)

            # Calculate duration
            duration = time.time() - start_time

            # Get response size
            response_size = 0
            if hasattr(response, "body"):
                response_size = len(response.body)
            elif hasattr(response, "content"):
                response_size = len(response.content)

            # Record metrics using matched route template (bounded cardinality)
            if self.http_requests_counter:
                self.http_requests_counter.add(
                    1,
                    {
                        "method": method,
                        "endpoint": route_label,
                        "status_code": str(response.status_code),
                        "status_class": f"{response.status_code // 100}xx",
                    },
                )

                self.http_request_duration.record(
                    duration,
                    {
                        "method": method,
                        "endpoint": route_label,
                        "status_code": str(response.status_code),
                    },
                )

                if content_length > 0:
                    self.http_request_size.record(
                        content_length,
                        {
                            "method": method,
                            "endpoint": route_label,
                        },
                    )

                if response_size > 0:
                    self.http_response_size.record(
                        response_size,
                        {
                            "method": method,
                            "endpoint": route_label,
                        },
                    )

            # Log request details
            log_data = {
                "timestamp": time.time(),
                "method": method,
                "path": route_label,
                "status_code": response.status_code,
                "duration_ms": round(duration * 1000, 2),
                "client_ip": client_ip,
                "user_agent": user_agent,
                "request_size": content_length,
                "response_size": response_size,
            }

            # Log at different levels based on status code
            if response.status_code >= 500:
                logger.error(f"HTTP {response.status_code} - {json.dumps(log_data)}")
            elif response.status_code >= 400:
                logger.warning(f"HTTP {response.status_code} - {json.dumps(log_data)}")
            else:
                logger.info(f"HTTP {response.status_code} - {json.dumps(log_data)}")

            return response, route_label

        except Exception as e:
            duration = time.time() - start_time

            # Record error metrics
            if self.business_metrics and self.business_metrics.enabled:
                self.business_metrics.record_error(
                    error_type="middleware_exception",
                    mode="unknown",
                    scenario="unknown",
                )

            # Log the error
            error_data = {
                "timestamp": time.time(),
                "method": method,
                "path": _get_route_label(request, 500),
                "duration_ms": round(duration * 1000, 2),
                "client_ip": client_ip,
                "user_agent": user_agent,
                "error": str(e),
                "error_type": type(e).__name__,
            }

            logger.error(f"Request failed - {json.dumps(error_data)}", exc_info=True)

            # Re-raise the exception
            raise e

    def _get_client_ip(self, request: Request) -> str:
        """
        Extract client IP address, trusting CF-Connecting-IP only from private/loopback peers.
        """
        peer_host = request.client.host if request.client and request.client.host else ""
        peer_ip = _parse_ip(peer_host)
        if peer_ip is None or not _is_trusted_proxy_ip(peer_ip):
            return str(peer_ip) if peer_ip is not None else (peer_host or "unknown")

        cf_ip = request.headers.get("CF-Connecting-IP")
        if cf_ip:
            parsed_cf = _parse_ip(cf_ip)
            if parsed_cf is not None:
                return str(parsed_cf)

        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            parsed_hops = [ip for part in forwarded_for.split(",") if (ip := _parse_ip(part)) is not None]
            for hop in reversed(parsed_hops):
                if not _is_trusted_proxy_ip(hop):
                    return str(hop)
            if parsed_hops:
                return str(parsed_hops[-1])

        return str(peer_ip)