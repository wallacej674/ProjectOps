# Milestone 34: Scheduled Health Monitoring

Status: implemented. Current deployment validation remains part of the hosted
private-beta milestone in `projectops-remaining-work-handoff.md`.

Milestone 34 turns the existing safe manual URL check into an opt-in recurring
operational signal. A Project owner chooses a cadence of 15 minutes, hourly,
every 6 hours, or daily.

## Public seams

- `GET /api/v1/projects/{project_id}/health-monitor` reads schedule state.
- `PUT /api/v1/projects/{project_id}/health-monitor` enables or updates it.
- `DELETE /api/v1/projects/{project_id}/health-monitor` pauses it.
- `python -m app.jobs.run_due_health_checks` claims and executes due schedules.
- Health-check responses expose `execution_source` as `manual` or `scheduled`.
- The Project Dashboard controls cadence, enablement, updates, and pausing.

All API routes use the existing authenticated Project ownership boundary. A
schedule cannot be enabled for an archived Project or one without a production
URL. The worker reuses the existing public-network URL safety checks and stores
each result in the same newest-first Health Check history.

## Deployment model

Render invokes the scheduler command every five minutes. PostgreSQL coordinates
workers: due rows are claimed with row locking and their next run is advanced
before network work begins. No Redis, Celery, or continuously running worker is
required for this private-beta scope.

This is observation history, not an uptime SLA. The milestone does not add
alerts, escalation, incident management, multi-endpoint monitoring, uptime
percentages, or public status pages.

## TDD coverage

The feature is specified through authenticated API tests, scheduler behavior
tests, frontend API contract tests, Project Dashboard interaction tests, and a
Render Blueprint contract test. Backend behavioral tests require the project
PostgreSQL test database; collection remains useful when that service is not
available locally.
