# ProjectOps

ProjectOps is a software project command center for understanding, monitoring,
and preparing projects for production.

ProjectOps currently lets developers register, sign in, create account-owned
Projects, read, update, list, archive, view dashboard summaries, attach public
GitHub repository connections, run CodeMap Lite repository path analysis, run
manual health checks, view an advisory production-readiness checklist, generate
a current Launch Report and Guided Launch Checklist from readiness and evidence
signals, record a Launch Decision as a Project Artifact, search Project Artifact
metadata, link artifacts as supporting readiness evidence, inspect evidence
coverage and artifact usage, review recent Project activity from Project detail
pages, and scan recent activity across Projects from the app Overview.

ProjectOps is still intentionally staged. It does not yet include teams,
organizations, roles, OAuth, password reset, refresh tokens, scheduled
monitoring, alerts, file processing, notifications, OpenTelemetry, or AI
features.

## Current Status

Implemented:

- FastAPI backend application.
- PostgreSQL database through Docker Compose.
- SQLAlchemy and Alembic migrations.
- Local email/password authentication with JWT bearer access tokens.
- Account-owned Project visibility.
- Project CRUD and archive-on-delete behavior.
- Project Dashboard API.
- GitHub repo intake for public GitHub repository URLs.
- CodeMap Lite rule-based repository path analysis.
- Manual Health Monitor for on-demand Project URL checks.
- Advisory Production Readiness checklist.
- Launch Report and Guided Launch Checklist APIs.
- Launch Decision UI that records go/no-go/defer decisions as Project Artifacts.
- DataForge Lite Project Artifacts metadata registry.
- Readiness artifact evidence links.
- Artifact evidence coverage and traceability across Readiness, Artifacts,
  Launch Report, and Guided Launch Checklist.
- Recent Engineering Activity, Project-scoped and cross-Project.
- First-run demo workspace seeding outside production.
- Deployment-aware configuration, database health checks, environment examples,
  SPA hosting guidance, and deployment readiness documentation.
- GitHub Actions CI quality gate.
- Dependency vulnerability scan commands for backend and frontend.
- Fixed-window rate limiting for selected auth and expensive action routes.
- Structured backend request logging with `X-Request-ID`.
- Optional Sentry-backed backend and frontend error monitoring.
- Safe backend 500 responses and frontend error-boundary request ID surfacing.
- Backup/restore and private-beta deployment drill documentation.
- Safe backend smoke-check helper for hosted `/health` and `/health/db`.
- Backend Dockerfile for the selected AWS App Runner private-beta path.
- React + TypeScript frontend for Project Registry, Overview, Project detail
  command center, auth flows, readiness, artifacts, Launch Report, Guided
  Launch Checklist, Launch Decision, and activity surfaces.

Not implemented yet:

- Teams, organizations, roles, OAuth, password reset, refresh tokens, or account
  administration.
- GitHub OAuth, GitHub Apps, private repository support, webhooks, or background
  repository sync.
- Deep repository analysis, file content fetching, language percentages, AST
  parsing, or dependency graph analysis.
- File upload storage, OCR, document preview, embeddings, semantic search, LLM
  extraction, scheduled monitoring, background jobs, alerts, notification
  inboxes, or AI summaries.
- Terraform, Kubernetes, Docker image publishing, or full CI/CD deployment
  automation.

## Repository Layout

```text
ProjectOps/
  backend/      FastAPI backend
  frontend/     React + TypeScript web client
  docs/         Project, deployment, and milestone documentation
  .github/      GitHub Actions CI workflow
```

## Backend Architecture

The backend uses a small route, service, repository, model, and schema
structure.

- Routes handle HTTP details: paths, status codes, query parameters, request
  bodies, authentication, ownership checks, and API errors.
- Services hold business behavior, such as archiving Projects, assembling
  dashboard summaries, evaluating readiness, and deriving launch-review views.
- Repositories hold database access.
- Models define persisted database tables.
- Schemas define API input and output contracts.

This structure is deliberately small. New modules should earn their place by
hiding real behavior behind a clear interface.

## Frontend

The web client lives in `frontend/` and uses React, TypeScript, Vite, React
Router, native `fetch`, Vitest, React Testing Library, ESLint, Tailwind CSS v4,
and a hand-authored semantic token system.

```powershell
cd frontend
npm install
npm run dev      # Vite dev server on http://localhost:5173
npm test         # Vitest + React Testing Library
npm run lint
npm run build    # tsc -b && vite build
npm run preview  # serve built dist output
npm run audit    # npm audit --audit-level=high
```

The frontend requires the backend to be running and migrated. Production builds
require `VITE_API_BASE_URL`; otherwise the API client reports a configuration
error instead of silently calling localhost.

See `frontend/README.md` for the route map, architecture, behavior notes,
manual verification steps, and known limitations.

## Requirements

- Python 3.11 or newer.
- Node.js compatible with the frontend lockfile.
- Docker Desktop.

## Local Setup

From the repository root:

```powershell
Copy-Item .env.example .env
docker compose up -d
```

Install backend dependencies:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e ".[dev]"
```

Run migrations:

```powershell
.\.venv\Scripts\python.exe -m alembic upgrade head
```

Check deployment-critical backend configuration without printing secrets:

```powershell
.\.venv\Scripts\python.exe scripts\check_config.py
```

Start the backend:

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

Useful local URLs:

- Health endpoint: `http://127.0.0.1:8000/health`
- Database health endpoint: `http://127.0.0.1:8000/health/db`
- Project API: `http://127.0.0.1:8000/api/v1/projects`
- API docs: `http://127.0.0.1:8000/docs`

## Deployment Readiness

Deployment guidance lives in `docs/deployment-readiness.md`. It covers backend
and frontend environment variables, managed PostgreSQL setup, Alembic migration
strategy, backup and restore expectations, production CORS, static-host SPA
fallback, optional error monitoring, smoke tests, troubleshooting, dogfooding
ProjectOps inside ProjectOps, and future hardening needs.

The private-beta deployment drill checklist lives in
`docs/private-beta-deployment-drill.md`. Use it to record the chosen provider
stack, migration result, health checks, observability smoke test, request ID
proof, backup/PITR status, rollback notes, and go/no-go decision.

The shorter operator to-do checklist lives in
`docs/private-beta-hosting-todo-checklist.md`. Use it as the step-by-step list
while performing the hosted private-beta deployment.

The selected private-beta hosting path is Vercel for the frontend, AWS App
Runner for the backend container, and Amazon RDS PostgreSQL for the managed
database. AWS/Vercel-specific setup steps live in
`docs/aws-app-runner-vercel-deployment.md`.

After deploying a backend, run the safe unauthenticated health smoke helper:

```powershell
cd backend
.\.venv\Scripts\python.exe scripts\smoke_check.py https://projectops-api.example.com
```

Production notes:

- Set `PROJECTOPS_ENVIRONMENT=production`.
- Set `PROJECTOPS_DATABASE_URL` to the managed PostgreSQL connection string.
- Set `PROJECTOPS_AUTH_SECRET_KEY` to a strong production-only secret.
- Set `PROJECTOPS_CORS_ALLOWED_ORIGINS` to the deployed frontend origin; wildcard
  CORS is rejected in production.
- Set `PROJECTOPS_LOG_LEVEL=INFO`.
- Enable managed PostgreSQL automated backups before inviting real users.
- Set frontend `VITE_API_BASE_URL` to the deployed backend origin before
  building.
- Serve frontend deep links such as `/app/projects/1/edit` with an SPA fallback
  to `index.html`.

## Running Tests

Keep the PostgreSQL container running, then run:

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m compileall app tests
.\.venv\Scripts\python.exe scripts\check_config.py
.\.venv\Scripts\pip-audit
```

Frontend:

```powershell
cd frontend
npm test
npm run lint
npm run build
npm audit --audit-level=high
```

Full repo:

```powershell
git diff --check
```

ProjectOps maps PostgreSQL to local port `55432` so it does not collide with
another PostgreSQL server already using the default `5432` port.

## Implemented API

```text
GET    /health
GET    /health/db
POST   /api/v1/auth/register
POST   /api/v1/auth/login
GET    /api/v1/auth/me
POST   /api/v1/auth/logout
GET    /api/v1/demo-data/status
POST   /api/v1/demo-data/seed
POST   /api/v1/projects
GET    /api/v1/projects
GET    /api/v1/projects/{project_id}
PATCH  /api/v1/projects/{project_id}
DELETE /api/v1/projects/{project_id}
GET    /api/v1/projects/{project_id}/dashboard
GET    /api/v1/activity
GET    /api/v1/projects/{project_id}/activity
POST   /api/v1/projects/{project_id}/repo
GET    /api/v1/projects/{project_id}/repo
DELETE /api/v1/projects/{project_id}/repo
POST   /api/v1/projects/{project_id}/analyses/run
GET    /api/v1/projects/{project_id}/analyses/latest
GET    /api/v1/projects/{project_id}/analyses
POST   /api/v1/projects/{project_id}/health-checks/run
GET    /api/v1/projects/{project_id}/health-checks/latest
GET    /api/v1/projects/{project_id}/health-checks
POST   /api/v1/projects/{project_id}/readiness/evaluate
GET    /api/v1/projects/{project_id}/readiness
GET    /api/v1/projects/{project_id}/readiness/evidence-coverage
GET    /api/v1/projects/{project_id}/launch-report
GET    /api/v1/projects/{project_id}/launch-checklist
PATCH  /api/v1/projects/{project_id}/readiness/items/{item_key}
POST   /api/v1/projects/{project_id}/readiness/items/{item_key}/artifacts
GET    /api/v1/projects/{project_id}/readiness/items/{item_key}/artifacts
DELETE /api/v1/projects/{project_id}/readiness/items/{item_key}/artifacts/{artifact_id}
POST   /api/v1/projects/{project_id}/artifacts
GET    /api/v1/projects/{project_id}/artifacts
GET    /api/v1/projects/{project_id}/artifacts/{artifact_id}
PATCH  /api/v1/projects/{project_id}/artifacts/{artifact_id}
DELETE /api/v1/projects/{project_id}/artifacts/{artifact_id}
```

Deleting a Project archives it by setting `status` to `archived`; rows are not
hard deleted. Deleting a Project Artifact archives it by setting `status` to
`archived`; artifact rows are not hard deleted.

Project endpoints require a bearer token and return only Projects owned by the
current account. Existing rows may have a nullable owner during migration
compatibility, but Projects created through the API are account-owned.

The launch report endpoint returns a current, read-only launch-review projection
built from Project metadata, repository connection, latest CodeMap Lite result,
latest health check, readiness summary, artifact count, and activity count. The
guided launch checklist endpoint returns a current operator checklist from the
same evidence. Neither endpoint persists immutable approvals or certifies
production safety.

The Launch Decision UI creates normal Project Artifacts with
`artifact_type=decision`, `source_type=manual`, and the `launch-decision` and
`go-no-go` tags. The backend validates those Launch Decision artifact
conventions and records authenticated creator attribution for new artifacts.
Project detail derives the latest decision and newest-first decision history
from those artifacts. No-go and Defer records require notes so future review has
context. This is a convenient human go/no-go/defer record, not release
automation, deployment approval enforcement, or an immutable compliance sign-off
system.

Readiness artifact evidence links attach existing Project Artifacts to readiness
checklist items as supporting references. Evidence coverage summarizes linked
and unlinked active artifacts, readiness items with or without supporting
artifact links, and artifact usage by readiness item. Linked artifacts do not
automatically change readiness status, and ProjectOps does not verify artifact
contents in DataForge Lite.

## Key Documentation

- `docs/projectops-remaining-work-handoff.md`: current remaining-work roadmap,
  ship criteria, milestone process, and private-beta readiness boundary.
- `frontend/README.md`: frontend architecture, route map, behavior notes, manual
  verification, and limitations.
- `docs/deployment-readiness.md`: provider-neutral deployment readiness guide.
- `docs/private-beta-deployment-drill.md`: evidence log for the real hosted
  deployment drill.
- `docs/private-beta-hosting-todo-checklist.md`: shorter operator checklist for
  the hosted private-beta deployment.
- `docs/observability-error-monitoring.md`: Sentry and request ID triage notes.
- `docs/backup-restore-runbook.md`: managed PostgreSQL backup and restore
  expectations.
- `docs/ci-quality-gate.md`: GitHub Actions quality gate.
- `docs/authentication-ownership.md`: local auth and Project ownership model.
- `docs/launch-decision-records.md`: Launch Decision artifact storage,
  history behavior, limitations, and future hardening options.
- `docs/milestone-28-artifact-evidence-coverage-traceability.md`: evidence
  coverage endpoint and UI traceability behavior.
- `CONTEXT.md`: ProjectOps domain vocabulary.

## Project Vocabulary

ProjectOps uses a small domain glossary in `CONTEXT.md`.

Important current terms:

- `Project`: a top-level workspace record for one software project inside
  ProjectOps.
- `Project Status`: the lifecycle label for a Project.
- `Archived Project`: a Project kept for history but hidden from normal active
  lists.
- `Project Dashboard`: a command-center view for one Project.
- `Repo Integration`: a connection record between one Project and an external
  code repository.
- `GitHub Repo Intake`: the workflow that attaches, normalizes, retrieves, or
  removes a public GitHub repository connection.
- `Repo Analysis`: a stored snapshot of rule-based observations about an
  attached repository.
- `CodeMap Lite`: the workflow that fetches public GitHub repository paths and
  turns those paths into a Repo Analysis.
- `Health Check`: a stored result of one manual reachability check against a
  Project URL.
- `Manual Health Monitor`: the workflow that runs and stores an on-demand Health
  Check.
- `Readiness`: an advisory checklist combining available ProjectOps evidence and
  manual review.
- `Launch Report`: a current launch-review projection built from ProjectOps
  evidence. It is not a deployment approval or certification.
- `Guided Launch Checklist`: a current operator checklist derived from launch
  evidence. It is not an immutable sign-off record.
- `Launch Decision`: a go/no-go/defer Project Artifact history that records
  human launch decisions and context notes.
- `Project Artifact`: a Project-scoped metadata record for notes, links,
  runbooks, decisions, requirements, risks, incidents, or evidence references.
- `DataForge Lite`: the Project Artifact registry and evidence-linking
  foundation; it does not process uploaded files or perform AI document analysis.
- `Project Activity Event`: a stored Project-scoped product history event for
  meaningful ProjectOps actions; it is not a realtime notification or audit-grade
  log.
- `Demo Workspace`: an environment-gated sample workspace for first-run
  exploration; it is not user-owned production data or verified external
  evidence.
- `Authenticated Account`: a local ProjectOps user identity used to scope Project
  visibility.
- `Rate Limit`: a fixed-window launch hardening control that throttles repeated
  auth and expensive action requests.

When adding new features, use those terms consistently in code, tests, and
documentation.
