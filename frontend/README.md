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

## Planned Frontend Direction

The first frontend should likely focus on the Project command-center workflow:

- List Projects.
- Create and update a Project.
- View one Project Dashboard.
- Show repo, analysis, health, and readiness sections as backend milestones fill them in.

Milestone 3 is still backend work. It is planned to add GitHub repo intake before any frontend screens are built.

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
