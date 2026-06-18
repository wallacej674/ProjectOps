# Milestone 3: GitHub Repo Intake

Milestone 3 adds GitHub Repo Intake for Projects. A Project can now attach, read, replace, and remove one public GitHub repository connection.

The main routes are:

```text
POST   /api/v1/projects/{project_id}/repo
GET    /api/v1/projects/{project_id}/repo
DELETE /api/v1/projects/{project_id}/repo
```

## What Was Built

- A `RepoIntegration` model backed by the `repo_integrations` table.
- An Alembic migration for `repo_integrations`.
- A GitHub repository URL parser.
- A repository layer for Repo Integration persistence.
- A Repo Integration service for attach, read, replace, and remove behavior.
- Project repo routes under the existing Project API.
- Dashboard repo output backed by Repo Integration data.
- Tests for URL parsing, repo routes, service behavior, and dashboard repo output.

## Why Repo Integration Exists

`Project.repo_url` remains simple Project metadata. It can store a URL, but it does not mean ProjectOps has connected to that repository.

`RepoIntegration` is the source of truth for connected repository data. It stores the normalized repository URL, owner, name, provider, connected state, and verification fields that future milestones can expand.

Keeping these concepts separate prevents Project CRUD from becoming responsible for GitHub-specific behavior.

## GitHub URL Parsing

The parser supports these public GitHub repository URL formats:

```text
https://github.com/owner/repo
https://github.com/owner/repo.git
git@github.com:owner/repo.git
```

All supported formats normalize to:

```text
https://github.com/owner/repo
```

The parser extracts:

- `repo_owner`
- `repo_name`
- normalized `repo_url`

Invalid or non-GitHub URLs return a clear validation error.

## POST Replaces Existing Connections

Only one Repo Integration is allowed per Project.

`POST /api/v1/projects/{project_id}/repo` behaves as an upsert:

- If the Project has no attached repo, it creates one.
- If the Project already has an attached repo, it replaces the existing connection data.

This keeps the interface small for now. A dedicated `PATCH` route can be added later if partial update behavior becomes necessary.

## Dashboard Behavior

The Project Dashboard repo section now reflects Repo Integration data.

When no repo is attached, the dashboard reports that no GitHub repository has been attached yet.

When a repo is attached, the dashboard reports:

- `connected: true`
- `provider: github`
- `repo_owner`
- `repo_name`
- normalized `repo_url`
- `default_branch: null`
- `last_verified_at: null`

Repo analysis, health checks, and readiness scoring remain placeholders.

## What Is Not Included Yet

Milestone 3 does not include GitHub API calls, GitHub OAuth, private repository support, GitHub tokens, GitHub App installation, repo file tree fetching, CodeMap Lite, language detection, AI summaries, webhooks, background jobs, readiness scoring, user project health checks, frontend implementation, or authentication.

## Known Limitations

- ProjectOps validates GitHub URL shape only; it does not verify that the repository exists.
- `default_branch` is always `null`.
- `last_verified_at` is always `null`.
- Only public GitHub repository URL formats are supported.
- Only one Repo Integration per Project is supported.
