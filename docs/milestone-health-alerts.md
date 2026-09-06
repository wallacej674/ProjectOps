# Health Alerts and Monitoring Freshness

Status: implemented in the repository. Hosted validation remains pending.

## User behavior

Scheduled monitoring now produces in-app Health Alerts after two consecutive
unhealthy, timeout, or error results. Two consecutive healthy scheduled results
recover an alert. A single successful check does not clear it. Manual checks,
including checks of alternative URLs, do not affect this lifecycle.

Each episode records its target, first failure, opening, latest observation,
recovery or closure, failed-check count, acknowledgement, and supporting checks.
Acknowledgement records the authenticated owner and keeps the alert active.
The Project Dashboard exposes history and paginated evidence. Overview, the
Operations Map, and cross-Project Health Monitoring expose active alerts and
monitoring freshness. External delivery is not implemented.

Pausing retains an active alert with recovery unconfirmed. Resume and cadence
changes reset streaks. Target changes/removal close the old episode without
claiming recovery. Archiving via DELETE or PATCH disables monitoring and closes
the episode; restoring the Project does not restart monitoring.

Monitoring overdue is separate from endpoint failure. It appears at the last
scheduled completion plus cadence plus ten minutes, or sequence start plus
cadence plus ten minutes if no result has completed. Claims do not extend this
deadline. Disabled schedules are never overdue. The UI refreshes every minute
while visible and on return, retaining data with an explicit warning on errors.
Detection depends on cadence and cron execution; timestamps do not establish
exact downtime, an uptime percentage, or an availability guarantee.

## API

- GET /api/v1/projects/{project_id}/health-alerts: status-filtered history.
- GET /api/v1/projects/{project_id}/health-alerts/{alert_id}: episode and evidence.
- POST /api/v1/projects/{project_id}/health-alerts/{alert_id}/acknowledge:
  idempotent owner acknowledgement; newly acknowledging an inactive alert is 409.
- Lists use limit (1-100, default 25) and offset (default 0), with total counts.
- Existing monitor responses add active_alert, consecutive_healthy, freshness,
  failure_threshold, and recovery_threshold.
- Cross-Project health adds monitor and latest_scheduled_check. latest_check
  remains the latest observation of either execution source for compatibility.
- Existing ownership rules apply, including 404 for another account's resources.

Health alert transition events use the existing health activity category.
Evidence membership is persisted explicitly so an episode can retain observations
across pauses and cadence changes without including unrelated or manual checks.

## Worker and storage

Migration 0014_health_alerts follows 0013_health_monitor. It creates alert and
evidence tables, a partial unique index allowing only one active alert per
Project, and monitoring generation/lease/streak fields. Existing observations
remain intact; existing streaks reset and no historical alerts are generated.

The worker claims one Project at a time using PostgreSQL SKIP LOCKED, with a
10-minute lease. Project-before-schedule locking is shared by mutations and
completion. No network work occurs under those row locks. Completion verifies
claim identity, expiration, generation, target, and enablement. Superseded or
expired results are discarded. Observation, counters, alert, completion, and
activity commit together. A failed Project rolls back independently; remaining
Projects are attempted and unexpected processing failures produce a nonzero exit.

A crashed attempt does not generate a synthetic check. It is eligible for a
later attempt once the lease has expired and the schedule is due. Worker logs
include claim/completion/discard/failure identifiers. Database records remain the
source of truth for committed transitions.

The real HTTP client streams at most 16 KiB of decoded response data into its
bounded preview buffer and stores at most 500 characters. Existing URL safety,
timeouts, and disabled redirect following remain in force.

## Verification and rollout

Automated PostgreSQL scenarios cover failure, acknowledgement, recovery,
interrupted recovery, pause/resume, archive, target changes, ownership,
concurrency, expired claims, storage rollback, worker isolation, freshness,
and bounded response streaming. The migration is exercised in an isolated schema
that is rolled back after verification. React tests cover acknowledgement,
evidence, stale data, visible polling, cleanup, and portfolio filtering.

Before a hosted release:

1. Pause the cron worker.
2. Apply migration 0014_health_alerts.
3. Release the API, frontend, and worker together, then resume the cron worker.
4. Against an isolated controlled endpoint, produce two failures, acknowledge,
   produce two successes, and verify evidence/history in the UI.
5. Verify pause and overdue behavior and record provider evidence in the
   private-beta deployment drill.

For rollback, pause the worker and retain the additive schema and evidence.
Downgrade deliberately refuses to delete existing alert history. This milestone
creates no provider resources and does not complete hosted private-beta approval.

## Local verification record (2026-09-04 America/Chicago)

- Backend: 313 tests passed, including PostgreSQL worker/API and isolated migration tests.
- Frontend: 305 tests passed in the full suite; the additional attention-ordering
  scenario passed with its 10-test Overview suite (306 frontend tests in total).
- TypeScript and Vite production build passed. ESLint passed with five existing
  Fast Refresh warnings; Vite reported a main-bundle size warning.
- Preview route smoke checks passed for /, /app, and /app/projects/1/edit.
- Backend configuration check and Python compilation passed.
- npm audit reported zero vulnerabilities; pip-audit reported no known
  vulnerabilities (the local ProjectOps package is not listed on PyPI).
- Hosted deployment, provider logs, and the hosted controlled-endpoint drill
  remain pending. No application database migration or provider deployment was
  performed as part of this implementation; migration verification used an
  isolated test schema.
