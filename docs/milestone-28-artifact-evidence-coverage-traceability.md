# Milestone 28: Artifact Evidence Coverage and Traceability

Milestone 28 makes existing DataForge Lite evidence links easier to inspect
across Production Readiness, Project Artifacts, Launch Report, and Guided
Launch Checklist.

## Goal

ProjectOps already lets users link Project Artifacts to readiness checklist
items. This milestone adds a project-level evidence coverage view so users can
see which artifacts are linked, which active artifacts are not currently used
as readiness evidence, and which evaluated readiness items have supporting
artifact references.

Evidence coverage remains advisory visibility. ProjectOps does not verify
artifact contents, certify readiness, approve launch safety, or automatically
pass readiness items because an artifact is linked.

## Backend Changes

- Added `GET /api/v1/projects/{project_id}/readiness/evidence-coverage`.
- The endpoint returns active artifact counts, linked/unlinked active artifact
  counts, readiness item coverage counts, total evidence links, artifact usage
  rows, and readiness item coverage rows.
- The endpoint uses existing Project ownership checks and existing
  `project_readiness_artifact_evidence` links.
- No database tables, migrations, or dependencies were added.
- Launch Report evidence summary now includes linked/unlinked artifact coverage
  counts and readiness item evidence coverage counts.
- Guided Launch Checklist now includes a `Supporting evidence linked` item:
  `done` when evidence links exist, `needs_attention` when active artifacts
  exist but none are linked, and `todo` when no active artifacts exist.

## Frontend Changes

- Project detail now loads project-level readiness evidence coverage through one
  coverage request instead of per-readiness-item artifact-list requests.
- Production Readiness shows a compact Evidence Coverage summary.
- Readiness checklist rows still allow linking and unlinking artifacts as
  supporting evidence.
- Project Artifacts now shows artifact-side usage labels such as
  `Supports 1 readiness item: Deployment Docs Reviewed` or
  `Not currently linked to readiness evidence.`
- Project Artifacts includes an Evidence Usage filter for all, linked, and
  unlinked artifact records.
- Launch Report and Guided Launch Checklist display the new coverage signals.

## Tests

Backend tests cover:

- evidence coverage auth and Project ownership
- empty coverage
- active linked/unlinked artifact counts
- archived artifacts remaining traceable without inflating active counts
- readiness item coverage counts
- Launch Report evidence summary coverage fields
- Guided Launch Checklist supporting-evidence status rules

Frontend tests cover:

- evidence coverage API helper
- Production Readiness coverage summary
- artifact usage labels
- artifact evidence usage filtering
- Launch Report coverage fields
- Guided Launch Checklist supporting-evidence item
- link/unlink behavior without automatically passing readiness items

## Verification

The implementation was verified with:

- backend migrations at head
- backend pytest suite
- backend compile check
- backend config check
- backend dependency audit
- frontend test suite
- frontend lint
- frontend production build
- frontend dependency audit
- `git diff --check`
- browser smoke test against the local app

The browser smoke test created a Project, created an artifact, ran readiness,
linked the artifact as supporting readiness evidence, used the Evidence Usage
filter, and confirmed the Evidence Coverage summary, Project Artifacts usage
label, Launch Report coverage fields, and Guided Launch Checklist supporting
evidence item rendered without browser console errors.

## Known Limits

- Artifact contents are not uploaded, parsed, previewed, embedded, summarized,
  scored, or verified.
- Linked evidence remains a team-supplied supporting reference.
- Coverage counts do not prove evidence quality or sufficiency.
- There is still no standalone Artifacts route, pagination, export packet, or
  compliance-grade launch sign-off.
