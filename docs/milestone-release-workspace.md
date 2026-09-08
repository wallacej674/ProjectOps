# Release Readiness: initial workspace

Implemented 2026-09-07. This checkpoint covers the first manual Release Brief and requirement journey. It does not complete the evidence-assessment engine or the AI workflow catalog.

## Using it

Open a Project and select **Release Readiness**. Create a named release, save and confirm its brief, add a requirement with an observable criterion and verification method, and confirm that saved requirement. Select a Project Artifact to preserve a supporting snapshot. Once an active release exists, opening the Project without an explicit view defaults to it. Existing view links and the legacy Launch link remain supported.

This works with local PostgreSQL, FastAPI, and React. No deployment or AI configuration is required for this milestone.

## Contracts and boundaries

- A Project has at most one active Release, enforced by a partial unique index. Creating a release makes it active. Archiving retains history and prevents changes; restoration is not implemented.
- Brief content includes stage, intended users, critical journey, data handled, unacceptable failure outcomes, constraints, and exclusions. Content changes append a revision. Confirmation records the actor and time separately.
- Requirements bind to a confirmed brief revision. Each has a criterion, verification method, consequence, applicability, and an explanation when excluded. Revisions begin as proposals and require confirmation. A changed brief marks existing requirements for review.
- Confirmation records agreed intent. Every requirement remains `not_verified`, including excluded requirements and those with supporting material. There is no release-readiness score or automatic pass.
- Supporting material freezes artifact text, URL, metadata, timestamp, and a SHA-256 digest. Changing the original produces a source-changed indicator; it does not rewrite the snapshot. URL snapshots preserve references, not fetched page contents. Snapshot limit: 32 KiB; up to 100 per requirement across revisions. Exact duplicate attachments are reused.
- All endpoints are scoped through an owned Project and Release. Mutations lock the Project row and require the current record version. Stale writes return 409. Reloading changed records retains local form edits and requires an explicit keep/discard choice before resubmission.
- List and history endpoints are paginated, default 25 and maximum 100 records. History preserves saved content and confirmation metadata; retired-requirement operations are deferred.

The API is under `/api/v1/projects/{project_id}/releases`. Modules are split into `models/releases.py`, `schemas/releases.py`, `repositories/releases.py`, `services/releases.py`, and `api/releases.py`. The UI starts at `ReleaseReadinessPanel.tsx`. Additive migration `0017_release_workspace` introduces five tables and preserves existing project-level readiness and Code Risk Review data.

## Executable fixture and verification

`backend/tests/test_releases.py` defines a private document-sharing beta: ten invited testers, upload/search as the critical journey, cross-user access as an unacceptable failure, and a two-account isolation requirement. It exercises the create/confirm/revise journey, ownership, archive rules, stale versions, and frozen material that never implies verification. The migration integration test checks the full chain in an isolated schema.

Frontend tests cover brief creation/confirmation, confirmation history refresh, default navigation and preserved deep links, and retaining/reconciling unsaved brief and requirement drafts across changed server revisions.

Verification: 358 backend tests and 332 frontend tests passed. Focused release/migration checks passed again after review fixes. The frontend production build succeeded; lint reported no errors and five existing Fast Refresh warnings. The build retains its existing large-bundle warning. Local PostgreSQL was upgraded to `0017_release_workspace`. No live AI request or deployment was performed.

## Next increment

Define attributed, snapshot-scoped evidence records and deterministic assessment states before adding AI interpretation. Then implement the bounded gap review, ranked next steps, context export, and reviewed result import from the approved plan. Repository/scan evidence adapters, automated verification, workflow workers, model evaluation, and release-specific AI calls are not part of this checkpoint.
