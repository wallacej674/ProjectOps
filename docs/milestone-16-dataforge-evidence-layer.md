# Milestone 16: DataForge Evidence Layer

Milestone 16 strengthens Project Artifacts as a searchable DataForge Lite
evidence layer.

Artifacts remain user-provided metadata and references. ProjectOps does not
upload, parse, preview, summarize, embed, semantically search, or verify
artifact contents in this milestone.

## What Was Built

- Backend artifact search across title, summary, content, URL, and tags.
- Backend tag filtering with comma-separated `tags` query parameters.
- Artifact filters compose with type, source, and include-archived filters.
- Backend Project dashboard artifact summary.
- Readiness artifact evidence join table.
- Link/list/unlink APIs for artifacts supporting readiness items.
- Frontend artifact search input, result count, tag chip filters, clear filters,
  and no-results state.
- Frontend readiness checklist supporting-artifact rows and link/unlink
  controls.
- Command-center next action for linking artifacts to readiness evidence when
  active artifacts exist and manual readiness review still needs attention.

## Artifact Search

The artifact list endpoint supports:

```text
GET /api/v1/projects/{project_id}/artifacts?search=deployment
```

Search is case-insensitive and scans:

- `title`
- `summary`
- `content`
- `url`
- `tags`

Search scans stored artifact metadata and text fields only. It does not scan
uploaded documents because DataForge Lite does not support file uploads or
document parsing yet.

## Tag Filtering

Tags remain a comma-separated text field in the database.

The list endpoint supports:

```text
GET /api/v1/projects/{project_id}/artifacts?tags=runbook,deployment
```

Tag filtering uses any-match semantics: an artifact is returned when at least
one requested tag matches one stored tag token. Matching trims whitespace and is
case-insensitive.

This pragmatic approach avoids a tag-table migration while preserving a future
path to structured tags if product needs justify it.

## Dashboard Artifact Summary

The Project dashboard endpoint now includes:

```json
{
  "artifacts": {
    "active_count": 2,
    "archived_count": 1,
    "total_count": 3,
    "latest_artifact": {
      "id": 12,
      "title": "Deployment runbook",
      "artifact_type": "runbook",
      "source_type": "external_url",
      "updated_at": "2026-01-02T00:00:00Z"
    }
  }
}
```

`latest_artifact` chooses the most recently updated active artifact. Archived
artifacts still count toward `archived_count` and `total_count`, but they do not
override the latest active artifact.

## Readiness Artifact Evidence

Milestone 16 adds a relational link table:

```text
project_readiness_artifact_evidence
- id
- project_id
- readiness_item_id
- artifact_id
- created_at
```

The uniqueness constraint is:

```text
project_id + readiness_item_id + artifact_id
```

This lets one readiness item have many supporting artifacts while preventing
duplicates.

## Evidence APIs

```text
POST   /api/v1/projects/{project_id}/readiness/items/{item_key}/artifacts
GET    /api/v1/projects/{project_id}/readiness/items/{item_key}/artifacts
DELETE /api/v1/projects/{project_id}/readiness/items/{item_key}/artifacts/{artifact_id}
```

POST body:

```json
{
  "artifact_id": 12
}
```

Behavior:

- Project must exist.
- Readiness item key must exist.
- Artifact must belong to the same Project.
- Duplicate links return `409` with a clear error message.
- Unlinking removes only the evidence link; it does not delete or archive the
  artifact.
- Archived artifacts remain linked and display with archived status.

Linked artifacts provide supporting evidence for a readiness item. They do not
automatically mark the item passed.

## Frontend Behavior

Project Artifacts now include:

- Search input with explanatory helper text.
- Type and source filters.
- Clickable tag chips.
- Include archived toggle.
- Result count.
- Filters-active indicator.
- Clear filters button.
- Filter-aware no-results state.

Production Readiness checklist rows now include:

- Supporting artifact copy.
- Linked artifact rows with title, type, source, and active/archived status.
- Select control for linking an existing active artifact.
- Unlink control for removing evidence links.
- Error display for duplicate/backend link failures.

Copy states that linked artifacts are references supplied by the team and that
ProjectOps does not verify artifact contents in DataForge Lite.

## Local Testing

Backend:

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m pytest tests\test_project_artifacts.py
.\.venv\Scripts\python.exe -m pytest tests\test_project_dashboard.py
.\.venv\Scripts\python.exe -m pytest tests\test_readiness_artifact_evidence.py
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m compileall app tests
```

Frontend:

```powershell
cd frontend
npm test -- projectArtifacts.test.ts
npm test -- ProjectDetailArtifacts.test.tsx
npm test -- projectReadinessArtifacts.test.ts
npm test -- ProjectDetailReadiness.test.tsx
npm test -- projectCommandCenter.test.ts
npm test
npm run lint
npm run build
```

Repository root:

```powershell
git diff --check
```

## Manual Verification

1. Open a Project with several artifacts.
2. Search by title, summary, content, URL, and tag.
3. Filter by artifact type.
4. Filter by source type.
5. Combine search, tag, type, and source filters.
6. Clear filters.
7. Include archived artifacts.
8. Confirm no-results copy appears for filter misses.
9. Create an artifact and confirm it appears after reload.
10. Edit tags and confirm chips update.
11. Archive an artifact and confirm counts/filtering update.
12. Confirm the command-center artifact summary remains accurate.
13. Confirm `GET /api/v1/projects/{project_id}/dashboard` returns artifact
    summary.
14. Evaluate readiness.
15. Link an artifact to a readiness checklist item.
16. Confirm linked artifact displays as supporting evidence.
17. Confirm linked artifact does not automatically mark the item passed.
18. Unlink artifact evidence.
19. Confirm Repository, CodeMap, Health, Readiness, and Project metadata still
    work.
20. Confirm dark and light themes remain usable.
21. Review desktop, tablet, and mobile layouts.

## Accessibility Notes

- Search input and filter selects have explicit labels.
- Result count uses `aria-live`.
- Tag chips are buttons with pressed state.
- Clear filters is a named button.
- Link/unlink controls are keyboard-operable buttons/selects.
- Backend link errors render with `role="alert"`.
- Artifact status is visible as text, not color alone.
- Long URLs and artifact titles wrap inside their containers.

This is an accessibility review, not a WCAG certification.

## Known Limitations

- No file upload or storage.
- No document preview.
- No OCR or PDF parsing.
- No embeddings, semantic search, vector database, or full-text indexing.
- No LLM summarization or AI extraction.
- No malware scanning.
- No background processing.
- No artifact comments or sharing.
- No standalone Artifacts route.
- No artifact pagination.
- Tags are still a comma-separated string.
- Evidence links do not affect readiness scoring automatically.

## Future Milestone 17 Boundary

A future milestone can choose one narrow DataForge step, such as:

- File attachment design without parsing.
- Structured tags.
- Bulk readiness evidence endpoint.
- Artifact detail drawer.
- Artifact pagination.

It should not jump directly to document intelligence without explicit storage,
security, parsing, scanning, and review boundaries.
