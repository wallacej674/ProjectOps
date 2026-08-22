# Milestone 27: Launch Decision Attribution and Backend Integrity

Milestone 27 makes the backend authoritative for Project Artifact creator
attribution and Launch Decision semantic validation.

## Goal

Launch Decisions remain normal Project Artifacts, but the backend now protects
the contract that makes them credible:

- new Project Artifacts store authenticated recorder attribution when available
- Launch Decision artifacts are validated on create
- Launch Decision artifacts are validated against the effective state after
  PATCH
- historical artifacts without creator attribution remain valid

Launch Decisions are still lightweight human records. They are not approvals,
certifications, immutable sign-offs, role-based authorizations, or audit-grade
records.

## Backend Changes

Project Artifacts now include nullable creator attribution:

- `created_by_user_id`
- `created_by_user`

The creator is derived from the authenticated backend user in the Project
Artifacts route. It is not accepted from create or update request payloads, and
PATCH does not expose a mutation path for attribution.

The backend treats artifacts with both `launch-decision` and `go-no-go` tags as
Launch Decisions. Those artifacts must use:

- `artifact_type=decision`
- `source_type=manual`
- exactly one decision tag: `go`, `no-go`, or `defer`

No-go and Defer records require nonblank `summary` notes. Go records allow
optional notes.

## Frontend Changes

The Launch Decision card now shows:

- `Recorded by <display name>` when a creator display name exists
- `Recorded by <email>` when only email is available
- `Recorder unavailable for this historical record.` for historical records
  without attribution

The UI continues to use human-recorded language and avoids approval,
authorization, certification, and signing claims.

## Database Changes

Alembic revision `0010_artifact_creator` adds nullable
`project_artifacts.created_by_user_id` with an index and foreign key to
`users.id`.

The column is nullable to preserve existing historical artifacts. No historical
backfill is performed because ProjectOps did not previously store trustworthy
artifact creator data.

## Tests

Backend tests cover:

- artifact creator attribution on create
- client-supplied creator fields being ignored
- historical artifacts without creator attribution
- creator attribution remaining unchanged on PATCH
- generic decision artifacts remaining valid
- valid Go/No-go/Defer Launch Decisions
- malformed Launch Decision create requests
- PATCH validation against effective Launch Decision state
- normal artifact-to-valid-Launch-Decision transition

Frontend tests cover:

- recorder attribution display for known creators
- historical recorder fallback display
- existing Launch Decision history, notes, pending, and error states
- artifact API fixtures with nullable creator attribution

## Verification Notes

Backend:

- `alembic upgrade head`: passed
- `pytest`: 240 passed, 1 existing Starlette/httpx TestClient deprecation
  warning
- `compileall app tests`: passed
- `scripts/check_config.py`: passed
- `pip-audit`: no known vulnerabilities found; local package skipped because it
  is not on PyPI

Frontend:

- focused Launch Decision/artifact tests: 41 passed
- `npm test`: 249 passed
- `npm run lint`: passed with 3 existing Fast Refresh warnings in auth files
- `npm run build`: passed
- `npm run audit`: 0 vulnerabilities
