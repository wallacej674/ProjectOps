# ProjectOps

ProjectOps is a software project command center for understanding, monitoring, and preparing projects for production.

The current backend foundation lets developers create, read, update, list, archive, and view dashboard summaries for project workspace records. It does not include a frontend, authentication, GitHub integration, repo analysis, user project monitoring, readiness scoring, background jobs, or AI features yet.

## Repository Layout

```text
ProjectOps/
  backend/      FastAPI backend
  frontend/     Placeholder for a future frontend
  docs/         Project documentation
  .github/      Placeholder for future GitHub workflows
```

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
- API docs: `http://127.0.0.1:8000/docs`

## Running Tests

Keep the PostgreSQL container running, then run:

```powershell
cd backend
.\.venv\Scripts\python -m pytest
```

The test suite uses the `projectops_test` database created by Docker Compose.

ProjectOps maps PostgreSQL to local port `55432` so it does not collide with another PostgreSQL server already using the default `5432` port.

## Milestone 1 API

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
