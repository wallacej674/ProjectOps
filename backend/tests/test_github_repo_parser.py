import pytest

from app.services.github_repo_parser import InvalidGitHubRepoUrlError, parse_github_repo_url


def test_parse_https_github_repo_url():
    parsed = parse_github_repo_url("https://github.com/openai/codex")

    assert parsed.repo_owner == "openai"
    assert parsed.repo_name == "codex"
    assert parsed.repo_url == "https://github.com/openai/codex"


def test_parse_https_github_repo_url_with_git_suffix():
    parsed = parse_github_repo_url("https://github.com/openai/codex.git")

    assert parsed.repo_owner == "openai"
    assert parsed.repo_name == "codex"
    assert parsed.repo_url == "https://github.com/openai/codex"


def test_parse_ssh_github_repo_url():
    parsed = parse_github_repo_url("git@github.com:openai/codex.git")

    assert parsed.repo_owner == "openai"
    assert parsed.repo_name == "codex"
    assert parsed.repo_url == "https://github.com/openai/codex"


@pytest.mark.parametrize(
    "repo_url",
    [
        "https://gitlab.com/openai/codex",
        "https://github.com/openai",
        "https://github.com/openai/codex/issues",
        "not-a-url",
    ],
)
def test_parse_invalid_github_repo_url(repo_url):
    with pytest.raises(InvalidGitHubRepoUrlError, match="Enter a valid GitHub repository URL."):
        parse_github_repo_url(repo_url)
