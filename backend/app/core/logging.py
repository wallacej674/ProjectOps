import json
import logging
import sys
from datetime import UTC, datetime


class JsonLogFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, object] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        for field in (
            "project_id",
            "alert_id",
            "claim_id",
            "request_id",
            "http_method",
            "path",
            "status_code",
            "duration_ms",
            "client_host",
        ):
            if hasattr(record, field):
                payload[field] = getattr(record, field)
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        return json.dumps(payload, separators=(",", ":"))


def configure_logging(log_level: str) -> None:
    logger = logging.getLogger("projectops")
    logger.setLevel(log_level.upper())
    if not any(getattr(handler, "_projectops_json_handler", False) for handler in logger.handlers):
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JsonLogFormatter())
        handler._projectops_json_handler = True  # type: ignore[attr-defined]
        logger.addHandler(handler)
    logger.propagate = True
