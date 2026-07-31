# ProjectOps

ProjectOps is a software project command center for understanding, monitoring, and preparing projects for production.

ProjectOps currently lets developers create, read, update, list, archive, view dashboard summaries, attach public GitHub repository connections, run CodeMap Lite repository path analysis, run manual health checks, view an advisory production-readiness checklist, search Project Artifact metadata, link artifacts as supporting readiness evidence, review recent Project activity from Project detail pages, and scan recent activity across Projects from the app Overview. It is still intentionally staged: ProjectOps is building the command-center data model and the first frontend workflows before adding authentication, scheduled monitoring, alerts, file processing, notifications, or AI features.

## Current Status

Implemented:

- FastAPI backend application.
- PostgreSQL database through Docker Compose.
- Synchronous SQLAlchemy setup.
- Alembic migrations.
- Project CRUD routes.
- Archive-on-delete behavior for Projects.
- Project Dashboard API.
- GitHub repo intake for public GitHub repository URLs.
- CodeMap Lite rule-based repository path analysis.
- Manual Health Monitor for on-demand Project URL checks.
- DataForge Lite Project Artifacts metadata registry with search, tag filtering, dashboard summary, and readiness evidence links.
- Recent Engineering Activity with stored event records, Project-scoped and cross-Project list APIs, filters, dashboard summary, Overview surfacing, and frontend timeline UI.
- Deployment-aware configuration, database health checks, environment examples, SPA hosting guidance, and deployment readiness documentation.
- Pytest coverage for health, Project CRUD, archive behavior, dashboard output, repo intake, CodeMap Lite, and Manual Health Monitor behavior.
- React + TypeScript frontend: marketing landing page, Overview activity feed, Project Registry, Project create/edit/archive flows, sorting, mobile navigation, Project detail GitHub repository attach/replace/remove UI, Project detail CodeMap Lite analysis UI, Project detail Manual Health Monitoring UI, Project detail Production Readiness UI, Project detail Artifacts UI, and Project detail Recent Activity UI (see `frontend/README.md`).
- Milestone documentation in `docs/`.

Not implemented yet:

- Authentication or user ownership.
- GitHub OAuth, GitHub Apps, or private repository support.
- Deep repository analysis, file content fetching, language detection, or AST parsing.
- File upload storage, OCR, document preview, embeddings, semantic search, LLM extraction, scheduled monitoring, background jobs, webhooks, alerts, notification inboxes, or AI summaries.

## Repository Layout

```text
ProjectOps/
  backend/      FastAPI backend
  frontend/     React + TypeScript web client (Project Registry UI)
  docs/         Project documentation
  .github/      Placeholder for future GitHub workflows
```

## Backend Architecture

The backend uses a small route, service, repository, model, and schema structure.

- Routes handle HTTP details: paths, status codes, query parameters, request bodies, and 404 responses.
- Services hold business behavior, such as archiving Projects and assembling dashboard summaries.
- Repositories hold database access.
- Models define persisted database tables.
- Schemas define API input and output contracts.

This structure is deliberately small. New modules should earn their place by hiding real behavior behind a clear interface.

## Frontend

The web client lives in `frontend/` (React + TypeScript + Vite, dark-first
semantic-token design system). It is organized by feature, with a shared
application shell, a collapsible desktop sidebar, a real mobile navigation
drawer, client-side Project sorting, and dark/light themes.

```bash
# backend must be running and migrated first (see Local Setup)
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run test     # Vitest + React Testing Library (API mocked, never hits the backend)
npm run build    # tsc -b && vite build
npm run preview  # serve the built dist/ output locally
npm run lint
```

The Project Registry (`/api/v1/projects`), Project detail repository
connection UI (`/api/v1/projects/{project_id}/repo`), Project detail CodeMap
Lite analysis UI (`/api/v1/projects/{project_id}/analyses`), and Project detail
Manual Health Monitoring UI (`/api/v1/projects/{project_id}/health-checks`),
Project detail Production Readiness UI
(`/api/v1/projects/{project_id}/readiness`), and Project detail Artifacts UI
(`/api/v1/projects/{project_id}/artifacts`), Project detail Recent Activity UI
(`/api/v1/projects/{project_id}/activity`), and Overview Recent Activity UI
(`/api/v1/activity`) are wired to the backend. See `frontend/README.md` for the
route map, architecture, theme/navigation/sorting behavior, repo-intake
behavior, CodeMap behavior, manual health-check behavior, readiness behavior,
and known limitations.

## Requirements

- Python 3.11 or newer
- Docker Desktop

## Local Setup

From the repository root:

```powershell
Copy-Item .env.example .env
docker compose up -d db
```

If Docker reports that `dockerDesktopLinuxEngine` cannot be found, Docker Desktop is not running yet. Open Docker Desktop, wait until it says Docker is running, then run the `docker compose up -d db` command again.

Install the backend dependencies:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -e ".[dev]"
```

These commands call the virtual environment directly. That avoids PowerShell execution policy issues with `Activate.ps1`.

Run the database migration:

```powershell
.\.venv\Scripts\python -m alembic upgrade head
```

Check deployment-critical backend configuration without printing secrets:

```powershell
.\.venv\Scripts\python scripts\check_config.py
```

Start the backend:

```powershell
.\.venv\Scripts\python -m uvicorn app.main:app --reload
```

Useful local URLs:

- Health endpoint: `http://127.0.0.1:8000/health`
- Database health endpoint: `http://127.0.0.1:8000/health/db`
- Project API: `http://127.0.0.1:8000/api/v1/projects`
- API docs: `http://127.0.0.1:8000/docs`

## Deployment Readiness

Deployment guidance lives in `docs/deployment-readiness.md`. It covers backend
and frontend environment variables, managed PostgreSQL setup, Alembic migration
strategy, production CORS, static-host SPA fallback, smoke tests,
troubleshooting, dogfooding ProjectOps inside ProjectOps, and future hardening
needs.

Production notes:

- Set `PROJECTOPS_ENVIRONMENT=production`.
- Set `PROJECTOPS_DATABASE_URL` to the managed PostgreSQL connection string.
- Set `PROJECTOPS_CORS_ALLOWED_ORIGINS` to the deployed frontend origin; wildcard CORS is rejected in production.
- Set frontend `VITE_API_BASE_URL` to the deployed backend origin before building.
- Serve frontend deep links such as `/app/projects/1/edit` with an SPA fallback to `index.html`.

## Running Tests

Keep the PostgreSQL container running, then run:

```powershell
cd backend
.\.venv\Scripts\python -m pytest
```

The test suite uses the `projectops_test` database created by Docker Compose.

ProjectOps maps PostgreSQL to local port `55432` so it does not collide with another PostgreSQL server already using the default `5432` port.

## Implemented API

```text
GET    /health
GET    /health/db
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

Deleting a project archives it by setting `status` to `archived`; rows are not hard deleted.
Deleting a Project Artifact archives it by setting `status` to `archived`; artifact rows are not hard deleted.

The dashboard endpoint returns real Project metadata, real Repo Integration data when a repo is attached, and explicit placeholder sections for future ProjectOps modules.
The dashboard also returns the latest attempted Repo Analysis when CodeMap Lite has run.
The dashboard also returns the latest attempted Health Check when Manual Health Monitor has run.
The dashboard also returns a readiness summary when readiness has been evaluated.
The dashboard also returns Project Artifact summary counts and the latest active artifact.
The dashboard also returns a compact activity summary with the Project activity event count and latest event.

The cross-Project activity list endpoint supports `category`, `event_type`, `project_id`, `limit`, and `offset` query parameters. It returns newest-first activity across local Projects and includes Project name/status for frontend navigation.

The Project-scoped activity list endpoint supports `category`, `event_type`, `limit`, and `offset` query parameters. Activity events are stored as product history for meaningful ProjectOps actions. They are not realtime notifications, unread state, or audit-grade compliance logs.

The artifact list endpoint supports `search`, `tags`, `artifact_type`, `source_type`, and `include_archived` query parameters. Search scans artifact metadata and text fields, not uploaded document contents. Tag filtering uses comma-separated tag tokens with any-match semantics.

Readiness artifact evidence links attach existing Project Artifacts to readiness checklist items as supporting references. Linked artifacts do not automatically change readiness status, and ProjectOps does not verify artifact contents in DataForge Lite.

## Milestones

### Milestone 1: Backend Foundation

Milestone 1 established the backend foundation:

- FastAPI application setup.
- PostgreSQL and Docker Compose setup.
- SQLAlchemy database connection.
- Alembic migration setup.
- `Project` model.
- Project create, read, update, list, and archive routes.
- Archive-on-delete behavior.
- Health endpoint.
- Basic backend tests.
- Foundation documentation.

See `docs/milestone-1-backend-foundation.md`.

### Milestone 2: Project Dashboard API

Milestone 2 added the first Project Dashboard endpoint:

```text
GET /api/v1/projects/{project_id}/dashboard
```

The dashboard currently returns:

- Real Project metadata.
- A placeholder repo section.
- `null` repo analysis and health check sections.
- A placeholder readiness section.
- Next-step messages for future milestones.

The dashboard does not analyze repositories or calculate readiness yet.

See `docs/milestone-2-project-dashboard-api.md`.

### Milestone 3: GitHub Repo Intake

Milestone 3 added GitHub Repo Intake. A Project can attach, read, replace, and remove one public GitHub repository connection.

What was built:

- `RepoIntegration` database model.
- Alembic migration for `repo_integrations`.
- GitHub repo URL parser.
- Repo intake routes under `/api/v1/projects/{project_id}/repo`.
- Dashboard repo section backed by real repo integration data.
- Tests for parsing, intake behavior, and dashboard repo output.
- Documentation for the repo intake design.

The supported GitHub URL formats are:

```text
https://github.com/owner/repo
https://github.com/owner/repo.git
git@github.com:owner/repo.git
```

Supported URLs normalize to:

```text
https://github.com/owner/repo
```

Milestone 3 exclusions:

- GitHub OAuth.
- Private repositories.
- GitHub tokens or GitHub App installation.
- Repository analysis or file tree fetching.
- CodeMap Lite.
- Language detection.
- Webhooks or background jobs.
- Frontend implementation.
- Authentication.

See `docs/milestone-3-github-repo-intake.md`.

### Milestone 4: CodeMap Lite

Milestone 4 added rule-based repository path analysis for attached public GitHub repositories.

What was built:

- `RepoAnalysis` database model.
- Alembic migration for `repo_analyses`.
- Public GitHub tree fetcher.
- CodeMap Lite analyzer for path-based stack and architecture signals.
- Repo Analysis routes under `/api/v1/projects/{project_id}/analyses`.
- Dashboard `latest_repo_analysis` backed by the latest attempted analysis snapshot.
- Tests for analyzer rules, service behavior, route behavior, and dashboard analysis output.
- Documentation for the CodeMap Lite design.

Milestone 4 exclusions:

- AI summaries or OpenAI calls.
- Production readiness scoring.
- Background jobs.
- Frontend pages.
- GitHub OAuth, private repos, GitHub tokens, or webhooks.
- Repository cloning.
- File content fetching.
- Deep static analysis, AST parsing, dependency graph analysis, or language percentage calculation.

See `docs/milestone-4-codemap-lite.md`.

### Milestone 5: Manual Health Monitor

Milestone 5 added on-demand Health Checks for Project URLs.

What was built:

- `HealthCheck` database model.
- Alembic migration for `health_checks`.
- Health Check repository and service using `httpx`.
- Routes under `/api/v1/projects/{project_id}/health-checks`.
- Dashboard `latest_health_check` backed by the latest attempted Health Check.
- Tests for service behavior, route behavior, error handling, and dashboard health output.
- Documentation for the Manual Health Monitor design.

Milestone 5 exclusions:

- Scheduled uptime monitoring.
- Background jobs, Celery/RQ, or Redis.
- Email, SMS, Slack, or other alerts.
- Incident management or status pages.
- Uptime percentage calculations or health trend charts.
- Frontend implementation.
- Readiness scoring.
- Authentication.

See `docs/milestone-5-manual-health-monitor.md`.

### Milestone 12: Manual Health Monitoring Frontend

Milestone 12 connected the Manual Health Monitor backend to the Project detail
frontend.

What was built:

- Project detail Health Monitoring section.
- No-production-URL and ready-to-check states.
- Manual Run Health Check and Run Again controls.
- Optional one-time override URL checks.
- Latest Health Check result display.
- Healthy, unhealthy, timeout, and error status meanings.
- Response time, HTTP status, target URL, response preview, timestamp, and
  error-message display where available.
- Health-check history display.
- SSRF-blocked URL safety messaging.
- Frontend tests and learning notes.

Milestone 12 exclusions:

- Scheduled uptime monitoring.
- Alerts or notifications.
- Uptime percentages, charts, incidents, or status pages.
- Readiness frontend.
- Artifacts frontend.
- Authentication.

See `docs/milestone-12-manual-health-monitoring-frontend.md`.

### Milestone 13: Production Readiness Frontend

Milestone 13 connected the Production Readiness backend to Project detail.

What was built:

- Production Readiness section on Project detail.
- Advisory readiness score, status, counts, and top gaps.
- Checklist rows with source and evidence details.
- Manual review item status and notes editing.
- Automatic item protection in the UI.
- Frontend readiness API helpers, types, tests, and learning notes.

Readiness is advisory. It is not a deployment approval, security audit,
certification, or uptime guarantee.

Milestone 13 exclusions:

- Artifacts frontend.
- Standalone readiness route.
- Readiness history.
- AI-generated recommendations.
- Security scanning or deployment automation.

See `docs/milestone-13-production-readiness-frontend.md`.

### Milestone 15: DataForge Lite Project Artifacts

Milestone 15 added Project Artifacts, a metadata registry for project knowledge and supporting references.

What was built:

- `ProjectArtifact` database model.
- Alembic migration for `project_artifacts`.
- Project-scoped artifact create, list, detail, update, and archive routes.
- Artifact type, source type, and status constraints.
- Active-by-default listing, include-archived support, and type/source filters.
- Project detail Artifacts section with create, edit, archive, filters, empty, loading, and error states.
- Command-center Artifacts summary card, section navigation entry, setup-progress step, and low-priority next action.
- Frontend and backend tests plus learning notes.

Milestone 15 exclusions:

- File uploads or blob storage.
- OCR, PDF parsing, document preview, embeddings, semantic search, or vector databases.
- LLM summarization or AI extraction.
- Malware scanning or background processing.
- Artifact-based readiness scoring.

See `docs/milestone-15-dataforge-lite-artifacts.md`.

### Milestone 16: DataForge Evidence Layer

Milestone 16 strengthened Project Artifacts as a DataForge Lite evidence layer.

Implemented:

- Backend artifact search across title, summary, content, URL, and tags.
- Backend tag filtering with comma-separated `tags` query parameters and any-match semantics.
- Frontend artifact search input, clickable tag chips, result count, clear filters, and no-results state.
- Artifact summary fields on the backend Project dashboard endpoint.
- Readiness artifact evidence link table and link/list/unlink APIs.
- Readiness checklist UI for showing, linking, and unlinking supporting artifacts.
- Clear copy that artifacts are team-supplied supporting evidence, not verified proof.

Still not implemented:

- File upload storage.
- Document parsing, OCR, preview, embeddings, semantic search, or AI extraction.
- Artifact-based automatic readiness passing.
- Standalone artifact knowledge base.

See `docs/milestone-16-dataforge-evidence-layer.md`.

### Milestone 17: Recent Engineering Activity Timeline

Milestone 17 added a Project-scoped activity timeline.

Implemented:

- `project_activity_events` backend table and Alembic migration.
- Constrained activity categories and event types.
- `GET /api/v1/projects/{project_id}/activity` with category, event type, limit, and offset filters.
- Activity recording for Project lifecycle, repository intake, CodeMap results, health-check outcomes, readiness evaluation, manual readiness updates, artifact lifecycle, and readiness evidence links.
- Backend dashboard activity summary with event count and latest event.
- Frontend activity API/types, Recent Activity timeline section, category filter, empty/loading/error/no-results states, and command-center summary card.

Still not implemented:

- Real-time updates, WebSockets, server-sent events, notification inboxes, email/Slack alerts, background workers, user accounts, permissions, comments, AI summaries, or audit-grade logging.
- Historical backfill for Projects created before the activity table existed.

See `docs/milestone-17-recent-engineering-activity.md`.

### Milestone 18: Activity Surfacing and Overview Upgrade

Milestone 18 surfaces recent activity across the app.

Implemented:

- `GET /api/v1/activity` cross-Project activity feed with category, event type, Project, limit, and offset filters.
- Overview metrics backed by real Projects and recent activity.
- Overview Recent Activity Across Projects feed with Project names and links.
- Recently Active Projects section derived from the latest activity window.
- Manual Refresh activity controls on Overview and Project detail.
- Project detail Activity summary card now uses an unfiltered summary source while timeline filters affect only the Activity section list.
- Copy distinguishes recent activity indicators from unread notifications, realtime alerts, and audit-grade logging.

Still not implemented:

- Realtime updates, polling, WebSockets, server-sent events, notification inboxes, user-specific unread state, authentication, permissions, team preferences, AI summaries, or compliance audit logs.

See `docs/milestone-18-activity-surfacing-overview.md`.

### Milestone 19: Deployment Readiness and Production Hardening

Milestone 19 prepares ProjectOps itself for cleaner deployment and demos outside
local development.

Implemented:

- Deployment-aware backend CORS validation.
- `GET /health/db` database reachability endpoint.
- Backend config check helper at `backend/scripts/check_config.py`.
- Frontend production API URL guard for `VITE_API_BASE_URL`.
- Vercel SPA rewrite for `/app/*` deep links.
- Frontend `npm run preview` command for built-output smoke checks.
- Complete root and frontend environment examples.
- Provider-neutral deployment readiness guide, smoke checklist, CI/CD review,
  security footgun review, dogfooding notes, and future hardening checklist.

Still not implemented:

- Authentication, authorization, rate limiting, structured logging, monitoring,
  backups, migration rollback automation, dependency scanning, or CI/CD deploy
  automation.

See `docs/deployment-readiness.md`.

## Project Vocabulary

ProjectOps uses a small domain glossary in `CONTEXT.md`.

Important current terms:

- `Project`: a top-level workspace record for one software project inside ProjectOps.
- `Project Status`: the lifecycle label for a Project.
- `Archived Project`: a Project kept for history but hidden from normal active lists.
- `Project Dashboard`: a command-center view for one Project.
- `Repo Integration`: a connection record between one Project and an external code repository.
- `GitHub Repo Intake`: the workflow that attaches, normalizes, retrieves, or removes a public GitHub repository connection.
- `Repo Analysis`: a stored snapshot of rule-based observations about an attached repository.
- `CodeMap Lite`: the workflow that fetches public GitHub repository paths and turns those paths into a Repo Analysis.
- `Health Check`: a stored result of one manual reachability check against a Project URL.
- `Manual Health Monitor`: the workflow that runs and stores an on-demand Health Check for a Project.
- `Readiness`: an advisory checklist combining available ProjectOps evidence and manual review.
- `Project Artifact`: a Project-scoped metadata record for notes, links, runbooks, decisions, requirements, risks, incidents, or evidence references.
- `DataForge Lite`: the Project Artifact registry and evidence-linking foundation; it does not process uploaded files or perform AI document analysis.
- `Project Activity Event`: a stored Project-scoped product history event for meaningful ProjectOps actions; it is not a realtime notification or audit-grade log.

When adding new features, use those terms consistently in code, tests, and documentation.
