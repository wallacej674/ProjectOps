import base64
import binascii
from dataclasses import dataclass
from typing import Any

import httpx


class RepoTreeFetchError(Exception):
    pass


MAX_MANIFEST_FILES = 20
MAX_MANIFEST_FILE_BYTES = 128 * 1024
MAX_MANIFEST_TOTAL_BYTES = 512 * 1024


@dataclass(frozen=True)
class GitHubRepositorySnapshot:
    paths: list[str]
    manifest_contents: dict[str, str]
    skipped_files: list[str]


def is_supported_manifest(path: str) -> bool:
    normalized = path.replace("\\", "/").strip("/").lower()
    name = normalized.rsplit("/", 1)[-1]
    return (
        name in {
            "package.json", "pyproject.toml", "requirements.txt", "pipfile",
            "poetry.lock", "package-lock.json", "pnpm-lock.yaml", "yarn.lock",
            "dockerfile", "docker-compose.yml", "compose.yml", ".env.example",
        }
        or normalized == "readme.md"
        or (normalized.startswith(".github/workflows/") and normalized.endswith((".yml", ".yaml")))
    )


class GitHubRepoTreeFetcher:
    def __init__(self, timeout_seconds: float = 10.0, access_token: str | None = None) -> None:
        self.timeout_seconds = timeout_seconds
        self.access_token = access_token

    def fetch_tree_paths(self, repo_owner: str, repo_name: str) -> list[str]:
        return self.fetch_repository_snapshot(repo_owner, repo_name).paths

    def fetch_repository_snapshot(self, repo_owner: str, repo_name: str) -> GitHubRepositorySnapshot:
        headers = {"User-Agent": "ProjectOps-CodeMap-Lite", "Accept": "application/vnd.github+json"}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        try:
            with httpx.Client(timeout=self.timeout_seconds, headers=headers) as client:
                repo_response = client.get(f"https://api.github.com/repos/{repo_owner}/{repo_name}")
                repo_response.raise_for_status()
                default_branch = repo_response.json().get("default_branch")
                if not default_branch:
                    raise RepoTreeFetchError("GitHub did not return a default branch for this repository.")

                tree_response = client.get(
                    f"https://api.github.com/repos/{repo_owner}/{repo_name}/git/trees/{default_branch}",
                    params={"recursive": "1"},
                )
                tree_response.raise_for_status()
                tree_payload = tree_response.json()
                if tree_payload.get("truncated"):
                    raise RepoTreeFetchError("GitHub repository tree response was truncated.")

                paths = [
                    item["path"]
                    for item in tree_payload.get("tree", [])
                    if _is_file_or_directory_entry(item) and "path" in item
                ]
                candidates = [path for path in paths if is_supported_manifest(path)][:MAX_MANIFEST_FILES]
                contents: dict[str, str] = {}
                skipped: list[str] = []
                total_bytes = 0
                for path in candidates:
                    response = client.get(
                        f"https://api.github.com/repos/{repo_owner}/{repo_name}/contents/{path}",
                        params={"ref": default_branch},
                    )
                    response.raise_for_status()
                    payload = response.json()
                    if payload.get("encoding") != "base64" or not isinstance(payload.get("content"), str):
                        skipped.append(path)
                        continue
                    raw = base64.b64decode(payload["content"], validate=True)
                    if len(raw) > MAX_MANIFEST_FILE_BYTES or total_bytes + len(raw) > MAX_MANIFEST_TOTAL_BYTES:
                        skipped.append(path)
                        continue
                    try:
                        contents[path] = raw.decode("utf-8")
                    except UnicodeDecodeError:
                        skipped.append(path)
                        continue
                    total_bytes += len(raw)
        except httpx.HTTPError as error:
            raise RepoTreeFetchError("GitHub repository tree could not be fetched.") from error
        except (binascii.Error, ValueError, TypeError) as error:
            raise RepoTreeFetchError("GitHub repository manifest data was invalid.") from error

        return GitHubRepositorySnapshot(paths=paths, manifest_contents=contents, skipped_files=skipped)


def _is_file_or_directory_entry(item: dict[str, Any]) -> bool:
    return item.get("type") in {"blob", "tree"}


github_repo_tree_fetcher = GitHubRepoTreeFetcher()
