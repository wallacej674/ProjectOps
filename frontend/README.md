# ProjectOps Frontend

This directory is a placeholder for the future ProjectOps frontend.

ProjectOps is currently backend-first. The implemented work lives in the FastAPI backend, where Projects can be created, read, updated, listed, archived, and summarized through the Project Dashboard API.

## Current Frontend Status

No frontend application has been implemented yet.

This is intentional. The early milestones are defining the backend data model and API shape before adding screens.

## Implemented Backend Milestones

### Milestone 1: Backend Foundation

The backend foundation includes:

- FastAPI.
- PostgreSQL through Docker Compose.
- Synchronous SQLAlchemy.
- Alembic migrations.
- Project model.
- Project CRUD routes.
- Archive-on-delete behavior.
- Health endpoint.
- Backend tests.
- Documentation.

### Milestone 2: Project Dashboard API

The dashboard endpoint is implemented at:

```text
GET /api/v1/projects/{project_id}/dashboard
```

It returns real Project metadata plus placeholder sections for future repo, repo analysis, health check, readiness, and next-step data.

### Milestone 3: GitHub Repo Intake

The backend now supports GitHub Repo Intake:

```text
POST   /api/v1/projects/{project_id}/repo
GET    /api/v1/projects/{project_id}/repo
DELETE /api/v1/projects/{project_id}/repo
```

A Project can attach, read, replace, and remove one public GitHub repository connection. The dashboard repo section now reflects that connection when present.

### Milestone 4: CodeMap Lite

The backend now supports CodeMap Lite:

```text
POST /api/v1/projects/{project_id}/analyses/run
GET  /api/v1/projects/{project_id}/analyses/latest
GET  /api/v1/projects/{project_id}/analyses
```

CodeMap Lite fetches public GitHub repository paths for an attached repo, detects simple rule-based stack and architecture signals, stores Repo Analysis snapshots, and exposes the latest attempted analysis on the Project Dashboard API.

## Planned Frontend Direction

The first frontend should likely focus on the Project command-center workflow:

- List Projects.
- Create and update a Project.
- View one Project Dashboard.
- Attach or remove a GitHub repository connection.
- Run CodeMap Lite analysis and show latest Repo Analysis output.
- Show health and readiness sections as backend milestones fill them in.

GitHub Repo Intake and CodeMap Lite are backend-only for now. A future frontend can add screens on top of the implemented repo and analysis routes.

## Not Implemented Yet

- Frontend framework setup.
- Project list page.
- Project Dashboard page.
- Authentication.
- GitHub connection UI.
- Repo analysis UI.
- Health check UI.
- Readiness scoring UI.
- AI summary UI.
