# Milestone 15: DataForge Lite Project Artifacts

Milestone 15 adds DataForge Lite, a Project-scoped artifact registry for notes,
links, runbooks, decisions, requirements, risks, incidents, and evidence
references.

This milestone stores artifact metadata only. It does not upload, parse,
preview, summarize, embed, or analyze document files.

## What Was Built

- `ProjectArtifact` backend model backed by the `project_artifacts` table.
- Alembic migration `0006_create_project_artifacts`.
- Pydantic schemas for artifact create, update, and read responses.
- Project-scoped artifact repository and service.
- Artifact API routes under `/api/v1/projects/{project_id}/artifacts`.
- Archive-on-delete behavior for artifacts.
- Active-by-default listing with `include_archived=true` support.
- Type and source filters on the list endpoint.
- Frontend artifact types and API helpers.
- Project detail Artifacts section with loading, empty, error, list, create,
  edit, archive, include-archived, and filter states.
- Command-center Artifacts summary card, section navigation entry, setup step,
  and low-priority recommended next action.

## Artifact Model

`ProjectArtifact` stores:

- `project_id`: owning Project.
- `title`: required short name.
- `artifact_type`: `note`, `document`, `link`, `runbook`, `decision`,
  `incident`, `requirement`, `risk`, `evidence`, or `other`.
- `source_type`: `manual`, `external_url`, `imported`, or `system`.
- `url`: optional HTTP or HTTPS reference.
- `summary`: optional short description.
- `content`: optional note body.
- `tags`: optional comma-separated text.
- `status`: `active` or `archived`.
- `created_at` and `updated_at` timestamps.

`tags` is intentionally a simple string in DataForge Lite. A future DataForge
phase can replace or supplement it with structured tagging if product needs
justify that complexity.

## API Routes

```text
POST   /api/v1/projects/{project_id}/artifacts
GET    /api/v1/projects/{project_id}/artifacts
GET    /api/v1/projects/{project_id}/artifacts/{artifact_id}
PATCH  /api/v1/projects/{project_id}/artifacts/{artifact_id}
DELETE /api/v1/projects/{project_id}/artifacts/{artifact_id}
```

List query parameters:

- `include_archived=true`: include archived records.
- `artifact_type=runbook`: filter by artifact type.
- `source_type=external_url`: filter by source type.

Every artifact route is scoped to one Project. An artifact requested through the
wrong Project returns `404`.

`DELETE` archives the artifact by setting `status` to `archived`; it does not
hard delete the row.

## Frontend Behavior

The Artifacts section lives on Project detail after Production Readiness and
before Project Details.

Users can:

- See an empty state when no active artifacts exist.
- Create an artifact.
- View artifact title, type, source, status, URL, summary/content preview,
  tags, updated date, and artifact ID.
- Edit artifact metadata.
- Archive an artifact through a confirmation dialog.
- Include archived artifacts.
- Filter visible artifacts by type or source.

The section copy says ProjectOps stores metadata and references only. It does
not claim AI document analysis, document completeness, security verification, or
readiness approval.

## Command Center Integration

The Project command center now includes an Artifacts summary card.

The card shows:

- No artifacts when no active artifact exists.
- Active artifact count when records exist.
- Archived count when archived records are included in loaded state.
- Most recent artifact title and updated date when available.

Recommended next actions include `Add a project note or runbook.` only at low
priority after repository, CodeMap, production URL, health, and readiness work.

The frontend still derives command-center state from resources loaded by
`ProjectDetailPage`. The backend dashboard endpoint does not include artifact
summary fields yet.

## Local Testing

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m pytest tests\test_project_artifacts.py
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m compileall app tests
```

Frontend:

```powershell
cd frontend
npm test -- projectArtifacts.test.ts
npm test -- ProjectDetailArtifacts.test.tsx
npm test -- projectCommandCenter.test.ts
npm test -- ProjectDetailCommandCenter.test.tsx
npm test
npm run lint
npm run build
```

Repository root:

```powershell
git diff --check
```

## Manual Verification

1. Open a Project detail page.
2. Confirm the Artifacts section appears.
3. Confirm the empty state appears when no active artifacts exist.
4. Create a note artifact.
5. Create an external URL artifact.
6. Confirm artifacts appear in the list.
7. Confirm the artifact count appears in the command-center summary.
8. Filter by artifact type.
9. Filter by source type.
10. Edit an artifact.
11. Archive an artifact.
12. Confirm it leaves the default active list.
13. Enable include archived and confirm archived records appear.
14. Confirm Repository, CodeMap, Health, Readiness, and Project Details still
    render.
15. Confirm dark and light themes remain usable.
16. Confirm desktop, tablet, and mobile layouts do not horizontally overflow.

## Accessibility Notes

- The Artifacts section is a named region.
- Form inputs have labels.
- URL helper text is associated with the URL input.
- Client validation errors are associated with invalid fields.
- Backend save errors use `role="alert"`.
- Archive confirmation uses a modal dialog with focus trapping.
- Artifact status is visible as text, not color alone.
- Long URLs and long content wrap inside their containers.

This is an accessibility review, not a WCAG certification.

## Known Limitations

- No file upload or storage.
- No document preview.
- No OCR or PDF parsing.
- No embeddings, semantic search, vector database, or full-text indexing.
- No LLM summarization or AI extraction.
- No malware scanning.
- No background processing.
- No artifact-based readiness scoring.
- Artifact tags are a simple comma-separated string.
- The backend dashboard endpoint does not include artifact summary fields.

## Future Milestone 16 Boundary

A future milestone can build on this registry with one narrow DataForge
capability at a time, such as structured tags, richer artifact search, file
attachment design, or artifact-readiness evidence mapping.

It should not jump directly to full document intelligence without explicit
storage, security, parsing, and review boundaries.
