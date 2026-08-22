# Observability and Error Monitoring

ProjectOps observability for private beta focuses on practical error visibility
and request correlation. It does not try to be a full incident-management,
metrics, audit, tracing, or alerting platform.

## Goals

- Capture unexpected backend exceptions when external monitoring is configured.
- Capture frontend render crashes when external monitoring is configured.
- Keep local development, tests, and CI working with monitoring disabled.
- Preserve `X-Request-ID` from backend logs through frontend-facing failures.
- Avoid sending secrets, tokens, cookies, request bodies, or sensitive query
  strings to logs or monitoring events.

## What Is Monitored

- Backend unhandled exceptions that reach the request logging middleware.
- Frontend React render errors caught by the top-level error boundary.
- Request ID context for backend exceptions and frontend errors when available.
- Backend structured request logs with method, path, status code, duration,
  client host, and request ID.

## What Is Not Monitored Yet

- Scheduled uptime checks.
- Background jobs.
- Metrics dashboards.
- Distributed traces.
- Alert routing, PagerDuty, Slack, email, or SMS notifications.
- Status pages or incident management workflows.
- Audit-grade compliance logging.

## Request ID Flow

1. The backend accepts a valid client `X-Request-ID` or generates one.
2. The backend stores it on request state.
3. The backend emits one structured request log with the request ID.
4. The backend returns `X-Request-ID` on the response, including safe 500s.
5. The frontend API client attaches `X-Request-ID` to failed `ApiError`
   instances.
6. User-facing failure panels can show `Request ID: ...` when useful.
7. Backend monitoring events include `request_id` as a tag/context.
8. Frontend monitoring events include `request_id` when the error carries one.

The request ID is only a debugging and support correlation value. It is not an
authentication, authorization, or security control.

## Backend Setup

Backend monitoring uses Sentry when explicitly enabled:

```text
PROJECTOPS_ENABLE_ERROR_MONITORING=true
PROJECTOPS_SENTRY_DSN=<provider dsn>
PROJECTOPS_SENTRY_ENVIRONMENT=private-beta
```

Leave `PROJECTOPS_ENABLE_ERROR_MONITORING=false` or omit
`PROJECTOPS_SENTRY_DSN` for local development and CI. `scripts/check_config.py`
reports whether monitoring is enabled without printing the DSN.

Backend event sanitization removes:

- request body data
- cookies
- `Authorization`, `Cookie`, and `Set-Cookie` headers
- query-string values

## Frontend Setup

Frontend monitoring uses Sentry when explicitly enabled:

```text
VITE_ENABLE_ERROR_MONITORING=true
VITE_SENTRY_DSN=<provider dsn>
VITE_SENTRY_ENVIRONMENT=private-beta
```

Production builds do not require a DSN. With no DSN or with the enable flag off,
monitoring initialization is a no-op.

Frontend event sanitization removes:

- request body data
- cookies
- `Authorization`, `Cookie`, and `Set-Cookie` headers
- query-string values

## Safe Error Behavior

Unexpected backend errors return:

```json
{
  "detail": "ProjectOps hit an unexpected error.",
  "request_id": "<request id>"
}
```

The response also includes the `X-Request-ID` header. Stack traces and internal
exception messages are not returned to the client.

Frontend render crashes show a safe fallback screen with:

- a clear error heading
- a reload action
- a return-to-Overview action
- a request ID only when one is available

The fallback does not show stack traces or internal exception details.

## Triage: Backend 500

1. Copy the `Request ID` from the frontend error panel or the
   `X-Request-ID` response header.
2. Search backend logs for that request ID.
3. Review the structured log entry for method, path, status, duration, and
   timestamp.
4. Search the monitoring provider for the same `request_id` tag.
5. Compare the exception event with the backend log timestamp and path.
6. Fix the underlying issue, then add or update a regression test.

For the hosted private-beta drill, record the request ID and monitoring event
status in `docs/private-beta-deployment-drill.md`.

## Triage: Frontend Crash

1. Confirm the user saw the ProjectOps error fallback rather than a blank page.
2. If the fallback shows a request ID, search monitoring for that value.
3. Search frontend monitoring events by environment and timestamp.
4. Confirm the event does not include tokens, cookies, passwords, request
   bodies, or sensitive query strings.
5. Reproduce locally with monitoring disabled and add a focused test around the
   failing view.

## What Not To Log Or Send

Do not log or send:

- passwords
- JWTs or bearer tokens
- authorization headers
- cookies
- database URLs
- raw request bodies
- form fields containing secrets
- full query strings when they may contain sensitive values
- environment variable values
- backup contents or SQL dumps

## Known Limitations

- Error monitoring is optional and provider-backed only when configured.
- No alerting or on-call workflow exists yet.
- Request logging is operational logging, not audit-grade compliance history.
- Rate limiting is still in-process only.
- Monitoring capture is intentionally minimal and may omit context that would be
  useful but risky to send.

## Future Roadmap

- Provider-specific alert routing after private-beta usage proves what matters.
- Scheduled monitoring and health trends in a later milestone.
- Multi-instance rate-limit backing store.
- Deployment pipeline checks that verify monitoring environment variables are
  present for production-like environments.
- Broader frontend request ID propagation for section-level API failures.
