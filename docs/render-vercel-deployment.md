# Render Backend + Vercel Frontend Deployment

This is the selected ProjectOps private-beta hosting architecture:

- Frontend: Vercel, built from `frontend/`.
- Backend: Render Web Service, built from `backend/Dockerfile`.
- Scheduler: Render Cron Job, built from the backend image and run every five minutes.
- Database: Render Postgres on the same private network and region as the backend.
- Monitoring: optional Sentry projects for the frontend and backend.

Do not paste real database URLs, auth secrets, GitHub App credentials, Sentry
DSNs, passwords, or provider tokens into this repository.

## Architecture

```text
Browser -> Vercel -> React/Vite SPA
                    |
                    v
             Render Web Service -> Render Postgres
                  FastAPI          private connection
```

The root `render.yaml` Blueprint defines the backend, scheduler, and database. Render
generates the JWT signing secret, injects the database's private connection
string, runs Alembic before each deploy, checks `/health`, and keeps the API at
one instance while rate limiting remains in process memory.

## 1. Preflight

Before connecting either provider:

1. Merge only after GitHub Actions passes.
2. Confirm no real secrets are committed.
3. Run the local backend and frontend verification commands from `README.md`.
4. Decide the production frontend domain and API domain.
5. Create separate Sentry projects if error monitoring will be enabled.

## 2. Create The Render Blueprint

In Render, create a Blueprint from this repository. Render discovers
`render.yaml` at the repository root and creates:

- `projectops-api`, a paid Docker Web Service in Ohio.
- `projectops-health-monitor`, a Docker Cron Job that claims due schedules every five minutes.
- `projectops-db`, a paid PostgreSQL 16 database in Ohio.

During initial Blueprint creation, set
`PROJECTOPS_CORS_ALLOWED_ORIGINS` to the exact Vercel production origin, for
example `https://projectops.example.com`. Do not use `*`.

The database has no public IP allow list. The API receives its internal Render
connection string through `PROJECTOPS_DATABASE_URL`. ProjectOps normalizes the
provider URL to SQLAlchemy's installed Psycopg 3 driver.

The selected plans are conservative private-beta starting points. Review their
current pricing before creating the Blueprint. Do not switch the API to a free
service: free instances can sleep and do not support the pre-deploy migration
command used by this architecture.

## 3. Optional Backend Variables

Add these in the Render dashboard only when the corresponding feature is used:

```text
PROJECTOPS_ENABLE_ERROR_MONITORING=true
PROJECTOPS_SENTRY_DSN=<backend Sentry DSN>
PROJECTOPS_GITHUB_APP_CLIENT_ID=<GitHub App client ID>
PROJECTOPS_GITHUB_APP_CLIENT_SECRET=<GitHub App client secret>
PROJECTOPS_GITHUB_APP_ID=<GitHub App ID>
PROJECTOPS_GITHUB_APP_SLUG=<GitHub App slug>
PROJECTOPS_GITHUB_APP_PRIVATE_KEY=<GitHub App private key>
PROJECTOPS_GITHUB_APP_CALLBACK_URL=https://<frontend-domain>/app/github/callback
```

GitHub App configuration is all-or-nothing. ProjectOps rejects a partially
configured set. Preserve private-key line breaks when entering the value.

## 4. Deploy The Backend First

Render builds `backend/Dockerfile`, then executes this pre-deploy command on a
separate instance:

```text
python -m alembic upgrade head
```

The new service version is promoted only if the migration succeeds. Render then
starts the Dockerfile command on the injected `PORT` and checks `/health`.

After the first deploy, record the Render API origin and run:

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\smoke_check.py https://<render-api-host>
```

Both `/health` and `/health/db` must pass.

The cron job runs `python -m app.jobs.run_due_health_checks`. It uses the same
private database, claims due schedules transactionally, and advances each next
run before performing the outbound check. Confirm its first successful run in
Render logs before enabling a Project schedule.

## 5. Create The Vercel Project

Import the same repository into Vercel and configure:

| Setting | Value |
| --- | --- |
| Root Directory | `frontend` |
| Framework | Vite |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |

Set these Vercel production variables:

```text
VITE_API_BASE_URL=https://<render-api-host>
VITE_ENABLE_ERROR_MONITORING=false
VITE_SENTRY_ENVIRONMENT=production
```

If frontend Sentry monitoring is enabled, also set
`VITE_ENABLE_ERROR_MONITORING=true` and `VITE_SENTRY_DSN` in Vercel. Vite
variables are embedded in the browser bundle, so never place private backend
credentials in a `VITE_` variable.

`frontend/vercel.json` supplies SPA rewrites for `/login`, `/register`, and
`/app/*`, plus baseline browser security headers.

## 6. Close The Origin Loop

Once the final Vercel domain is known:

1. Set Render `PROJECTOPS_CORS_ALLOWED_ORIGINS` to that exact HTTPS origin.
2. If both the Vercel domain and a custom domain remain active, list both as a
   comma-separated value during the transition.
3. Redeploy the Render service.
4. Confirm browser preflight requests succeed.
5. Remove temporary origins after DNS cutover.

Vercel preview deployments use changing hostnames and are intentionally not
allowed to call the production API by default. Use a separate non-production
backend before enabling full-stack previews.

## 7. Production Verification

Complete `docs/private-beta-hosting-todo-checklist.md` and record evidence in
`docs/private-beta-deployment-drill.md`. At minimum verify:

- Render `/health` and `/health/db`.
- Vercel `/`, `/login`, `/register`, and an authenticated `/app/*` deep link.
- Registration, logout, login, and user isolation.
- Project create/edit/archive flows.
- Public and private GitHub repository flows when configured.
- CodeMap analysis, health checks, readiness, artifacts, and activity.
- Enable a scheduled health monitor, confirm the cron worker stores a result,
  then pause it from the Project Dashboard.
- Render logs and request ID correlation.
- Render PostgreSQL backup and point-in-time recovery settings.
- Vercel and Render rollback procedures.

## 8. Rollback

- Backend-only failure: roll Render back to the previous successful deploy.
- Frontend-only failure: promote the previous Vercel deployment.
- Migration failure before promotion: Render keeps the previous service version;
  inspect the migration output before retrying.
- Unsafe schema or data change: restore Render Postgres to a new database,
  validate it, and only then repoint the service.

Do not assume an application rollback reverses a database migration.

## Scaling Boundary

Keep `numInstances: 1` until the in-process rate limiter is replaced with a
shared store. Before broader production use, also complete a real restore drill,
add uptime alerting, and revisit database and API plan sizing from observed
metrics.
