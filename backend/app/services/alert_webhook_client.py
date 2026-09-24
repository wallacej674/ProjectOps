import socket
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.core.config import get_settings
from app.services.url_validator import HealthCheckUrlSafetyError, validate_health_check_url


def _resolve_url_addresses(hostname: str) -> list[str]:
    """Resolve *hostname* to IP address strings. Monkeypatched in tests."""
    try:
        results = socket.getaddrinfo(hostname, None)
        return [r[4][0] for r in results]
    except socket.gaierror:
        return []


class AlertWebhookHttpClient(Protocol):
    def post(self, url: str, json: dict) -> httpx.Response:
        pass


@dataclass(frozen=True)
class AlertWebhookDeliveryOutcome:
    delivered: bool
    http_status: int | None
    error_message: str | None


class AlertWebhookClient:
    def __init__(self, http_client: AlertWebhookHttpClient | None = None) -> None:
        self.http_client = http_client

    def post(self, url: str, payload: dict, swallow_url_errors: bool = True) -> AlertWebhookDeliveryOutcome:
        try:
            validate_health_check_url(url, resolver=_resolve_url_addresses)
        except HealthCheckUrlSafetyError as error:
            if not swallow_url_errors:
                raise
            return AlertWebhookDeliveryOutcome(delivered=False, http_status=None, error_message=str(error))

        active_client = self.http_client
        if active_client is not None:
            return self._send(active_client, url, payload)

        settings = get_settings()
        with httpx.Client(timeout=settings.alert_webhook_timeout_seconds, follow_redirects=False) as client:
            return self._send(client, url, payload)

    def _send(self, client: AlertWebhookHttpClient, url: str, payload: dict) -> AlertWebhookDeliveryOutcome:
        try:
            response = client.post(url, json=payload)
        except httpx.TimeoutException as error:
            return AlertWebhookDeliveryOutcome(delivered=False, http_status=None,
                error_message=str(error) or "Webhook request timed out.")
        except httpx.HTTPError as error:
            return AlertWebhookDeliveryOutcome(delivered=False, http_status=None,
                error_message=str(error) or "Webhook request failed.")
        delivered = 200 <= response.status_code < 300
        error_message = None if delivered else f"Webhook endpoint returned HTTP {response.status_code}."
        return AlertWebhookDeliveryOutcome(delivered=delivered, http_status=response.status_code, error_message=error_message)


alert_webhook_client = AlertWebhookClient()
