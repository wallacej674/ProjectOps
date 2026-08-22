import logging
import json
from uuid import UUID

from app.core.logging import JsonLogFormatter


def _request_records(caplog):
    return [record for record in caplog.records if record.name == "projectops.request"]


def test_request_id_header_is_generated_and_logged(unauthenticated_client, caplog):
    caplog.set_level(logging.INFO, logger="projectops.request")

    response = unauthenticated_client.get("/health?token=do-not-log")

    request_id = response.headers["X-Request-ID"]
    UUID(request_id)
    records = _request_records(caplog)
    assert records
    record = records[-1]
    assert record.message == "request_completed"
    assert record.request_id == request_id
    assert record.http_method == "GET"
    assert record.path == "/health"
    assert record.status_code == 200
    assert record.duration_ms >= 0
    assert "do-not-log" not in caplog.text


def test_client_request_id_is_preserved(unauthenticated_client, caplog):
    caplog.set_level(logging.INFO, logger="projectops.request")

    response = unauthenticated_client.get("/health", headers={"X-Request-ID": "client-request-123"})

    assert response.headers["X-Request-ID"] == "client-request-123"
    assert _request_records(caplog)[-1].request_id == "client-request-123"


def test_invalid_client_request_id_is_replaced(unauthenticated_client):
    response = unauthenticated_client.get("/health", headers={"X-Request-ID": "bad request id with spaces"})

    request_id = response.headers["X-Request-ID"]
    assert request_id != "bad request id with spaces"
    UUID(request_id)


def test_json_log_formatter_includes_request_metadata():
    formatter = JsonLogFormatter()
    record = logging.LogRecord(
        name="projectops.request",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="request_completed",
        args=(),
        exc_info=None,
    )
    record.request_id = "request-123"
    record.http_method = "GET"
    record.path = "/health"
    record.status_code = 200
    record.duration_ms = 12.5

    payload = json.loads(formatter.format(record))

    assert payload["message"] == "request_completed"
    assert payload["request_id"] == "request-123"
    assert payload["http_method"] == "GET"
    assert payload["path"] == "/health"
    assert payload["status_code"] == 200
    assert payload["duration_ms"] == 12.5
