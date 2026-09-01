# Deployment Readiness

ProjectOps now has a selected private-beta deployment path:

- Frontend: Vercel, built from `frontend/`.
- Backend: Render Docker Web Service, built from `backend/Dockerfile`.
- Database: Render Postgres using the same-region private connection string.

The root `render.yaml` declares the backend and database lifecycle. Follow
`docs/render-vercel-deployment.md` for provider setup. The guidance below
retains the provider-neutral operational requirements behind that selection.

ProjectOps has local email/password authentication and account-owned Projects.
It does not yet have teams, organizations, roles, OAuth, password reset,
distributed rate limiting, scheduled monitoring, metrics dashboards, or
production alerting.

## Required Services

- Python 3.11 or newer backend runtime.
- Node.js runtime for building the frontend.
- PostgreSQL 16-compatible database with managed backups enabled before real
  users are invited.
- HTTPS-enabled public frontend and backend URLs supplied by the host.

## Environment Variables

Backend variables use the `PROJECTOPS_` prefix.

| Variable | Required | Local default | Production note |
| --- | --- | --- | --- |
| `PROJECTOPS_APP_NAME` | No | `ProjectOps Backend` | Displayed by `/health`. |
| `PROJECTOPS_ENVIRONMENT` | No | `local` | Use `production` for deployed backend instances. |
| `PROJECTOPS_DATABASE_URL` | Yes | Docker Compose local database | Use the managed PostgreSQL connection string. Keep it secret. |
| `PROJECTOPS_TEST_DATABASE_URL` | Tests only | Docker Compose test database | Used by pytest; not needed in production. |
| `PROJECTOPS_HEALTH_CHECK_TIMEOUT_SECONDS` | No | `5` | Timeout for manual Project URL checks. |
| `PROJECTOPS_LOG_LEVEL` | No | `INFO` | Backend log threshold. Use `INFO` for normal production request logs. |
| `PROJECTOPS_ENABLE_ERROR_MONITORING` | No | `false` | Set to `true` only when a monitoring provider DSN is configured. |
| `PROJECTOPS_SENTRY_DSN` | No | Empty | Optional Sentry DSN for backend unhandled exception capture. Keep it secret. |
| `PROJECTOPS_SENTRY_ENVIRONMENT` | No | Empty | Optional monitoring environment label. Falls back to `PROJECTOPS_ENVIRONMENT`. |
| `PROJECTOPS_AUTH_SECRET_KEY` | Yes in production | Local development placeholder | JWT signing secret. Use a strong production-only value; the local default is rejected in production. |
| `PROJECTOPS_ACCESS_TOKEN_EXPIRE_MINUTES` | No | `60` | Positive access-token lifetime in minutes. |
| `PROJECTOPS_RATE_LIMIT_AUTH_LOGIN_ATTEMPTS` | No | `5` | Login attempts allowed per client IP and per email within the login window. |
| `PROJECTOPS_RATE_LIMIT_AUTH_LOGIN_WINDOW_SECONDS` | No | `300` | Login rate-limit window in seconds. |
| `PROJECTOPS_RATE_LIMIT_AUTH_REGISTER_ATTEMPTS` | No | `5` | Registration attempts allowed per client IP and per email within the registration window. |
| `PROJECTOPS_RATE_LIMIT_AUTH_REGISTER_WINDOW_SECONDS` | No | `3600` | Registration rate-limit window in seconds. |
| `PROJECTOPS_RATE_LIMIT_DEMO_SEED_ATTEMPTS` | No | `3` | Demo seed attempts allowed per user within the demo seed window. |
| `PROJECTOPS_RATE_LIMIT_DEMO_SEED_WINDOW_SECONDS` | No | `3600` | Demo seed rate-limit window in seconds. |
| `PROJECTOPS_RATE_LIMIT_CODEMAP_RUN_ATTEMPTS` | No | `5` | CodeMap Lite runs allowed per user and Project within the CodeMap window. |
| `PROJECTOPS_RATE_LIMIT_CODEMAP_RUN_WINDOW_SECONDS` | No | `300` | CodeMap Lite run rate-limit window in seconds. |
| `PROJECTOPS_RATE_LIMIT_HEALTH_CHECK_RUN_ATTEMPTS` | No | `10` | Manual health checks allowed per user and Project within the health-check window. |
| `PROJECTOPS_RATE_LIMIT_HEALTH_CHECK_RUN_WINDOW_SECONDS` | No | `300` | Manual health-check rate-limit window in seconds. |
| `PROJECTOPS_CORS_ALLOWED_ORIGINS` | Yes | Local Vite origins | Comma-separated deployed frontend origins. `*` is rejected in production. |

Frontend variables use Vite's `VITE_` prefix.

| Variable | Required | Local default | Production note |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | Yes in production | `http://127.0.0.1:8000` | Set to the deployed backend origin, for example `https://projectops-api.example.com`. |
| `VITE_ENABLE_ERROR_MONITORING` | No | `false` | Set to `true` only when a frontend monitoring DSN is configured. |
| `VITE_SENTRY_DSN` | No | Empty | Optional Sentry DSN for frontend render crash capture. Do not commit a real value. |
| `VITE_SENTRY_ENVIRONMENT` | No | Empty | Optional frontend monitoring environment label. |

## Local Development Setup

From the repository root:

```powershell
Copy-Item .env.example .env
docker compose up -d db
```

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe scripts\check_config.py
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

The frontend defaults to the local backend. Create `frontend/.env.local` from
`frontend/.env.example` only when you need to override that URL.

## Backend Deployment Steps

1. Create a managed PostgreSQL database.
2. Configure backend environment variables, especially `PROJECTOPS_DATABASE_URL`,
   `PROJECTOPS_ENVIRONMENT=production`, `PROJECTOPS_AUTH_SECRET_KEY`, and
   `PROJECTOPS_CORS_ALLOWED_ORIGINS`.
3. Install backend dependencies from `backend/pyproject.toml`.
4. Confirm managed database backups are enabled and a fresh backup or snapshot
   exists.
5. Run migrations before serving traffic:

```bash
python -m alembic upgrade head
```

6. Optionally validate config without printing secrets:

```bash
python scripts/check_config.py
```

7. Start the app with Uvicorn:

```bash
python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
```

Some providers inject `PORT`; use their documented variable syntax if this
shell form is not supported.

## Frontend Deployment Steps

1. Set `VITE_API_BASE_URL` to the deployed backend origin.
2. Install dependencies with `npm ci` or `npm install`.
3. Build:

```bash
npm run build
```

4. Deploy the `frontend/dist` directory.
5. Ensure static hosting falls back `/app/*` routes to `index.html`.

For Vercel, `frontend/vercel.json` includes:

```json
{
  "rewrites": [
    { "source": "/app/:path*", "destination": "/index.html" }
  ]
}
```

For other static hosts, configure the equivalent SPA fallback.

## Database Setup

Local Docker Compose creates:

- `projectops`
- `projectops_test`

Production should use one managed PostgreSQL database for the app. Keep test
databases separate from production and do not reuse production connection
strings in local tests.

## Migration Strategy

- Run `python -m alembic upgrade head` on every deploy before starting the new backend.
- Do not squash migrations without a deliberate migration plan.
- Back up production data before schema changes.
- Prefer provider snapshots or point-in-time recovery for destructive migration
  rollback.
- Use `python -m alembic downgrade -1` only when the specific migration
  downgrade has been tested with representative data.

See `docs/backup-restore-runbook.md` for backup drills, restore procedure, and
migration rollback guidance.

## Backup And Restore

ProjectOps does not own provider-level backup automation. The deployment owner
must enable managed PostgreSQL automated backups, confirm retention, and run a
restore drill before launch. Database dumps contain sensitive user data and must
not be committed, emailed unencrypted, pasted into support threads, or stored in
shared locations without an expiration plan.

Use `docs/backup-restore-runbook.md` as the launch runbook. It covers recovery
targets, local backup and restore drills, production restore procedure,
migration release checks, and migration rollback decision rules.

## CORS Setup

Backend CORS is controlled by `PROJECTOPS_CORS_ALLOWED_ORIGINS`.

Local:

```text
PROJECTOPS_CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Production:

```text
PROJECTOPS_CORS_ALLOWED_ORIGINS=https://projectops.example.com
```

If multiple frontend origins are used, separate them with commas. Wildcard CORS
is rejected when `PROJECTOPS_ENVIRONMENT` is `production` or `prod`.

## Authentication Setup

ProjectOps uses local email/password accounts with Argon2 password hashes and
JWT bearer access tokens. Frontend sessions store the access token in
`localStorage`, which keeps local demos simple but is not a substitute for a
full production session-security review.

Production deployments must set:

```text
PROJECTOPS_AUTH_SECRET_KEY=<strong random secret>
PROJECTOPS_ACCESS_TOKEN_EXPIRE_MINUTES=60
```

The backend rejects the checked-in local development secret when
`PROJECTOPS_ENVIRONMENT` is `production` or `prod`. Rotating the auth secret
invalidates existing access tokens.

## Rate Limiting

ProjectOps includes an in-process fixed-window rate limiter for launch
hardening. It protects:

- `/api/v1/auth/login` by client IP and normalized email.
- `/api/v1/auth/register` by client IP and normalized email.
- `/api/v1/demo-data/seed` by signed-in user.
- `/api/v1/projects/{project_id}/analyses/run` by signed-in user and Project.
- `/api/v1/projects/{project_id}/health-checks/run` by signed-in user and
  Project.

Limited requests return `429 Too Many Requests` with a `Retry-After` header.
This limiter is intended for a single backend process or small private beta. If
ProjectOps runs multiple backend instances, replace the in-memory store with a
shared store such as Redis or provider-managed edge rate limiting so limits are
consistent across instances.

## Request Logging

ProjectOps emits one structured JSON request log per backend request through the
`projectops.request` logger. The log fields include request ID, method, path,
status code, duration in milliseconds, and client host. The middleware also
returns `X-Request-ID` on responses, preserves valid client-provided request
IDs, and exposes the header through CORS for browser debugging.

Request logs intentionally do not include request bodies, authorization headers,
cookies, or query strings. Use the request ID to correlate a frontend/browser
error with the backend log line.

## Error Monitoring

ProjectOps can capture backend unhandled exceptions and frontend render crashes
with Sentry when DSNs are configured. Monitoring is disabled by default and
remains a no-op for local development, tests, and CI unless explicitly enabled.

Backend:

```text
PROJECTOPS_ENABLE_ERROR_MONITORING=true
PROJECTOPS_SENTRY_DSN=<provider dsn>
PROJECTOPS_SENTRY_ENVIRONMENT=production
```

Frontend:

```text
VITE_ENABLE_ERROR_MONITORING=true
VITE_SENTRY_DSN=<provider dsn>
VITE_SENTRY_ENVIRONMENT=production
```

Unexpected backend exceptions return a generic 500 JSON response with
`request_id` and the `X-Request-ID` header. Frontend API errors can carry that
request ID into visible error panels. The frontend error boundary catches render
crashes and shows reload / return-to-Overview actions instead of a blank screen.

Monitoring events intentionally strip request bodies, cookies, authorization
headers, and query strings. See `docs/observability-error-monitoring.md` for
the full request ID triage flow and privacy rules.

## Health Endpoints

- `GET /health` verifies the app process is responding and reports environment.
- `GET /health/db` verifies the app can reach the configured database.

Use both for deployment smoke checks. `/health/db` intentionally returns only a
minimal status and does not expose the database URL.

You can run the safe unauthenticated smoke helper against a deployed backend:

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\smoke_check.py https://projectops-api.example.com
```

The helper checks only `/health` and `/health/db`; it does not require a test
account and does not print secrets.

## Smoke Test Checklist

1. Backend `/health` responds.
2. Backend `/health/db` responds.
3. Frontend loads.
4. Frontend can call the backend.
5. Register or sign in.
6. Create a Project.
7. Edit the Project.
8. Attach a public GitHub repository URL.
9. Run CodeMap Lite.
10. Add a production URL.
11. Run a manual health check.
12. Evaluate readiness.
13. Create an artifact.
14. Link the artifact as readiness evidence.
15. Check Project detail Recent Activity.
16. Check Overview Recent Activity.
17. Sign out and confirm protected app routes redirect to sign in.
18. Refresh a deep link such as `/app/projects/1/edit` and confirm SPA routing works.
19. Confirm the browser console has no missing API URL or hardcoded-localhost errors.
20. Confirm managed PostgreSQL automated backups are enabled and a restore drill
    has been completed for the target environment.

## Troubleshooting

- Frontend shows an API configuration error: set `VITE_API_BASE_URL` before building.
- Browser reports CORS failure: add the deployed frontend origin to `PROJECTOPS_CORS_ALLOWED_ORIGINS`.
- Sign-in works but app API calls fail with CORS preflight errors: confirm
  `Authorization` is allowed by the backend CORS response and the frontend
  origin is configured.
- `/health/db` fails: verify `PROJECTOPS_DATABASE_URL`, database network access, and migrations.
- Deep links return 404 from the host: configure SPA fallback to `index.html`.
- Alembic cannot connect: run migrations from the backend directory and verify environment variables.

## CI/CD Review

Milestone 20 adds a GitHub Actions CI quality gate at
`.github/workflows/ci.yml`. It runs on pushes and pull requests to `main` and
checks release confidence before merge:

- Backend Alembic migrations against a disposable PostgreSQL service container.
- Backend pytest.
- Backend Python compile checks.
- Backend deployment config validation.
- Frontend Vitest tests.
- Frontend ESLint.
- Frontend Vite production build.
- Backend Python dependency vulnerability scanning with `pip-audit`.
- Frontend npm dependency vulnerability scanning with high-or-worse advisory
  failures.
- Git diff whitespace hygiene.

See `docs/ci-quality-gate.md` for the workflow design, safe CI environment
variables, local command equivalents, troubleshooting notes, and branch
protection recommendations.

This CI quality gate is not a deployment pipeline. Deployment automation should
be added only after the hosting provider and environment promotion model are
chosen.

## Private-Beta Deployment Drill

Use `docs/private-beta-deployment-drill.md` to record the actual private-beta
deployment evidence. That runbook covers provider stack, backend and frontend
settings, database migration status, health check results, product smoke tests,
observability smoke tests, request ID correlation proof, backup/PITR status,
rollback notes, and the private-beta go/no-go decision.

## Security and Deployment Footgun Review

Reviewed in Milestone 19:

- CORS is explicit and wildcard origins are rejected in production.
- SSRF protection remains in the manual health-check URL validator.
- Frontend production builds require `VITE_API_BASE_URL`.
- Production config rejects the checked-in local auth secret and requires a
  production-only `PROJECTOPS_AUTH_SECRET_KEY`.
- Project routes require a bearer token and scope Project visibility to the
  authenticated account.
- Login, registration, demo seed, CodeMap run, and manual health-check run
  endpoints have fixed-window rate limits.
- Backend responses include `X-Request-ID` and emit structured JSON request
  logs without request bodies, credentials, cookies, or query strings.
- Optional error monitoring is disabled by default, redacts sensitive request
  data, and includes request ID context when configured.
- Unexpected backend exceptions return generic 500 responses without stack
  traces, and frontend render crashes show a safe error boundary.
- Backup, restore, and migration rollback runbooks document launch recovery
  procedures and local drills.
- Environment examples avoid committed real secrets.
- Database health checks do not expose connection strings.
- Demo data seeding is disabled when `PROJECTOPS_ENVIRONMENT` is `production`
  or `prod`.
- Python and npm dependency vulnerability scans run in CI.
- SQLAlchemy queries continue to use structured expressions rather than raw SQL
  interpolation for product data paths.
- Error messages remain user-readable and do not expose stack traces in app code.

This is not a penetration test. Fine-grained authorization, shared-store rate
limiting, deeper supply-chain review, provider alerting, and metrics/tracing
remain future hardening work.

## Dogfooding ProjectOps

For demos, create a Project named `ProjectOps` inside ProjectOps:

1. Attach this repository.
2. Run CodeMap Lite.
3. Add the deployed backend health URL as the production URL.
4. Run a health check.
5. Evaluate readiness.
6. Add artifacts for deployment notes, architecture notes, risks, and milestone docs.
7. Use Recent Activity and Overview Activity to review the setup flow.

Milestone 21 also provides an explicit demo workspace seed for first-run local
exploration. The seed now requires a signed-in user outside production and is
idempotent per account. Do not rely on demo records as production evidence: the
seed uses stored sample snapshots and is disabled in production.

## Known Limitations

- No teams, organizations, roles, OAuth, password reset, or account administration.
- No fine-grained authorization beyond account-owned Project isolation.
- Rate limiting is in-process only; it is not shared across multiple backend instances.
- Optional external error monitoring exists, but no alerting, metrics dashboard,
  tracing platform, or incident workflow exists yet.
- Provider-specific private-beta deployment evidence is tracked in
  `docs/private-beta-deployment-drill.md`; hosted checks remain pending until a
  provider stack is selected and exercised.
- Backup, restore, and migration rollback procedures are documented, but
  provider-managed backup automation and restore drills still must be configured
  per deployment.
- No CI/CD deployment pipeline.
- Manual health checks are on-demand only; there are no background jobs.
- Recent Activity is product history, not audit-grade compliance logging.

## Future Hardening Checklist

- Teams, organizations, roles, and account administration.
- Fine-grained authorization and permissions.
- Shared-store or edge rate limiting and request size limits.
- Monitoring alert routing and metrics/tracing if production usage justifies it.
- Automated backup monitoring, scheduled restore drills, and provider-specific
  rollback automation.
- Deeper supply-chain policy checks beyond dependency vulnerability scanning.
- CI/CD deploy workflow.
- Secrets management policy.
- HTTPS enforcement through hosting providers.
- Background job system if scheduled checks are added.
- Real audit logging if compliance history becomes a product requirement.

## Next Boundary

Future milestones should keep teams, roles, OAuth, scheduled monitoring, CI/CD
deployment automation, alerting, and broader production observability as
explicit product or operations slices.
