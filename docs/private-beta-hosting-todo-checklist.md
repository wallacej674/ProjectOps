# Private-Beta Hosting To-Do Checklist

Use this checklist when you are ready to deploy ProjectOps to the private-beta
hosting stack. Do not paste real secrets, DSNs, database URLs, JWTs, passwords,
or screenshots containing credentials into the repository.

## 1. Provider Accounts

- [ ] Confirm frontend provider account is available.
- [ ] Confirm backend provider account is available.
- [ ] Confirm managed PostgreSQL provider account is available.
- [ ] Confirm Sentry account/project access is available, if monitoring will be enabled.
- [ ] Record the chosen provider stack in `docs/private-beta-deployment-drill.md`.

Recommended private-beta stack:

- Frontend: Vercel
- Backend: Render Web Service
- Scheduler: Render Cron Job
- Database: Render Postgres
- Monitoring: Sentry

Render/Vercel-specific setup notes live in
`docs/render-vercel-deployment.md`.

## 2. Database Setup

- [ ] Create the managed PostgreSQL database.
- [ ] Copy the database connection string into the backend provider environment variables only.
- [ ] Confirm SSL mode requirements from the provider.
- [ ] Confirm automated backups are enabled.
- [ ] Confirm PITR availability and retention.
- [ ] Confirm retention is at least 7 days.
- [ ] Confirm the private-beta target RPO is no more than 24 hours.
- [ ] Confirm the private-beta target RTO is restore to usable database within 2 hours.
- [ ] Record backup/PITR proof in `docs/private-beta-deployment-drill.md`.

## 3. Backend Environment

- [ ] Set `PROJECTOPS_ENVIRONMENT=production`.
- [ ] Set `PROJECTOPS_DATABASE_URL` in the provider environment only.
- [ ] Set `PROJECTOPS_AUTH_SECRET_KEY` to a strong production-only secret.
- [ ] Set `PROJECTOPS_CORS_ALLOWED_ORIGINS` to the deployed frontend origin only.
- [ ] Set `PROJECTOPS_LOG_LEVEL=INFO`.
- [ ] Review rate-limit environment variables and keep rate limiting enabled.
- [ ] Set `PROJECTOPS_ENABLE_ERROR_MONITORING=true` only if Sentry is configured.
- [ ] Set `PROJECTOPS_SENTRY_DSN` in the provider environment only, if used.
- [ ] Set `PROJECTOPS_SENTRY_ENVIRONMENT=production`, if Sentry is used.
- [ ] Confirm no backend secrets are committed.

## 4. Backend Deploy

- [ ] Build the backend container from `backend/Dockerfile`.
- [ ] Create or sync the root `render.yaml` Blueprint.
- [ ] Confirm the API and database are in the same Render region.
- [ ] Confirm `projectops-health-monitor` is created from the Blueprint.
- [ ] Confirm the database uses its private internal connection string.
- [ ] Confirm Render HTTP health check path is `/health`.
- [ ] Deploy the backend service.
- [ ] Confirm the Render pre-deploy command runs Alembic migrations.
- [ ] Confirm the deployed database revision is `0013_health_monitor`.
- [ ] Confirm the cron command is `python -m app.jobs.run_due_health_checks`.
- [ ] Record migration timestamp and result.
- [ ] Confirm provider logs are accessible.
- [ ] Confirm backend health check endpoint is configured as `/health`.

## 5. Frontend Environment

- [ ] Set `VITE_API_BASE_URL` to the hosted backend origin.
- [ ] Set `VITE_ENABLE_ERROR_MONITORING=true` only if Sentry is configured.
- [ ] Set `VITE_SENTRY_DSN` in the frontend provider environment only, if used.
- [ ] Set `VITE_SENTRY_ENVIRONMENT=production`, if Sentry is used.
- [ ] Confirm no frontend DSNs or tokens are committed.

## 6. Frontend Deploy

- [ ] Configure frontend working directory.
- [ ] Configure Node version.
- [ ] Configure install command.
- [ ] Configure build command.
- [ ] Confirm output directory is `dist`.
- [ ] Confirm SPA fallback works for `/app/*` deep links.
- [ ] Deploy the frontend.
- [ ] Record the deployed frontend URL.

## 7. Hosted Health Smoke

- [ ] Run the backend smoke helper against the hosted backend.
- [ ] Confirm `GET /health` passes.
- [ ] Confirm `GET /health/db` passes.
- [ ] Record timestamp and result.

Command:

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\smoke_check.py https://your-hosted-backend.example.com
```

## 8. Hosted Auth Smoke

- [ ] Open the deployed frontend.
- [ ] Register a safe test account.
- [ ] Log out.
- [ ] Log back in.
- [ ] Confirm current-user behavior works.
- [ ] Confirm protected routes require login.
- [ ] Optional: confirm a second user cannot see the first user's Projects.
- [ ] Do not record real passwords.

## 9. Hosted Product Smoke

- [ ] Create a Project.
- [ ] Edit the Project.
- [ ] Attach a public GitHub repository.
- [ ] Run CodeMap Medium Repository Analysis.
- [ ] Add a production URL.
- [ ] Run a manual health check.
- [ ] Enable scheduled monitoring and wait for the Render cron worker to store a
      scheduled result.
- [ ] Pause scheduled monitoring and confirm the schedule reports paused.
- [ ] Evaluate readiness.
- [ ] Create an artifact.
- [ ] Link the artifact as readiness evidence.
- [ ] Confirm activity timeline updates.
- [ ] Confirm Overview activity updates.
- [ ] Confirm Project ownership access works.
- [ ] Confirm demo workspace loads only when appropriate.
- [ ] Confirm errors show request IDs when available.
- [ ] Confirm normal flows do not show stack traces.
- [ ] Confirm Launch Report renders current evidence.
- [ ] Confirm Guided Launch Checklist renders concrete todo/attention/done items.
- [ ] Confirm Launch Decision clearly says the decision is human-recorded and artifact-backed.
- [ ] Try No-go and Defer without notes and confirm validation blocks submission.
- [ ] Record safe test Go, Defer, and No-go Launch Decisions with non-secret notes.
- [ ] Confirm the latest decision updates and previous decisions appear newest-first in history.
- [ ] Confirm Launch Decision records also appear as normal Project Artifacts.

## 10. Observability Smoke

- [ ] Confirm backend Sentry event arrives, if configured.
- [ ] Confirm frontend Sentry event arrives, if configured.
- [ ] Confirm environment tag is `production`.
- [ ] Confirm request ID appears in logs and monitoring context where available.
- [ ] Confirm Authorization headers are not captured.
- [ ] Confirm Cookie headers are not captured.
- [ ] Confirm request bodies are not captured.
- [ ] Confirm database URLs are not captured.
- [ ] Confirm passwords and raw secrets are not captured.
- [ ] Do not add a permanent public crash endpoint.

## 11. Request ID Correlation

- [ ] Trigger or capture a safe error that exposes a request ID.
- [ ] Confirm browser/API error shows the request ID.
- [ ] Confirm backend response header includes the same `X-Request-ID`.
- [ ] Confirm backend structured log includes the same request ID.
- [ ] Confirm backend Sentry event includes the same request ID, if configured.
- [ ] Confirm frontend Sentry event includes the same request ID, if applicable.
- [ ] Record only the request ID and non-secret context.

## 12. Security/Privacy Review

- [ ] Confirm no secrets are committed.
- [ ] Confirm CORS allows only the deployed frontend origin.
- [ ] Confirm demo seeding is disabled in production.
- [ ] Confirm auth secret is production-only.
- [ ] Confirm database URL is provider-only.
- [ ] Confirm Sentry DSNs are provider-only.
- [ ] Confirm logs do not print tokens, cookies, request bodies, passwords, or database URLs.
- [ ] Confirm monitoring payloads are sanitized.
- [ ] Confirm rate limiting is enabled and documented as in-process only.
- [ ] Confirm CI uses test-only credentials.

## 13. Browser Responsive QA

- [ ] Review landing page at 1440px, 834px, and 390px.
- [ ] Review login/register at 1440px, 834px, and 390px.
- [ ] Review Overview at 1440px, 834px, and 390px.
- [ ] Review Project Registry at 1440px, 834px, and 390px.
- [ ] Review the Project Dashboard at 1440px, 834px, and 390px.
- [ ] Review Launch Report, Guided Launch Checklist, Launch Decision form, and decision history at 1440px, 834px, and 390px.
- [ ] Review safe error/request ID display if safely testable.
- [ ] Record visual or usability findings in the drill doc.

## 14. Rollback and Go/No-Go

- [ ] Record backend rollback steps.
- [ ] Record frontend rollback steps.
- [ ] Record database recovery steps.
- [ ] Record known deployment limitations.
- [ ] Record unresolved risks.
- [ ] Make and record the private-beta go/no-go decision.
- [ ] Confirm the in-app Launch Decision record matches the drill doc decision.
- [ ] Confirm the UI does not call the decision certified, approved, compliance-ready, or guaranteed safe.

## 15. Final Local Verification

- [x] Run local Alembic migrations.
- [x] Run backend tests.
- [x] Run backend compile checks.
- [x] Inspect the declared Alembic head.
- [x] Run deployment configuration tests.
- [x] Run backend config check.
- [x] Run backend dependency audit.
- [x] Run frontend tests.
- [x] Run frontend lint.
- [x] Run frontend production build.
- [x] Run frontend dependency audit.
- [x] Run `git diff --check`.
- [x] Confirm no dangerous debug endpoint was added.
- [x] Confirm no secrets were committed.

Local evidence recorded on 2026-08-31 against the preserved dirty worktree:

- Backend compilation completed successfully for `app` and `tests`.
- `python -m alembic heads` reported the single head
  `0013_health_monitor`.
- The Render deployment and private-beta drill configuration tests passed:
  5 tests passed.
- The frontend suite passed: 39 files and 258 tests.
- Frontend lint completed with 0 errors and 5 known Fast Refresh warnings.
- The frontend production build completed successfully.
- `git diff --check` passed; Git emitted only line-ending conversion notices.
- The dedicated PostgreSQL test service was not listening on port `55432`, so
  local migrations and database-backed backend tests remain unchecked.

Additional release-gate evidence recorded on 2026-09-01 for revision
`27fe51beff91f5fe0db9b5338b8a7d4054bfc67b`:

- The backend configuration checker passed without printing configuration
  values.
- The backend dependency audit found no known vulnerabilities; the local
  `projectops-backend` package itself is not published on PyPI and was skipped.
- The frontend dependency audit found 0 vulnerabilities.
- Route inspection found no debug, crash, test-error, or Sentry-test endpoints.
- A redacted high-confidence secret-pattern scan found only Sentry-shaped test
  fixtures. The tracked `frontend/.env.local` contains only a localhost API
  base URL. This scan is supporting evidence, not proof that no secret exists,
  so the no-secrets checklist item remains open for release review.
- GitHub Actions run 10 failed in the backend test step: 18 tests failed and
  255 passed. The release remains blocked until CI is green.
- PostgreSQL remained unavailable on port `55432`; the service and credentials
  were not changed.

Local regression evidence recorded later on 2026-09-01:

- The existing Docker Desktop installation was located and the repository's
  dedicated `projectops-db` container was started without changing credentials.
- Alembic upgraded the local database through `0013_health_monitor`.
- The repository-attachment API failure was reproduced before the fix and
  passed afterward.
- The manual and scheduled Health Monitor failures were reproduced before the
  shared test-boundary fix and passed afterward.
- The focused affected backend suite passed: 39 tests.
- The complete PostgreSQL-backed backend suite passed: 273 tests with one
  existing Starlette/httpx deprecation warning.
- Backend compilation, configuration checking, Alembic head/current inspection,
  and `git diff --check` passed after the fixes.
- GitHub Actions run 10 remains the latest hosted CI evidence and is still
  failed. A new revision and green CI run are required before deployment.

Final local readiness refresh recorded on 2026-09-01 before the approved
release commit:

- The complete PostgreSQL-backed backend suite passed: 275 tests with one
  existing Starlette/httpx deprecation warning.
- Backend compilation and configuration checking passed. Alembic `heads` and
  `current` both reported `0013_health_monitor`.
- Seven Render Blueprint and deployment-drill contract tests passed, including
  the Vercel root-relative `dist` output and production Sentry environment
  defaults.
- The frontend suite passed: 39 files and 258 tests. The production build also
  passed.
- The official frontend lint command passed with 0 errors and the 5 known Fast
  Refresh warnings. A transient error from a concurrently created untracked
  development entry point cleared after that file was removed without changes
  from this deployment-preparation work.
- The explicitly staged release diff was reviewed file by file. A
  high-confidence scan found no private keys, provider tokens, credentialed
  database URLs, or live Sentry ingestion URLs in the staged files.
- Hosted cron execution and all provider-side evidence remain unverified.

CI follow-up evidence recorded on 2026-09-01 for commit `8825190`:

- GitHub Actions run 11 passed Backend, Frontend, and Diff Hygiene. Dependency
  Security Scan failed because a newly published high-severity advisory covered
  the lockfile's transitive `browserslist` version.
- The same `npm audit --audit-level=high` failure was reproduced locally before
  changing the lockfile.
- A compatible lockfile-only refresh moved `browserslist` from `4.28.2` to
  `4.28.8`. The live audit then reported 0 vulnerabilities.
- After reinstalling from the updated dependency graph, all 258 frontend tests,
  lint with 0 errors and 5 known warnings, and the production build passed.
- A new commit and green GitHub Actions run are still required before provider
  deployment.
