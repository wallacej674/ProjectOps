# Milestone 1: Backend Foundation

Milestone 1 establishes the backend foundation for ProjectOps with a narrow, production-minded slice: project CRUD plus archive behavior.

## What Was Built

- A FastAPI backend application.
- A health endpoint for the ProjectOps backend itself.
- PostgreSQL connection setup through synchronous SQLAlchemy.
- Alembic migration setup.
- A `Project` model with basic lifecycle status values.
- Pydantic schemas for create, update, and read operations.
- Project CRUD routes under `/api/v1/projects`.
- Archive behavior for delete requests.
- Docker Compose for local PostgreSQL.
- Pytest coverage for health and Project CRUD behavior.

## Why The Backend Is Structured This Way

The backend uses a small route, service, repository structure.

Routes handle HTTP details such as paths, status codes, query parameters, and 404 responses.

Services hold business behavior. In this milestone, the important business rule is that deleting a Project archives it instead of hard deleting it.

Repositories hold database access. Keeping SQLAlchemy queries here makes route handlers easier to read and gives future business logic one stable place to call into persistence.

Models define database tables. Schemas define API input and output. Keeping those separate avoids mixing storage details with API contracts.

## Project Model

The first Project model is intentionally small:

- `id`
- `name`
- `description`
- `repo_url`
- `production_url`
- `status`
- `created_at`
- `updated_at`

Allowed status values:

- `planning`
- `development`
- `staging`
- `production`
- `paused`
- `archived`

## What Is Not Included Yet

Milestone 1 does not include frontend code, authentication, GitHub integration, code analysis, user project health monitoring, readiness scoring, background jobs, or AI features.

## Known Limitations

- URL fields are plain strings for now.
- There is no user ownership model yet.
- There is no pagination yet.
- Tests require a local PostgreSQL database.
- Archiving tracks the change through `updated_at`; there is no dedicated `archived_at` field yet.
