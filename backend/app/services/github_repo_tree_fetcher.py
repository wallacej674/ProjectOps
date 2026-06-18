from typing import Any

import httpx


class RepoTreeFetchError(Exception):
    pass


class GitHubRepoTreeFetcher:
    def __init__(self, timeout_seconds: float = 10.0) -> None:
        self.timeout_seconds = timeout_seconds

    def fetch_tree_paths(self, repo_owner: str, repo_name: str) -> list[str]:
        headers = {"User-Agent": "ProjectOps-CodeMap-Lite"}
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
        except httpx.HTTPError as error:
            raise RepoTreeFetchError("GitHub repository tree could not be fetched.") from error

        if tree_payload.get("truncated"):
            raise RepoTreeFetchError("GitHub repository tree response was truncated.")

        return [
            item["path"]
            for item in tree_payload.get("tree", [])
            if _is_file_or_directory_entry(item) and "path" in item
        ]


def _is_file_or_directory_entry(item: dict[str, Any]) -> bool:
    return item.get("type") in {"blob", "tree"}


github_repo_tree_fetcher = GitHubRepoTreeFetcher()
