# Milestone 4: CodeMap Lite

Milestone 4 adds CodeMap Lite, a small rule-based repository path analyzer for Projects that already have an attached GitHub repository.

The main routes are:

```text
POST /api/v1/projects/{project_id}/analyses/run
GET  /api/v1/projects/{project_id}/analyses/latest
GET  /api/v1/projects/{project_id}/analyses
```

## What Was Built

- A `RepoAnalysis` model backed by the `repo_analyses` table.
- An Alembic migration for `repo_analyses`.
- A public GitHub repository tree fetcher.
- A CodeMap Lite analyzer that turns repository paths into rule-based signals.
- A Repo Analysis repository and service.
- Routes to run an analysis, fetch the latest analysis, and list analysis snapshots.
- Dashboard output backed by the latest attempted Repo Analysis.
- Tests for analyzer rules, service behavior, route behavior, and dashboard output.

## Why Repo Analysis Is A Snapshot

A Repo Analysis captures what CodeMap Lite observed at one point in time.

Snapshots are useful because repository structure can change. Keeping each analysis attempt makes it possible to compare runs later and to show failures honestly instead of hiding them behind older successful results.

## GitHub Tree Fetching

CodeMap Lite uses the public GitHub REST API without tokens.

It fetches:

```text
GET https://api.github.com/repos/{owner}/{repo}
GET https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1
```

The fetcher reads path names only. It does not clone repositories, fetch file contents, inspect commits, read README content, or calculate language percentages.

If the GitHub tree cannot be fetched, CodeMap Lite stores a failed Repo Analysis snapshot with a clear error message.

## Analyzer Rules

CodeMap Lite detects signals from repository paths.

Current signals include:

- `has_readme`
- `has_backend`
- `has_frontend`
- `has_tests`
- `has_ci`
- `has_docker`
- `has_env_example`
- `has_migrations`
- `has_python`
- `has_fastapi`
- `has_sqlalchemy`
- `has_alembic`
- `has_react`
- `has_typescript`
- `has_vite`

The summary is generated only from detected signals. CodeMap Lite does not claim facts it did not detect.

## Dashboard Behavior

The Project Dashboard `latest_repo_analysis` section now reflects the latest attempted Repo Analysis.

The dashboard uses the latest attempted analysis rather than only the latest completed analysis. If the newest analysis failed, the dashboard should show that failure instead of hiding it behind stale successful data.

## What Is Not Included Yet

Milestone 4 does not include AI summaries, OpenAI calls, production readiness scoring, background jobs, frontend pages, GitHub OAuth, private repository support, GitHub tokens, webhooks, repository cloning, file content fetching, deep static analysis, AST parsing, dependency graph analysis, or language percentage calculation.

## Known Limitations

- Public GitHub API calls are unauthenticated and rate-limited.
- Large repositories can return truncated tree responses, which CodeMap Lite treats as failed analysis attempts.
- Detection is path-based and intentionally conservative.
- `GET /analyses` does not have pagination yet.
