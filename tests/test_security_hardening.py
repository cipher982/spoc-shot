"""Security hardening unit tests for storyteller."""

import asyncio
import tomllib
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from starlette.datastructures import Headers

from app.main import app
from app.middleware import MAX_CONTENT_LENGTH
from app.middleware import ObservabilityMiddleware
from app.observability import resolve_otel_config


@pytest.fixture(autouse=True)
def setup_page():
    """Override the E2E browser fixture so unit tests run without Chromium."""
    yield


def test_otel_disabled_by_default_unless_endpoint_set(monkeypatch):
    for key in (
        "ENABLE_OTEL",
        "OTEL_EXPORTER_OTLP_ENDPOINT",
        "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT",
        "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT",
    ):
        monkeypatch.delenv(key, raising=False)

    assert resolve_otel_config() == ("", False)

    monkeypatch.setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://collector:4317")
    assert resolve_otel_config() == ("http://collector:4317", True)

    monkeypatch.setenv("ENABLE_OTEL", "false")
    assert resolve_otel_config() == ("http://collector:4317", False)


def test_docs_and_debug_metrics_disabled_by_default(monkeypatch):
    client = TestClient(app)
    for path in ("/docs", "/redoc", "/openapi.json", "/debug/metrics"):
        assert client.get(path).status_code == 404

    monkeypatch.setenv("ENABLE_DEBUG_METRICS", "true")
    assert client.get("/debug/metrics").status_code == 200


def test_content_length_guard_returns_400_and_413():
    async def dummy_app(scope, receive, send):
        await send({"type": "http.response.start", "status": 200, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    mw = ObservabilityMiddleware(dummy_app)

    async def call_with_length(raw_len: bytes) -> int:
        sent = []

        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(message):
            sent.append(message)

        scope = {
            "type": "http",
            "method": "GET",
            "path": "/health",
            "raw_path": b"/health",
            "query_string": b"",
            "headers": [(b"content-length", raw_len)],
            "client": ("127.0.0.1", 12345),
            "scheme": "http",
            "server": ("testserver", 80),
        }
        await mw(scope, receive, send)
        return sent[0]["status"]

    assert asyncio.run(call_with_length(b"not-a-number")) == 400
    assert asyncio.run(call_with_length(b"-5")) == 400
    assert asyncio.run(call_with_length(str(MAX_CONTENT_LENGTH + 1).encode())) == 413


def test_otel_metrics_use_route_template_not_raw_path():
    recorded_labels: list[str] = []

    class _FakeCounter:
        def add(self, _value, attrs):
            recorded_labels.append(attrs["endpoint"])

    class _FakeHistogram:
        def record(self, _value, attrs):
            pass

    async def fake_app(scope, receive, send):
        if scope["path"] == "/health":
            scope["route"] = SimpleNamespace(path="/health")
            status = 200
        elif scope["path"].startswith("/items/"):
            scope["route"] = SimpleNamespace(path="/items/{item_id}")
            status = 200
        else:
            status = 404
        await send({"type": "http.response.start", "status": status, "headers": []})
        await send({"type": "http.response.body", "body": b"ok"})

    mw = ObservabilityMiddleware(fake_app)
    mw.http_requests_counter = _FakeCounter()
    mw.http_request_duration = _FakeHistogram()
    mw.http_request_size = _FakeHistogram()
    mw.http_response_size = _FakeHistogram()

    async def hit(path: str):
        async def receive():
            return {"type": "http.request", "body": b"", "more_body": False}

        async def send(_msg):
            pass

        scope = {
            "type": "http",
            "method": "GET",
            "path": path,
            "raw_path": path.encode(),
            "query_string": b"",
            "headers": [],
            "client": ("127.0.0.1", 12345),
            "scheme": "http",
            "server": ("testserver", 80),
        }
        await mw(scope, receive, send)

    asyncio.run(hit("/health"))
    asyncio.run(hit("/items/user-99999"))
    asyncio.run(hit("/attacker-scan-1"))
    asyncio.run(hit("/attacker-scan-2"))

    assert recorded_labels == ["/health", "/items/{item_id}", "__unmatched__", "__unmatched__"]


def test_cf_connecting_ip_only_trusted_from_private_or_loopback():
    mw = ObservabilityMiddleware(app)

    trusted = SimpleNamespace(
        client=SimpleNamespace(host="172.18.0.10"),
        headers=Headers({"CF-Connecting-IP": "198.51.100.7", "X-Real-IP": "9.9.9.9"}),
    )
    assert mw._get_client_ip(trusted) == "198.51.100.7"

    trusted_x_real_only = SimpleNamespace(
        client=SimpleNamespace(host="127.0.0.1"),
        headers=Headers({"X-Real-IP": "9.9.9.9"}),
    )
    assert mw._get_client_ip(trusted_x_real_only) == "127.0.0.1"

    untrusted = SimpleNamespace(
        client=SimpleNamespace(host="198.51.100.50"),
        headers=Headers({"CF-Connecting-IP": "1.2.3.4", "X-Forwarded-For": "5.6.7.8"}),
    )
    assert mw._get_client_ip(untrusted) == "198.51.100.50"


def test_pyproject_pytest_moved_to_dev_group():
    pyproject_path = Path(__file__).resolve().parents[1] / "pyproject.toml"
    data = tomllib.loads(pyproject_path.read_text())
    runtime_deps = data["project"]["dependencies"]
    assert not any(dep.lower().startswith("pytest") for dep in runtime_deps)
    dev_deps = data["dependency-groups"]["dev"]
    assert any(dep.lower().startswith("pytest") for dep in dev_deps)
