from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass(frozen=True)
class ParsedGitHubRepo:
    repo_owner: str
    repo_name: str
    repo_url: str


class InvalidGitHubRepoUrlError(ValueError):
    pass


def parse_github_repo_url(repo_url: str) -> ParsedGitHubRepo:
    if repo_url.startswith("git@github.com:"):
        path = repo_url.removeprefix("git@github.com:")
        return _parse_owner_and_repo(path)

    parsed_url = urlparse(repo_url)
    if parsed_url.scheme != "https" or parsed_url.netloc.lower() != "github.com":
        raise InvalidGitHubRepoUrlError("Enter a valid GitHub repository URL.")

    return _parse_owner_and_repo(parsed_url.path)


def _parse_owner_and_repo(path: str) -> ParsedGitHubRepo:
    path_parts = [part for part in path.split("/") if part]
    if len(path_parts) != 2:
        raise InvalidGitHubRepoUrlError("Enter a valid GitHub repository URL.")

    repo_owner, repo_name = path_parts
    if repo_name.endswith(".git"):
        repo_name = repo_name.removesuffix(".git")

    normalized_url = f"https://github.com/{repo_owner}/{repo_name}"
    return ParsedGitHubRepo(repo_owner=repo_owner, repo_name=repo_name, repo_url=normalized_url)
