# ProjectOps

ProjectOps is a software project command center for understanding, monitoring, and preparing projects for production.

The current backend lets developers create, read, update, list, archive, and view dashboard summaries for Project workspace records. It is intentionally backend-first: ProjectOps is building the command-center data model before adding frontend screens, repository analysis, health monitoring, readiness scoring, or AI features.

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
- Pytest coverage for health, Project CRUD, archive behavior, dashboard output, repo intake, CodeMap Lite, and Manual Health Monitor behavior.
- React + TypeScript frontend: marketing landing page and a Project Registry that creates, reads, updates, lists, archives, sorts, and searches Projects against the Project API (see `frontend/README.md`).
- Milestone documentation in `docs/`.

Not implemented yet:

- Frontend screens for GitHub repo intake, repository analysis, health monitoring, or readiness (backend-only for now; surfaced in the UI as labeled future-state previews).
- Authentication or user ownership.
- GitHub OAuth, GitHub Apps, or private repository support.
- Deep repository analysis, file content fetching, language detection, or AST parsing.
- User project health checks.
- Production readiness scoring.
- Scheduled monitoring, background jobs, webhooks, alerts, or AI summaries.

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
npm run lint
```

Only the Project Registry (`/api/v1/projects`) is wired to the backend. GitHub
repo intake, repository analysis, health monitoring, and readiness are surfaced
as clearly labeled future-state previews. See `frontend/README.md` for the route
map, architecture, theme/navigation/sorting behavior, and known limitations.

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

Start the backend:

```powershell
.\.venv\Scripts\python -m uvicorn app.main:app --reload
```

Useful local URLs:

- Health endpoint: `http://127.0.0.1:8000/health`
- Project API: `http://127.0.0.1:8000/api/v1/projects`
- API docs: `http://127.0.0.1:8000/docs`

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
POST   /api/v1/projects
GET    /api/v1/projects
GET    /api/v1/projects/{project_id}
PATCH  /api/v1/projects/{project_id}
DELETE /api/v1/projects/{project_id}
GET    /api/v1/projects/{project_id}/dashboard
POST   /api/v1/projects/{project_id}/repo
GET    /api/v1/projects/{project_id}/repo
DELETE /api/v1/projects/{project_id}/repo
POST   /api/v1/projects/{project_id}/analyses/run
GET    /api/v1/projects/{project_id}/analyses/latest
GET    /api/v1/projects/{project_id}/analyses
POST   /api/v1/projects/{project_id}/health-checks/run
GET    /api/v1/projects/{project_id}/health-checks/latest
GET    /api/v1/projects/{project_id}/health-checks
```

Deleting a project archives it by setting `status` to `archived`; rows are not hard deleted.

The dashboard endpoint returns real Project metadata, real Repo Integration data when a repo is attached, and explicit placeholder sections for future ProjectOps modules.
The dashboard also returns the latest attempted Repo Analysis when CodeMap Lite has run.
The dashboard also returns the latest attempted Health Check when Manual Health Monitor has run.

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

When adding new features, use those terms consistently in code, tests, and documentation.
