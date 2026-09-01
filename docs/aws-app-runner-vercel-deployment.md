# AWS App Runner Backend + Vercel Frontend Deployment

> Alternative architecture only. ProjectOps selected Render Web Service,
> Render Cron Job, Render Postgres, and Vercel for the private beta. Use
> `render-vercel-deployment.md` unless the hosting decision is explicitly
> changed back to AWS.

Use this runbook for the selected private-beta hosting path:

- Frontend: Vercel static hosting from `frontend/dist`.
- Backend: AWS App Runner running the `backend/Dockerfile` container.
- Database: Amazon RDS for PostgreSQL.
- Monitoring: Sentry if enabled, otherwise explicitly deferred.

Do not paste real secrets, RDS connection strings, Sentry DSNs, JWTs, passwords,
or screenshots containing credentials into repository docs.

## Architecture

```text
Vercel
  ProjectOps frontend
  VITE_API_BASE_URL=https://<app-runner-service>

AWS App Runner
  ProjectOps FastAPI backend container
  health check path: /health
  container port: 8000

Amazon RDS PostgreSQL
  managed production database
  automated backups and PITR enabled where available
```

## Backend Container

The backend container is built from `backend/Dockerfile`.

Local image build check:

```powershell
cd backend
docker build -t projectops-backend:local .
```

Local container smoke check, using a real database URL only in your shell
environment:

```powershell
docker run --rm -p 8000:8000 `
  -e PROJECTOPS_ENVIRONMENT=production `
  -e PROJECTOPS_DATABASE_URL="<managed-postgres-url>" `
  -e PROJECTOPS_AUTH_SECRET_KEY="<strong-secret>" `
  -e PROJECTOPS_CORS_ALLOWED_ORIGINS="http://localhost:5173" `
  projectops-backend:local
```

Then run:

```powershell
.\.venv\Scripts\python.exe scripts\smoke_check.py http://127.0.0.1:8000
```

## AWS Resources

Create these resources in AWS:

1. Amazon RDS PostgreSQL.
2. Amazon ECR repository for the backend image.
3. AWS App Runner service sourced from the ECR image.
4. Optional custom domain for the App Runner service.

RDS settings to confirm:

- PostgreSQL 16-compatible engine when available.
- Public or private connectivity chosen intentionally.
- Automated backups enabled.
- PITR available and retention recorded.
- Connection string stored only in App Runner environment/secrets.

App Runner settings:

- Source: ECR container image.
- Port: `8000`.
- Health check protocol: HTTP.
- Health check path: `/health`.
- Logs: CloudWatch logs enabled.
- Auto deploy: enabled only if you are comfortable with image-push deployments.

## Backend Environment Variables

Set these in App Runner environment variables or AWS-managed secret storage:

```text
PROJECTOPS_ENVIRONMENT=production
PROJECTOPS_DATABASE_URL=<rds-postgres-url>
PROJECTOPS_AUTH_SECRET_KEY=<strong-production-secret>
PROJECTOPS_CORS_ALLOWED_ORIGINS=https://<vercel-frontend-origin>
PROJECTOPS_LOG_LEVEL=INFO
PROJECTOPS_ENABLE_ERROR_MONITORING=false
PROJECTOPS_SENTRY_DSN=<sentry-dsn-if-enabled>
PROJECTOPS_SENTRY_ENVIRONMENT=production
PROJECTOPS_HEALTH_CHECK_TIMEOUT_SECONDS=5
PROJECTOPS_ACCESS_TOKEN_EXPIRE_MINUTES=60
PROJECTOPS_RATE_LIMIT_AUTH_LOGIN_ATTEMPTS=5
PROJECTOPS_RATE_LIMIT_AUTH_LOGIN_WINDOW_SECONDS=300
PROJECTOPS_RATE_LIMIT_AUTH_REGISTER_ATTEMPTS=5
PROJECTOPS_RATE_LIMIT_AUTH_REGISTER_WINDOW_SECONDS=3600
PROJECTOPS_RATE_LIMIT_DEMO_SEED_ATTEMPTS=3
PROJECTOPS_RATE_LIMIT_DEMO_SEED_WINDOW_SECONDS=3600
PROJECTOPS_RATE_LIMIT_CODEMAP_RUN_ATTEMPTS=5
PROJECTOPS_RATE_LIMIT_CODEMAP_RUN_WINDOW_SECONDS=300
PROJECTOPS_RATE_LIMIT_HEALTH_CHECK_RUN_ATTEMPTS=10
PROJECTOPS_RATE_LIMIT_HEALTH_CHECK_RUN_WINDOW_SECONDS=300
```

Keep `PROJECTOPS_ENABLE_ERROR_MONITORING=false` unless the Sentry backend DSN is
configured.

## Migration Step

Run migrations after RDS exists and before inviting private-beta users:

```powershell
cd backend
$env:PROJECTOPS_DATABASE_URL = "<rds-postgres-url>"
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Do not run migrations against an unknown database. Confirm the RDS instance and
database name in the AWS console first.

## Frontend On Vercel

Create a Vercel project from the same repository:

- Root directory: `frontend`
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- SPA fallback: already covered by `frontend/vercel.json`

Set Vercel environment variables:

```text
VITE_API_BASE_URL=https://<app-runner-service-or-custom-backend-domain>
VITE_ENABLE_ERROR_MONITORING=false
VITE_SENTRY_DSN=<frontend-sentry-dsn-if-enabled>
VITE_SENTRY_ENVIRONMENT=production
```

After Vercel provides the deployed frontend origin, update App Runner
`PROJECTOPS_CORS_ALLOWED_ORIGINS` to exactly that origin and redeploy/restart the
backend service if required.

## Smoke Tests

Backend health smoke:

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\smoke_check.py https://<app-runner-service-or-custom-backend-domain>
```

Frontend hosted smoke:

1. Open the Vercel frontend URL.
2. Register a disposable private-beta test account.
3. Log out and log back in.
4. Create a Project.
5. Confirm Project Registry search/table view works.
6. Confirm a deep link such as `/app/projects/1/edit` serves the app shell.
7. Confirm no browser console errors during normal flows.

Record safe evidence in `docs/private-beta-deployment-drill.md`.

## Rollback Notes

- Backend: deploy the previous ECR image tag in App Runner.
- Frontend: roll back to the previous Vercel deployment.
- Database: restore RDS to a new instance from automated backup/PITR, then point
  App Runner at the restored database only after verification.

Do not overwrite or delete the original production database during a restore
drill.
