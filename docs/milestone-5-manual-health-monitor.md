# Milestone 5: Manual Health Monitor

Milestone 5 adds Manual Health Monitor, a small backend feature for running and storing on-demand Health Checks for Projects.

The main routes are:

```text
POST /api/v1/projects/{project_id}/health-checks/run
GET  /api/v1/projects/{project_id}/health-checks/latest
GET  /api/v1/projects/{project_id}/health-checks
```

## What Was Built

- A `HealthCheck` model backed by the `health_checks` table.
- An Alembic migration for `health_checks`.
- A Health Check repository and service.
- Manual health-check routes under the Project API.
- Dashboard output backed by the latest attempted Health Check.
- Tests for service behavior, route behavior, error handling, and dashboard output.
- A configurable health-check timeout setting.

## How Health Check Targets Are Chosen

`POST /api/v1/projects/{project_id}/health-checks/run` accepts an optional `url`.

- If `url` is provided, ProjectOps checks that URL.
- If `url` is not provided, ProjectOps checks the Project `production_url`.
- If neither exists, ProjectOps returns a clear `400` error.

## Status Values

Manual Health Monitor stores every attempt with one status:

- `healthy`: the target returned a `2xx` or `3xx` HTTP response.
- `unhealthy`: the target returned a `4xx` or `5xx` HTTP response.
- `timeout`: the request timed out.
- `error`: the request failed because of another network or client error.

## Response Preview

ProjectOps stores a short response preview for completed HTTP responses. It does not store full response bodies.

## Dashboard Behavior

The Project Dashboard `latest_health_check` section now reflects the latest attempted Health Check.

If no Health Check has run, `latest_health_check` is `null`.

## Configuration

The request timeout is configured through:

```text
PROJECTOPS_HEALTH_CHECK_TIMEOUT_SECONDS=5
```

## What Is Not Included Yet

Milestone 5 does not include scheduled uptime monitoring, background jobs, Celery/RQ, Redis, email alerts, SMS alerts, Slack alerts, incident management, status pages, multi-endpoint monitoring, uptime percentage calculations, health trend charts, frontend implementation, readiness scoring, deployment automation, or authentication.

## Known Limitations

- Health Checks are manual only.
- There is no pagination for `GET /health-checks` yet.
- There is no URL allowlist or SSRF protection yet.
- Response previews are intentionally short and are not intended for debugging full page content.
