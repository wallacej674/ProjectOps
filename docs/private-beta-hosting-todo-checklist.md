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
- Backend: AWS App Runner
- Database: Amazon RDS PostgreSQL
- Monitoring: Sentry

AWS/Vercel-specific setup notes live in
`docs/aws-app-runner-vercel-deployment.md`.

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
- [ ] Push the image to Amazon ECR.
- [ ] Create or update the AWS App Runner service from the ECR image.
- [ ] Configure App Runner container port `8000`.
- [ ] Configure App Runner HTTP health check path `/health`.
- [ ] Deploy the backend service.
- [ ] Run Alembic migrations against the hosted database.
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
- [ ] Run CodeMap Lite.
- [ ] Add a production URL.
- [ ] Run a manual health check.
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
- [ ] Review Project detail command center at 1440px, 834px, and 390px.
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

- [ ] Run local Alembic migrations.
- [ ] Run backend tests.
- [ ] Run backend compile checks.
- [ ] Run backend config check.
- [ ] Run backend dependency audit.
- [ ] Run frontend tests.
- [ ] Run frontend lint.
- [ ] Run frontend production build.
- [ ] Run frontend dependency audit.
- [ ] Run `git diff --check`.
- [ ] Confirm no dangerous debug endpoint was added.
- [ ] Confirm no secrets were committed.
