from urllib.parse import parse_qs, urlparse

import jwt
import pytest
import httpx
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from app.core.config import Settings
from app.services.github_app import GitHubAppAuthorizationError, GitHubAppService


def github_settings() -> Settings:
    return Settings(
        auth_secret_key="test-only-state-signing-key-long-enough-for-hs256",
        github_app_client_id="client-id",
        github_app_client_secret="client-secret",
        github_app_id="1234",
        github_app_slug="projectops-test",
        github_app_private_key="private-key-placeholder",
        github_app_callback_url="https://projectops.example/app/github/callback",
    )


def test_authorization_url_contains_signed_short_lived_user_and_project_state():
    settings = github_settings()
    url = GitHubAppService().authorization_url(settings, user_id=42, project_id=7)

    query = parse_qs(urlparse(url).query)
    payload = jwt.decode(query["state"][0], settings.auth_secret_key, algorithms=[settings.auth_token_algorithm])
    assert url.startswith("https://github.com/apps/projectops-test/installations/new?")
    assert payload["sub"] == "42"
    assert payload["project_id"] == 7
    assert payload["purpose"] == "github_app"
    assert payload["exp"] - payload["iat"] == 600


def test_callback_rejects_state_signed_for_another_projectops_user():
    settings = github_settings()
    state = parse_qs(urlparse(GitHubAppService().authorization_url(settings, user_id=42, project_id=7)).query)["state"][0]

    with pytest.raises(GitHubAppAuthorizationError, match="signed-in account"):
        GitHubAppService().complete_authorization(None, settings, user_id=99, code="unused", state=state)  # type: ignore[arg-type]


def test_partial_github_app_configuration_is_rejected():
    settings = Settings(github_app_client_id="client-only")
    with pytest.raises(ValueError, match="must be complete"):
        settings.validate_github_app_settings()


def test_installation_token_uses_short_lived_rsa_signed_app_jwt(monkeypatch):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    settings = github_settings()
    settings.github_app_private_key = private_key.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    captured_authorization = ""

    class FakeClient:
        def __init__(self, *args, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): return None
        def post(self, url, headers):
            nonlocal captured_authorization
            captured_authorization = headers["Authorization"]
            response = httpx.Response(201, json={"token": "installation-token"})
            response.request = httpx.Request("POST", url)
            return response

    monkeypatch.setattr(httpx, "Client", FakeClient)
    token = GitHubAppService().installation_token(settings, 91)
    app_token = captured_authorization.removeprefix("Bearer ")
    payload = jwt.decode(app_token, private_key.public_key(), algorithms=["RS256"])

    assert token == "installation-token"
    assert payload["iss"] == "1234"
    assert payload["exp"] - payload["iat"] == 570
