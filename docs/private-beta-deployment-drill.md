# Private-Beta Deployment Drill

This runbook records the ProjectOps private-beta deployment drill. It is
provider-neutral until a frontend host, backend host, managed PostgreSQL
provider, and monitoring project are selected.

Do not paste real secrets, tokens, Sentry DSN values, database URL values, auth
secret values, passwords, backup contents, or provider credentials into this
file. Record only redacted values, provider names, timestamps, request IDs, and
operator notes.

## Drill Status

| Area | Status | Notes |
| --- | --- | --- |
| Provider stack | Pending provider access | No frontend/backend/database provider selected in the repository. |
| Backend deploy | Pending provider access | Local backend verification passes; hosted deploy not yet run. |
| Frontend deploy | Pending provider access | Vite build and Vercel SPA fallback config exist; hosted deploy not yet run. |
| Managed database | Pending provider access | Provider backup/PITR settings must be confirmed in provider UI. |
| Observability | Pending provider access | Sentry config exists; real provider event arrival must be verified. |
| Request ID correlation | Pending provider access | Local behavior is covered by tests; hosted logs/events must be checked. |

## Provider Stack

Record the chosen provider stack before running the drill:

| Layer | Provider | URL or project name | Status |
| --- | --- | --- | --- |
| Frontend static host | Pending | Do not paste credentials | Pending |
| Backend web service host | Pending | Do not paste credentials | Pending |
| Managed PostgreSQL | Pending | Do not paste database URL | Pending |
| Monitoring | Pending | Do not paste Sentry DSN | Pending |

Recommended provider shape:

- Frontend: Vercel, Netlify, Azure Static Web Apps, or similar.
- Backend: Render, Railway, Fly.io, Azure App Service, or similar.
- Database: Neon, Supabase Postgres, Railway Postgres, or similar.
- Monitoring: Sentry or equivalent.

## Backend Deployment Settings

Use the backend directory as the deploy root unless the provider requires the
repository root plus a working-directory setting.

| Setting | Value |
| --- | --- |
| Runtime | Python 3.11 or newer |
| Install command | `python -m pip install -e ".[dev]"` for CI/test; production may use `python -m pip install -e "."` |
| Migration command | `python -m alembic upgrade head` |
| Start command | `python -m uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}` |
| Health check path | `/health` |
| Database health path | `/health/db` |
| Log format | Structured JSON on `projectops.request` |

Backend environment variables:

```text
PROJECTOPS_APP_NAME=ProjectOps Backend
PROJECTOPS_ENVIRONMENT=production
PROJECTOPS_DATABASE_URL=<managed postgresql url>
PROJECTOPS_HEALTH_CHECK_TIMEOUT_SECONDS=5
PROJECTOPS_CORS_ALLOWED_ORIGINS=<deployed frontend origin>
PROJECTOPS_AUTH_SECRET_KEY=<strong provider-managed secret>
PROJECTOPS_ACCESS_TOKEN_EXPIRE_MINUTES=60
PROJECTOPS_LOG_LEVEL=INFO
PROJECTOPS_ENABLE_ERROR_MONITORING=false
PROJECTOPS_SENTRY_DSN=<provider-managed sentry dsn if enabled>
PROJECTOPS_SENTRY_ENVIRONMENT=private-beta
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

Use `PROJECTOPS_ENVIRONMENT=production` for a true production deployment. Use a
private-beta or staging value only if demo seeding should remain available for a
non-production drill.

## Frontend Deployment Settings

| Setting | Value |
| --- | --- |
| Runtime | Node.js 20 or newer recommended |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Preview command | `npm run preview` |
| Build output directory | `frontend/dist` |
| SPA fallback | Serve `/app/*` routes to `index.html` |
| Existing Vercel config | `frontend/vercel.json` rewrites `/app/:path*` to `/index.html` |

Frontend environment variables:

```text
VITE_API_BASE_URL=<deployed backend origin>
VITE_ENABLE_ERROR_MONITORING=false
VITE_SENTRY_DSN=<provider-managed sentry dsn if enabled>
VITE_SENTRY_ENVIRONMENT=private-beta
```

The frontend stores the JWT bearer token in `localStorage`. Confirm normal
browser flows work over HTTPS before inviting private-beta users.

## Database Provider And Migration Settings

Record the managed PostgreSQL provider before running migrations:

| Item | Status | Notes |
| --- | --- | --- |
| PostgreSQL version | Pending provider access | Use PostgreSQL 16-compatible provider when possible. |
| SSL mode required | Pending provider access | Follow provider connection-string guidance. |
| Migration command | Ready | `python -m alembic upgrade head` |
| Current revision before deploy | Pending provider access | Run `python -m alembic current`. |
| Revision after deploy | Pending provider access | Record after migration. |
| Backup before migration | Pending provider access | Confirm snapshot/backup exists before migration. |

Do not run migrations against an unknown production database. Confirm the target
environment and database name in the provider UI before running Alembic.

## Environment Variable Checklist

Backend:

- [ ] `PROJECTOPS_ENVIRONMENT` set intentionally.
- [ ] `PROJECTOPS_DATABASE_URL` stored only in provider secrets/env UI.
- [ ] `PROJECTOPS_AUTH_SECRET_KEY` stored only in provider secrets/env UI.
- [ ] `PROJECTOPS_CORS_ALLOWED_ORIGINS` exactly matches deployed frontend origin.
- [ ] `PROJECTOPS_LOG_LEVEL=INFO` unless troubleshooting.
- [ ] Monitoring enable flag and Sentry DSN match the drill decision.
- [ ] Rate-limit values are positive.

Frontend:

- [ ] `VITE_API_BASE_URL` points to deployed backend origin.
- [ ] Frontend Sentry settings match the drill decision.
- [ ] No real DSN is committed to the repository.

## Migration Command

Run before serving new backend traffic:

```bash
python -m alembic upgrade head
```

If a migration fails:

1. Stop the backend deploy before serving traffic.
2. Record the error and current database revision.
3. Check whether the migration failed before or after schema/data changes.
4. Prefer provider snapshot or point-in-time restore for unsafe partial changes.
5. Use `alembic downgrade -1` only if the exact migration was tested both
   directions against representative data.

## Health Check Results

Local helper:

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\smoke_check.py https://projectops-api.example.com
```

Record deployed results:

| Check | Result | Timestamp | Request ID or notes |
| --- | --- | --- | --- |
| `/health` | Pending provider access | Pending | Pending |
| `/health/db` | Pending provider access | Pending | Pending |

## Auth Smoke Test

Run through the deployed frontend:

- [ ] Register a private-beta test account.
- [ ] Log out.
- [ ] Log back in.
- [ ] Confirm protected `/app/*` routes require auth.
- [ ] Confirm account-owned Projects are visible only to the signed-in user.

Result: Pending provider access.

## Product Smoke Test

Run through the deployed frontend:

- [ ] Frontend loads.
- [ ] Deep link route loads.
- [ ] Create Project.
- [ ] Edit Project.
- [ ] Load demo workspace only if the environment is non-production and demo
      seed controls are intentionally enabled.
- [ ] Attach public GitHub repository.
- [ ] Run CodeMap Lite.
- [ ] Add production URL.
- [ ] Run Manual Health Monitor.
- [ ] Evaluate readiness.
- [ ] Add Project Artifact.
- [ ] Link artifact as readiness evidence.
- [ ] Confirm Project Activity timeline updates.
- [ ] Confirm Overview Activity updates.
- [ ] Confirm no browser console errors during normal flows.
- [ ] Toggle dark/light theme.
- [ ] Confirm mobile viewport is usable.

Result: Pending provider access.

## Observability Smoke Test

Backend monitoring:

- [ ] `PROJECTOPS_ENABLE_ERROR_MONITORING=true` only if a backend Sentry DSN is configured.
- [ ] Confirm Sentry receives a backend event from a safe staging/private-beta test.
- [ ] Confirm event environment is correct.
- [ ] Confirm event includes request ID context when available.
- [ ] Confirm event does not include Authorization header, Cookie header,
      request body, database URL, password, raw secret values, or sensitive
      query strings.

Frontend monitoring:

- [ ] `VITE_ENABLE_ERROR_MONITORING=true` only if a frontend Sentry DSN is configured.
- [ ] Confirm Sentry receives a frontend event from a safe staging/private-beta test.
- [ ] Confirm event environment is correct.
- [ ] Confirm event includes request ID context when available.
- [ ] Confirm event does not include JWT bearer token, cookies, passwords,
      request bodies, or sensitive query strings.

Do not add public crash endpoints or permanent unsafe UI to trigger events.
Result: Pending provider access.

## Request ID Correlation Proof

Prove and record one correlation path:

1. Browser receives `X-Request-ID` on a backend response.
2. Frontend API error UI displays `Request ID: ...` when useful.
3. Backend structured logs include the same request ID.
4. Backend monitoring event includes the same request ID if monitoring is configured.
5. Frontend monitoring event includes the same request ID if the frontend error
   carries one.

| Source | Request ID | Status |
| --- | --- | --- |
| Browser/API response | Pending provider access | Pending |
| Frontend UI | Pending provider access | Pending |
| Backend log | Pending provider access | Pending |
| Monitoring event | Pending provider access | Pending |

## Browser Responsive QA

Review these at approximately `1440px`, `834px`, and `390px`:

- [ ] Landing page.
- [ ] Login/register.
- [ ] Overview.
- [ ] Project Registry.
- [ ] Project Dashboard.
- [ ] Error boundary fallback.
- [ ] Request ID error display.

Result: Pending provider access.

## Backup And PITR Status

| Backup control | Status | Notes |
| --- | --- | --- |
| Automated backups enabled | Pending provider access | Confirm in managed PostgreSQL provider. |
| Backup retention | Pending provider access | Private beta target: at least 7 days. |
| PITR available/enabled | Pending provider access | Enable if provider supports it. |
| Backup encrypted at rest | Pending provider access | Confirm provider default or setting. |
| Restore drill completed | Pending provider access | Do not run destructive restore without approval. |

See `docs/backup-restore-runbook.md` for restore procedure and rollback
decision guidance.

## Rollback Notes

Low-risk rollback order:

1. If deploy fails before migration, roll back the app deploy.
2. If migration has not served traffic, fix and rerun or restore from snapshot.
3. If migration served traffic and data may have changed, prefer provider PITR
   or snapshot restore to a new database.
4. Cut traffic only after `/health`, `/health/db`, auth, Project list, and one
   write operation pass against the rollback target.

Record rollback decision owner, timestamp, database revision, request IDs, and
provider backup target if rollback is needed.

## Security And Privacy Review

- [ ] No real secrets committed.
- [ ] Sentry DSNs stored in provider env vars.
- [ ] Auth secret stored in provider env vars.
- [ ] Database URL stored in provider env vars.
- [ ] CORS allows only deployed frontend origin.
- [ ] Demo seeding disabled in production.
- [ ] Demo seeding authenticated in non-production.
- [ ] Monitoring payloads sanitized.
- [ ] Logs do not print auth headers, cookies, request bodies, or database URLs.
- [ ] CI uses test-only credentials.
- [ ] Rate limiting enabled and documented as in-process only.

Result: Pending provider access.

## Private-Beta Go/No-Go Checklist

Go only when:

- [ ] Backend deploy completed.
- [ ] Frontend deploy completed.
- [ ] Managed database connected.
- [ ] Migrations ran successfully.
- [ ] `/health` and `/health/db` pass.
- [ ] Auth smoke test passes.
- [ ] Product smoke test passes.
- [ ] Request ID correlation proof is recorded.
- [ ] Monitoring smoke test is complete or explicitly deferred.
- [ ] Backup/PITR status is confirmed.
- [ ] No critical or high security/privacy findings remain.

Current decision: No-go until provider stack, deployment, backups, observability,
and smoke checks are completed.
