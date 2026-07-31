# Deployment Readiness

Milestone 19 prepares ProjectOps for a clean deployment path without choosing a
single cloud provider. The expected shape is:

- Frontend: static host such as Vercel, Netlify, Azure Static Web Apps, or similar.
- Backend: Python web service host such as Render, Railway, Fly.io, Azure App Service, or similar.
- Database: managed PostgreSQL such as Neon, Supabase, Railway Postgres, or similar.

ProjectOps still has no authentication or multi-user permissions. Deploy it only
for trusted demonstrations until those controls exist.

## Required Services

- Python 3.11 or newer backend runtime.
- Node.js runtime for building the frontend.
- PostgreSQL 16-compatible database.
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
| `PROJECTOPS_CORS_ALLOWED_ORIGINS` | Yes | Local Vite origins | Comma-separated deployed frontend origins. `*` is rejected in production. |

Frontend variables use Vite's `VITE_` prefix.

| Variable | Required | Local default | Production note |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | Yes in production | `http://127.0.0.1:8000` | Set to the deployed backend origin, for example `https://projectops-api.example.com`. |

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
   `PROJECTOPS_ENVIRONMENT=production`, and `PROJECTOPS_CORS_ALLOWED_ORIGINS`.
3. Install backend dependencies from `backend/pyproject.toml`.
4. Run migrations before serving traffic:

```bash
python -m alembic upgrade head
```

5. Optionally validate config without printing secrets:

```bash
python scripts/check_config.py
```

6. Start the app with Uvicorn:

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
- Back up production data before risky schema changes.
- Rollbacks are not automated yet; treat downgrade planning as future hardening.

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

## Health Endpoints

- `GET /health` verifies the app process is responding and reports environment.
- `GET /health/db` verifies the app can reach the configured database.

Use both for deployment smoke checks. `/health/db` intentionally returns only a
minimal status and does not expose the database URL.

## Smoke Test Checklist

1. Backend `/health` responds.
2. Backend `/health/db` responds.
3. Frontend loads.
4. Frontend can call the backend.
5. Create a Project.
6. Edit the Project.
7. Attach a public GitHub repository URL.
8. Run CodeMap Lite.
9. Add a production URL.
10. Run a manual health check.
11. Evaluate readiness.
12. Create an artifact.
13. Link the artifact as readiness evidence.
14. Check Project detail Recent Activity.
15. Check Overview Recent Activity.
16. Refresh a deep link such as `/app/projects/1/edit` and confirm SPA routing works.
17. Confirm the browser console has no missing API URL or hardcoded-localhost errors.

## Troubleshooting

- Frontend shows an API configuration error: set `VITE_API_BASE_URL` before building.
- Browser reports CORS failure: add the deployed frontend origin to `PROJECTOPS_CORS_ALLOWED_ORIGINS`.
- `/health/db` fails: verify `PROJECTOPS_DATABASE_URL`, database network access, and migrations.
- Deep links return 404 from the host: configure SPA fallback to `index.html`.
- Alembic cannot connect: run migrations from the backend directory and verify environment variables.

## CI/CD Review

The repository currently has `.github/.gitkeep` but no GitHub Actions workflow.
Milestone 19 does not add a deployment pipeline. A small future workflow should
run these checks before deployment:

- Start PostgreSQL or use a managed test database.
- Run backend migrations.
- Run backend pytest.
- Run Python compile checks.
- Run frontend tests.
- Run frontend lint.
- Run the Vite production build.
- Run `git diff --check`.

Deployment automation should be added only after the hosting provider and
environment promotion model are chosen.

## Security and Deployment Footgun Review

Reviewed in Milestone 19:

- CORS is explicit and wildcard origins are rejected in production.
- SSRF protection remains in the manual health-check URL validator.
- Frontend production builds require `VITE_API_BASE_URL`.
- Environment examples avoid committed real secrets.
- Database health checks do not expose connection strings.
- SQLAlchemy queries continue to use structured expressions rather than raw SQL
  interpolation for product data paths.
- Error messages remain user-readable and do not expose stack traces in app code.

This is not a penetration test. Authentication, authorization, rate limiting,
structured logging, dependency scanning, and production monitoring remain future
hardening work.

## Dogfooding ProjectOps

For demos, create a Project named `ProjectOps` inside ProjectOps:

1. Attach this repository.
2. Run CodeMap Lite.
3. Add the deployed backend health URL as the production URL.
4. Run a health check.
5. Evaluate readiness.
6. Add artifacts for deployment notes, architecture notes, risks, and milestone docs.
7. Use Recent Activity and Overview Activity to review the setup flow.

Do not seed this automatically until authentication and environment ownership are defined.

## Known Limitations

- No authentication or authorization.
- No rate limiting.
- No structured logging or external error monitoring.
- No automated backup or restore policy.
- No automated migration rollback strategy.
- No CI/CD deployment pipeline.
- Manual health checks are on-demand only; there are no background jobs.
- Recent Activity is product history, not audit-grade compliance logging.

## Future Hardening Checklist

- Authentication and user ownership.
- Authorization and permissions.
- Rate limiting and request size limits.
- Structured logging and request IDs.
- Error monitoring.
- Database backup and restore runbooks.
- Migration rollback strategy.
- Dependency vulnerability scanning.
- CI/CD test and deploy workflow.
- Secrets management policy.
- HTTPS enforcement through hosting providers.
- Background job system if scheduled checks are added.
- Real audit logging if compliance history becomes a product requirement.

## Milestone 20 Boundary

Milestone 20 should stay focused on the next approved product or operations
slice. Authentication, scheduled monitoring, CI/CD deployment automation, and
production observability are all substantial enough to deserve explicit scope.
