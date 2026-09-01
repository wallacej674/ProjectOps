import base64

import httpx
import pytest

from app.services.github_repo_tree_fetcher import (
    GitHubRepoTreeFetcher,
    RepoTreeFetchError,
    is_supported_manifest,
)


def test_supported_manifest_allowlist_excludes_source_files():
    assert is_supported_manifest("package.json") is True
    assert is_supported_manifest("backend/pyproject.toml") is True
    assert is_supported_manifest(".github/workflows/ci.yml") is True
    assert is_supported_manifest("backend/app/main.py") is False
    assert is_supported_manifest(".env") is False


def test_repository_snapshot_fetches_only_supported_utf8_manifests(monkeypatch):
    responses = [
        httpx.Response(200, json={"default_branch": "main"}),
        httpx.Response(200, json={"tree": [
            {"type": "blob", "path": "package.json"},
            {"type": "blob", "path": "src/main.ts"},
        ]}),
        httpx.Response(200, json={"encoding": "base64", "content": base64.b64encode(b'{"name":"demo"}').decode()}),
    ]

    class FakeClient:
        def __init__(self, *args, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): return None
        def get(self, *args, **kwargs):
            response = responses.pop(0)
            response.request = httpx.Request("GET", "https://api.github.com")
            return response

    monkeypatch.setattr(httpx, "Client", FakeClient)
    snapshot = GitHubRepoTreeFetcher().fetch_repository_snapshot("openai", "codex")

    assert snapshot.paths == ["package.json", "src/main.ts"]
    assert snapshot.manifest_contents == {"package.json": '{"name":"demo"}'}


def test_truncated_tree_fails_before_manifest_fetch(monkeypatch):
    responses = [
        httpx.Response(200, json={"default_branch": "main"}),
        httpx.Response(200, json={"truncated": True, "tree": []}),
    ]

    class FakeClient:
        def __init__(self, *args, **kwargs): pass
        def __enter__(self): return self
        def __exit__(self, *args): return None
        def get(self, *args, **kwargs):
            response = responses.pop(0)
            response.request = httpx.Request("GET", "https://api.github.com")
            return response

    monkeypatch.setattr(httpx, "Client", FakeClient)
    with pytest.raises(RepoTreeFetchError, match="truncated"):
        GitHubRepoTreeFetcher().fetch_repository_snapshot("openai", "codex")
    assert responses == []


def test_private_repository_fetcher_uses_bearer_token_without_exposing_it_in_results(monkeypatch):
    captured_headers = {}
    responses = [
        httpx.Response(200, json={"default_branch": "main"}),
        httpx.Response(200, json={"tree": []}),
    ]

    class FakeClient:
        def __init__(self, *args, **kwargs): captured_headers.update(kwargs["headers"])
        def __enter__(self): return self
        def __exit__(self, *args): return None
        def get(self, *args, **kwargs):
            response = responses.pop(0)
            response.request = httpx.Request("GET", "https://api.github.com")
            return response

    monkeypatch.setattr(httpx, "Client", FakeClient)
    snapshot = GitHubRepoTreeFetcher(access_token="short-lived-installation-token").fetch_repository_snapshot("owner", "private")

    assert captured_headers["Authorization"] == "Bearer short-lived-installation-token"
    assert snapshot.manifest_contents == {}
    assert "short-lived-installation-token" not in repr(snapshot)
