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
- Pytest coverage for health, Project CRUD, archive behavior, and dashboard output.
- Milestone documentation in `docs/`.

Not implemented yet:

- Frontend application.
- Authentication or user ownership.
- GitHub repo intake.
- GitHub OAuth, GitHub Apps, or private repository support.
- Repository analysis, file tree fetching, language detection, or CodeMap Lite.
- User project health checks.
- Production readiness scoring.
- Background jobs, webhooks, or AI summaries.

## Repository Layout

```text
ProjectOps/
  backend/      FastAPI backend
  frontend/     Placeholder for a future frontend
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
```

Deleting a project archives it by setting `status` to `archived`; rows are not hard deleted.

The dashboard endpoint returns real Project metadata plus explicit placeholder sections for future ProjectOps modules.

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

Milestone 3 is planned next. The goal is to let a Project attach one public GitHub repository as connection metadata.

Planned scope:

- `RepoIntegration` database model.
- Alembic migration for `repo_integrations`.
- GitHub repo URL parser.
- Repo intake routes under `/api/v1/projects/{project_id}/repo`.
- Dashboard repo section backed by real repo integration data.
- Tests for parsing, intake behavior, and dashboard repo output.
- Documentation for the repo intake design.

Planned exclusions:

- GitHub OAuth.
- Private repositories.
- GitHub tokens or GitHub App installation.
- Repository analysis or file tree fetching.
- CodeMap Lite.
- Language detection.
- Webhooks or background jobs.
- Frontend implementation.
- Authentication.

## Project Vocabulary

ProjectOps uses a small domain glossary in `CONTEXT.md`.

Important current terms:

- `Project`: a top-level workspace record for one software project inside ProjectOps.
- `Project Status`: the lifecycle label for a Project.
- `Archived Project`: a Project kept for history but hidden from normal active lists.
- `Project Dashboard`: a command-center view for one Project.

When adding new features, use those terms consistently in code, tests, and documentation.
