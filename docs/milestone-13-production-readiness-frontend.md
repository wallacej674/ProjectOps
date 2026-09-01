# Milestone 13: Production Readiness Frontend

> Historical milestone record. Scope and exclusions describe this milestone at delivery; see `projectops-remaining-work-handoff.md` for current capabilities.

Milestone 13 connects the existing Production Readiness backend to Project
detail. Readiness is an advisory checklist based on available ProjectOps
evidence. It does not certify that a project is safe for production.

## What Was Built

- Project detail Production Readiness section.
- Readiness API client helpers for evaluate, fetch, and manual item update.
- TypeScript readiness types based on the backend schema.
- Backend response metadata for each readiness assessment's catalog item.
- Not-started, loading, pending, result, and error states.
- Advisory score, status, counts, progress bar, and top gaps.
- Checklist item display with label, description, status, category, source, and
  evidence text.
- Missing-evidence helper copy.
- Manual review item editor for manual catalog items only.
- Automatic item protection in the UI.
- Frontend tests for API behavior and Project detail readiness behavior.

## Backend Contract Used

```text
POST  /api/v1/projects/{project_id}/readiness/evaluate
GET   /api/v1/projects/{project_id}/readiness
PATCH /api/v1/projects/{project_id}/readiness/items/{item_key}
```

The frontend expects each `ProjectReadinessItem` to include the nested catalog
`item` metadata: key, label, description, category, evaluation type, sort order,
and active flag. This lets the UI render a stable checklist and only show editor
controls for manual items.

## UI Behavior

Before evaluation, the card explains the evidence sources and advisory
boundary. Users can run readiness evaluation without first running CodeMap Lite
or a health check; missing evidence appears as backend-provided failed or
unknown items.

After evaluation, the card shows:

- Advisory score and backend status.
- Passed, failed, unknown, and not-applicable counts.
- Top gaps returned by the backend.
- Checklist rows with evidence/source details.
- Manual review controls for manual items.

Manual item saves call the backend patch route with `{ status, notes }`. The
returned item replaces the matching row in the current readiness summary.
Automatic items do not show manual controls.

## Evidence Boundaries

- `project` source: Project metadata, such as production URL.
- `codemap` source: latest completed CodeMap Lite analysis.
- `health_check` source: latest manual health check.
- `manual` source: human review item with optional notes.

Readiness does not run CodeMap Lite, run health checks, inspect source files,
perform security scanning, or generate AI recommendations.

## Local Testing

```powershell
cd frontend
npm test -- projectReadiness.test.ts
npm test -- ProjectDetailReadiness.test.tsx
npm test
npm run lint
npm run build
```

Backend regression:

```powershell
cd backend
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe -m pytest
.\.venv\Scripts\python.exe -m compileall app tests
```

## Manual Verification

1. Open a Project detail page.
2. Confirm Project metadata, Repository Connection, CodeMap Lite, and Health
   Monitoring still load.
3. Confirm Production Readiness explains it is advisory.
4. Run readiness evaluation and confirm the button disables while pending.
5. Confirm score, status, counts, top gaps, and checklist display.
6. Confirm missing evidence is understandable.
7. Update a manual item and confirm status/notes update.
8. Confirm automatic items do not expose save controls.
9. Confirm no copy claims certification, deployment approval, security
   verification, or guaranteed production safety.
10. Review dark/light mode and desktop/tablet/mobile layouts.

## Known Limitations

- Manual item saves update the item row locally but do not recalculate summary
  counts until readiness is re-evaluated or reloaded from the backend.
- There is no readiness history route or frontend history view.
- Top gaps are backend-provided labels, not generated recommendations.
- There is no standalone Readiness route yet; the real UI lives inside Project
  detail.

## Future Milestone 14 Boundary

Milestone 14 can consider richer dashboard placement, readiness history,
additional item catalog metadata, or project-scoped navigation. It should not
blur readiness into certification, deployment automation, security scanning, or
scheduled monitoring.
