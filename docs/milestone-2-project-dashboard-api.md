# Milestone 2: Project Dashboard API

Milestone 2 adds the first Project Dashboard endpoint:

```text
GET /api/v1/projects/{project_id}/dashboard
```

The endpoint gives clients one command-center response for a Project. It returns real Project metadata from the existing `projects` table, then includes placeholder sections for future ProjectOps modules.

## What Was Built

- A dashboard response schema.
- A dashboard service that assembles the response.
- A dashboard route under the existing project API.
- Tests for dashboard success, missing project behavior, and archived project behavior.

## Why The Response Has Placeholder Sections

The dashboard is meant to become the place where CodeMap, SignalWatch, readiness scoring, and future project-preparation modules meet.

Those modules do not exist yet, so Milestone 2 does not invent fake data. Instead, the response exposes stable sections with honest placeholder values:

- `repo` reports that GitHub repo intake is not implemented yet.
- `latest_repo_analysis` is `null`.
- `latest_health_check` is `null`.
- `readiness.score` is `null`.
- `readiness.status` is `not_started`.
- `next_steps` explains what future milestones can add.

This gives future frontend and backend work a stable shape to plug into while keeping this milestone small.

## What The Endpoint Uses

The dashboard uses the existing `Project` model. It does not add a database table because there is no persisted dashboard state yet.

## What Is Not Included Yet

Milestone 2 does not include GitHub API calls, repository validation, file tree fetching, repo analysis, user project health checks, readiness checklist tables, readiness scoring logic, background jobs, frontend pages, authentication, or AI summaries.

## Known Limitations

- Placeholder text is static.
- `repo.connected` is always `false`.
- Analysis and health sections are always `null`.
- Readiness scoring is not calculated.
