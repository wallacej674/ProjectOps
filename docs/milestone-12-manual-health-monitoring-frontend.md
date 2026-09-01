# Milestone 12: Manual Health Monitoring Frontend

> Historical milestone record. Scheduled monitoring controls now extend this section; see `projectops-remaining-work-handoff.md`.

Milestone 12 connects the existing Manual Health Monitor backend to the Project
detail frontend.

## What was built

- Project detail Health Monitoring section.
- Production-URL-required state when a Project has no health-check target.
- Ready-to-run state when a Project has a production URL but no checks yet.
- Run Health Check / Run Again controls.
- Pending state while a manual health check is running.
- One-time override URL input backed by the backend's optional `{ url }` body.
- Latest health-check result display.
- Healthy, unhealthy, timeout, and error status labels with text meanings.
- HTTP status, response time, checked timestamp, response preview, error
  message, and target URL display where available.
- Health-check history list.
- Scoped loading and error states for latest health check, history, and run
  failures.
- SSRF-blocked URL safety message.
- Frontend API module for health-check routes.
- Frontend tests for API behavior and Project detail Health Monitoring behavior.

## Backend routes used

```text
POST /api/v1/projects/{project_id}/health-checks/run
GET  /api/v1/projects/{project_id}/health-checks/latest
GET  /api/v1/projects/{project_id}/health-checks
GET  /api/v1/projects/{project_id}
```

The run route accepts an optional request body:

```json
{ "url": "https://status.example.com/health" }
```

When the body is omitted, the backend uses `Project.production_url`. The
frontend does not invent query parameters for history.

## Manual checks vs scheduled monitoring

Manual Health Check means:

- A user clicks a button.
- ProjectOps checks one target URL.
- The backend stores the result.
- No schedule or alert is created.

Scheduled Monitoring is not part of this milestone. The UI does not show uptime
percentages, charts, incidents, status pages, notifications, or background-job
state.

## Status meanings

- Healthy: the endpoint responded with a 2xx or 3xx status.
- Unhealthy: the endpoint responded, but returned a 4xx or 5xx status.
- Timeout: the endpoint did not respond before the backend timeout.
- Error: ProjectOps could not complete the request because of a network or
  client error.

These labels describe one stored manual check. They do not prove that
production is down, healthy over time, or ready for launch.

## SSRF-blocked URL behavior

The backend blocks local, private, link-local, credentialed, unsupported-scheme,
or otherwise unsafe URLs before making the outbound request. Those blocked
attempts return validation errors and are not stored as `HealthCheck` rows.

The frontend shows this product-level message:

```text
ProjectOps blocked this URL because health checks cannot target local, private, link-local, or otherwise unsafe network addresses.
```

## UI states

1. No production URL configured: the run button is disabled and the user is
   directed to Edit Project.
2. Production URL configured, no checks yet: the user can run a manual health
   check against the saved production URL.
3. Latest check healthy: the UI shows green status text plus HTTP status,
   response time, timestamp, and response preview.
4. Latest check unhealthy, timeout, or error: the UI shows status text,
   available metadata, response preview or error message, and a concise status
   meaning.
5. History: the newest stored attempts are shown in a compact list.

## Local testing

```powershell
cd frontend
npm test
npm run lint
npm run build
```

There is no separate `npm run typecheck` script. `npm run build` runs `tsc -b`
before the Vite production build.

Backend regression:

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m compileall app tests
```

## Manual verification checklist

1. Create a Project without a production URL.
2. Open Project detail.
3. Confirm Health Monitoring says a production URL is required.
4. Edit the Project and add a production URL.
5. Return to Project detail.
6. Confirm Health Monitoring changes to ready-to-check state.
7. Click Run Health Check.
8. Confirm the button becomes pending and disabled.
9. Confirm latest health check appears after success.
10. Confirm status, HTTP status, response time, timestamp, and preview display.
11. Run health check again.
12. Confirm history updates.
13. Test a 4xx or 5xx URL if practical.
14. Test a blocked unsafe URL through the one-time override.
15. Confirm error messages are useful.
16. Confirm Project metadata still works.
17. Confirm RepoIntegration UI still works.
18. Confirm CodeMap UI still works.
19. Confirm dark and light themes remain readable.
20. Confirm mobile layout remains usable.

## Known limitations

- Health-check history is not paginated because the backend route has no
  pagination contract yet. The UI shows the newest six attempts.
- Sidebar Health Monitoring remains a future-state navigation item. The real
  Health Monitoring UI lives inside Project detail for this milestone.
- Checks run synchronously from the UI. There are no background jobs or live
  progress events.
- Blocked SSRF attempts are not stored by the backend, so they appear as scoped
  request errors rather than history rows.
- The UI does not validate that an override URL is reachable before sending it;
  backend validation remains the source of truth.

## Future Milestone 13 boundary

Readiness UI can later consume Project metadata, the latest `RepoAnalysis`, and
the latest `HealthCheck` as evidence. It should not treat a single manual health
check as scheduled monitoring or production readiness by itself.

Milestone 13 should keep Readiness separate from the run-health-check control
flow and explain which inputs are available, missing, stale, or advisory.

## Learning notes

- Keep backend route details inside focused API modules.
- Treat `404` no-health-check responses as normal empty states.
- Keep run errors scoped to the Health Monitoring section so Project metadata,
  repository connection, and CodeMap remain usable.
- Display status with text and symbols, not color alone.
- Long URLs and response previews need wrapping/scrolling styles because backend
  evidence can exceed mobile viewport width.
